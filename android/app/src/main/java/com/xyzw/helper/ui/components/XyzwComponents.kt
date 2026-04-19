@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package com.xyzw.helper.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.ErrorOutline
import androidx.compose.material.icons.outlined.HourglassEmpty
import androidx.compose.material.icons.outlined.MoreVert
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material.icons.outlined.Visibility
import androidx.compose.material.icons.outlined.VisibilityOff
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Badge
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ElevatedCard
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.xyzw.helper.ui.theme.DangerRed
import com.xyzw.helper.ui.theme.InfoBlue
import com.xyzw.helper.ui.theme.SuccessGreen
import com.xyzw.helper.ui.theme.WarningAmber

@Composable
fun XyzwPage(
  title: String,
  subtitle: String? = null,
  onBack: (() -> Unit)? = null,
  onRefresh: (() -> Unit)? = null,
  snackbarHostState: SnackbarHostState = remember { SnackbarHostState() },
  actions: @Composable RowScope.() -> Unit = {},
  bottomAction: @Composable (() -> Unit)? = null,
  content: @Composable ColumnScope.() -> Unit,
) {
  Scaffold(
    snackbarHost = { XyzwSnackbarHost(snackbarHostState) },
    topBar = {
      XyzwTopBar(
        title = title,
        onBack = onBack,
        onRefresh = onRefresh,
        actions = actions,
      )
    },
    bottomBar = {
      if (bottomAction != null) {
        Box(
          modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 12.dp),
        ) {
          bottomAction()
        }
      }
    },
  ) { innerPadding ->
    Column(
      modifier = Modifier
        .fillMaxSize()
        .padding(innerPadding)
        .verticalScroll(rememberScrollState())
        .padding(horizontal = 16.dp, vertical = 16.dp),
      verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
      if (!subtitle.isNullOrBlank()) {
        Text(
          text = subtitle,
          style = MaterialTheme.typography.bodyMedium,
          color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
      }
      content()
    }
  }
}

@Composable
fun XyzwTopBar(
  title: String,
  onBack: (() -> Unit)? = null,
  onRefresh: (() -> Unit)? = null,
  onMore: (() -> Unit)? = null,
  actions: @Composable RowScope.() -> Unit = {},
) {
  TopAppBar(
    title = {
      Text(
        text = title,
        maxLines = 1,
        overflow = TextOverflow.Ellipsis,
      )
    },
    navigationIcon = {
      if (onBack != null) {
        IconButton(onClick = onBack) {
          Icon(Icons.AutoMirrored.Outlined.ArrowBack, contentDescription = "返回")
        }
      }
    },
    actions = {
      if (onRefresh != null) {
        IconButton(onClick = onRefresh) {
          Icon(Icons.Outlined.Refresh, contentDescription = "刷新")
        }
      }
      actions()
      if (onMore != null) {
        IconButton(onClick = onMore) {
          Icon(Icons.Outlined.MoreVert, contentDescription = "更多")
        }
      }
    },
    colors = TopAppBarDefaults.topAppBarColors(
      containerColor = MaterialTheme.colorScheme.background,
    ),
  )
}

@Composable
fun XyzwCard(
  modifier: Modifier = Modifier,
  onClick: (() -> Unit)? = null,
  content: @Composable ColumnScope.() -> Unit,
) {
  val colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
  if (onClick == null) {
    ElevatedCard(
      modifier = modifier.fillMaxWidth(),
      shape = MaterialTheme.shapes.medium,
      colors = colors,
      elevation = CardDefaults.elevatedCardElevation(defaultElevation = 1.dp),
    ) {
      Column(
        modifier = Modifier.padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
        content = content,
      )
    }
  } else {
    ElevatedCard(
      onClick = onClick,
      modifier = modifier.fillMaxWidth(),
      shape = MaterialTheme.shapes.medium,
      colors = colors,
      elevation = CardDefaults.elevatedCardElevation(defaultElevation = 1.dp),
    ) {
      Column(
        modifier = Modifier.padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
        content = content,
      )
    }
  }
}

@Composable
fun XyzwActionCard(
  icon: ImageVector? = null,
  title: String,
  subtitle: String,
  badge: String? = null,
  enabled: Boolean = true,
  onClick: () -> Unit,
) {
  ElevatedCard(
    onClick = onClick,
    enabled = enabled,
    modifier = Modifier.fillMaxWidth(),
    shape = MaterialTheme.shapes.medium,
    colors = CardDefaults.elevatedCardColors(
      containerColor = MaterialTheme.colorScheme.surfaceVariant,
      disabledContainerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.55f),
    ),
  ) {
    Row(
      modifier = Modifier
        .fillMaxWidth()
        .padding(16.dp),
      horizontalArrangement = Arrangement.spacedBy(14.dp),
      verticalAlignment = Alignment.CenterVertically,
    ) {
      if (icon != null) {
        Icon(
          imageVector = icon,
          contentDescription = null,
          modifier = Modifier.size(28.dp),
          tint = if (enabled) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
        )
      }
      Column(
        modifier = Modifier.weight(1f),
        verticalArrangement = Arrangement.spacedBy(4.dp),
      ) {
        Row(
          horizontalArrangement = Arrangement.spacedBy(8.dp),
          verticalAlignment = Alignment.CenterVertically,
        ) {
          Text(title, style = MaterialTheme.typography.titleMedium)
          if (!badge.isNullOrBlank()) {
            Badge { Text(badge) }
          }
        }
        Text(
          subtitle,
          style = MaterialTheme.typography.bodyMedium,
          color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
      }
    }
  }
}

