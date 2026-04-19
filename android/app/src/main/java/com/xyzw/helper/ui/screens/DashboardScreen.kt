package com.xyzw.helper.ui.screens

import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.AdminPanelSettings
import androidx.compose.material.icons.outlined.Badge
import androidx.compose.material.icons.outlined.Feedback
import androidx.compose.material.icons.outlined.Key
import androidx.compose.material.icons.outlined.Notifications
import androidx.compose.material.icons.outlined.People
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material.icons.outlined.SportsEsports
import androidx.compose.material.icons.outlined.TaskAlt
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.xyzw.helper.ui.components.XyzwActionCard
import com.xyzw.helper.ui.components.XyzwErrorState
import com.xyzw.helper.ui.components.XyzwLoadingState
import com.xyzw.helper.ui.components.XyzwPage
import com.xyzw.helper.ui.components.XyzwSection
import com.xyzw.helper.ui.components.XyzwStatusChip
import com.xyzw.helper.ui.components.XyzwTwoColumnStats

@Composable
fun DashboardScreen(
  uiState: DashboardUiState,
  showAdminEntry: Boolean,
  onRefresh: () -> Unit,
  onOpenTokens: () -> Unit,
  onOpenRoles: () -> Unit,
  onOpenGameHub: () -> Unit,
  onOpenDailyTasks: () -> Unit,
  onOpenFeedback: () -> Unit,
  onOpenReferral: () -> Unit,
  onOpenNotifications: () -> Unit,
  onOpenAdminHub: () -> Unit,
) {
  XyzwPage(
    title = "控制台",
    subtitle = "账号、任务、通知和后端状态的总览。",
    onRefresh = onRefresh,
  ) {
    if (uiState.isLoading && uiState.versionInfo == null) {
      XyzwLoadingState("控制台加载中...")
    }

    XyzwSection(
      title = "当前用户",
      subtitle = uiState.user?.email ?: "未提供邮箱",
    ) {
      Text(uiState.user?.username ?: "未登录", style = MaterialTheme.typography.titleLarge)
      Row(horizontalArrangement = androidx.compose.foundation.layout.Arrangement.spacedBy(8.dp)) {
        XyzwStatusChip(
          status = if (uiState.wsConnected) "active" else "disabled",
          label = if (uiState.wsConnected) "WebSocket 已连接" else "WebSocket 未连接",
        )
        XyzwStatusChip(
          status = if (showAdminEntry) "admin" else "user",
          label = if (showAdminEntry) "管理员" else "普通用户",
        )
      }
    }

    XyzwTwoColumnStats(
      stats = listOf(
        Triple("角色数", uiState.roleCount.toString(), "已创建角色"),
        Triple("Token 数", uiState.tokenCount.toString(), "本机加密工作区"),
        Triple("任务完成率", uiState.taskCompletionPercent?.let { "$it%" } ?: "--", uiState.taskSummaryText),
        Triple("未读通知", uiState.unreadNotificationCount.toString(), "通知中心"),
      ),
    )

    XyzwSection(
      title = "快捷入口",
      subtitle = "高频功能可以从这里直接进入。",
    ) {
      XyzwActionCard(
        icon = Icons.Outlined.Key,
        title = "Token 管理",
        subtitle = "导入、上传 BIN、下载和删除 Token 文件。",
        badge = uiState.tokenCount.toString(),
        onClick = onOpenTokens,
      )
      XyzwActionCard(
        icon = Icons.Outlined.Badge,
        title = "角色管理",
        subtitle = "创建、编辑、查看和删除游戏角色。",
        badge = uiState.roleCount.toString(),
        onClick = onOpenRoles,
      )
      XyzwActionCard(
        icon = Icons.Outlined.TaskAlt,
        title = "日常任务",
        subtitle = "按角色查看任务状态、配置自动执行和查看历史。",
        badge = uiState.taskCompletionPercent?.let { "$it%" },
        onClick = onOpenDailyTasks,
      )
      XyzwActionCard(
        icon = Icons.Outlined.SportsEsports,
        title = "游戏功能",
        subtitle = "进入原生游戏功能、军团战、阵容助手和战报。",
        onClick = onOpenGameHub,
      )
      XyzwActionCard(
        icon = Icons.Outlined.Notifications,
        title = "通知中心",
        subtitle = "查看未读通知和系统消息。",
        badge = uiState.unreadNotificationCount.takeIf { it > 0 }?.toString(),
        onClick = onOpenNotifications,
      )
      XyzwActionCard(
        icon = Icons.Outlined.Feedback,
        title = "反馈中心",
        subtitle = "提交问题反馈并查看处理结果。",
        onClick = onOpenFeedback,
      )
      XyzwActionCard(
        icon = Icons.Outlined.People,
        title = "推广中心",
        subtitle = "查看推广码、转化和返佣状态。",
        onClick = onOpenReferral,
      )
      if (showAdminEntry) {
        XyzwActionCard(
          icon = Icons.Outlined.AdminPanelSettings,
          title = "管理员中心",
          subtitle = "处理账号、邀请码、激活码、工单和推广数据。",
          badge = "Admin",
          onClick = onOpenAdminHub,
        )
      }
    }

    XyzwSection(
      title = "版本信息",
      subtitle = "当前 App 访问的后端构建信息。",
    ) {
      Text("App: ${uiState.versionInfo?.appVersion ?: "--"}")
      Text("Backend: ${uiState.versionInfo?.backendVersion ?: "--"}")
      Text("Git SHA: ${uiState.versionInfo?.gitSha ?: "--"}")
      Button(onClick = onRefresh, modifier = Modifier.fillMaxWidth()) {
        Text(if (uiState.isLoading) "刷新中..." else "刷新")
      }
    }

    if (!uiState.errorMessage.isNullOrBlank()) {
      XyzwErrorState(message = uiState.errorMessage, onRetry = onRefresh)
    }
  }
}
