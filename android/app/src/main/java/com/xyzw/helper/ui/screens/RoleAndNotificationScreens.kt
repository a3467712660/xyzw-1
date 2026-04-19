package com.xyzw.helper.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.xyzw.helper.data.model.NotificationItem
import com.xyzw.helper.data.storage.AppPreferences
import com.xyzw.helper.data.storage.ThemeMode
import com.xyzw.helper.ui.components.XyzwCard
import com.xyzw.helper.ui.components.XyzwConfirmDialog
import com.xyzw.helper.ui.components.XyzwEmptyState
import com.xyzw.helper.ui.components.XyzwErrorState
import com.xyzw.helper.ui.components.XyzwExpandableText
import com.xyzw.helper.ui.components.XyzwLoadingState
import com.xyzw.helper.ui.components.XyzwPage
import com.xyzw.helper.ui.components.XyzwStatusChip
import com.xyzw.helper.ui.formatters.formatDisplayDateTime

@Composable
fun RolesScreen(
  uiState: RolesUiState,
  onRefresh: () -> Unit,
) {
  Column(
    modifier = Modifier
      .fillMaxSize()
      .padding(16.dp),
    verticalArrangement = Arrangement.spacedBy(12.dp),
  ) {
    Row(
      modifier = Modifier.fillMaxWidth(),
      horizontalArrangement = Arrangement.SpaceBetween,
    ) {
      Text("角色列表", style = MaterialTheme.typography.headlineSmall)
      OutlinedButton(onClick = onRefresh) {
        Text(if (uiState.isLoading) "刷新中…" else "刷新")
      }
    }
    if (!uiState.errorMessage.isNullOrBlank()) {
      Text(uiState.errorMessage, color = MaterialTheme.colorScheme.error)
    }
    LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp)) {
      items(uiState.roles, key = { it.id }) { role ->
        Card(modifier = Modifier.fillMaxWidth()) {
          Column(modifier = Modifier.padding(16.dp)) {
            Text(role.name, style = MaterialTheme.typography.titleMedium)
            Text("${role.server} / ${role.profession} / 等级 ${role.level}")
            Text("激活状态：${if (role.isActive) "启用" else "停用"}")
          }
        }
      }
    }
  }
}

@Composable
fun NotificationsScreen(
  uiState: NotificationsUiState,
  onRefresh: () -> Unit,
  onMarkRead: (String) -> Unit,
  onMarkAllRead: () -> Unit,
  onClearAll: () -> Unit,
  onSetUnreadOnly: (Boolean) -> Unit,
  onConsumeMessage: () -> Unit,
) {
  val snackbarHostState = remember { SnackbarHostState() }
  var showClearConfirm by rememberSaveable { mutableStateOf(false) }

  LaunchedEffect(uiState.actionMessage, uiState.errorMessage) {
    uiState.actionMessage?.let { snackbarHostState.showSnackbar(it) }
    uiState.errorMessage?.let { snackbarHostState.showSnackbar(it) }
    if (uiState.actionMessage != null || uiState.errorMessage != null) {
      onConsumeMessage()
    }
  }

  XyzwPage(
    title = "通知中心",
    subtitle = "查看系统消息、任务提醒和处理状态。",
    onRefresh = onRefresh,
    snackbarHostState = snackbarHostState,
  ) {
    XyzwCard {
      Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        FilterChip(
          selected = !uiState.unreadOnly,
          onClick = { onSetUnreadOnly(false) },
          label = { Text("全部") },
        )
        FilterChip(
          selected = uiState.unreadOnly,
          onClick = { onSetUnreadOnly(true) },
          label = { Text("未读") },
        )
      }
      Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        OutlinedButton(onClick = onMarkAllRead, enabled = uiState.notifications.any { !it.isRead }) { Text("全部已读") }
        OutlinedButton(onClick = { showClearConfirm = true }, enabled = uiState.notifications.isNotEmpty()) { Text("清空") }
      }
    }

    if (!uiState.errorMessage.isNullOrBlank()) {
      XyzwErrorState(message = uiState.errorMessage, onRetry = onRefresh)
    }

    when {
      uiState.isLoading -> XyzwLoadingState("通知加载中...")
      uiState.notifications.isEmpty() -> XyzwEmptyState(
        title = if (uiState.unreadOnly) "暂无未读通知" else "暂无通知",
        description = "有新通知时会通过实时连接自动刷新。",
        primaryActionLabel = "刷新",
        onPrimaryAction = onRefresh,
      )

      else -> Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        uiState.notifications.forEach { notification ->
          NotificationCard(notification = notification, onMarkRead = onMarkRead)
        }
      }
    }
  }

  if (showClearConfirm) {
    XyzwConfirmDialog(
      title = "清空通知",
      message = "确认清空当前账号的所有通知？该操作不可撤销。",
      confirmLabel = "清空",
      destructive = true,
      onConfirm = {
        showClearConfirm = false
        onClearAll()
      },
      onDismiss = { showClearConfirm = false },
    )
  }
}

