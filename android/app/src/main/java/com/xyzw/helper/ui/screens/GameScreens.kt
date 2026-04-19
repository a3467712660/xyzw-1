package com.xyzw.helper.ui.screens

import android.graphics.BitmapFactory
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
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
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.xyzw.helper.data.model.BattleReportItem
import com.xyzw.helper.data.model.GameLineup
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
    subtitle = "只执行后端允许列表内的游戏命令。",
    onBack = onBack,
    onRefresh = onRefresh,
    snackbarHostState = snackbarHostState,
  ) {
    TokenPicker(state.tokens, state.selectedTokenId, onSelectToken)
    if (state.isLoading) {
      XyzwLoadingState("游戏功能加载中...")
    }
    WorkbenchCommandBar(state = state, onRefresh = onRefresh)
    if (state.workbenchCatalog.modules.isNotEmpty()) {
      WorkbenchModuleRail(
        state = state,
        onSelectModule = onSelectModule,
        onSelectSection = onSelectSection,
      )
      WorkbenchStageSummary(state = state)
      WorkbenchSectionContent(
        state = state,
        onRunWorkbenchAction = onRunWorkbenchAction,
        onRenderReplay = onRenderReplay,
      )
      state.renderedReplay?.let { replay ->
        XyzwSection(title = "回放渲染结果", subtitle = "由后端生成截图和诊断，安卓端只做原生展示。") {
          XyzwCard {
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
            Text(replay.summary.ifBlank { "渲染已生成" }, style = MaterialTheme.typography.titleMedium)
            Text("渲染编号：${replay.renderId}")
            Text("图片地址：${replay.imageUrl}")
            replay.expiresAt.takeIf { it.isNotBlank() }?.let {
              Text("过期时间：${formatDisplayDateTime(it)}")
            }
          }
        }
      }
    } else {
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
    onSelectToken = viewModel::selectToken,
    snackbarHostState = snackbarHostState,
  )
}

