package com.xyzw.helper.ui.screens

import android.graphics.BitmapFactory
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Article
import androidx.compose.material.icons.outlined.CalendarMonth
import androidx.compose.material.icons.outlined.Flag
import androidx.compose.material.icons.outlined.PlayArrow
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material.icons.outlined.Save
import androidx.compose.material.icons.outlined.SportsEsports
import androidx.compose.material.icons.outlined.ViewList
import androidx.compose.material3.Button
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.SelectableDates
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.xyzw.helper.data.model.BattleReportItem
import com.xyzw.helper.data.model.GameLineup
import com.xyzw.helper.data.model.LegionWarSnapshot
import com.xyzw.helper.data.network.NetworkFactory
import com.xyzw.helper.ui.components.XyzwActionCard
import com.xyzw.helper.ui.components.XyzwCard
import com.xyzw.helper.ui.components.XyzwEmptyState
import com.xyzw.helper.ui.components.XyzwErrorState
import com.xyzw.helper.ui.components.XyzwLoadingState
import com.xyzw.helper.ui.components.XyzwPage
import com.xyzw.helper.ui.components.XyzwSection
import com.xyzw.helper.ui.components.XyzwStatCard
import com.xyzw.helper.ui.components.XyzwStatusChip
import com.xyzw.helper.ui.formatters.formatDisplayDateTime
import kotlinx.coroutines.launch
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.encodeToString

@Composable
fun GameHubScreen(
  tokenCount: Int,
  onBack: () -> Unit,
  onOpenGameFeatures: () -> Unit,
  onOpenLegionWar: () -> Unit,
  onOpenLineupAssistant: () -> Unit,
  onOpenBattleReports: () -> Unit,
) {
  XyzwPage(
    title = "游戏中心",
    subtitle = "原生游戏功能、阵容、军团战和战报入口。",
    onBack = onBack,
  ) {
    XyzwStatCard(
      label = "可用令牌",
      value = tokenCount.toString(),
      supportingText = "游戏功能使用服务端二进制文件，不在应用内暴露原始令牌。",
    )
    XyzwSection(title = "功能入口", subtitle = "所有入口均为安卓原生页面。") {
      XyzwActionCard(
        icon = Icons.Outlined.SportsEsports,
        title = "游戏功能",
        subtitle = "查看当前二进制文件状态并执行已允许的游戏命令。",
        onClick = onOpenGameFeatures,
      )
      XyzwActionCard(
        icon = Icons.Outlined.Flag,
        title = "军团战",
        subtitle = "刷新军团战态势，查看战场节点和战队摘要。",
        onClick = onOpenLegionWar,
      )
      XyzwActionCard(
        icon = Icons.Outlined.ViewList,
        title = "阵容助手",
        subtitle = "读取、保存、导入导出和应用已保存阵容。",
        onClick = onOpenLineupAssistant,
      )
      XyzwActionCard(
        icon = Icons.Outlined.Article,
        title = "战报功能",
        subtitle = "查询战报、粘贴解析并查看详情。",
        onClick = onOpenBattleReports,
      )
    }
  }
}

@Composable
fun GameFeaturesScreen(
  viewModel: GameFeaturesViewModel,
  onBack: () -> Unit,
) {
  val state by viewModel.uiState.collectAsStateWithLifecycle()
  val snackbarHostState = remember { SnackbarHostState() }
  val scope = rememberCoroutineScope()
  LaunchedEffect(state.actionMessage, state.errorMessage) {
    state.actionMessage?.let { snackbarHostState.showSnackbar(it) }
    state.errorMessage?.let { snackbarHostState.showSnackbar(it) }
    if (state.actionMessage != null || state.errorMessage != null) {
      viewModel.consumeMessage()
    }
  }
  GameFeaturesScreenContent(
    state = state,
    onBack = onBack,
    onRefresh = viewModel::refresh,
    onRunAction = viewModel::runAction,
    onRunWorkbenchAction = viewModel::runWorkbenchAction,
    onRenderReplay = viewModel::renderReplay,
    onSelectModule = viewModel::selectModule,
    onSelectSection = viewModel::selectSection,
    onSelectToken = viewModel::selectToken,
    snackbarHostState = snackbarHostState,
  )
}

@Composable
fun GameFeaturesScreenContent(
  state: GameFeaturesUiState,
  onBack: () -> Unit,
  onRefresh: () -> Unit,
  onRunAction: (String) -> Unit,
  onRunWorkbenchAction: (String, String) -> Unit = { _, _ -> },
  onRenderReplay: (String) -> Unit = {},
  onSelectModule: (String) -> Unit = {},
  onSelectSection: (String) -> Unit = {},
  onSelectToken: (String) -> Unit = {},
  snackbarHostState: SnackbarHostState = remember { SnackbarHostState() },
) {
  XyzwPage(
    title = "游戏功能",
    subtitle = "原生游戏工作台，模块结构与网页端保持一致。",
    onBack = onBack,
    onRefresh = onRefresh,
    snackbarHostState = snackbarHostState,
  ) {
    if (state.isLoading) {
      XyzwLoadingState("游戏功能加载中...")
    }
    if (state.workbenchCatalog.modules.isNotEmpty()) {
      GameFeaturesWorkbench(
        state = state,
        onRefresh = onRefresh,
        onRunWorkbenchAction = onRunWorkbenchAction,
        onRenderReplay = onRenderReplay,
        onSelectModule = onSelectModule,
        onSelectSection = onSelectSection,
        onSelectToken = onSelectToken,
      )
    } else {
      TokenPicker(state.tokens, state.selectedTokenId, onSelectToken)
      WorkbenchCommandBar(state = state, onRefresh = onRefresh)
      state.summary?.let { summary ->
        XyzwSection(title = "当前状态", subtitle = summary.recommendedAction.ifBlank { "等待操作" }) {
          XyzwStatusChip(
            status = if (summary.binAvailable) "active" else "warning",
            label = if (summary.binAvailable) "二进制文件可用" else "请先上传二进制文件",
          )
          Text(summary.roleName.ifBlank { "未读取角色名" }, style = MaterialTheme.typography.titleLarge)
          Text(summary.serverName.ifBlank { "服务器信息待读取" })
        }
      }
      if (state.catalog.features.isEmpty() && !state.isLoading) {
        XyzwEmptyState(
          title = "暂无游戏功能",
          description = "后端暂未返回可用功能。",
          primaryActionLabel = "重试",
          onPrimaryAction = onRefresh,
        )
      } else {
        XyzwSection(title = "可执行功能", subtitle = "点击后由后端使用服务端二进制文件执行。") {
          state.catalog.features.forEach { item ->
            XyzwActionCard(
              icon = Icons.Outlined.PlayArrow,
              title = item.title,
              subtitle = item.description,
              enabled = item.enabled && !state.isMutating && state.summary?.binAvailable != false,
              onClick = { onRunAction(item.id) },
            )
          }
        }
      }
    }
    state.errorMessage?.let { XyzwErrorState(message = it, onRetry = onRefresh) }
  }
}

