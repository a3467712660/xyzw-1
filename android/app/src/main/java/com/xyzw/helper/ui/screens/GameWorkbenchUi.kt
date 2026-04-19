package com.xyzw.helper.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.CloudDone
import androidx.compose.material.icons.outlined.CloudOff
import androidx.compose.material.icons.outlined.ManageSearch
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material.icons.outlined.Storage
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ElevatedCard
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.xyzw.helper.ui.components.XyzwStatusChip

data class WorkbenchSignal(
  val label: String,
  val value: String,
  val meta: String = "",
  val tone: String = "info",
)

data class WorkbenchNavItem(
  val id: String,
  val label: String,
  val description: String = "",
  val groupId: String = "",
)

@Composable
fun GameCommandBar(
  eyebrow: String,
  title: String,
  description: String,
  activeGroupName: String,
  activeModuleName: String,
  connectionStatusText: String,
  connectionTone: String,
  binAvailable: Boolean,
  tokenName: String,
  tokenCount: Int,
  onRefresh: () -> Unit,
  modifier: Modifier = Modifier,
  onOpenInspector: (() -> Unit)? = null,
  onGoTokens: (() -> Unit)? = null,
) {
  ElevatedCard(
    modifier = modifier.fillMaxWidth(),
    shape = RoundedCornerShape(8.dp),
    colors = CardDefaults.elevatedCardColors(containerColor = MaterialTheme.colorScheme.surface),
  ) {
    Column(
      modifier = Modifier.padding(16.dp),
      verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.Top,
      ) {
        Column(
          modifier = Modifier.weight(1f),
          verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
          Text(
            text = eyebrow,
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.primary,
            fontWeight = FontWeight.SemiBold,
          )
          Text(
            text = title,
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.SemiBold,
          )
          Text(
            text = description,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
          )
        }
        XyzwStatusChip(status = connectionTone, label = connectionStatusText)
      }

      Row(
        modifier = Modifier
          .fillMaxWidth()
          .horizontalScroll(rememberScrollState()),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
      ) {
        CommandSignalChip("当前分组", activeGroupName.ifBlank { "待选择" })
        CommandSignalChip("当前模块", activeModuleName.ifBlank { "待选择" })
        CommandSignalChip("当前角色", tokenName.ifBlank { "未选择" })
        CommandSignalChip("角色数量", tokenCount.toString())
        CommandSignalChip("BIN", if (binAvailable) "已就绪" else "待上传/恢复")
      }

      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
      ) {
        Button(onClick = onRefresh, modifier = Modifier.weight(1f)) {
          Icon(Icons.Outlined.Refresh, contentDescription = null)
          Text("刷新")
        }
        if (onOpenInspector != null) {
          OutlinedButton(onClick = onOpenInspector, modifier = Modifier.weight(1f)) {
            Icon(Icons.Outlined.ManageSearch, contentDescription = null)
            Text("检查器")
          }
        }
        if (onGoTokens != null) {
          OutlinedButton(onClick = onGoTokens, modifier = Modifier.weight(1f)) {
            Icon(Icons.Outlined.Storage, contentDescription = null)
            Text("Token")
          }
        }
      }
    }
  }
}

@Composable
private fun CommandSignalChip(label: String, value: String) {
  AssistChip(
    onClick = {},
    label = {
      Column {
        Text(label, style = MaterialTheme.typography.labelSmall)
        Text(
          value,
          style = MaterialTheme.typography.labelMedium,
          maxLines = 1,
          overflow = TextOverflow.Ellipsis,
        )
      }
    },
  )
}

@Composable
fun GameModuleRail(
  groups: List<WorkbenchNavItem>,
  modules: List<WorkbenchNavItem>,
  selectedModuleId: String,
  selectedSectionId: String,
  sectionItems: List<WorkbenchNavItem>,
  onSelectModule: (String) -> Unit,
  onSelectSection: (String) -> Unit,
  modifier: Modifier = Modifier,
) {
  ElevatedCard(
    modifier = modifier.fillMaxWidth(),
    shape = RoundedCornerShape(8.dp),
    colors = CardDefaults.elevatedCardColors(containerColor = MaterialTheme.colorScheme.surface),
  ) {
    Column(
      modifier = Modifier.padding(14.dp),
      verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
      Text("模块导航", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
      groups.forEach { group ->
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
          Text(group.label, style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.primary)
          group.description.takeIf { it.isNotBlank() }?.let {
            Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
          }
          modules.filter { it.groupId == group.id }.forEach { module ->
            FilterChip(
              selected = module.id == selectedModuleId,
              onClick = { onSelectModule(module.id) },
              label = {
                Column {
                  Text(module.label)
                  module.description.takeIf { it.isNotBlank() }?.let {
                    Text(
                      it,
                      style = MaterialTheme.typography.labelSmall,
                      maxLines = 1,
                      overflow = TextOverflow.Ellipsis,
                    )
                  }
                }
              },
              modifier = Modifier.fillMaxWidth(),
            )
          }
        }
      }
      if (sectionItems.isNotEmpty()) {
        Text("分区", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.primary)
        Row(
          modifier = Modifier
            .fillMaxWidth()
            .horizontalScroll(rememberScrollState()),
          horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
          sectionItems.forEach { section ->
            FilterChip(
              selected = section.id == selectedSectionId,
              onClick = { onSelectSection(section.id) },
              label = { Text(section.label) },
            )
          }
        }
      }
    }
  }
}

