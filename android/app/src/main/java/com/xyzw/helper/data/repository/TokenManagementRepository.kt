package com.xyzw.helper.data.repository

import com.xyzw.helper.data.model.BinDownloadTicket
import com.xyzw.helper.data.model.BinFileItem
import com.xyzw.helper.data.model.BinFileUploadResult
import com.xyzw.helper.data.model.ImportedGameToken
import com.xyzw.helper.data.model.TokenImportSource
import com.xyzw.helper.data.model.TokenActivationStatus
import com.xyzw.helper.data.model.UserTokenActivationBinding
import com.xyzw.helper.data.network.ApiError
import com.xyzw.helper.data.network.ApiResult
import com.xyzw.helper.data.network.TokenImportProxyRequest
import com.xyzw.helper.data.network.TokenManagementApi
import com.xyzw.helper.data.session.UserSensitiveActionSession
import com.xyzw.helper.data.storage.SecureTokenWorkspaceStore
import com.xyzw.helper.data.token.MAX_BIN_UPLOAD_BYTES
import com.xyzw.helper.data.token.TokenImportParser
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import okio.BufferedSink
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody
import java.io.IOException
import java.io.InputStream
import java.io.OutputStream
import java.time.Instant

class TokenManagementRepository(
  private val api: TokenManagementApi,
  private val parser: com.xyzw.helper.data.network.ApiResultParser,
  private val store: SecureTokenWorkspaceStore,
  private val sensitiveActionSession: UserSensitiveActionSession,
) {
  val tokens = store.tokens

  fun saveImportedToken(token: ImportedGameToken) {
    store.upsert(token)
  }

  fun removeImportedToken(tokenId: String) {
    store.remove(tokenId)
  }

  fun updateImportedToken(tokenId: String, transform: (ImportedGameToken) -> ImportedGameToken) {
    store.update(tokenId, transform)
  }

  fun parseManualToken(rawToken: String): ImportedGameToken =
    TokenImportParser.parseManualToken(
      rawToken = rawToken,
      source = com.xyzw.helper.data.model.TokenImportSource.MANUAL,
    )

  suspend fun proxyImport(url: String): ApiResult<List<ImportedGameToken>> {
    val response = api.proxyFetch(TokenImportProxyRequest(url))
    if (!response.isSuccessful) {
      return ApiResult.Failure(
        ApiError(
          httpStatus = response.code(),
          message = response.errorBody()?.string().orEmpty().ifBlank { "URL 导入失败" },
        ),
      )
    }
    val payload = response.body()
    if (payload == null) {
      return ApiResult.Failure(ApiError.local("URL 导入响应为空"))
    }
    return runCatching {
      ApiResult.Success(TokenImportParser.parseProxyPayload(payload, url))
    }.getOrElse { error ->
      ApiResult.Failure(ApiError.local(error.message ?: "URL 导入解析失败"))
    }
  }

  suspend fun listBinFiles(): ApiResult<List<BinFileItem>> {
    val result = parser.parse(api.listBinFiles())
    if (result is ApiResult.Success) {
      syncLocalTokensWithRemoteBins(result.data)
    }
    return result
  }

  suspend fun uploadBinFile(
    tokenId: String,
    contentLength: Long?,
    inputStreamProvider: () -> InputStream,
  ): ApiResult<BinFileUploadResult> {
    if (contentLength != null && contentLength >= 0 && contentLength > MAX_BIN_UPLOAD_BYTES) {
      return ApiResult.Failure(ApiError.local("二进制文件超过 32MB 上限，请选择更小的文件"))
    }
    return runCatching {
      parser.parse(
        api.uploadBinFile(
          tokenId = tokenId,
          requestBody = streamingBinRequestBody(contentLength, inputStreamProvider),
        ),
      )
    }.getOrElse { error ->
      ApiResult.Failure(
        ApiError.local(
          message = error.message ?: "二进制文件读取失败",
        ),
      )
    }
  }

  private fun streamingBinRequestBody(
    contentLength: Long?,
    inputStreamProvider: () -> InputStream,
  ): RequestBody =
    object : RequestBody() {
      override fun contentType() = "application/octet-stream".toMediaType()

      override fun contentLength(): Long = contentLength ?: -1L

      override fun writeTo(sink: BufferedSink) {
        val buffer = ByteArray(DEFAULT_STREAM_BUFFER_SIZE)
        var total = 0L
        inputStreamProvider().use { input ->
          while (true) {
            val read = input.read(buffer)
            if (read == -1) break
            total += read.toLong()
            if (total > MAX_BIN_UPLOAD_BYTES) {
              throw IOException("二进制文件超过 32MB 上限，请选择更小的文件")
            }
            sink.write(buffer, 0, read)
          }
        }
      }
    }

  suspend fun createDownloadTicket(
    tokenId: String,
    confirmToken: String? = sensitiveActionSession.currentToken(),
  ): ApiResult<BinDownloadTicket> =
    parser.parse(
      api.createDownloadTicket(
        tokenId = tokenId,
        confirmToken = confirmToken,
      ),
    )

  suspend fun downloadBinFile(
    tokenId: String,
    ticket: String,
    outputStreamProvider: () -> OutputStream,
  ): ApiResult<Unit> {
    val response = api.downloadBinFile(tokenId, mapOf("ticket" to ticket))
    if (!response.isSuccessful) {
      return ApiResult.Failure(
        ApiError(
          httpStatus = response.code(),
          message = errorMessageFromBody(response.errorBody()?.string()).ifBlank { "二进制文件导出失败" },
        ),
      )
    }
    val body = response.body() ?: return ApiResult.Failure(ApiError.local("二进制文件导出响应为空"))
    return runCatching {
      body.use { responseBody ->
        responseBody.byteStream().use { input ->
          outputStreamProvider().use { output ->
            input.copyTo(output, DEFAULT_STREAM_BUFFER_SIZE)
          }
        }
      }
      ApiResult.Success(Unit)
    }.getOrElse { error ->
      ApiResult.Failure(ApiError.local(error.message?.let { "二进制文件写入失败：$it" } ?: "二进制文件写入失败"))
    }
  }

  suspend fun deleteBinFile(tokenId: String): ApiResult<Unit> =
    parser.parseUnit(api.deleteBinFile(tokenId))

  suspend fun getActivationStatus(
    token: ImportedGameToken,
  ): ApiResult<TokenActivationStatus> =
    parser.parse(
      api.getActivationStatus(
        mapOf(
          "tokenId" to token.id,
          "roleId" to token.roleId,
          "gameAccountId" to token.roleId,
          "sessId" to token.sessId,
          "roleName" to token.roleName,
          "region" to token.region,
          "server" to token.region,
          "roleIndex" to token.roleIndex,
        ).filterValues { value -> value.isNotBlank() },
      ),
    )

  suspend fun listActivationBindings(): ApiResult<List<UserTokenActivationBinding>> =
    parser.parse(api.listActivationBindings())

  private suspend fun syncLocalTokensWithRemoteBins(files: List<BinFileItem>) {
    val fileTokenIds = files.map { it.tokenId }.toSet()
    val bindingByTokenId = when (val bindings = listActivationBindings()) {
      is ApiResult.Success -> bindings.data
        .filter { it.tokenId.isNotBlank() }
        .associateBy { it.tokenId }
      is ApiResult.Failure -> emptyMap()
    }
    val now = Instant.now().toString()
    val existingTokens = tokens.value
    val existingTokenIds = existingTokens.map { it.id }.toSet()
    val mergedExisting = existingTokens.map { token ->
      val binding = bindingByTokenId[token.id]
      val binPresent = token.id in fileTokenIds
      token.copy(
        displayName = token.displayName.ifBlank { restoredDisplayName(token.id, null, binding) },
        roleId = token.roleId.ifBlank { binding?.roleId.orEmpty() },
        roleName = token.roleName.ifBlank { binding?.roleName.orEmpty() },
        region = token.region.ifBlank { binding?.region.orEmpty() },
        roleIndex = token.roleIndex.ifBlank { binding?.roleIndex.orEmpty() },
        activationBound = binding?.let { true } ?: token.activationBound,
        activationActive = binding?.active ?: token.activationActive,
        activationExpiresAt = binding?.expiresAt ?: token.activationExpiresAt,
        activationBoundAt = binding?.boundAt ?: token.activationBoundAt,
        binFilePresent = binPresent,
        lastSyncAt = now,
        updatedAt = now,
      )
    }
    val restoredTokens = files
      .filter { it.tokenId !in existingTokenIds }
      .map { file ->
        val binding = bindingByTokenId[file.tokenId]
        ImportedGameToken(
          id = file.tokenId,
          rawToken = "",
          displayName = restoredDisplayName(file.tokenId, file.fileName, binding),
          roleId = binding?.roleId.orEmpty(),
          sessId = "",
          region = binding?.region.orEmpty(),
          roleName = binding?.roleName.orEmpty(),
          roleIndex = binding?.roleIndex.orEmpty(),
          source = TokenImportSource.MANUAL,
          importedAt = file.createdAt.ifBlank { now },
          updatedAt = now,
          activationBound = binding != null,
          activationActive = binding?.active ?: false,
          activationExpiresAt = binding?.expiresAt,
          activationBoundAt = binding?.boundAt,
          binFilePresent = true,
          lastSyncAt = now,
          lastError = null,
        )
      }
    val nextTokens = mergedExisting + restoredTokens
    if (nextTokens != existingTokens) {
      store.replaceAll(nextTokens)
    }
  }

  private fun restoredDisplayName(
    tokenId: String,
    fileName: String?,
    binding: UserTokenActivationBinding?,
  ): String =
    binding?.roleName?.takeIf { it.isNotBlank() }
      ?: fileName
        ?.removeSuffix(".bin")
        ?.takeIf { it.isNotBlank() }
      ?: "远程二进制文件 $tokenId"

  private fun errorMessageFromBody(rawBody: String?): String {
    val raw = rawBody.orEmpty()
    if (raw.isBlank()) return ""
    return runCatching {
      val json = com.xyzw.helper.data.network.NetworkFactory.json.parseToJsonElement(raw)
      val obj = json as? JsonObject
      obj?.get("message")?.toString()?.trim('"').orEmpty()
    }.getOrDefault(raw)
  }

  private companion object {
    const val DEFAULT_STREAM_BUFFER_SIZE = 8 * 1024
  }
}