@Composable
private fun GameFeaturesWorkbench(
  state: GameFeaturesUiState,
  onRefresh: () -> Unit,
  onRunWorkbenchAction: (String, String) -> Unit,
  onRenderReplay: (String) -> Unit,
  onSelectModule: (String) -> Unit,
  onSelectSection: (String) -> Unit,
  onSelectToken: (String) -> Unit,
) {
  val selectedModule = state.workbenchCatalog.modules.firstOrNull { it.id == state.selectedModuleId }
  val selectedGroup = state.workbenchCatalog.groups.firstOrNull { it.id == selectedModule?.groupId }
  val section = selectedModule?.sections?.firstOrNull { it.id == state.selectedSectionId }
  val summary = state.summary
  val tokenName = summary?.roleName?.ifBlank { null }
    ?: state.tokens.firstOrNull { it.id == state.selectedTokenId }?.displayName
    ?: "未选择角色"
  val binAvailable = summary?.binAvailable ?: state.tokens.firstOrNull { it.id == state.selectedTokenId }?.binFilePresent ?: false
  GameCommandBar(
    eyebrow = "Game Workbench",
    title = "游戏功能工作台",
    description = summary?.serverName?.ifBlank { null } ?: "按网页端日常、军团、活动、工具、PVP 和数据分析模块组织。",
    activeGroupName = selectedGroup?.label.orEmpty(),
    activeModuleName = selectedModule?.label.orEmpty(),
    connectionStatusText = connectionLabel(summary?.connectionStatus.orEmpty(), binAvailable),
    connectionTone = connectionTone(summary?.connectionStatus.orEmpty(), binAvailable),
    binAvailable = binAvailable,
    tokenName = tokenName,
    tokenCount = state.tokens.size,
    onRefresh = onRefresh,
  )
  TokenPicker(state.tokens, state.selectedTokenId, onSelectToken)
  GameModuleRail(
    groups = state.workbenchCatalog.groups.map { WorkbenchNavItem(it.id, it.label, it.caption) },
    modules = state.workbenchCatalog.modules.map { WorkbenchNavItem(it.id, it.label, it.description, it.groupId) },
    selectedModuleId = state.selectedModuleId,
    selectedSectionId = state.selectedSectionId,
    sectionItems = selectedModule?.sections.orEmpty().map { WorkbenchNavItem(it.id, it.label, it.description) },
    onSelectModule = onSelectModule,
    onSelectSection = onSelectSection,
  )
  GameStage(
    eyebrow = "当前阶段",
    groupLabel = selectedGroup?.label.orEmpty(),
    moduleName = section?.label ?: state.sectionSnapshot?.title ?: selectedModule?.label ?: "游戏工作台",
    moduleDescription = section?.description ?: selectedModule?.description.orEmpty(),
    statusText = state.sectionSnapshot?.status?.ifBlank { connectionLabel(summary?.connectionStatus.orEmpty(), binAvailable) }
      ?: connectionLabel(summary?.connectionStatus.orEmpty(), binAvailable),
    statusTone = connectionTone(state.sectionSnapshot?.status ?: summary?.connectionStatus.orEmpty(), binAvailable),
    overview = {
      WorkbenchSummaryGrid(
        listOf(
          WorkbenchSignal("当前分组", selectedGroup?.label ?: "--", selectedGroup?.caption.orEmpty(), "info"),
          WorkbenchSignal("当前模块", selectedModule?.label ?: "--", selectedModule?.description.orEmpty(), "info"),
          WorkbenchSignal("当前区域", section?.label ?: state.sectionSnapshot?.title ?: "--", section?.description.orEmpty(), "success"),
          WorkbenchSignal("建议动作", summary?.recommendedAction?.ifBlank { "检查连接和 BIN" } ?: "检查连接和 BIN", "由后端受控执行", if (binAvailable) "success" else "warning"),
        ),
      )
    },
  ) {
    val snapshot = state.sectionSnapshot
    if (snapshot == null && !state.isLoading) {
      XyzwEmptyState(
        title = "暂无模块数据",
        description = "请刷新工作台或切换模块后重试。",
      )
    }
    snapshot?.cards.orEmpty().forEach { card ->
      GameStatusCard(
        icon = workbenchIcon(card.iconKey, card.type),
        title = card.title.ifBlank { card.id },
        subtitle = card.subtitle.ifBlank { "等待后端返回结构化结果" },
        status = card.status,
        tone = card.tone,
        metrics = card.metrics.map { WorkbenchSignal(it.label, it.value, "", it.tone) },
        actions = {
          if (card.actions.isEmpty()) {
            WorkbenchSecondaryButton(
              text = "信息展示",
              enabled = false,
              onClick = {},
              modifier = Modifier.weight(1f),
            )
          } else {
            card.actions.take(2).forEach { action ->
              WorkbenchPrimaryButton(
                text = if (state.isMutating) "执行中..." else action.label,
                enabled = action.enabled && !state.isMutating && binAvailable,
                onClick = {
                  if (action.id == "render-replay" || card.type == "replay") {
                    onRenderReplay(card.id)
                  } else {
                    onRunWorkbenchAction(card.id, action.id)
                  }
                },
                modifier = Modifier.weight(1f),
              )
            }
          }
        },
      )
    }
    state.renderedReplay?.let { replay ->
      GameStatusCard(
        icon = Icons.Outlined.Article,
        title = "回放渲染结果",
        subtitle = replay.summary.ifBlank { "由后端生成截图和诊断，安卓端只做原生展示。" },
        status = "ready",
        tone = "success",
        metrics = listOf(
          WorkbenchSignal("渲染编号", replay.renderId, "", "info"),
          WorkbenchSignal("过期时间", replay.expiresAt.takeIf { it.isNotBlank() }?.let { formatDisplayDateTime(it) } ?: "--", "", "warning"),
        ),
        detail = {
          state.renderedReplayImageBytes?.let { bytes ->
            val bitmap = remember(bytes) {
              BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
            }
            if (bitmap != null) {
              Image(
                bitmap = bitmap.asImageBitmap(),
                contentDescription = "回放渲染图",
                modifier = Modifier.fillMaxWidth(),
              )
            }
          }
          Text("图片地址：${replay.imageUrl}", style = MaterialTheme.typography.bodySmall)
        },
      )
    }
  }
  GameInspector(
    title = "工作台检查器",
    subtitle = "同步 Web 端右侧检查器的信息层级。",
    facts = listOf(
      WorkbenchSignal("角色", tokenName, summary?.serverName.orEmpty(), if (state.selectedTokenId.isBlank()) "warning" else "success"),
      WorkbenchSignal("BIN 状态", if (binAvailable) "已就绪" else "待上传/恢复", "远程 BIN 仅走服务端安全链路", if (binAvailable) "success" else "warning"),
      WorkbenchSignal("连接状态", connectionLabel(summary?.connectionStatus.orEmpty(), binAvailable), "动作由后端 allowlist 执行", connectionTone(summary?.connectionStatus.orEmpty(), binAvailable)),
      WorkbenchSignal("模块", selectedModule?.label ?: "--", section?.label.orEmpty(), "info"),
    ),
    recommendationTitle = summary?.recommendedAction?.ifBlank { "先刷新工作台状态" } ?: "先刷新工作台状态",
    recommendationDetail = "如果 BIN 缺失，请先到 Token 管理上传或恢复 BIN；Android 不直接暴露 token、cookie、seed 或 signature。",
    isConnected = summary?.connectionStatus.equals("connected", true) || summary?.connectionStatus.equals("ready", true),
    onRefresh = onRefresh,
  )
}