@Composable
fun XyzwStatCard(
  label: String,
  value: String,
  modifier: Modifier = Modifier,
  supportingText: String? = null,
) {
  XyzwCard(modifier = modifier) {
    Text(label, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
    Text(value, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.SemiBold)
    if (!supportingText.isNullOrBlank()) {
      Text(supportingText, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
  }
}

@Composable
fun XyzwStatusChip(
  status: String,
  label: String = status,
) {
  val color = statusColor(status)
  AssistChip(
    onClick = {},
    enabled = false,
    label = { Text(label) },
    leadingIcon = {
      Box(
        modifier = Modifier
          .size(8.dp),
      )
    },
    colors = androidx.compose.material3.AssistChipDefaults.assistChipColors(
      disabledContainerColor = color.copy(alpha = 0.14f),
      disabledLabelColor = color,
      disabledLeadingIconContentColor = color,
    ),
    border = androidx.compose.material3.AssistChipDefaults.assistChipBorder(
      enabled = false,
      borderColor = color.copy(alpha = 0.35f),
      disabledBorderColor = color.copy(alpha = 0.35f),
    ),
  )
}

@Composable
fun XyzwEmptyState(
  icon: ImageVector? = null,
  title: String,
  description: String,
  primaryActionLabel: String? = null,
  onPrimaryAction: (() -> Unit)? = null,
) {
  XyzwCard {
    Column(
      modifier = Modifier.fillMaxWidth(),
      horizontalAlignment = Alignment.CenterHorizontally,
      verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
      if (icon != null) {
        Icon(icon, contentDescription = null, modifier = Modifier.size(36.dp), tint = MaterialTheme.colorScheme.primary)
      }
      Text(title, style = MaterialTheme.typography.titleMedium)
      Text(
        description,
        style = MaterialTheme.typography.bodyMedium,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
      )
      if (primaryActionLabel != null && onPrimaryAction != null) {
        Button(onClick = onPrimaryAction) {
          Text(primaryActionLabel)
        }
      }
    }
  }
}

@Composable
fun XyzwErrorState(
  message: String,
  onRetry: (() -> Unit)? = null,
) {
  XyzwCard {
    Row(
      horizontalArrangement = Arrangement.spacedBy(12.dp),
      verticalAlignment = Alignment.CenterVertically,
    ) {
      Icon(Icons.Outlined.ErrorOutline, contentDescription = null, tint = MaterialTheme.colorScheme.error)
      Column(
        modifier = Modifier.weight(1f),
        verticalArrangement = Arrangement.spacedBy(6.dp),
      ) {
        Text("加载失败", style = MaterialTheme.typography.titleMedium)
        Text(message, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
      }
    }
    if (onRetry != null) {
      Button(onClick = onRetry, modifier = Modifier.fillMaxWidth()) {
        Text("重试")
      }
    }
  }
}

@Composable
fun XyzwLoadingState(
  label: String = "加载中...",
) {
  XyzwCard {
    Row(
      modifier = Modifier.fillMaxWidth(),
      horizontalArrangement = Arrangement.spacedBy(12.dp),
      verticalAlignment = Alignment.CenterVertically,
    ) {
      CircularProgressIndicator(modifier = Modifier.size(24.dp), strokeWidth = 2.dp)
      Text(label, style = MaterialTheme.typography.bodyMedium)
    }
  }
}

@Composable
fun XyzwConfirmDialog(
  title: String,
  message: String,
  confirmLabel: String = "确认",
  dismissLabel: String = "取消",
  destructive: Boolean = false,
  onConfirm: () -> Unit,
  onDismiss: () -> Unit,
) {
  AlertDialog(
    onDismissRequest = onDismiss,
    title = { Text(title) },
    text = { Text(message) },
    confirmButton = {
      TextButton(onClick = onConfirm) {
        Text(confirmLabel, color = if (destructive) MaterialTheme.colorScheme.error else Color.Unspecified)
      }
    },
    dismissButton = {
      TextButton(onClick = onDismiss) {
        Text(dismissLabel)
      }
    },
  )
}

@Composable
fun XyzwFormField(
  value: String,
  onValueChange: (String) -> Unit,
  label: String,
  modifier: Modifier = Modifier,
  error: String? = null,
  helper: String? = null,
  minLines: Int = 1,
  singleLine: Boolean = minLines == 1,
  password: Boolean = false,
  keyboardOptions: KeyboardOptions = KeyboardOptions.Default,
  keyboardActions: KeyboardActions = KeyboardActions.Default,
) {
  var visible by rememberSaveable { mutableStateOf(false) }
  OutlinedTextField(
    value = value,
    onValueChange = onValueChange,
    modifier = modifier.fillMaxWidth(),
    label = { Text(label) },
    isError = !error.isNullOrBlank(),
    supportingText = {
      val supporting = error ?: helper
      if (!supporting.isNullOrBlank()) {
        Text(supporting)
      }
    },
    trailingIcon = {
      if (password) {
        IconButton(onClick = { visible = !visible }) {
          Icon(
            if (visible) Icons.Outlined.VisibilityOff else Icons.Outlined.Visibility,
            contentDescription = if (visible) "隐藏内容" else "显示内容",
          )
        }
      }
    },
    visualTransformation = if (password && !visible) PasswordVisualTransformation() else VisualTransformation.None,
    minLines = minLines,
    singleLine = singleLine,
    keyboardOptions = keyboardOptions,
    keyboardActions = keyboardActions,
  )
}

@Composable
fun XyzwSnackbarHost(hostState: SnackbarHostState) {
  SnackbarHost(hostState = hostState)
}

@Composable
fun XyzwExpandableText(
  text: String,
  collapsedMaxLines: Int = 3,
  modifier: Modifier = Modifier,
) {
  var expanded by rememberSaveable(text) { mutableStateOf(false) }
  Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(4.dp)) {
    Text(
      text = text,
      style = MaterialTheme.typography.bodyMedium,
      maxLines = if (expanded) Int.MAX_VALUE else collapsedMaxLines,
      overflow = TextOverflow.Ellipsis,
    )
    if (text.length > 80) {
      TextButton(onClick = { expanded = !expanded }) {
        Text(if (expanded) "收起" else "展开")
      }
    }
  }
}

@Composable
fun SensitiveValueText(
  label: String,
  value: String,
  modifier: Modifier = Modifier,
  visiblePrefix: Int = 6,
  visibleSuffix: Int = 4,
) {
  var visible by rememberSaveable(value) { mutableStateOf(false) }
  Row(
    modifier = modifier.fillMaxWidth(),
    horizontalArrangement = Arrangement.spacedBy(8.dp),
    verticalAlignment = Alignment.CenterVertically,
  ) {
    Column(modifier = Modifier.weight(1f)) {
      Text(label, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
      Text(
        if (visible) value else value.maskSensitive(visiblePrefix, visibleSuffix),
        style = MaterialTheme.typography.bodyMedium,
        maxLines = if (visible) 4 else 1,
        overflow = TextOverflow.Ellipsis,
      )
    }
    IconButton(onClick = { visible = !visible }) {
      Icon(
        if (visible) Icons.Outlined.VisibilityOff else Icons.Outlined.Visibility,
        contentDescription = if (visible) "隐藏敏感值" else "显示敏感值",
      )
    }
  }
}

@Composable
fun XyzwSection(
  title: String,
  subtitle: String? = null,
  content: @Composable ColumnScope.() -> Unit,
) {
  XyzwCard {
    Text(title, style = MaterialTheme.typography.titleMedium)
    if (!subtitle.isNullOrBlank()) {
      Text(subtitle, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
    content()
  }
}

@Composable
fun XyzwTwoColumnStats(
  stats: List<Triple<String, String, String?>>,
) {
  Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
    stats.chunked(2).forEach { row ->
      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
      ) {
        row.forEach { (label, value, supporting) ->
          XyzwStatCard(
            label = label,
            value = value,
            supportingText = supporting,
            modifier = Modifier.weight(1f),
          )
        }
        if (row.size == 1) {
          Box(modifier = Modifier.weight(1f))
        }
      }
    }
  }
}

fun String.maskSensitive(prefix: Int = 6, suffix: Int = 4): String {
  val trimmed = trim()
  if (trimmed.length <= prefix + suffix + 3) {
    return "*".repeat(trimmed.length.coerceAtLeast(6))
  }
  return trimmed.take(prefix) + "..." + trimmed.takeLast(suffix)
}

fun statusLabel(status: String): String =
  when (status.lowercase()) {
    "enabled", "active", "open", "success", "succeeded", "read", "resolved", "paid" -> when (status.lowercase()) {
      "enabled" -> "已启用"
      "active" -> "已启用"
      "open" -> "待处理"
      "success", "succeeded" -> "成功"
      "read" -> "已读"
      "resolved" -> "已完成"
      "paid" -> "已支付"
      else -> status
    }

    "disabled", "inactive" -> "已禁用"
    "completed", "done" -> "已完成"
    "pending" -> "待处理"
    "processing", "running", "in_progress" -> "处理中"
    "failed", "error", "rejected" -> if (status.equals("rejected", ignoreCase = true)) "已驳回" else "失败"
    "unread" -> "未读"
    "admin" -> "管理员"
    "user" -> "普通用户"
    else -> status.ifBlank { "--" }
  }

private fun statusColor(status: String): Color =
  when (status.lowercase()) {
    "enabled", "active", "completed", "done", "read", "success", "succeeded", "resolved", "paid" -> SuccessGreen
    "pending", "processing", "running", "in_progress", "unread" -> WarningAmber
    "disabled", "inactive", "failed", "error", "rejected" -> DangerRed
    "admin" -> InfoBlue
    else -> InfoBlue
  }

