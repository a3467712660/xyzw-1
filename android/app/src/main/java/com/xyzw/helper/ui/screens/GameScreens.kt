package com.xyzw.helper.ui.screens

import android.graphics.BitmapFactory
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.Image
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
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
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.SelectableDates
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
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
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.xyzw.helper.data.model.BattleReportItem
import com.xyzw.helper.data.model.GameLineup
import com.xyzw.helper.data.model.GameWorkbenchCard
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
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull

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
  val sectionSnapshot = state.sectionSnapshot?.takeIf { snapshot ->
    snapshot.moduleId == selectedModule?.id && snapshot.sectionId == section?.id
  }
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
  if (selectedModule == null) {
    XyzwEmptyState(
      title = "模块不可用",
      description = "当前选中的模块不在工作台目录中，请刷新工作台或重新选择模块。",
      primaryActionLabel = "刷新工作台",
      onPrimaryAction = onRefresh,
    )
    return
  }
  if (section == null) {
    XyzwEmptyState(
      title = "暂无分区数据",
      description = "当前模块暂未返回可用分区，请刷新工作台或切换其他模块。",
      primaryActionLabel = "刷新工作台",
      onPrimaryAction = onRefresh,
    )
    return
  }
  WorkbenchHintCard(
    title = "权限与连接提示",
    description = when {
      state.selectedTokenId.isBlank() -> "当前没有选中角色，请先到 Token 管理选择可用角色。"
      !binAvailable -> "当前角色缺少服务端 BIN，请先上传或恢复 BIN 后再执行游戏功能。"
      summary?.connectionStatus.equals("error", true) -> "连接异常，建议刷新工作台或重新恢复 BIN。"
      else -> "当前仅通过后端 allowlist 执行动作，Android 不暴露 token、cookie、seed 或 signature。"
    },
    meta = "安全链路：登录态 + CSRF + refresh + WebSocket Origin 保持不降级",
    tone = if (binAvailable) connectionTone(summary?.connectionStatus.orEmpty(), true) else "warning",
  )
  GameStage(
    eyebrow = "当前阶段",
    groupLabel = selectedGroup?.label.orEmpty(),
    moduleName = section.label.ifBlank { sectionSnapshot?.title ?: selectedModule.label.ifBlank { "游戏工作台" } },
    moduleDescription = section.description.ifBlank { selectedModule.description },
    statusText = sectionSnapshot?.status?.ifBlank { connectionLabel(summary?.connectionStatus.orEmpty(), binAvailable) }
      ?: connectionLabel(summary?.connectionStatus.orEmpty(), binAvailable),
    statusTone = connectionTone(sectionSnapshot?.status ?: summary?.connectionStatus.orEmpty(), binAvailable),
    overview = {
      WorkbenchSummaryGrid(
        listOf(
          WorkbenchSignal("当前分组", selectedGroup?.label ?: "--", selectedGroup?.caption.orEmpty(), "info"),
          WorkbenchSignal("当前模块", selectedModule.label.ifBlank { "--" }, selectedModule.description, "info"),
          WorkbenchSignal("当前区域", section.label.ifBlank { sectionSnapshot?.title ?: "--" }, section.description, "success"),
          WorkbenchSignal("建议动作", summary?.recommendedAction?.ifBlank { "检查连接和 BIN" } ?: "检查连接和 BIN", "由后端受控执行", if (binAvailable) "success" else "warning"),
        ),
      )
      WorkbenchInfoPanel(
        title = "模块详情",
        subtitle = "与 Web 工作台一致保留分组、模块、分区和建议动作。",
        rows = listOf(
          WorkbenchSignal("模块 ID", selectedModule.id.ifBlank { "--" }, selectedModule.description, "info"),
          WorkbenchSignal("分区 ID", section.id.ifBlank { state.selectedSectionId.ifBlank { "--" } }, section.description, "success"),
          WorkbenchSignal("卡片数量", sectionSnapshot?.cards?.size?.toString() ?: "0", "由后端工作台 DTO 返回", "info"),
          WorkbenchSignal("连接状态", connectionLabel(summary?.connectionStatus.orEmpty(), binAvailable), "动作按钮会随 BIN 和连接状态禁用", connectionTone(summary?.connectionStatus.orEmpty(), binAvailable)),
        ),
      )
      WorkbenchTimeline(
        title = "最近活动",
        items = buildList {
          sectionSnapshot?.updatedAt?.takeIf { it.isNotBlank() }?.let {
            add(WorkbenchSignal("模块刷新", formatDisplayDateTime(it), sectionSnapshot.title, "success"))
          }
          state.actionMessage?.takeIf { it.isNotBlank() }?.let {
            add(WorkbenchSignal("动作结果", it, "后端 allowlist 执行结果", "success"))
          }
          state.renderedReplay?.let {
            add(WorkbenchSignal("回放渲染", it.renderId, it.summary, "info"))
          }
        },
      )
    },
  ) {
    val snapshot = sectionSnapshot
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
        detail = {
          GameWorkbenchCardDetail(card)
        },
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
          WorkbenchInfoPanel(
            title = "回放诊断",
            rows = detailRows(replay.diagnostics, limit = 4),
          )
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
      WorkbenchSignal("模块", selectedModule.label.ifBlank { "--" }, section.label, "info"),
    ),
    recommendationTitle = summary?.recommendedAction?.ifBlank { "先刷新工作台状态" } ?: "先刷新工作台状态",
    recommendationDetail = "如果 BIN 缺失，请先到 Token 管理上传或恢复 BIN；Android 不直接暴露 token、cookie、seed 或 signature。",
    isConnected = summary?.connectionStatus.equals("connected", true) || summary?.connectionStatus.equals("ready", true),
    onRefresh = onRefresh,
  )
}