@Composable
private fun WorkbenchCommandBar(
  state: GameFeaturesUiState,
  onRefresh: () -> Unit,
) {
  val summary = state.summary
  XyzwSection(title = "游戏工作台", subtitle = summary?.recommendedAction ?: "与网页端工作台一致的原生模块视图。") {
    XyzwStatusChip(
      status = if (summary?.binAvailable == true) "active" else "warning",
      label = if (summary?.binAvailable == true) "二进制文件可用" else "请先上传或恢复二进制文件",
    )
    Text(summary?.roleName?.ifBlank { null } ?: state.tokens.firstOrNull { it.id == state.selectedTokenId }?.displayName ?: "未选择角色", style = MaterialTheme.typography.titleLarge)
    Text(summary?.serverName?.ifBlank { "服务器信息待读取" } ?: "服务器信息待读取")
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
      XyzwStatCard("连接状态", summary?.connectionStatus?.ifBlank { "--" } ?: "--")
      XyzwStatCard("角色数", state.tokens.size.toString())
    }
    OutlinedButton(onClick = onRefresh, modifier = Modifier.fillMaxWidth()) {
      Icon(Icons.Outlined.Refresh, contentDescription = null)
      Text("刷新工作台")
    }
  }
}

@Composable
private fun WorkbenchModuleRail(
  state: GameFeaturesUiState,
  onSelectModule: (String) -> Unit,
  onSelectSection: (String) -> Unit,
) {
  XyzwSection(title = "模块导航", subtitle = "运营、战斗、分析分组与网页端保持一致。") {
    state.workbenchCatalog.groups.forEach { group ->
      Text(group.label, style = MaterialTheme.typography.titleMedium)
      group.caption.takeIf { it.isNotBlank() }?.let {
        Text(it, color = MaterialTheme.colorScheme.onSurfaceVariant)
      }
      state.workbenchCatalog.modules.filter { it.groupId == group.id }.forEach { module ->
        FilterChip(
          selected = state.selectedModuleId == module.id,
          onClick = { onSelectModule(module.id) },
          label = { Text(module.label) },
          modifier = Modifier.fillMaxWidth(),
        )
      }
    }
    val selectedModule = state.workbenchCatalog.modules.firstOrNull { it.id == state.selectedModuleId }
    if (selectedModule != null && selectedModule.sections.size > 1) {
      Text("子区域", style = MaterialTheme.typography.titleMedium)
      selectedModule.sections.forEach { section ->
        FilterChip(
          selected = state.selectedSectionId == section.id,
          onClick = { onSelectSection(section.id) },
          label = { Text(section.label) },
          modifier = Modifier.fillMaxWidth(),
        )
      }
    }
  }
}

@Composable
private fun WorkbenchStageSummary(state: GameFeaturesUiState) {
  val group = state.workbenchCatalog.groups.firstOrNull { it.id == state.workbenchCatalog.modules.firstOrNull { module -> module.id == state.selectedModuleId }?.groupId }
  val module = state.workbenchCatalog.modules.firstOrNull { it.id == state.selectedModuleId }
  val section = module?.sections?.firstOrNull { it.id == state.selectedSectionId }
  XyzwSection(title = "阶段摘要", subtitle = "当前分组、当前模块和建议动作。") {
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
      XyzwStatCard("当前分组", group?.label ?: "--")
      XyzwStatCard("当前模块", module?.label ?: "--")
    }
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
      XyzwStatCard("当前区域", section?.label ?: state.sectionSnapshot?.title ?: "--")
      XyzwStatCard("建议动作", state.summary?.recommendedAction?.ifBlank { "检查连接" } ?: "检查连接")
    }
  }
}

@Composable
private fun WorkbenchSectionContent(
  state: GameFeaturesUiState,
  onRunWorkbenchAction: (String, String) -> Unit,
  onRenderReplay: (String) -> Unit,
) {
  val snapshot = state.sectionSnapshot
  XyzwSection(
    title = snapshot?.title ?: "功能面板",
    subtitle = snapshot?.subtitle?.ifBlank { "按网页端功能卡片迁移为原生视图。" } ?: "按网页端功能卡片迁移为原生视图。",
  ) {
    if (snapshot == null && !state.isLoading) {
      XyzwEmptyState(
        title = "暂无模块数据",
        description = "请刷新工作台或切换模块后重试。",
      )
    }
    snapshot?.cards.orEmpty().forEach { card ->
      WorkbenchFeatureCard(
        card = card,
        isMutating = state.isMutating,
        onRunWorkbenchAction = onRunWorkbenchAction,
        onRenderReplay = onRenderReplay,
      )
    }
  }
}

