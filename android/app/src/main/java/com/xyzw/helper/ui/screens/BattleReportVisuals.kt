package com.xyzw.helper.ui.screens

import android.graphics.BitmapFactory
import android.util.Base64
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Article
import androidx.compose.material.icons.outlined.Flag
import androidx.compose.material.icons.outlined.Visibility
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ElevatedCard
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.xyzw.helper.data.model.BattleReportItem
import com.xyzw.helper.ui.formatters.formatDisplayDateTime
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.longOrNull

@Composable
fun BattleReportImageLikeCard(
  report: BattleReportItem,
  modifier: Modifier = Modifier,
) {
  val imageBytes = remember(report.detail) { embeddedImageBytes(report.detail) }
  val bitmap = remember(imageBytes) {
    imageBytes?.let { BitmapFactory.decodeByteArray(it, 0, it.size) }
  }
  if (bitmap != null) {
    ElevatedCard(
      modifier = modifier.fillMaxWidth(),
      shape = RoundedCornerShape(8.dp),
      elevation = CardDefaults.elevatedCardElevation(defaultElevation = 2.dp),
    ) {
      Image(
        bitmap = bitmap.asImageBitmap(),
        contentDescription = "${report.title.ifBlank { "战报" }}图片",
        modifier = Modifier.fillMaxWidth(),
      )
    }
    return
  }

  when {
    report.reportType.equals("peach-garden", ignoreCase = true) -> PeachGardenReportCard(report, modifier)
    report.reportType.equals("salt-field", ignoreCase = true) -> SaltFieldReportCard(report, modifier)
    report.reportType.contains("legion", ignoreCase = true) ||
      report.reportType.contains("war", ignoreCase = true) -> LegionBattleReportCard(report, modifier)
    else -> GenericBattleReportCard(report, modifier)
  }
}

@Composable
fun PeachGardenReportCard(
  report: BattleReportItem,
  modifier: Modifier = Modifier,
) {
  val detail = report.detail as? JsonObject
  val result = resultText(detail, report.summary)
  val player = detail.fieldText("player", "roleName", "name", "self", "myName").ifBlank { "我方" }
  val enemy = detail.fieldText("enemy", "opponent", "target", "enemyName").ifBlank { "对方" }
  val score = detail.fieldText("score", "point", "points", "rank")
  val count = detail.countText("rounds", "records", "list", "rankList", "legionRankList")
  val reward = detail.fieldText("reward", "rewards")
  val stats = buildList {
    addMetric("结果", result)
    addMetric("积分/排名", score)
    addMetric("记录", count)
    addMetric("奖励", reward)
    addMetric("伤害", detail.fieldText("damage", "totalDamage"))
    addMetric("血量", detail.fieldText("hp", "health"))
    addMetric("战力", detail.fieldText("power", "combatPower"))
  }

  ReportPosterCard(
    modifier = modifier,
    title = "蟠桃园战报",
    date = formatDisplayDateTime(report.createdAt),
    result = result,
    tone = if (result.contains("胜")) "success" else if (result.contains("败")) "danger" else "warning",
  ) {
    Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
      TeamBlock(label = "我方", name = player, value = score.ifBlank { report.summary.ifBlank { "--" } }, modifier = Modifier.weight(1f))
      TeamBlock(label = "对方", name = enemy, value = detail.fieldText("enemyScore", "opponentScore").ifBlank { "--" }, modifier = Modifier.weight(1f))
    }
    MetricGrid(stats)
    Text(
      "后端未返回图像，仅提供结构化数据，已转为原生战报卡",
      style = MaterialTheme.typography.bodySmall,
      color = MaterialTheme.colorScheme.onSurfaceVariant,
    )
  }
}

@Composable
fun SaltFieldReportCard(
  report: BattleReportItem,
  modifier: Modifier = Modifier,
) {
  val detail = report.detail as? JsonObject
  val result = resultText(detail, report.summary)
  ReportPosterCard(
    modifier = modifier,
    title = report.title.ifBlank { "盐场战报" },
    date = formatDisplayDateTime(report.createdAt),
    result = result,
    tone = if (result.contains("胜")) "success" else "info",
  ) {
    MetricGrid(
      listOfNotNull(
        "类型" to "盐场",
        "摘要" to report.summary.ifBlank { result },
        "积分" to detail.fieldText("score", "point", "points"),
        "排名" to detail.fieldText("rank", "order"),
        "记录" to detail.countText("records", "list", "rankList", "legionRankList"),
      ).filter { it.second.isNotBlank() },
    )
  }
}

@Composable
fun LegionBattleReportCard(
  report: BattleReportItem,
  modifier: Modifier = Modifier,
) {
  val detail = report.detail as? JsonObject
  ReportPosterCard(
    modifier = modifier,
    title = report.title.ifBlank { "军团战报" },
    date = formatDisplayDateTime(report.createdAt),
    result = report.summary.ifBlank { "军团战摘要" },
    tone = "info",
  ) {
    MetricGrid(
      listOfNotNull(
        "军团" to detail.fieldText("legion", "legionName", "guildName"),
        "排名" to detail.fieldText("rank", "legionRank"),
        "积分" to detail.fieldText("score", "point", "points"),
        "节点" to detail.countText("nodes", "routes", "records", "list"),
      ).filter { it.second.isNotBlank() },
    )
  }
}

