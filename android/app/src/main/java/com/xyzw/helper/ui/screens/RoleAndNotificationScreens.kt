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
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.xyzw.helper.data.model.NotificationItem
import com.xyzw.helper.data.storage.AppPreferences
import com.xyzw.helper.data.storage.ThemeMode

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
            Text("${role.server} / ${role.profession} / Lv.${role.level}")
            Text("激活状态: ${if (role.isActive) "启用" else "停用"}")
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
      Text("通知中心", style = MaterialTheme.typography.headlineSmall)
      Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        OutlinedButton(onClick = onMarkAllRead) { Text("全部已读") }
        OutlinedButton(onClick = onRefresh) { Text(if (uiState.isLoading) "刷新中…" else "刷新") }
      }
    }
    if (!uiState.errorMessage.isNullOrBlank()) {
      Text(uiState.errorMessage, color = MaterialTheme.colorScheme.error)
    }
    LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp)) {
      items(uiState.notifications, key = { it.id }) { notification ->
        NotificationCard(notification = notification, onMarkRead = onMarkRead)
      }
    }
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
        Text("当前用户: $currentUsername")
        Text("API_BASE_URL: ${preferences.apiBaseUrl}")
        Text("主题偏好: ${preferences.themeMode.name}")
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
          Text(mode.name)
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
  Card(modifier = Modifier.fillMaxWidth()) {
    Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
      Text(notification.title, style = MaterialTheme.typography.titleMedium)
      Text(notification.content, style = MaterialTheme.typography.bodyMedium)
      Text(
        text = notification.createdAt,
        style = MaterialTheme.typography.bodySmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
      )
      if (!notification.isRead) {
        OutlinedButton(onClick = { onMarkRead(notification.id) }) {
          Text("标记已读")
        }
      }
    }
  }
}