@Composable
private fun WorkbenchFeatureCard(
  card: com.xyzw.helper.data.model.GameWorkbenchCard,
  isMutating: Boolean,
  onRunWorkbenchAction: (String, String) -> Unit,
  onRenderReplay: (String) -> Unit,
) {
  XyzwCard {
    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
      Icon(workbenchIcon(card.iconKey, card.type), contentDescription = null)
      Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(card.title.ifBlank { card.id }, style = MaterialTheme.typography.titleMedium)
        card.subtitle.takeIf { it.isNotBlank() }?.let {
          Text(it, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
      }
    }
    XyzwStatusChip(status = card.status.ifBlank { card.tone }, label = workbenchStatusLabel(card.status, card.tone))
    if (card.metrics.isNotEmpty()) {
      Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        card.metrics.take(2).forEach { metric ->
          XyzwStatCard(metric.label, metric.value)
        }
      }
      card.metrics.drop(2).forEach { metric ->
        Text("${metric.label}：${metric.value}")
      }
    }
    card.actions.forEach { action ->
      Button(
        onClick = {
          if (action.id == "render-replay" || card.type == "replay") {
            onRenderReplay(card.id)
          } else {
            onRunWorkbenchAction(card.id, action.id)
          }
        },
        enabled = action.enabled && !isMutating,
        modifier = Modifier.fillMaxWidth(),
      ) {
        Text(if (isMutating) "执行中..." else action.label)
      }
    }
    if (card.actions.isEmpty()) {
      Text("此卡片当前为信息展示模式", color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
  }
}

private fun workbenchIcon(iconKey: String, type: String) =
  when {
    iconKey.contains("rank", ignoreCase = true) || type == "rank" -> Icons.Outlined.ViewList
    iconKey.contains("pvp", ignoreCase = true) || type == "pvp" -> Icons.Outlined.SportsEsports
    iconKey.contains("replay", ignoreCase = true) || type == "replay" -> Icons.Outlined.Article
    iconKey.contains("calendar", ignoreCase = true) -> Icons.Outlined.CalendarMonth
    else -> Icons.Outlined.PlayArrow
  }

private fun workbenchStatusLabel(status: String, tone: String): String =
  when (status.ifBlank { tone }) {
    "ready", "success", "active" -> "可用"
    "disabled", "missing-bin" -> "不可用"
    "warning" -> "需注意"
    "danger" -> "高风险"
    else -> "信息"
  }

@Composable
fun LegionWarScreen(
  viewModel: LegionWarViewModel,
  onBack: () -> Unit,
) {
  val state by viewModel.uiState.collectAsStateWithLifecycle()
  val snackbarHostState = remember { SnackbarHostState() }
  LaunchedEffect(state.actionMessage, state.errorMessage) {
    state.actionMessage?.let { snackbarHostState.showSnackbar(it) }
    state.errorMessage?.let { snackbarHostState.showSnackbar(it) }
    if (state.actionMessage != null || state.errorMessage != null) {
      viewModel.consumeMessage()
    }
  }
  LegionWarScreenContent(
    state = state,
    onBack = onBack,
    onRefresh = viewModel::refresh,
    onBroadcastReviveInfo = viewModel::broadcastReviveInfo,
    onSelectToken = viewModel::selectToken,
    snackbarHostState = snackbarHostState,
  )
}

@Composable
fun LegionWarScreenContent(
  state: LegionWarUiState,
  onBack: () -> Unit,
  onRefresh: () -> Unit,
  onBroadcastReviveInfo: () -> Unit = {},
  onSelectToken: (String) -> Unit = {},
  snackbarHostState: SnackbarHostState = remember { SnackbarHostState() },
) {
  var distributionMode by rememberSaveable { mutableStateOf(false) }
  var individualMode by rememberSaveable { mutableStateOf(false) }
  val snapshot = state.snapshot
  val selectedToken = state.tokens.firstOrNull { it.id == state.selectedTokenId }
  val connected = snapshot != null
  val battlefieldText = snapshot?.battlefieldId?.ifBlank { "待同步" } ?: "待同步"
  XyzwPage(
    title = "军团战",
    subtitle = "战场态势控制台，使用原生地图和操作面板。",
    onBack = onBack,
    onRefresh = onRefresh,
    snackbarHostState = snackbarHostState,
  ) {
    if (state.isLoading) XyzwLoadingState("军团战数据刷新中...")
    GameCommandBar(
      eyebrow = "Legion War",
      title = "战场态势控制台",
      description = if (snapshot == null) "进入战场后刷新地图、战队和免费复活摘要。" else "当前战场 ${battlefieldText} 已同步，可切换布局和视角查看。",
      activeGroupName = "战斗",
      activeModuleName = "军团战",
      connectionStatusText = if (connected) "战场数据已同步" else "等待战场数据",
      connectionTone = if (connected) "success" else "warning",
      binAvailable = selectedToken?.binFilePresent == true,
      tokenName = selectedToken?.displayName ?: selectedToken?.roleName ?: "未选择角色",
      tokenCount = state.tokens.size,
      onRefresh = onRefresh,
    )
    TokenPicker(state.tokens, state.selectedTokenId, onSelectToken)
    if (snapshot == null && !state.isLoading) {
      XyzwEmptyState(
        title = "暂无军团战数据",
        description = "点击刷新后从后端安全接口读取战场态势。",
        primaryActionLabel = "刷新",
        onPrimaryAction = onRefresh,
      )
    } else if (snapshot != null) {
      WorkbenchSummaryGrid(
        listOf(
          WorkbenchSignal("战场编号", battlefieldText, "对应 Web 顶部摘要", "success"),
          WorkbenchSignal("地图布局", if (distributionMode) "分布布局" else "占领布局", "原生地图即时切换", "info"),
          WorkbenchSignal("战况视角", if (individualMode) "个人战况" else "战队战况", "列表和指标跟随切换", "info"),
          WorkbenchSignal("建筑节点", snapshot.nodes.size.toString(), "已识别 ${snapshot.legions.size} 个战队", "success"),
        ),
      )
      GameStage(
        eyebrow = "战场图示",
        groupLabel = "军团战",
        moduleName = "地图与战况",
        moduleDescription = "用原生地图近似 Web canvas，并保留节点列表和战队摘要。",
        statusText = "已同步",
        statusTone = "success",
      ) {
        LegionWarMapPanel(snapshot = snapshot, distributionMode = distributionMode)
        WorkbenchToggleRow(
          title = "地图布局",
          description = "在占领布局与分布布局间切换，不改变底层战场数据。",
          valueLabel = if (distributionMode) "当前：分布布局" else "当前：占领布局",
        ) {
          Switch(checked = distributionMode, onCheckedChange = { distributionMode = it })
        }
        WorkbenchToggleRow(
          title = "战况视角",
          description = "切换战队战况和个人战况，保持同一张战场地图。",
          valueLabel = if (individualMode) "当前：个人战况" else "当前：战队战况",
        ) {
          Switch(checked = individualMode, onCheckedChange = { individualMode = it })
        }
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
          WorkbenchPrimaryButton("拉取战场数据", enabled = !state.isLoading, onClick = onRefresh, modifier = Modifier.weight(1f))
          WorkbenchSecondaryButton(
            text = "发送免费复活",
            enabled = snapshot.legions.isNotEmpty(),
            onClick = onBroadcastReviveInfo,
            modifier = Modifier.weight(1f),
          )
        }
      }
      GameStage(
        eyebrow = if (individualMode) "个人战况" else "战队战况",
        groupLabel = "军团战",
        moduleName = if (individualMode) "个人战况列表" else "战队战况列表",
        moduleDescription = if (individualMode) "后端暂未返回个人明细时展示节点归属摘要。" else "战队、复活次数和占领节点摘要。",
        statusText = if (snapshot.legions.isNotEmpty()) "可查看" else "等待战队数据",
        statusTone = if (snapshot.legions.isNotEmpty()) "success" else "warning",
      ) {
        if (!individualMode && snapshot.legions.isNotEmpty()) {
          snapshot.legions.forEach { legion ->
            val occupied = snapshot.nodes.count { it.belongsLegionId == legion.id || it.belongsLegionName == legion.name }
            GameStatusCard(
              icon = Icons.Outlined.Flag,
              title = legion.name.ifBlank { legion.id },
              subtitle = "战队态势与免费复活摘要",
              status = "ready",
              tone = "success",
              metrics = listOf(
                WorkbenchSignal("剩余复活", legion.reviveLeft.toString(), "", "warning"),
                WorkbenchSignal("占领节点", occupied.toString(), "", "info"),
              ),
            )
          }
        } else {
          snapshot.nodes.take(24).forEach { node ->
            GameStatusCard(
              icon = Icons.Outlined.Flag,
              title = node.id,
              subtitle = node.typeName.ifBlank { "未知节点" },
              status = if (node.hp > 0) "ready" else "warning",
              tone = if (node.hp > 0) "success" else "warning",
              metrics = listOf(
                WorkbenchSignal("血量", "${node.hp}/${node.maxHp}", "", "warning"),
                WorkbenchSignal("所属", node.belongsLegionName.ifBlank { "无所属" }, "", "info"),
                WorkbenchSignal("分数", node.point.toString(), "", "info"),
              ),
            )
          }
          if (snapshot.nodes.size > 24) {
            Text(
              "已显示前 24 个节点，其余节点可通过刷新后的战况摘要继续查看。",
              style = MaterialTheme.typography.bodySmall,
              color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
          }
        }
      }
    }
    state.errorMessage?.let { XyzwErrorState(message = it, onRetry = onRefresh) }
  }
}

@Composable
private fun LegionWarMapPanel(
  snapshot: LegionWarSnapshot,
  distributionMode: Boolean,
) {
  Surface(
    modifier = Modifier
      .fillMaxWidth()
      .height(260.dp),
    shape = RoundedCornerShape(8.dp),
    color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.74f),
  ) {
    Box(modifier = Modifier.padding(12.dp)) {
      if (snapshot.nodes.isEmpty()) {
        Text(
          "暂无地图节点",
          modifier = Modifier.align(Alignment.Center),
          color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
      } else {
        Canvas(
          modifier = Modifier
            .fillMaxWidth()
            .height(236.dp)
            .background(MaterialTheme.colorScheme.surface.copy(alpha = 0.72f), RoundedCornerShape(8.dp)),
        ) {
          val coords = snapshot.nodes.mapIndexed { index, node ->
            val parts = node.id.split("_", ",", ":", "-").mapNotNull { it.toFloatOrNull() }
            val x = parts.getOrNull(0) ?: (index % 8).toFloat()
            val y = parts.getOrNull(1) ?: (index / 8).toFloat()
            Triple(node, x, y)
          }
          val minX = coords.minOf { it.second }
          val maxX = coords.maxOf { it.second }.coerceAtLeast(minX + 1f)
          val minY = coords.minOf { it.third }
          val maxY = coords.maxOf { it.third }.coerceAtLeast(minY + 1f)
          coords.forEach { (node, rawX, rawY) ->
            val normalizedX = (rawX - minX) / (maxX - minX)
            val normalizedY = (rawY - minY) / (maxY - minY)
            val x = 22.dp.toPx() + normalizedX * (size.width - 44.dp.toPx())
            val y = 22.dp.toPx() + normalizedY * (size.height - 44.dp.toPx())
            val color = if (distributionMode) legionColor(node.belongsLegionId, node.belongsLegionName) else legionColor(node.belongsLegionName, node.id)
            drawCircle(
              color = color.copy(alpha = if (node.hp > 0) 0.86f else 0.38f),
              radius = if (node.typeName.contains("营")) 9.dp.toPx() else 6.dp.toPx(),
              center = Offset(x, y),
            )
          }
        }
      }
    }
  }
}

private fun legionColor(seed: String, fallback: String): Color {
  val source = (seed.ifBlank { fallback }).ifBlank { "legion" }
  val palette = listOf(
    Color(0xFF1E88E5),
    Color(0xFF43A047),
    Color(0xFFF9A825),
    Color(0xFF8E24AA),
    Color(0xFFE53935),
    Color(0xFF00897B),
  )
  return palette[kotlin.math.abs(source.hashCode()) % palette.size]
}

@Composable
fun LineupAssistantScreen(
  viewModel: LineupAssistantViewModel,
  onBack: () -> Unit,
) {
  val state by viewModel.uiState.collectAsStateWithLifecycle()
  val snackbarHostState = remember { SnackbarHostState() }
  LaunchedEffect(state.actionMessage, state.errorMessage) {
    state.actionMessage?.let { snackbarHostState.showSnackbar(it) }
    state.errorMessage?.let { snackbarHostState.showSnackbar(it) }
    if (state.actionMessage != null || state.errorMessage != null) {
      viewModel.consumeMessage()
    }
  }
  LineupAssistantScreenContent(
    state = state,
    onBack = onBack,
    onRefresh = viewModel::refresh,
    onSave = viewModel::save,
    onApply = viewModel::apply,
    onSelectToken = viewModel::selectToken,
    snackbarHostState = snackbarHostState,
  )
}

@Composable
fun LineupAssistantScreenContent(
  state: LineupAssistantUiState,
  onBack: () -> Unit,
  onRefresh: () -> Unit,
  onSave: (List<GameLineup>) -> Unit,
  onApply: (String) -> Unit,
  onSelectToken: (String) -> Unit = {},
  snackbarHostState: SnackbarHostState = remember { SnackbarHostState() },
) {
  var jsonDraft by rememberSaveable { mutableStateOf("") }
  val scope = rememberCoroutineScope()
  val selectedToken = state.tokens.firstOrNull { it.id == state.selectedTokenId }
  val hasToken = selectedToken != null
  val hasBin = selectedToken?.binFilePresent == true
  val currentSlotText = state.currentFormation?.toString() ?: "--"
  XyzwPage(
    title = "阵容助手",
    subtitle = "阵容工作台，读取、保存、同步和应用走后端安全编排。",
    onBack = onBack,
    onRefresh = onRefresh,
    snackbarHostState = snackbarHostState,
  ) {
    GameCommandBar(
      eyebrow = "Lineup Workbench",
      title = "阵容工作台",
      description = when {
        !hasToken -> "先在 Token 管理页选择角色，再读取、保存或应用阵容。"
        !hasBin -> "当前角色缺少服务端 BIN，请先上传或恢复 BIN。"
        else -> "连接正常时可刷新当前阵容、保存方案、导入导出 JSON 并一键应用。"
      },
      activeGroupName = "工具",
      activeModuleName = "阵容助手",
      connectionStatusText = if (hasBin) "BIN 已就绪" else "等待 BIN",
      connectionTone = if (hasBin) "success" else "warning",
      binAvailable = hasBin,
      tokenName = selectedToken?.displayName ?: selectedToken?.roleName ?: "未选择角色",
      tokenCount = state.tokens.size,
      onRefresh = onRefresh,
    )
    TokenPicker(state.tokens, state.selectedTokenId, onSelectToken)
    if (state.isLoading) XyzwLoadingState("阵容读取中...")
    WorkbenchSummaryGrid(
      listOf(
        WorkbenchSignal("当前角色", selectedToken?.displayName ?: "未选择", selectedToken?.region.orEmpty(), if (hasToken) "success" else "warning"),
        WorkbenchSignal("WebSocket", if (hasBin) "后端可编排" else "待上传/恢复 BIN", "Android 不直接发送游戏命令", if (hasBin) "success" else "warning"),
        WorkbenchSignal("已保存阵容", state.lineups.size.toString(), "支持导入导出和服务端保存", "info"),
        WorkbenchSignal("当前阵容槽", currentSlotText, "刷新后由后端返回", "info"),
      ),
    )
    GameStage(
      eyebrow = "阵容面板",
      groupLabel = "工具",
      moduleName = "保存阵容、快速切换",
      moduleDescription = "对齐 Web 阵容助手的工具栏、槽位卡和保存方案面板。",
      statusText = if (state.lineups.isNotEmpty()) "已有方案" else "等待方案",
      statusTone = if (state.lineups.isNotEmpty()) "success" else "warning",
      overview = {
        WorkbenchToggleRow(
          title = "基础数据",
          description = "刷新当前阵容、武将、鱼灵和科技数据，作为保存和应用的依据。",
          valueLabel = if (state.isLoading) "读取中" else "可刷新",
        ) {
          WorkbenchSecondaryButton("刷新基础数据", enabled = !state.isLoading, onClick = onRefresh)
        }
      },
    ) {
      if (state.lineups.isEmpty()) {
        XyzwEmptyState(
          title = "暂无阵容",
          description = "可导入配置文本，或刷新后保存当前返回的阵容方案。",
        )
      }
      state.lineups.forEach { lineup ->
        GameStatusCard(
          icon = Icons.Outlined.ViewList,
          title = lineup.name,
          subtitle = "阵容槽：${lineup.teamId ?: "--"} · 最近更新：${lineup.updatedAt?.let { formatDisplayDateTime(it) } ?: "--"}",
          status = if (lineup.slots.isNotEmpty()) "ready" else "warning",
          tone = if (lineup.slots.isNotEmpty()) "success" else "warning",
          metrics = listOf(
            WorkbenchSignal("阵容槽", lineup.teamId?.toString() ?: "--", "", "info"),
            WorkbenchSignal("站位", lineup.slots.size.toString(), "", "success"),
          ),
          detail = {
            LineupSlotPreview(lineup)
          },
          actions = {
            WorkbenchPrimaryButton(
              text = if (state.isMutating) "应用中..." else "应用阵容",
              enabled = !state.isMutating && hasBin,
              onClick = { onApply(lineup.id) },
              modifier = Modifier.weight(1f),
            )
            WorkbenchSecondaryButton(
              text = "导出",
              enabled = true,
              onClick = {
                jsonDraft = NetworkFactory.json.encodeToString(ListSerializer(GameLineup.serializer()), listOf(lineup))
              },
              modifier = Modifier.weight(1f),
            )
          },
        )
      }
    }
    state.lastApplyResult?.let { result ->
      GameStage(
        eyebrow = "应用进度",
        groupLabel = "阵容助手",
        moduleName = "分步调试",
        moduleDescription = "显示后端 allowlist 编排返回的阶段结果，便于定位失败步骤。",
        statusText = "已返回",
        statusTone = "success",
      ) {
        if (result.stages.isEmpty()) {
          XyzwEmptyState(title = "暂无阶段明细", description = "后端未返回分步结果。")
        }
        result.stages.forEach { stage ->
          GameStatusCard(
            icon = Icons.Outlined.PlayArrow,
            title = stage.id,
            subtitle = stage.message.ifBlank { "等待阶段消息" },
            status = stage.status.ifBlank { "ready" },
            tone = connectionTone(stage.status, true),
            metrics = listOf(WorkbenchSignal("状态", stage.status.ifBlank { "--" }, "", connectionTone(stage.status, true))),
          )
        }
      }
    }
    GameStage(
      eyebrow = "导入导出",
      groupLabel = "阵容助手",
      moduleName = "保存方案同步",
      moduleDescription = "配置文本只在应用和后端保存接口之间传递，不上传原始令牌。",
      statusText = "本地编辑",
      statusTone = "info",
    ) {
      OutlinedTextField(
        value = jsonDraft,
        onValueChange = { jsonDraft = it },
        modifier = Modifier.fillMaxWidth(),
        label = { Text("阵容配置文本") },
        minLines = 4,
      )
      Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        WorkbenchSecondaryButton(
          text = "导出全部",
          enabled = true,
          onClick = {
            jsonDraft = NetworkFactory.json.encodeToString(ListSerializer(GameLineup.serializer()), state.lineups)
          },
          modifier = Modifier.weight(1f),
        )
        WorkbenchPrimaryButton(
          text = "导入保存",
          enabled = jsonDraft.isNotBlank() && !state.isMutating,
          onClick = {
            runCatching {
              NetworkFactory.json.decodeFromString(ListSerializer(GameLineup.serializer()), jsonDraft)
            }.onSuccess(onSave).onFailure {
              scope.launch { snackbarHostState.showSnackbar("阵容 JSON 解析失败") }
            }
          },
          modifier = Modifier.weight(1f),
        )
      }
    }
    state.errorMessage?.let { XyzwErrorState(message = it, onRetry = onRefresh) }
  }
}