@Composable
fun BattleReportCompactSummaryCard(
  report: BattleReportItem,
  onOpenDetail: (BattleReportItem) -> Unit,
  modifier: Modifier = Modifier,
) {
  ElevatedCard(
    modifier = modifier.fillMaxWidth(),
    shape = RoundedCornerShape(8.dp),
    colors = CardDefaults.elevatedCardColors(containerColor = MaterialTheme.colorScheme.surface),
    elevation = CardDefaults.elevatedCardElevation(defaultElevation = 1.dp),
  ) {
    Row(
      modifier = Modifier.padding(12.dp),
      horizontalArrangement = Arrangement.spacedBy(10.dp),
      verticalAlignment = Alignment.CenterVertically,
    ) {
      Box(
        modifier = Modifier
          .size(38.dp)
          .background(MaterialTheme.colorScheme.primaryContainer, RoundedCornerShape(8.dp)),
        contentAlignment = Alignment.Center,
      ) {
        Icon(Icons.Outlined.Article, contentDescription = null, tint = MaterialTheme.colorScheme.onPrimaryContainer)
      }
      Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text(reportTypeLabel(report.reportType), style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.primary)
        Text(report.title.ifBlank { "战报" }, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
        Text(
          listOf(formatDisplayDateTime(report.createdAt), report.summary)
            .filter { it.isNotBlank() && it != "--" }
            .joinToString(" · ")
            .ifBlank { "暂无摘要" },
          style = MaterialTheme.typography.bodySmall,
          color = MaterialTheme.colorScheme.onSurfaceVariant,
          maxLines = 1,
          overflow = TextOverflow.Ellipsis,
        )
      }
      WorkbenchPrimaryButton(
        text = "查看",
        enabled = true,
        onClick = { onOpenDetail(report) },
      )
    }
  }
}

@Composable
fun BattleReportDebugJsonSheet(
  report: BattleReportItem,
  expanded: Boolean,
  onToggle: () -> Unit = {},
  modifier: Modifier = Modifier,
) {
  Column(modifier = modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(10.dp)) {
    if (expanded) {
      ElevatedCard(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(8.dp),
        colors = CardDefaults.elevatedCardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
      ) {
        Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
          Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Outlined.Visibility, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
            Text("原始数据", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
          }
          Text(
            sanitizeJson(report.detail).take(6_000),
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
          )
          (sanitizeJsonElement(report.detail ?: JsonObject(emptyMap())) as? JsonObject)
            ?.entries
            ?.take(12)
            ?.forEach { (key, value) ->
              Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                Text(key, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.primary, modifier = Modifier.weight(0.38f))
                Text(
                  value.cleanText() ?: value.toString().take(180),
                  style = MaterialTheme.typography.bodySmall,
                  color = MaterialTheme.colorScheme.onSurfaceVariant,
                  modifier = Modifier.weight(0.62f),
                )
              }
            }
        }
      }
    }
  }
}

@Composable
private fun GenericBattleReportCard(
  report: BattleReportItem,
  modifier: Modifier = Modifier,
) {
  ReportPosterCard(
    modifier = modifier,
    title = report.title.ifBlank { "战报" },
    date = formatDisplayDateTime(report.createdAt),
    result = report.summary.ifBlank { "结构化战报" },
    tone = "info",
  ) {
    Text(
      "未识别到专属版式，已按原生图片式战报卡展示摘要。",
      style = MaterialTheme.typography.bodyMedium,
      color = MaterialTheme.colorScheme.onSurfaceVariant,
    )
  }
}

@Composable
private fun ReportPosterCard(
  title: String,
  date: String,
  result: String,
  tone: String,
  modifier: Modifier = Modifier,
  content: @Composable ColumnScope.() -> Unit,
) {
  val accent = toneColorForReport(tone)
  ElevatedCard(
    modifier = modifier.fillMaxWidth(),
    shape = RoundedCornerShape(8.dp),
    colors = CardDefaults.elevatedCardColors(containerColor = MaterialTheme.colorScheme.surface),
    elevation = CardDefaults.elevatedCardElevation(defaultElevation = 2.dp),
  ) {
    Column(
      modifier = Modifier
        .background(
          Brush.verticalGradient(
            listOf(
              accent.copy(alpha = 0.16f),
              MaterialTheme.colorScheme.surface,
            ),
          ),
        )
        .padding(14.dp),
      verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
      Row(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(
          modifier = Modifier
            .size(42.dp)
            .background(accent.copy(alpha = 0.15f), RoundedCornerShape(8.dp))
            .border(1.dp, accent.copy(alpha = 0.35f), RoundedCornerShape(8.dp)),
          contentAlignment = Alignment.Center,
        ) {
          Icon(Icons.Outlined.Flag, contentDescription = null, tint = accent)
        }
        Column(modifier = Modifier.weight(1f)) {
          Text(title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
          Text(date, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        Text(
          result.ifBlank { "已解析" },
          style = MaterialTheme.typography.labelLarge,
          color = accent,
          fontWeight = FontWeight.SemiBold,
        )
      }
      HorizontalDivider(color = accent.copy(alpha = 0.18f))
      content()
    }
  }
}

@Composable
private fun TeamBlock(
  label: String,
  name: String,
  value: String,
  modifier: Modifier = Modifier,
) {
  Column(
    modifier = modifier
      .heightIn(min = 84.dp)
      .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.64f), RoundedCornerShape(8.dp))
      .padding(10.dp),
    verticalArrangement = Arrangement.spacedBy(6.dp),
  ) {
    Text(label, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.primary)
    Text(name, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
    Text(value.ifBlank { "--" }, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
  }
}

@Composable
private fun MetricGrid(metrics: List<Pair<String, String>>) {
  Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
    metrics.chunked(2).forEach { row ->
      Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
        row.forEach { (label, value) ->
          Column(
            modifier = Modifier
              .weight(1f)
              .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.58f), RoundedCornerShape(8.dp))
              .padding(9.dp),
          ) {
            Text(label, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text(value, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold)
          }
        }
        if (row.size == 1) {
          Box(modifier = Modifier.weight(1f))
        }
      }
    }
  }
}

