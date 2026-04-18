package com.xyzw.helper.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@Composable
fun DashboardScreen(
  uiState: DashboardUiState,
  showAdminEntry: Boolean,
  onRefresh: () -> Unit,
  onOpenRoles: () -> Unit,
  onOpenNotifications: () -> Unit,
  onOpenAdminHub: () -> Unit,
) {
  Column(
    modifier = Modifier
      .fillMaxSize()
      .padding(16.dp),
    verticalArrangement = Arrangement.spacedBy(12.dp),
  ) {
    Text(text = "控制台", style = MaterialTheme.typography.headlineSmall)
    Card(modifier = Modifier.fillMaxWidth()) {
      Column(
        modifier = Modifier.padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
      ) {
        Text("当前用户", style = MaterialTheme.typography.titleMedium)
        Text(uiState.user?.username ?: "未登录")
        Text(uiState.user?.email ?: "未提供邮箱")
        Text(if (uiState.wsConnected) "WebSocket：已连接" else "WebSocket：未连接")
      }
    }
    Card(modifier = Modifier.fillMaxWidth()) {
      Column(
        modifier = Modifier.padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
      ) {
        Text("版本信息", style = MaterialTheme.typography.titleMedium)
        Text("App: ${uiState.versionInfo?.appVersion ?: "--"}")
        Text("Backend: ${uiState.versionInfo?.backendVersion ?: "--"}")
        Text("Git SHA: ${uiState.versionInfo?.gitSha ?: "--"}")
      }
    }
    if (showAdminEntry) {
      Card(modifier = Modifier.fillMaxWidth()) {
        Column(
          modifier = Modifier.padding(16.dp),
          verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
          Text("管理员中心", style = MaterialTheme.typography.titleMedium)
          Text("当前账号具备管理员权限，可进入原生管理员模块处理账号、激活码、工单和推广数据。")
          OutlinedButton(onClick = onOpenAdminHub, modifier = Modifier.fillMaxWidth()) {
            Text("进入管理员中心")
          }
        }
      }
    }
    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
      Button(onClick = onOpenRoles) { Text("查看角色") }
      OutlinedButton(onClick = onOpenNotifications) { Text("查看通知") }
      OutlinedButton(onClick = onRefresh) { Text(if (uiState.isLoading) "刷新中…" else "刷新") }
    }
    if (!uiState.errorMessage.isNullOrBlank()) {
      Text(uiState.errorMessage, color = MaterialTheme.colorScheme.error)
    }
  }
}