@Composable
private fun LineupSlotPreview(lineup: GameLineup) {
  if (lineup.slots.isEmpty()) {
    Text("暂无站位明细", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    return
  }
  Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
    lineup.slots.chunked(3).forEach { row ->
      Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
        row.forEach { slot ->
          Surface(
            modifier = Modifier.weight(1f),
            shape = RoundedCornerShape(8.dp),
            color = MaterialTheme.colorScheme.surface.copy(alpha = 0.78f),
          ) {
            Column(modifier = Modifier.padding(8.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
              Text("站位 ${slot.position}", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
              Text(slot.heroName.ifBlank { slot.heroId.ifBlank { "空位" } }, style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.Medium)
              if (slot.artifactId.isNotBlank() || slot.pearlId.isNotBlank()) {
                Text(
                  listOfNotNull(
                    slot.artifactId.takeIf { it.isNotBlank() }?.let { "鱼灵 $it" },
                    slot.pearlId.takeIf { it.isNotBlank() }?.let { "鱼珠 $it" },
                  ).joinToString(" · "),
                  style = MaterialTheme.typography.labelSmall,
                  color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
              }
            }
          }
        }
        repeat(3 - row.size) {
          Box(modifier = Modifier.weight(1f))
        }
      }
    }
  }
}

@Composable
fun BattleReportsScreen(
  viewModel: BattleReportsViewModel,
  onBack: () -> Unit,
  onOpenDetail: (BattleReportItem) -> Unit,
) {
  val state by viewModel.uiState.collectAsStateWithLifecycle()
  val snackbarHostState = remember { SnackbarHostState() }
  LaunchedEffect(state.actionMessage, state.errorMessage) {
    state.actionMessage?.let { snackbarHostState.showSnackbar(it) }
    state.errorMessage?.let { snackbarHostState.showSnackbar(it) }
    if (state.actionMessage != null || state.errorMessage != null) {
      viewModel.consumeMessage()
    }
  }
  BattleReportsScreenContent(
    state = state,
    onBack = onBack,
    onRefresh = viewModel::refreshCatalog,
    onQuery = viewModel::queryReports,
    onParse = viewModel::parseReport,
    onOpenDetail = onOpenDetail,
    onSelectToken = viewModel::selectToken,
    onSelectType = viewModel::setReportType,
    onDateChange = viewModel::setQueryDate,
    snackbarHostState = snackbarHostState,
  )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BattleReportsScreenContent(
  state: BattleReportsUiState,
  onBack: () -> Unit,
  onRefresh: () -> Unit,
  onQuery: () -> Unit,
  onParse: (String) -> Unit,
  onOpenDetail: (BattleReportItem) -> Unit,
  onSelectToken: (String) -> Unit = {},
  onSelectType: (String) -> Unit = {},
  onDateChange: (String) -> Unit = {},
  snackbarHostState: SnackbarHostState = remember { SnackbarHostState() },
) {
  var manualText by rememberSaveable { mutableStateOf("") }
  var showDatePicker by rememberSaveable { mutableStateOf(false) }
  var activeReportModule by rememberSaveable { mutableStateOf("saltField") }
  var saltFieldSubTab by rememberSaveable { mutableStateOf("warrank") }
  var peachSubTab by rememberSaveable { mutableStateOf("peach") }
  val queryTypes = remember(state.catalog.types) {
    state.catalog.types.filter { isDateBackedBattleReportType(it.id) }
      .ifEmpty { state.catalog.types }
  }
  val selectedToken = state.tokens.firstOrNull { it.id == state.selectedTokenId }
  val selectedModule = reportModules().firstOrNull { it.id == activeReportModule } ?: reportModules().first()
  val activeSubTab = if (activeReportModule == "peachGarden") peachSubTab else saltFieldSubTab
  XyzwPage(
    title = "战报功能",
    subtitle = "战报工作区，盐场与蟠桃模块结构对齐网页端。",
    onBack = onBack,
    onRefresh = onRefresh,
    snackbarHostState = snackbarHostState,
  ) {
    GameCommandBar(
      eyebrow = "Report Center",
      title = "战报功能",
      description = "匹配详情、周月战绩、实时态势、蟠桃概览和对战战报统一放进原生工作区。",
      activeGroupName = "战报",
      activeModuleName = selectedModule.label,
      connectionStatusText = if (selectedToken?.binFilePresent == true) "BIN 已就绪" else "等待 BIN",
      connectionTone = if (selectedToken?.binFilePresent == true) "success" else "warning",
      binAvailable = selectedToken?.binFilePresent == true,
      tokenName = selectedToken?.displayName ?: selectedToken?.roleName ?: "未选择角色",
      tokenCount = state.tokens.size,
      onRefresh = onRefresh,
    )
    TokenPicker(state.tokens, state.selectedTokenId, onSelectToken)
    if (state.isLoading) XyzwLoadingState("战报加载中...")
    GameModuleRail(
      groups = listOf(WorkbenchNavItem("reports", "战报导航", "盐场、蟠桃战报统一入口")),
      modules = reportModules().map { WorkbenchNavItem(it.id, it.label, it.description, "reports") },
      selectedModuleId = activeReportModule,
      selectedSectionId = activeSubTab,
      sectionItems = selectedModule.subTabs.map { WorkbenchNavItem(it.id, it.label, it.description) },
      onSelectModule = { moduleId ->
        activeReportModule = moduleId
        val module = reportModules().firstOrNull { it.id == moduleId } ?: return@GameModuleRail
        onSelectType(module.reportType)
      },
      onSelectSection = { sectionId ->
        if (activeReportModule == "peachGarden") peachSubTab = sectionId else saltFieldSubTab = sectionId
      },
    )
    WorkbenchSummaryGrid(
      listOf(
        WorkbenchSignal("当前模块", selectedModule.label, selectedModule.description, "info"),
        WorkbenchSignal("当前视图", selectedModule.subTabs.firstOrNull { it.id == activeSubTab }?.label ?: "--", "对应 Web 子标签", "success"),
        WorkbenchSignal("比赛日期", state.queryDate.ifBlank { defaultBattleReportDate(state.selectedReportType) }, "默认最近可查询比赛日", "warning"),
        WorkbenchSignal("战报数量", state.reports.size.toString(), "列表和详情均为原生展示", "info"),
      ),
    )
    GameStage(
      eyebrow = selectedModule.label,
      groupLabel = "战报工作区",
      moduleName = selectedModule.subTabs.firstOrNull { it.id == activeSubTab }?.label ?: selectedModule.label,
      moduleDescription = selectedModule.subTabs.firstOrNull { it.id == activeSubTab }?.description ?: selectedModule.description,
      statusText = if (state.reports.isNotEmpty()) "有数据" else "等待查询",
      statusTone = if (state.reports.isNotEmpty()) "success" else "warning",
      overview = {
        BattleReportDatePickerRow(
          reportType = state.selectedReportType,
          queryDate = state.queryDate,
          onDateChange = onDateChange,
          onOpenDatePicker = { showDatePicker = true },
        )
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
          WorkbenchPrimaryButton(
            text = "查询战报",
            enabled = state.selectedTokenId.isNotBlank() && !state.isLoading,
            onClick = onQuery,
            modifier = Modifier.weight(1f),
          )
          WorkbenchSecondaryButton(
            text = "回到最近比赛日",
            enabled = true,
            onClick = { onDateChange(defaultBattleReportDate(state.selectedReportType)) },
            modifier = Modifier.weight(1f),
          )
        }
      },
    ) {
      if (queryTypes.size > 1) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
          queryTypes.forEach { type ->
            FilterChip(
              selected = state.selectedReportType == type.id,
              onClick = {
                onSelectType(type.id)
                activeReportModule = if (type.id == "peach-garden") "peachGarden" else "saltField"
              },
              label = { Text(type.title) },
            )
          }
        }
      }
      BattleReportPanel(
        moduleId = activeReportModule,
        subTab = activeSubTab,
        reports = state.reports,
        onOpenDetail = onOpenDetail,
      )
    }
    GameStage(
      eyebrow = "手动解析",
      groupLabel = "战报工作区",
      moduleName = "战报配置文本",
      moduleDescription = "用于本地粘贴战报 JSON，错误态保持原生提示。",
      statusText = if (manualText.isBlank()) "待输入" else "可解析",
      statusTone = if (manualText.isBlank()) "warning" else "success",
    ) {
      OutlinedTextField(
        value = manualText,
        onValueChange = { manualText = it },
        modifier = Modifier.fillMaxWidth(),
        label = { Text("战报配置文本") },
        minLines = 4,
      )
      WorkbenchSecondaryButton(
        text = "解析战报",
        enabled = manualText.isNotBlank(),
        onClick = { onParse(manualText) },
        modifier = Modifier.fillMaxWidth(),
      )
    }
    state.errorMessage?.let { XyzwErrorState(message = it, onRetry = onRefresh) }
  }

  if (showDatePicker) {
    BattleReportDatePickerDialog(
      reportType = state.selectedReportType,
      queryDate = state.queryDate,
      onDismiss = { showDatePicker = false },
      onDateSelected = { selected ->
        onDateChange(selected)
        showDatePicker = false
      },
    )
  }
}