@Composable
private fun toneColorForReport(tone: String) =
  when (tone) {
    "success" -> MaterialTheme.colorScheme.primary
    "danger" -> MaterialTheme.colorScheme.error
    "warning" -> MaterialTheme.colorScheme.tertiary
    else -> MaterialTheme.colorScheme.secondary
  }

private fun MutableList<Pair<String, String>>.addMetric(label: String, value: String) {
  if (value.isNotBlank()) add(label to value)
}

private fun JsonObject?.fieldText(vararg keys: String): String =
  keys.firstNotNullOfOrNull { key -> this?.get(key)?.cleanText() }.orEmpty()

private fun JsonObject?.countText(vararg keys: String): String =
  keys.firstNotNullOfOrNull { key ->
    when (val value = this?.get(key)) {
      is JsonArray -> if (value.isNotEmpty()) "${value.size} 条" else null
      is JsonObject -> if (value.isNotEmpty()) "${value.size} 项" else null
      else -> value?.cleanText()
    }
  }.orEmpty()

private fun JsonElement.cleanText(): String? =
  when (this) {
    is JsonPrimitive -> contentOrNull?.takeUnless { it.isBlank() || it == "null" }
      ?: booleanOrNull?.toString()
      ?: longOrNull?.toString()
    is JsonArray -> if (isNotEmpty()) "${size} 条" else null
    is JsonObject -> null
  }?.takeUnless { it == "{}" || it == "[]" }

private fun resultText(detail: JsonObject?, fallback: String): String {
  val primitive = listOf("isWin", "win", "result")
    .firstNotNullOfOrNull { key -> detail?.get(key) as? JsonPrimitive }
  primitive?.booleanOrNull?.let { return if (it) "胜利" else "失败" }
  val text = primitive?.contentOrNull.orEmpty()
  return when {
    text.contains("胜") || text.equals("win", ignoreCase = true) || text.equals("true", ignoreCase = true) -> "胜利"
    text.contains("败") || text.equals("lose", ignoreCase = true) || text.equals("false", ignoreCase = true) -> "失败"
    fallback.isNotBlank() -> fallback
    else -> "已解析"
  }
}

private fun reportTypeLabel(reportType: String): String =
  when {
    reportType.equals("peach-garden", ignoreCase = true) -> "蟠桃园"
    reportType.equals("salt-field", ignoreCase = true) -> "盐场"
    reportType.contains("legion", ignoreCase = true) || reportType.contains("war", ignoreCase = true) -> "军团战"
    reportType.equals("manual", ignoreCase = true) -> "手动"
    else -> "战报"
  }

private fun embeddedImageBytes(detail: JsonElement?): ByteArray? {
  val obj = detail as? JsonObject ?: return null
  val raw = obj.fieldText("dataUrl", "imageBase64", "image", "imageUrl").takeIf { it.isNotBlank() } ?: return null
  if (raw.startsWith("http://", ignoreCase = true) || raw.startsWith("https://", ignoreCase = true)) {
    return null
  }
  val payload = raw.substringAfter("base64,", raw)
  return runCatching { Base64.decode(payload, Base64.DEFAULT) }.getOrNull()
}

private fun sanitizeJson(value: JsonElement?): String {
  if (value == null) return "{}"
  return sanitizeJsonElement(value).toString()
}

private fun sanitizeJsonElement(value: JsonElement, key: String = ""): JsonElement =
  when (value) {
    is JsonObject -> JsonObject(
      value.mapValues { (childKey, childValue) ->
        sanitizeJsonElement(childValue, childKey)
      },
    )
    is JsonArray -> JsonArray(value.map { sanitizeJsonElement(it) })
    is JsonPrimitive -> if (Regex("token|cookie|seed|signature", RegexOption.IGNORE_CASE).containsMatchIn(key)) {
      JsonPrimitive("已隐藏")
    } else {
      value
    }
  }