@Composable
private fun GameWorkbenchCardDetail(card: GameWorkbenchCard) {
  val rows = detailRows(card.detail)
  if (rows.isNotEmpty()) {
    WorkbenchInfoPanel(
      title = "卡片详情",
      subtitle = "优先展示结构化字段，避免在移动端直接铺满原始 JSON。",
      rows = rows,
    )
  } else {
    WorkbenchHintCard(
      title = "卡片详情",
      description = "后端暂未返回该卡片的结构化详情，当前显示指标和动作摘要。",
      tone = "info",
    )
  }
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

private fun detailRows(detail: JsonElement?, limit: Int = 6): List<WorkbenchSignal> =
  when (detail) {
    is JsonObject -> detail.entries.take(limit).map { (key, value) ->
      WorkbenchSignal(key, compactJsonValue(value), "", "info")
    }
    is JsonArray -> listOf(
      WorkbenchSignal("条目数量", detail.size.toString(), "数组详情仅显示摘要", "info"),
      WorkbenchSignal("预览", detail.take(3).joinToString(" / ") { compactJsonValue(it) }, "", "success"),
    )
    is JsonPrimitive -> listOf(WorkbenchSignal("值", detail.contentOrNull ?: detail.toString(), "", "info"))
    else -> emptyList()
  }

private fun compactJsonValue(value: JsonElement): String =
  when (value) {
    is JsonPrimitive -> value.contentOrNull ?: value.toString()
    is JsonArray -> "数组 ${value.size} 项"
    is JsonObject -> "对象 ${value.size} 项"
    else -> value.toString()
  }.take(80)

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
      WorkbenchInfoPanel(
        title = "实时状态",
        subtitle = "对应 Web 顶部状态栏和战场摘要。",
        rows = listOf(
          WorkbenchSignal("同步状态", "战场数据已同步", "刷新按钮会重新读取服务端安全接口", "success"),
          WorkbenchSignal("据点总数", snapshot.nodes.size.toString(), "包含营地、据点和路线节点", "info"),
          WorkbenchSignal("战队数量", snapshot.legions.size.toString(), "免费复活广播以该列表为准", if (snapshot.legions.isNotEmpty()) "success" else "warning"),
          WorkbenchSignal("当前视角", if (individualMode) "个人战况" else "战队战况", if (distributionMode) "分布布局" else "占领布局", "info"),
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
        WorkbenchLegend(
          title = "地图图例",
          items = listOf(
            WorkbenchSignal("已占领/高血量", "绿色", "节点仍可参与态势判断", "success"),
            WorkbenchSignal("待争夺/低血量", "黄色", "需要关注复活和路线变化", "warning"),
            WorkbenchSignal("失守/未知", "灰色", "后端未返回完整状态时降级显示", "disabled"),
          ),
        )
        WorkbenchRouteList(
          title = "路线与据点",
          routes = snapshot.nodes.take(10).map { node ->
            WorkbenchSignal(
              label = node.id,
              value = node.typeName.ifBlank { "未知节点" },
              meta = "归属：${node.belongsLegionName.ifBlank { "无所属" }} · 血量：${node.hp}/${node.maxHp}",
              tone = if (node.hp > 0) "success" else "warning",
            )
          },
        )
        WorkbenchHintCard(
          title = "操作面板",
          description = "布局切换、战况视角、刷新战场和频道广播集中在这里；Android 使用原生控件替代 Web canvas 工具条。",
          tone = "info",
        )
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
  val routeColor = MaterialTheme.colorScheme.outline.copy(alpha = 0.26f)
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
          val pointFor = { item: Triple<com.xyzw.helper.data.model.LegionWarNode, Float, Float> ->
            val normalizedX = (item.second - minX) / (maxX - minX)
            val normalizedY = (item.third - minY) / (maxY - minY)
            Offset(
              22.dp.toPx() + normalizedX * (size.width - 44.dp.toPx()),
              22.dp.toPx() + normalizedY * (size.height - 44.dp.toPx()),
            )
          }
          coords.zipWithNext().forEach { (from, to) ->
            drawLine(
              color = routeColor,
              start = pointFor(from),
              end = pointFor(to),
              strokeWidth = 1.2.dp.toPx(),
            )
          }
          coords.forEach { (node, rawX, rawY) ->
            val point = pointFor(Triple(node, rawX, rawY))
            val color = if (distributionMode) legionColor(node.belongsLegionId, node.belongsLegionName) else legionColor(node.belongsLegionName, node.id)
            drawCircle(
              color = color.copy(alpha = if (node.hp > 0) 0.86f else 0.38f),
              radius = if (node.typeName.contains("营")) 9.dp.toPx() else 6.dp.toPx(),
              center = point,
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
    WorkbenchHintCard(
      title = "云同步状态",
      description = "保存方案通过服务端偏好接口同步，导入导出只处理阵容 JSON，不携带原始令牌。",
      meta = if (state.lineups.isEmpty()) "暂无可同步阵容" else "已缓存 ${state.lineups.size} 套阵容",
      tone = if (state.lineups.isEmpty()) "warning" else "success",
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
      WorkbenchInfoPanel(
        title = "阵容槽位棋盘",
        subtitle = "以 1-6 站位为主视图，保留 Web 端槽位密度和鱼灵/鱼珠摘要。",
        rows = listOf(
          WorkbenchSignal("当前阵容槽", currentSlotText, "后端返回 currentFormation 后更新", "info"),
          WorkbenchSignal("已保存方案", state.lineups.size.toString(), "可导出、导入和应用", if (state.lineups.isNotEmpty()) "success" else "warning"),
          WorkbenchSignal("可应用状态", if (hasBin) "后端可编排" else "等待 BIN", "应用流程不在 Android 直连游戏 WebSocket", if (hasBin) "success" else "warning"),
        ),
      )
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
            LineupEquipmentFishPanel(lineup)
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
        WorkbenchDebugStageList(
          title = "调试面板",
          stages = result.stages.map { stage ->
            WorkbenchSignal(
              label = stage.id,
              value = stage.status.ifBlank { "--" },
              meta = stage.message.ifBlank { "等待阶段消息" },
              tone = connectionTone(stage.status, true),
            )
          },
        )
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
private fun LineupEquipmentFishPanel(lineup: GameLineup) {
  val artifactCount = lineup.slots.count { it.artifactId.isNotBlank() }
  val pearlCount = lineup.slots.count { it.pearlId.isNotBlank() }
  Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
    WorkbenchInfoPanel(
      title = "装备/鱼灵诊断",
      subtitle = "Android 先展示后端已返回的鱼灵/鱼珠字段，装备精炼详情缺失时明确降级。",
      rows = buildList {
        add(WorkbenchSignal("鱼灵数量", artifactCount.toString(), "来自 artifactId", if (artifactCount > 0) "success" else "warning"))
        add(WorkbenchSignal("鱼珠数量", pearlCount.toString(), "来自 pearlId", if (pearlCount > 0) "success" else "warning"))
        add(WorkbenchSignal("装备详情", "后端未返回装备详情", "等待后端返回 equipment/refine 结构化 DTO", "warning"))
        lineup.slots.firstOrNull { it.artifactId.isNotBlank() || it.pearlId.isNotBlank() }?.let { slot ->
          add(
            WorkbenchSignal(
              label = "示例槽位 ${slot.position}",
              value = listOfNotNull(
                slot.artifactId.takeIf { it.isNotBlank() }?.let { "鱼灵 $it" },
                slot.pearlId.takeIf { it.isNotBlank() }?.let { "鱼珠 $it" },
              ).joinToString(" · "),
              meta = slot.heroName.ifBlank { slot.heroId.ifBlank { "未知英雄" } },
              tone = "info",
            ),
          )
        }
      },
    )
    WorkbenchHintCard(
      title = "装备详情缺失提示",
      description = "后端未返回装备详情，当前仅展示鱼灵和鱼珠摘要，装备/精炼 DTO 补齐前不会伪造数据。",
      tone = "warning",
    )
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
  LaunchedEffect(state.parsedReport?.id) {
    state.parsedReport?.let { report ->
      onOpenDetail(report)
      viewModel.consumeParsedReport()
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
  var showManualSheet by rememberSaveable { mutableStateOf(false) }
  val manualSheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
  val queryTypes = remember(state.catalog.types) {
    state.catalog.types.filter { isDateBackedBattleReportType(it.id) }
      .ifEmpty { state.catalog.types }
  }
  LaunchedEffect(state.parsedReport?.id) {
    if (state.parsedReport != null) {
      showManualSheet = false
      manualText = ""
    }
  }
  XyzwPage(
    title = "战报",
    onBack = onBack,
    onRefresh = onRefresh,
    snackbarHostState = snackbarHostState,
  ) {
    CompactTokenPicker(state.tokens, state.selectedTokenId, onSelectToken)
    if (state.isLoading) XyzwLoadingState("战报加载中...")
    BattleReportTypeSegment(
      queryTypes = queryTypes,
      selectedReportType = state.selectedReportType,
      onSelectType = onSelectType,
      onOpenManual = { showManualSheet = true },
    )
    XyzwSection(title = "查询", subtitle = "选择比赛日后查询当前角色战报。") {
      BattleReportDatePickerRow(
        reportType = state.selectedReportType,
        queryDate = state.queryDate,
        onDateChange = onDateChange,
        onOpenDatePicker = { showDatePicker = true },
      )
      WorkbenchPrimaryButton(
        text = if (state.isLoading) "查询中..." else "查询战报",
        enabled = state.selectedTokenId.isNotBlank() && !state.isLoading && state.selectedReportType != "manual",
        onClick = onQuery,
        modifier = Modifier.fillMaxWidth(),
      )
    }
    BattleReportCompactList(
      state = state,
      onOpenDetail = onOpenDetail,
      onResetDate = { onDateChange(defaultBattleReportDate(state.selectedReportType)) },
    )
    WorkbenchSecondaryButton(
      text = "粘贴解析",
      enabled = !state.isLoading,
      onClick = { showManualSheet = true },
      modifier = Modifier.fillMaxWidth(),
    )
    state.errorMessage?.let { XyzwErrorState(message = it, onRetry = onRefresh) }
  }

  if (showManualSheet) {
    ModalBottomSheet(
      onDismissRequest = { showManualSheet = false },
      sheetState = manualSheetState,
    ) {
      Column(
        modifier = Modifier
          .fillMaxWidth()
          .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
      ) {
        Text("粘贴解析", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
        OutlinedTextField(
          value = manualText,
          onValueChange = { manualText = it },
          modifier = Modifier.fillMaxWidth(),
          label = { Text("战报 JSON") },
          minLines = 6,
        )
        WorkbenchPrimaryButton(
          text = if (state.isLoading) "解析中..." else "解析战报",
          enabled = manualText.isNotBlank() && !state.isLoading,
          onClick = { onParse(manualText) },
          modifier = Modifier.fillMaxWidth(),
        )
        state.errorMessage?.let {
          Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error)
        }
      }
    }
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
  ReportWorkbenchModule(
    id = "legionWarReports",
    label = "军团战战报",
    description = "军团战摘要、地图和实时统计。",
    reportType = "salt-field",
    subTabs = listOf(
      ReportSubTab("legionWarSummary", "军团战摘要", "查看军团战总览和关键状态。"),
      ReportSubTab("legionWarMap", "军团战地图", "复用原生军团战地图摘要入口。"),
      ReportSubTab("legionWarStatistics", "军团战统计", "展示节点、路线和战队统计。"),
    ),
  ),
)

@Composable
private fun CompactTokenPicker(
  tokens: List<com.xyzw.helper.data.model.ImportedGameToken>,
  selectedTokenId: String,
  onSelectToken: (String) -> Unit,
) {
  if (tokens.isEmpty()) {
    XyzwEmptyState(
      title = "暂无令牌",
      description = "请先在令牌管理中导入令牌并上传 BIN。",
    )
    return
  }
  Row(
    modifier = Modifier
      .fillMaxWidth()
      .horizontalScroll(rememberScrollState()),
    horizontalArrangement = Arrangement.spacedBy(8.dp),
  ) {
    tokens.forEach { token ->
      FilterChip(
        selected = token.id == selectedTokenId,
        onClick = { onSelectToken(token.id) },
        label = {
          Text(token.displayName.ifBlank { token.roleName.ifBlank { token.id } })
        },
      )
    }
  }
}

@Composable
private fun BattleReportTypeSegment(
  queryTypes: List<com.xyzw.helper.data.model.BattleReportType>,
  selectedReportType: String,
  onSelectType: (String) -> Unit,
  onOpenManual: () -> Unit,
) {
  val defaultTypes = listOf(
    com.xyzw.helper.data.model.BattleReportType("salt-field", "盐场"),
    com.xyzw.helper.data.model.BattleReportType("peach-garden", "蟠桃园"),
  )
  val available = (queryTypes + defaultTypes)
    .filter { it.id != "manual" }
    .distinctBy { it.id }
  Row(
    modifier = Modifier.fillMaxWidth(),
    horizontalArrangement = Arrangement.spacedBy(8.dp),
  ) {
    available.forEach { type ->
      FilterChip(
        selected = selectedReportType == type.id,
        onClick = { onSelectType(type.id) },
        modifier = Modifier.weight(1f),
        label = {
          Text(
            when (type.id) {
              "salt-field" -> "盐场"
              "peach-garden" -> "蟠桃园"
              else -> type.title.ifBlank { "战报" }
            },
          )
        },
      )
    }
    FilterChip(
      selected = selectedReportType == "manual",
      onClick = {
        onSelectType("manual")
        onOpenManual()
      },
      modifier = Modifier.weight(1f),
      label = { Text("手动") },
    )
  }
}

@Composable
private fun BattleReportCompactList(
  state: BattleReportsUiState,
  onOpenDetail: (BattleReportItem) -> Unit,
  onResetDate: () -> Unit,
) {
  XyzwSection(title = "结果", subtitle = "${state.reports.size} 条战报") {
    if (state.reports.isEmpty()) {
      val reason = state.emptyReason.ifBlank { "暂无战报" }
      val isNoData = state.businessCode == "200020"
      XyzwEmptyState(
        title = reason,
        description = if (isNoData) {
          "可尝试切换到最近比赛日"
        } else {
          "请选择比赛日期并查询，或使用粘贴解析。"
        },
        primaryActionLabel = if (state.selectedReportType != "manual") "回到最近比赛日" else null,
        onPrimaryAction = if (state.selectedReportType != "manual") onResetDate else null,
      )
      if (isNoData) {
        Text("确认该角色是否参加", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text("确认 BIN 是否属于当前角色", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
      }
      return@XyzwSection
    }
    state.reports.forEach { report ->
      BattleReportCompactSummaryCard(report = report, onOpenDetail = onOpenDetail)
    }
  }
}

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
  BattleReportSpecialCard(moduleId = moduleId, subTab = subTab, reportCount = reports.size)
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
private fun BattleReportSpecialCard(
  moduleId: String,
  subTab: String,
  reportCount: Int,
) {
  val (title, subtitle, tone) = when {
    moduleId == "peachGarden" && subTab == "peachBattle" ->
      Triple("蟠桃对战卡", "对齐 Web 蟠桃园对战战报，展示双方结果和摘要。", "warning")
    moduleId == "peachGarden" ->
      Triple("蟠桃概览卡", "对齐 Web 蟠桃概览，先展示活动概况，再进入对战列表。", "warning")
    moduleId == "legionWarReports" && subTab == "legionWarMap" ->
      Triple("军团战地图卡", "军团战地图在 Android 中使用原生摘要和入口替代 Web canvas。", "info")
    moduleId == "legionWarReports" && subTab == "legionWarStatistics" ->
      Triple("军团战统计卡", "展示节点、路线和战队统计，缺失明细时保留空态。", "success")
    moduleId == "legionWarReports" ->
      Triple("军团战摘要", "军团战子 tab 复用现有安全接口和战报 detail 能力。", "info")
    subTab == "weekBattle" ->
      Triple("周战绩卡", "盐场周战绩列表和胜负摘要。", "success")
    subTab == "monthBattle" ->
      Triple("月战绩卡", "盐场月度归档和趋势摘要。", "success")
    subTab == "legionWarMap" ->
      Triple("实时地图卡", "盐场实时地图以原生卡片展示地图摘要。", "info")
    subTab == "legionWarStatistics" ->
      Triple("实时战况卡", "盐场实时战况与战队结果摘要。", "info")
    else ->
      Triple("匹配详情卡", "盐场匹配详情、对手和战况摘要。", "success")
  }
  GameStatusCard(
    icon = Icons.Outlined.Article,
    title = title,
    subtitle = subtitle,
    status = if (reportCount > 0) "ready" else "warning",
    tone = tone,
    metrics = listOf(
      WorkbenchSignal("当前子项", subTab, "对应 Web 子 tab", "info"),
      WorkbenchSignal("已加载战报", reportCount.toString(), "查询后在下方展示列表", if (reportCount > 0) "success" else "warning"),
    ),
  )
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
  var showRawData by rememberSaveable { mutableStateOf(false) }
  val clipboard = LocalClipboardManager.current
  XyzwPage(
    title = "战报详情",
    onBack = onBack,
  ) {
    if (report == null) {
      XyzwEmptyState(
        title = "未找到战报",
        description = "请返回战报列表重新选择。",
      )
    } else {
      BattleReportImageLikeCard(report = report)
      Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
        WorkbenchPrimaryButton(
          text = "复制摘要",
          enabled = true,
          onClick = {
            clipboard.setText(
              AnnotatedString(
                listOf(
                  report.title,
                  report.summary,
                  formatDisplayDateTime(report.createdAt),
                ).filter { it.isNotBlank() && it != "--" }.joinToString(" / "),
              ),
            )
          },
          modifier = Modifier.weight(1f),
        )
        WorkbenchSecondaryButton(
          text = if (showRawData) "收起原始数据" else "查看原始数据",
          enabled = report.detail != null,
          onClick = { showRawData = !showRawData },
          modifier = Modifier.weight(1f),
        )
      }
      BattleReportDebugJsonSheet(
        report = report,
        expanded = showRawData,
        onToggle = { showRawData = !showRawData },
      )
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