@Composable
fun PlaceholderScreen(
  title: String,
  description: String,
) {
  Column(
    modifier = Modifier
      .fillMaxSize()
      .padding(16.dp),
    verticalArrangement = Arrangement.spacedBy(12.dp),
  ) {
    Text(text = title, style = MaterialTheme.typography.headlineSmall)
    Text(text = description, style = MaterialTheme.typography.bodyLarge)
  }
}

@Composable
fun ProfileScreen(
  currentUsername: String,
  isAdmin: Boolean,
  preferences: AppPreferences,
  onThemeChange: (ThemeMode) -> Unit,
  onOpenAdminHub: () -> Unit,
  onLogout: () -> Unit,
) {
  Column(
    modifier = Modifier
      .fillMaxSize()
      .padding(16.dp),
    verticalArrangement = Arrangement.spacedBy(12.dp),
  ) {
    Text("我的", style = MaterialTheme.typography.headlineSmall)
    Card(modifier = Modifier.fillMaxWidth()) {
      Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("当前用户：$currentUsername")
        Text("接口地址：${preferences.apiBaseUrl}")
        Text("主题偏好：${themeModeLabel(preferences.themeMode)}")
      }
    }
    if (isAdmin) {
      OutlinedButton(
        onClick = onOpenAdminHub,
        modifier = Modifier.fillMaxWidth(),
      ) {
        Text("管理员中心")
      }
    }
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
      ThemeMode.entries.forEach { mode ->
        OutlinedButton(onClick = { onThemeChange(mode) }) {
          Text(themeModeLabel(mode))
        }
      }
    }
    Button(onClick = onLogout) {
      Text("退出登录")
    }
  }
}

@Composable
private fun NotificationCard(
  notification: NotificationItem,
  onMarkRead: (String) -> Unit,
) {
  XyzwCard {
    Row(
      modifier = Modifier.fillMaxWidth(),
      horizontalArrangement = Arrangement.SpaceBetween,
    ) {
      Text(notification.title, style = MaterialTheme.typography.titleMedium, modifier = Modifier.weight(1f))
      XyzwStatusChip(
        status = if (notification.isRead) "read" else "unread",
        label = if (notification.isRead) "已读" else "未读",
      )
    }
    XyzwExpandableText(notification.content)
    Text(
      text = formatDisplayDateTime(notification.createdAt),
      style = MaterialTheme.typography.bodySmall,
      color = MaterialTheme.colorScheme.onSurfaceVariant,
    )
    if (!notification.isRead) {
      OutlinedButton(onClick = { onMarkRead(notification.id) }, modifier = Modifier.fillMaxWidth()) {
        Text("标记已读")
      }
    }
  }
}

private fun themeModeLabel(mode: ThemeMode): String =
  when (mode) {
    ThemeMode.SYSTEM -> "跟随系统"
    ThemeMode.LIGHT -> "浅色"
    ThemeMode.DARK -> "深色"
  }
