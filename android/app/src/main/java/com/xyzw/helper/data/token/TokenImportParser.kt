package com.xyzw.helper.data.token

import com.xyzw.helper.data.model.ImportedGameToken
import com.xyzw.helper.data.model.TokenImportSource
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.security.MessageDigest
import java.time.Instant
import java.util.Base64

private val tokenJson = Json {
  ignoreUnknownKeys = true
  explicitNulls = false
  isLenient = true
}

object TokenImportParser {
  fun parseManualToken(
    rawToken: String,
    source: TokenImportSource,
    sourceUrl: String? = null,
  ): ImportedGameToken {
    val normalized = rawToken.trim()
    require(normalized.isNotBlank()) {
      "令牌不能为空"
    }

    val payload = decodeTokenPayload(normalized)
    val roleId = firstNonBlank(
      directValue(payload, "roleId"),
      directValue(payload, "gameAccountId"),
      directValue(payload, "activationRoleId"),
      directValue(payload, "activationGameAccountId"),
      findAnyId(payload),
    )
    val roleName = firstNonBlank(
      directValue(payload, "activationRoleName"),
      directValue(payload, "roleName"),
      directValue(payload, "name"),
      if (roleId.isBlank()) "" else "角色 $roleId",
      "未命名令牌",
    )
    val region = firstNonBlank(
      directValue(payload, "activationRegion"),
      directValue(payload, "region"),
      directValue(payload, "server"),
    )
    val sessId = firstNonBlank(
      directValue(payload, "activationSessId"),
      directValue(payload, "sessId"),
      directValue(payload, "sessid"),
      directValue(payload, "sessionId"),
    )
    val roleIndex = firstNonBlank(
      directValue(payload, "roleIndex"),
      directValue(payload, "role_index"),
    )
    val tokenId = buildStableTokenId(normalized, roleId)
    val now = Instant.now().toString()

    return ImportedGameToken(
      id = tokenId,
      rawToken = normalized,
      displayName = roleName,
      roleId = roleId,
      sessId = sessId,
      region = region,
      roleName = roleName,
      roleIndex = roleIndex,
      source = source,
      sourceUrl = sourceUrl,
      importedAt = now,
      updatedAt = now,
    )
  }

  fun parseProxyPayload(
    payload: JsonElement,
    sourceUrl: String,
  ): List<ImportedGameToken> {
    val tokens = extractTokenCandidates(payload)
      .filter { it.isNotBlank() && !it.contains("***") }
      .distinct()

    require(tokens.isNotEmpty()) {
      "响应中缺少完整 token 字段"
    }

    return tokens.map { token ->
      parseManualToken(
        rawToken = token,
        source = TokenImportSource.URL,
        sourceUrl = sourceUrl,
      )
    }
  }

  private fun buildStableTokenId(rawToken: String, roleId: String): String {
    val candidate = roleId.trim()
    if (candidate.matches(Regex("^[A-Za-z0-9_-]{1,128}$"))) {
      return candidate
    }
    return MessageDigest.getInstance("MD5")
      .digest(rawToken.toByteArray())
      .joinToString("") { "%02x".format(it) }
  }

  private fun decodeTokenPayload(rawToken: String): JsonObject {
    val direct = parseJsonObject(rawToken)
    if (direct != null) {
      return direct
    }

    val stripped = rawToken.substringAfter("base64,", rawToken).trim()
    if (stripped.isBlank()) {
      return JsonObject(emptyMap())
    }

    val decoded = runCatching {
      String(Base64.getDecoder().decode(stripped))
    }.getOrNull()

    return decoded?.let(::parseJsonObject) ?: JsonObject(emptyMap())
  }

  private fun parseJsonObject(value: String): JsonObject? =
    runCatching { tokenJson.parseToJsonElement(value) as? JsonObject }
      .getOrNull()

  private fun extractTokenCandidates(element: JsonElement): List<String> {
    val results = linkedSetOf<String>()

    fun visit(node: JsonElement?) {
      when (node) {
        null -> Unit
        is JsonObject -> {
          directToken(node)?.let(results::add)
          val segmented = mergeSegmentedParts(node)
          if (segmented.isNotBlank()) {
            results.add(segmented)
          }
          node.values.forEach(::visit)
        }
        is JsonArray -> node.forEach(::visit)
        is JsonPrimitive -> Unit
      }
    }

    visit(element)
    return results.toList()
  }

  private fun directToken(objectNode: JsonObject): String? {
    val candidates = listOf(
      objectNode["token"],
      objectNode["gameToken"],
      objectNode["game_token"],
      objectNode["accessToken"],
      objectNode["access_token"],
      objectNode["roleToken"],
      objectNode["role_token"],
    )

    candidates.forEach { candidate ->
      val value = candidate.asScalar()
      if (value.isNotBlank()) {
        return value
      }
    }

    val nestedToken = objectNode["token"]
    if (nestedToken is JsonObject) {
      val merged = directToken(nestedToken)
      if (!merged.isNullOrBlank()) {
        return merged
      }
    }
    return null
  }

  private fun mergeSegmentedParts(objectNode: JsonObject): String {
    val tokenParts = objectNode["tokenParts"]
      ?.takeIf { it is JsonArray }
      ?.jsonArray
      ?.mapNotNull { it.asScalar().ifBlank { null } }
      ?.joinToString("")
      .orEmpty()

    if (tokenParts.isNotBlank()) {
      return tokenParts
    }

    val segmented = objectNode.entries
      .filter { (key, _) -> key.matches(Regex("^token([_-]?part)?[_-]?\\d+$", RegexOption.IGNORE_CASE)) }
      .sortedBy { (key, _) -> key.takeLastWhile { it.isDigit() }.toIntOrNull() ?: 0 }
      .mapNotNull { (_, value) -> value.asScalar().ifBlank { null } }
      .joinToString("")

    return segmented
  }

  private fun directValue(payload: JsonObject, key: String): String =
    payload[key].asScalar()

  private fun findAnyId(payload: JsonObject): String {
    val queue = ArrayDeque<JsonElement>()
    queue.add(payload)
    val pattern = Regex("\\b\\d{6,12}\\b")

    while (queue.isNotEmpty()) {
      when (val current = queue.removeFirst()) {
        is JsonObject -> current.forEach { (key, value) ->
          if (key.equals("roleId", ignoreCase = true)
            || key.equals("gameAccountId", ignoreCase = true)
            || key.equals("activationRoleId", ignoreCase = true)
          ) {
            val normalized = value.asScalar()
            if (normalized.matches(Regex("^\\d{6,12}$"))) {
              return normalized
            }
          }
          queue.add(value)
        }
        is JsonArray -> current.forEach(queue::add)
        is JsonPrimitive -> {
          val scalar = current.content.trim()
          if (scalar.matches(Regex("^\\d{6,12}$"))) {
            return scalar
          }
          val match = pattern.find(scalar)
          if (match != null) {
            return match.value
          }
        }
      }
    }
    return ""
  }

  private fun JsonElement?.asScalar(): String =
    (this as? JsonPrimitive)?.content?.trim().orEmpty()

  private fun firstNonBlank(vararg values: String): String =
    values.firstOrNull { it.isNotBlank() }.orEmpty()
}