@Composable
fun GameStage(
  eyebrow: String,
  groupLabel: String,
  moduleName: String,
  moduleDescription: String,
  statusText: String,
  statusTone: String,
  modifier: Modifier = Modifier,
  overview: @Composable ColumnScope.() -> Unit = {},
  content: @Composable ColumnScope.() -> Unit,
) {
  ElevatedCard(
    modifier = modifier.fillMaxWidth(),
    shape = RoundedCornerShape(8.dp),
    colors = CardDefaults.elevatedCardColors(containerColor = MaterialTheme.colorScheme.surface),
  ) {
    Column(
      modifier = Modifier.padding(16.dp),
      verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.Top,
      ) {
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
          Text(eyebrow, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.primary)
          Text(moduleName, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
          Text(
            listOf(groupLabel, moduleDescription).filter { it.isNotBlank() }.joinToString(" · "),
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
          )
        }
        XyzwStatusChip(status = statusTone, label = statusText)
      }
      overview()
      content()
    }
  }
}

@Composable
fun GameInspector(
  title: String,
  subtitle: String,
  facts: List<WorkbenchSignal>,
  recommendationTitle: String,
  recommendationDetail: String,
  isConnected: Boolean,
  onRefresh: () -> Unit,
  modifier: Modifier = Modifier,
) {
  ElevatedCard(
    modifier = modifier.fillMaxWidth(),
    shape = RoundedCornerShape(8.dp),
    colors = CardDefaults.elevatedCardColors(containerColor = MaterialTheme.colorScheme.surface),
  ) {
    Column(
      modifier = Modifier.padding(14.dp),
      verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
      Row(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
        Icon(
          imageVector = if (isConnected) Icons.Outlined.CloudDone else Icons.Outlined.CloudOff,
          contentDescription = null,
          tint = if (isConnected) toneColor("success") else toneColor("warning"),
        )
        Column(modifier = Modifier.weight(1f)) {
          Text(title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
          Text(subtitle, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
      }
      facts.forEach { fact ->
        Row(
          modifier = Modifier.fillMaxWidth(),
          horizontalArrangement = Arrangement.spacedBy(10.dp),
          verticalAlignment = Alignment.CenterVertically,
        ) {
          Box(
            modifier = Modifier
              .size(8.dp)
              .background(toneColor(fact.tone), RoundedCornerShape(4.dp)),
          )
          Column(modifier = Modifier.weight(1f)) {
            Text(fact.label, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text(fact.value, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium)
          }
        }
      }
      Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(8.dp),
        color = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.45f),
      ) {
        Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
          Text(recommendationTitle, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
          Text(recommendationDetail, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
      }
      OutlinedButton(onClick = onRefresh, modifier = Modifier.fillMaxWidth()) {
        Icon(Icons.Outlined.Refresh, contentDescription = null)
        Text("刷新状态")
      }
    }
  }
}

@Composable
fun WorkbenchSummaryGrid(items: List<WorkbenchSignal>, modifier: Modifier = Modifier) {
  Column(modifier = modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(10.dp)) {
    items.chunked(2).forEach { row ->
      Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        row.forEach { item ->
          SummaryTile(item = item, modifier = Modifier.weight(1f))
        }
        if (row.size == 1) {
          Spacer(modifier = Modifier.weight(1f))
        }
      }
    }
  }
}

@Composable
private fun SummaryTile(item: WorkbenchSignal, modifier: Modifier = Modifier) {
  Surface(
    modifier = modifier.heightIn(min = 86.dp),
    shape = RoundedCornerShape(8.dp),
    color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.7f),
    tonalElevation = 1.dp,
  ) {
    Column(
      modifier = Modifier.padding(12.dp),
      verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
      Text(item.label, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
      Text(
        item.value.ifBlank { "--" },
        style = MaterialTheme.typography.titleMedium,
        fontWeight = FontWeight.SemiBold,
        maxLines = 2,
        overflow = TextOverflow.Ellipsis,
      )
      item.meta.takeIf { it.isNotBlank() }?.let {
        Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
      }
    }
  }
}

@Composable
fun GameStatusCard(
  icon: ImageVector,
  title: String,
  subtitle: String,
  status: String,
  tone: String,
  metrics: List<WorkbenchSignal>,
  modifier: Modifier = Modifier,
  actions: @Composable RowScope.() -> Unit = {},
  detail: @Composable ColumnScope.() -> Unit = {},
) {
  ElevatedCard(
    modifier = modifier.fillMaxWidth(),
    shape = RoundedCornerShape(8.dp),
    colors = CardDefaults.elevatedCardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.78f)),
    elevation = CardDefaults.elevatedCardElevation(defaultElevation = 1.dp),
  ) {
    Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
      Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.Top) {
        Box(
          modifier = Modifier
            .size(38.dp)
            .background(toneColor(tone).copy(alpha = 0.13f), RoundedCornerShape(8.dp))
            .border(1.dp, toneColor(tone).copy(alpha = 0.2f), RoundedCornerShape(8.dp)),
          contentAlignment = Alignment.Center,
        ) {
          Icon(icon, contentDescription = null, tint = toneColor(tone), modifier = Modifier.size(22.dp))
        }
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
          Text(title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
          Text(subtitle, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        XyzwStatusChip(status = status.ifBlank { tone }, label = statusLabel(status, tone))
      }
      if (metrics.isNotEmpty()) {
        WorkbenchSummaryGrid(metrics)
      }
      detail()
      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        content = actions,
      )
    }
  }
}

