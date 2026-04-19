package com.xyzw.helper.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.AdminPanelSettings
import androidx.compose.material.icons.outlined.Badge
import androidx.compose.material.icons.outlined.Feedback
import androidx.compose.material.icons.outlined.Key
import androidx.compose.material.icons.outlined.Notifications
import androidx.compose.material.icons.outlined.People
import androidx.compose.material.icons.outlined.SportsEsports
import androidx.compose.material.icons.outlined.TaskAlt
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.xyzw.helper.ui.components.ActionGrid
import com.xyzw.helper.ui.components.ActionGridItem
import com.xyzw.helper.ui.components.AppHero
import com.xyzw.helper.ui.components.DenseInfoRow
import com.xyzw.helper.ui.components.SectionCard
import com.xyzw.helper.ui.components.SummaryGrid
import com.xyzw.helper.ui.components.SummaryMetric
import com.xyzw.helper.ui.components.SurfacePrimaryButton
import com.xyzw.helper.ui.components.XyzwErrorState
import com.xyzw.helper.ui.components.XyzwLoadingState
import com.xyzw.helper.ui.components.XyzwPage
import com.xyzw.helper.ui.components.XyzwStatusChip

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
    onRefresh = onRefresh,
  ) {
    if (uiState.isLoading && uiState.versionInfo == null) {
      XyzwLoadingState("控制台加载中...")
    }

    AppHero(
      eyebrow = "控制台总览",
      title = "欢迎回来，${uiState.user?.username ?: "未登录"}",
      description = "账号、任务、通知和后端状态集中在同一张移动端工作台里。",
      meta = {
        XyzwStatusChip(
          status = if (uiState.wsConnected) "active" else "disabled",
          label = if (uiState.wsConnected) "实时连接已建立" else "实时连接未建立",
        )
        XyzwStatusChip(
          status = if (showAdminEntry) "admin" else "user",
          label = if (showAdminEntry) "管理员" else "普通用户",
        )
      },
      actions = {
        SurfacePrimaryButton(
          text = "刷新总览",
          onClick = onRefresh,
          modifier = Modifier.weight(1f),
          enabled = !uiState.isLoading,
        )
      },
    )

    SummaryGrid(
      items = listOf(
        SummaryMetric("角色数", uiState.roleCount.toString(), "已创建角色"),
        SummaryMetric("令牌数", uiState.tokenCount.toString(), "本机加密工作区"),
        SummaryMetric("任务完成率", uiState.taskCompletionPercent?.let { "$it%" } ?: "--", uiState.taskSummaryText),
        SummaryMetric("未读通知", uiState.unreadNotificationCount.toString(), "通知中心"),
      ),
    )

    SectionCard(
      title = "快捷入口",
      description = "把常用链路收成一屏，减少来回跳转。",
    ) {
      ActionGrid(
        items = buildDashboardActions(
          uiState = uiState,
          showAdminEntry = showAdminEntry,
          onOpenTokens = onOpenTokens,
          onOpenRoles = onOpenRoles,
          onOpenGameHub = onOpenGameHub,
          onOpenDailyTasks = onOpenDailyTasks,
          onOpenFeedback = onOpenFeedback,
          onOpenReferral = onOpenReferral,
          onOpenNotifications = onOpenNotifications,
          onOpenAdminHub = onOpenAdminHub,
        ),
      )
    }

    SectionCard(
      title = "版本信息",
      description = "当前应用访问的后端构建信息。",
    ) {
      DenseInfoRow("应用版本", uiState.versionInfo?.appVersion ?: "--")
      DenseInfoRow("后端版本", uiState.versionInfo?.backendVersion ?: "--")
      DenseInfoRow("代码提交", uiState.versionInfo?.gitSha ?: "--")
      Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        SurfacePrimaryButton(
          text = if (uiState.isLoading) "刷新中..." else "刷新",
          onClick = onRefresh,
          modifier = Modifier.weight(1f),
          enabled = !uiState.isLoading,
        )
      }
    }

    if (!uiState.errorMessage.isNullOrBlank()) {
      XyzwErrorState(message = uiState.errorMessage, onRetry = onRefresh)
    }
  }
}

private fun buildDashboardActions(
  uiState: DashboardUiState,
  showAdminEntry: Boolean,
  onOpenTokens: () -> Unit,
  onOpenRoles: () -> Unit,
  onOpenGameHub: () -> Unit,
  onOpenDailyTasks: () -> Unit,
  onOpenFeedback: () -> Unit,
  onOpenReferral: () -> Unit,
  onOpenNotifications: () -> Unit,
  onOpenAdminHub: () -> Unit,
): List<ActionGridItem> =
  buildList {
    add(ActionGridItem(title = "令牌管理", description = "导入、上传二进制文件、导出和删除令牌文件。", icon = Icons.Outlined.Key, badge = uiState.tokenCount.toString(), onClick = onOpenTokens))
    add(ActionGridItem(title = "角色管理", description = "创建、编辑、查看和删除游戏角色。", icon = Icons.Outlined.Badge, badge = uiState.roleCount.toString(), onClick = onOpenRoles))
    add(ActionGridItem(title = "日常任务", description = "按角色查看任务状态、配置自动执行和查看历史。", icon = Icons.Outlined.TaskAlt, badge = uiState.taskCompletionPercent?.let { "$it%" }, onClick = onOpenDailyTasks))
    add(ActionGridItem(title = "游戏功能", description = "进入原生游戏功能、军团战、阵容助手和战报。", icon = Icons.Outlined.SportsEsports, onClick = onOpenGameHub))
    add(ActionGridItem(title = "通知中心", description = "查看未读通知和系统消息。", icon = Icons.Outlined.Notifications, badge = uiState.unreadNotificationCount.takeIf { it > 0 }?.toString(), onClick = onOpenNotifications))
    add(ActionGridItem(title = "反馈中心", description = "提交问题反馈并查看处理结果。", icon = Icons.Outlined.Feedback, onClick = onOpenFeedback))
    add(ActionGridItem(title = "推广中心", description = "查看推广码、转化和返佣状态。", icon = Icons.Outlined.People, onClick = onOpenReferral))
    if (showAdminEntry) {
      add(ActionGridItem(title = "管理员中心", description = "处理账号、邀请码、激活码、工单和推广数据。", icon = Icons.Outlined.AdminPanelSettings, badge = "管理员", onClick = onOpenAdminHub))
    }
  }