private data class ReportWorkbenchModule(
  val id: String,
  val label: String,
  val description: String,
  val reportType: String,
  val subTabs: List<ReportSubTab>,
)

private data class ReportSubTab(
  val id: String,
  val label: String,
  val description: String,
)

private fun reportModules(): List<ReportWorkbenchModule> = listOf(
  ReportWorkbenchModule(
    id = "saltField",
    label = "盐场战报",
    description = "匹配详情、周战绩、月战绩、实时地图与实时战况。",
    reportType = "salt-field",
    subTabs = listOf(
      ReportSubTab("warrank", "匹配详情", "查看盐场匹配与战况摘要。"),
      ReportSubTab("weekBattle", "周战绩", "按最近比赛周查看战绩列表。"),
      ReportSubTab("monthBattle", "月战绩", "按月归档盐场战绩。"),
      ReportSubTab("legionWarMap", "实时地图", "以原生卡片展示地图摘要。"),
      ReportSubTab("legionWarStatistics", "实时战况", "展示实时战况与战队结果。"),
    ),
  ),
  ReportWorkbenchModule(
    id = "peachGarden",
    label = "蟠桃园战报",
    description = "蟠桃概览与对战战报并排归档。",
    reportType = "peach-garden",
    subTabs = listOf(
      ReportSubTab("peach", "蟠桃概览", "查看蟠桃活动总览。"),
      ReportSubTab("peachBattle", "对战战报", "查看蟠桃园对战战报。"),
    ),
  ),
)