@Composable
fun WorkbenchPrimaryButton(
  text: String,
  enabled: Boolean,
  onClick: () -> Unit,
  modifier: Modifier = Modifier,
) {
  Button(
    onClick = onClick,
    enabled = enabled,
    modifier = modifier.height(48.dp),
    colors = ButtonDefaults.buttonColors(disabledContainerColor = MaterialTheme.colorScheme.surfaceVariant),
  ) {
    Text(text, maxLines = 1, overflow = TextOverflow.Ellipsis)
  }
}

@Composable
fun WorkbenchSecondaryButton(
  text: String,
  enabled: Boolean = true,
  onClick: () -> Unit,
  modifier: Modifier = Modifier,
) {
  OutlinedButton(
    onClick = onClick,
    enabled = enabled,
    modifier = modifier.height(48.dp),
  ) {
    Text(text, maxLines = 1, overflow = TextOverflow.Ellipsis)
  }
}

@Composable
fun WorkbenchToggleRow(
  title: String,
  description: String,
  valueLabel: String,
  modifier: Modifier = Modifier,
  action: @Composable () -> Unit,
) {
  Surface(
    modifier = modifier.fillMaxWidth(),
    shape = RoundedCornerShape(8.dp),
    color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.7f),
  ) {
    Row(
      modifier = Modifier.padding(12.dp),
      horizontalArrangement = Arrangement.spacedBy(12.dp),
      verticalAlignment = Alignment.CenterVertically,
    ) {
      Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
        Text(title, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
        Text(description, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(valueLabel, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.primary)
      }
      action()
    }
  }
}

fun statusLabel(status: String, tone: String): String =
  when (status.ifBlank { tone }) {
    "ready", "success", "active", "connected" -> "可用"
    "disabled", "missing-bin", "disconnected" -> "不可用"
    "warning" -> "需注意"
    "danger", "error" -> "高风险"
    "running", "processing" -> "处理中"
    else -> "信息"
  }

@Composable
fun toneColor(tone: String): Color =
  when (tone.lowercase()) {
    "ready", "success", "active", "connected" -> Color(0xFF2E7D32)
    "warning", "pending" -> Color(0xFFB26A00)
    "danger", "error", "failed" -> MaterialTheme.colorScheme.error
    "disabled", "missing-bin", "disconnected" -> MaterialTheme.colorScheme.outline
    else -> MaterialTheme.colorScheme.primary
  }

fun connectionTone(status: String, binAvailable: Boolean = true): String =
  when {
    !binAvailable -> "warning"
    status.equals("connected", ignoreCase = true) || status.equals("ready", ignoreCase = true) -> "success"
    status.equals("connecting", ignoreCase = true) || status.equals("running", ignoreCase = true) -> "warning"
    status.equals("error", ignoreCase = true) || status.equals("failed", ignoreCase = true) -> "danger"
    else -> "info"
  }

fun connectionLabel(status: String, binAvailable: Boolean = true): String =
  when {
    !binAvailable -> "请先上传/恢复 BIN"
    status.equals("connected", ignoreCase = true) || status.equals("ready", ignoreCase = true) -> "已连接"
    status.equals("connecting", ignoreCase = true) -> "连接中"
    status.equals("error", ignoreCase = true) || status.equals("failed", ignoreCase = true) -> "连接异常"
    status.isBlank() -> "待连接"
    else -> status
  }