@Composable
fun LegionWarScreenContent(
  state: LegionWarUiState,
  onBack: () -> Unit,
  onRefresh: () -> Unit,
  onSelectToken: (String) -> Unit = {},
  snackbarHostState: SnackbarHostState = remember { SnackbarHostState() },
) {
  XyzwPage(
    title = "军团战",
    subtitle = "原生列表与摘要视图，不嵌入网页画布。",
    onBack = onBack,
    onRefresh = onRefresh,
    snackbarHostState = snackbarHostState,
  ) {
    TokenPicker(state.tokens, state.selectedTokenId, onSelectToken)
    if (state.isLoading) XyzwLoadingState("军团战数据刷新中...")
    val snapshot = state.snapshot
    if (snapshot == null && !state.isLoading) {
      XyzwEmptyState(
        title = "暂无军团战数据",
        description = "点击刷新后从后端安全接口读取战场态势。",
        primaryActionLabel = "刷新",
        onPrimaryAction = onRefresh,
      )
    } else if (snapshot != null) {
      XyzwSection(title = "战场摘要", subtitle = snapshot.battlefieldId.ifBlank { "战场编号待返回" }) {
        XyzwStatCard("节点数", snapshot.nodes.size.toString())
        XyzwStatCard("战队数", snapshot.legions.size.toString())
      }
      XyzwSection(title = "节点", subtitle = "网页画布的交互已改为原生可读列表。") {
        snapshot.nodes.forEach { node ->
          XyzwCard {
            Text(node.id, style = MaterialTheme.typography.titleMedium)
            Text(node.typeName.ifBlank { "未知节点" })
            Text("血量 ${node.hp}/${node.maxHp}")
            if (node.belongsLegionName.isNotBlank()) {
              Text("所属：${node.belongsLegionName}")
            }
          }
        }
      }
      if (snapshot.legions.isNotEmpty()) {
        XyzwSection(title = "战队", subtitle = "免费复活等信息由后端摘要返回。") {
          snapshot.legions.forEach { legion ->
            XyzwCard {
              Text(legion.name.ifBlank { legion.id }, fontWeight = FontWeight.SemiBold)
              Text("剩余复活：${legion.reviveLeft}")
            }
          }
        }
      }
    }
    state.errorMessage?.let { XyzwErrorState(message = it, onRetry = onRefresh) }
  }
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
  XyzwPage(
    title = "阵容助手",
    subtitle = "阵容读取、保存和应用走后端安全编排。",
    onBack = onBack,
    onRefresh = onRefresh,
    snackbarHostState = snackbarHostState,
  ) {
    TokenPicker(state.tokens, state.selectedTokenId, onSelectToken)
    if (state.isLoading) XyzwLoadingState("阵容读取中...")
    XyzwSection(title = "已保存阵容", subtitle = "当前阵容槽：${state.currentFormation ?: "--"}") {
      if (state.lineups.isEmpty()) {
        XyzwEmptyState(
          title = "暂无阵容",
          description = "可导入配置文本，或刷新后保存当前返回的阵容方案。",
        )
      }
      state.lineups.forEach { lineup ->
        XyzwCard {
          Text(lineup.name, style = MaterialTheme.typography.titleMedium)
          Text("阵容槽：${lineup.teamId ?: "--"}")
          Text("站位：${lineup.slots.size}")
          Button(
            onClick = { onApply(lineup.id) },
            enabled = !state.isMutating,
            modifier = Modifier.fillMaxWidth(),
          ) {
            Text(if (state.isMutating) "应用中..." else "应用阵容")
          }
        }
      }
    }
    XyzwSection(title = "导入导出", subtitle = "配置文本只在应用和后端保存接口之间传递，不上传原始令牌。") {
      OutlinedTextField(
        value = jsonDraft,
        onValueChange = { jsonDraft = it },
        modifier = Modifier.fillMaxWidth(),
        label = { Text("阵容配置文本") },
        minLines = 4,
      )
      Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        OutlinedButton(
          onClick = {
            jsonDraft = NetworkFactory.json.encodeToString(ListSerializer(GameLineup.serializer()), state.lineups)
          },
        ) {
          Text("导出配置文本")
        }
        Button(
          onClick = {
            runCatching {
              NetworkFactory.json.decodeFromString(ListSerializer(GameLineup.serializer()), jsonDraft)
            }.onSuccess(onSave).onFailure {
              scope.launch { snackbarHostState.showSnackbar("阵容 JSON 解析失败") }
            }
          },
          enabled = jsonDraft.isNotBlank(),
        ) {
          Text("导入配置文本")
        }
      }
    }
    state.errorMessage?.let { XyzwErrorState(message = it, onRetry = onRefresh) }
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
  val queryTypes = remember(state.catalog.types) {
    state.catalog.types.filter { isDateBackedBattleReportType(it.id) }
      .ifEmpty { state.catalog.types }
  }
  XyzwPage(
    title = "战报功能",
    subtitle = "查询战报或粘贴配置文本解析，详情使用原生页面展示。",
    onBack = onBack,
    onRefresh = onRefresh,
    snackbarHostState = snackbarHostState,
  ) {
    TokenPicker(state.tokens, state.selectedTokenId, onSelectToken)
    if (state.isLoading) XyzwLoadingState("战报加载中...")
    XyzwSection(title = "查询入口", subtitle = "选择战报类型和比赛日期后刷新。") {
      queryTypes.forEach { type ->
        FilterChip(
          selected = state.selectedReportType == type.id,
          onClick = { onSelectType(type.id) },
          label = { Text(type.title) },
          modifier = Modifier.fillMaxWidth(),
        )
      }
      BattleReportDatePickerRow(
        reportType = state.selectedReportType,
        queryDate = state.queryDate,
        onDateChange = onDateChange,
        onOpenDatePicker = { showDatePicker = true },
      )
      Button(onClick = onQuery, modifier = Modifier.fillMaxWidth()) {
        Text("查询战报")
      }
    }
    XyzwSection(title = "手动解析", subtitle = "用于本地粘贴战报配置文本。") {
      OutlinedTextField(
        value = manualText,
        onValueChange = { manualText = it },
        modifier = Modifier.fillMaxWidth(),
        label = { Text("战报配置文本") },
        minLines = 4,
      )
      OutlinedButton(
        onClick = { onParse(manualText) },
        enabled = manualText.isNotBlank(),
        modifier = Modifier.fillMaxWidth(),
      ) {
        Text("解析战报")
      }
    }
    XyzwSection(title = "战报列表", subtitle = "点击进入原生详情页。") {
      if (state.reports.isEmpty() && !state.isLoading) {
        XyzwEmptyState(
          title = "暂无战报",
          description = "请先查询或粘贴配置文本解析。",
          primaryActionLabel = "刷新",
          onPrimaryAction = onRefresh,
        )
      }
      state.reports.forEach { report ->
        XyzwActionCard(
          icon = Icons.Outlined.Article,
          title = report.title,
          subtitle = report.summary.ifBlank { report.reportType },
          onClick = { onOpenDetail(report) },
        )
      }
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