@Composable
private fun BattleReportPanel(
  moduleId: String,
  subTab: String,
  reports: List<BattleReportItem>,
  onOpenDetail: (BattleReportItem) -> Unit,
) {
  val title = reportModules()
    .firstOrNull { it.id == moduleId }
    ?.subTabs
    ?.firstOrNull { it.id == subTab }
    ?.label ?: "战报列表"
  if (reports.isEmpty()) {
    XyzwEmptyState(
      title = "暂无$title",
      description = "请先选择比赛日期并查询，或切换战报模块。",
    )
    return
  }
  reports.forEach { report ->
    GameStatusCard(
      icon = Icons.Outlined.Article,
      title = report.title,
      subtitle = report.summary.ifBlank { title },
      status = "ready",
      tone = if (moduleId == "peachGarden") "warning" else "success",
      metrics = listOf(
        WorkbenchSignal("类型", report.reportType, "", "info"),
        WorkbenchSignal("时间", report.createdAt?.let { formatDisplayDateTime(it) } ?: "--", "", "warning"),
      ),
      actions = {
        WorkbenchPrimaryButton(
          text = "查看详情",
          enabled = true,
          onClick = { onOpenDetail(report) },
          modifier = Modifier.weight(1f),
        )
      },
    )
  }
}

@Composable
private fun BattleReportDatePickerRow(
  reportType: String,
  queryDate: String,
  onDateChange: (String) -> Unit,
  onOpenDatePicker: () -> Unit,
) {
  val defaultDate = defaultBattleReportDate(reportType)
  val visibleDate = queryDate.ifBlank { defaultDate }
  Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
    Text("比赛日期", style = MaterialTheme.typography.labelMedium)
    OutlinedButton(
      onClick = onOpenDatePicker,
      modifier = Modifier.fillMaxWidth(),
    ) {
      Icon(Icons.Outlined.CalendarMonth, contentDescription = null)
      Text("选择日期：$visibleDate")
    }
    OutlinedButton(
      onClick = { onDateChange(defaultDate) },
      modifier = Modifier.fillMaxWidth(),
      enabled = visibleDate != defaultDate,
    ) {
      Text("回到最近比赛日")
    }
  }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun BattleReportDatePickerDialog(
  reportType: String,
  queryDate: String,
  onDismiss: () -> Unit,
  onDateSelected: (String) -> Unit,
) {
  val initialDateMillis = battleReportDateToUtcMillis(queryDate)
    ?: battleReportDateToUtcMillis(defaultBattleReportDate(reportType))
  val selectableDates = remember(reportType) {
    object : SelectableDates {
      override fun isSelectableDate(utcTimeMillis: Long): Boolean =
        isSelectableBattleReportDate(
          reportType = reportType,
          date = battleReportDateFromUtcMillisToLocalDate(utcTimeMillis),
        )
    }
  }
  val pickerState = rememberDatePickerState(
    initialSelectedDateMillis = initialDateMillis,
    selectableDates = selectableDates,
  )
  DatePickerDialog(
    onDismissRequest = onDismiss,
    confirmButton = {
      TextButton(
        onClick = {
          pickerState.selectedDateMillis?.let { millis ->
            onDateSelected(battleReportDateFromUtcMillis(millis))
          } ?: onDismiss()
        },
      ) {
        Text("确定")
      }
    },
    dismissButton = {
      TextButton(onClick = onDismiss) {
        Text("取消")
      }
    },
  ) {
    DatePicker(state = pickerState)
  }
}

@Composable
fun BattleReportDetailScreen(
  report: BattleReportItem?,
  onBack: () -> Unit,
) {
  XyzwPage(
    title = "战报详情",
    subtitle = report?.reportType ?: "未选择战报",
    onBack = onBack,
  ) {
    if (report == null) {
      XyzwEmptyState(
        title = "未找到战报",
        description = "请返回战报列表重新选择。",
      )
    } else {
      XyzwSection(title = report.title, subtitle = formatDisplayDateTime(report.createdAt)) {
        Text(report.summary.ifBlank { "暂无摘要" }, style = MaterialTheme.typography.titleMedium)
        Text(
          text = report.detail?.toString() ?: "{}",
          style = MaterialTheme.typography.bodySmall,
        )
      }
    }
  }
}

@Composable
private fun TokenPicker(
  tokens: List<com.xyzw.helper.data.model.ImportedGameToken>,
  selectedTokenId: String,
  onSelectToken: (String) -> Unit,
) {
  XyzwSection(title = "令牌", subtitle = "仅使用已保存的服务端二进制文件。") {
    if (tokens.isEmpty()) {
      XyzwEmptyState(
        title = "暂无令牌",
        description = "请先在令牌管理中导入令牌并上传二进制文件。",
      )
    } else {
      tokens.forEach { token ->
        FilterChip(
          selected = token.id == selectedTokenId,
          onClick = { onSelectToken(token.id) },
          label = {
            Text(token.displayName.ifBlank { token.roleName.ifBlank { token.id } })
          },
          modifier = Modifier.fillMaxWidth(),
        )
      }
    }
  }
}
