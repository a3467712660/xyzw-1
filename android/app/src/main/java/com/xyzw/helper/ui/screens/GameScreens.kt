package com.xyzw.helper.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Article
import androidx.compose.material.icons.outlined.Flag
import androidx.compose.material.icons.outlined.PlayArrow
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material.icons.outlined.Save
import androidx.compose.material.icons.outlined.SportsEsports
import androidx.compose.material.icons.outlined.ViewList
import androidx.compose.material3.Button
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
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
      label = "可用 Token",
      value = tokenCount.toString(),
      supportingText = "游戏功能使用服务端 BIN，不在 App 内暴露 raw token。",
    )
    XyzwSection(title = "功能入口", subtitle = "所有入口均为 Android 原生页面。") {
      XyzwActionCard(
        icon = Icons.Outlined.SportsEsports,
        title = "游戏功能",
        subtitle = "查看当前 BIN 状态并执行已允许的游戏命令。",
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
  onSelectToken: (String) -> Unit = {},
  snackbarHostState: SnackbarHostState = remember { SnackbarHostState() },
) {
  XyzwPage(
    title = "游戏功能",
    subtitle = "只执行后端 allowlist 内的游戏命令。",
    onBack = onBack,
    onRefresh = onRefresh,
    snackbarHostState = snackbarHostState,
  ) {
    TokenPicker(state.tokens, state.selectedTokenId, onSelectToken)
    if (state.isLoading) {
      XyzwLoadingState("游戏功能加载中...")
    }
    state.summary?.let { summary ->
      XyzwSection(title = "当前状态", subtitle = summary.recommendedAction.ifBlank { "等待操作" }) {
        XyzwStatusChip(
          status = if (summary.binAvailable) "active" else "warning",
          label = if (summary.binAvailable) "BIN 可用" else "请先上传 BIN",
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
      XyzwSection(title = "可执行功能", subtitle = "点击后由后端使用服务端 BIN 执行。") {
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
    state.errorMessage?.let { XyzwErrorState(message = it, onRetry = onRefresh) }
  }
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
    subtitle = "原生列表与摘要视图，不嵌入 Web canvas。",
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
      XyzwSection(title = "节点", subtitle = "点击 Web canvas 的交互已改为原生可读列表。") {
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
          description = "可导入 JSON 或刷新后保存当前返回的阵容方案。",
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
    XyzwSection(title = "导入导出", subtitle = "JSON 留在 App 和后端保存接口之间，不上传 raw token。") {
      OutlinedTextField(
        value = jsonDraft,
        onValueChange = { jsonDraft = it },
        modifier = Modifier.fillMaxWidth(),
        label = { Text("阵容 JSON") },
        minLines = 4,
      )
      Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        OutlinedButton(
          onClick = {
            jsonDraft = NetworkFactory.json.encodeToString(ListSerializer(GameLineup.serializer()), state.lineups)
          },
        ) {
          Text("导出 JSON")
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
          Text("导入 JSON")
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
  XyzwPage(
    title = "战报功能",
    subtitle = "查询战报或粘贴 JSON 解析，详情使用原生页面展示。",
    onBack = onBack,
    onRefresh = onRefresh,
    snackbarHostState = snackbarHostState,
  ) {
    TokenPicker(state.tokens, state.selectedTokenId, onSelectToken)
    if (state.isLoading) XyzwLoadingState("战报加载中...")
    XyzwSection(title = "查询入口", subtitle = "选择战报类型和日期后刷新。") {
      state.catalog.types.forEach { type ->
        FilterChip(
          selected = state.selectedReportType == type.id,
          onClick = { onSelectType(type.id) },
          label = { Text(type.title) },
          modifier = Modifier.fillMaxWidth(),
        )
      }
      OutlinedTextField(
        value = state.queryDate,
        onValueChange = onDateChange,
        modifier = Modifier.fillMaxWidth(),
        label = { Text("日期，例如 2026-04-19") },
        singleLine = true,
      )
      Button(onClick = onQuery, modifier = Modifier.fillMaxWidth()) {
        Text("查询战报")
      }
    }
    XyzwSection(title = "手动解析", subtitle = "用于本地粘贴 JSON 战报。") {
      OutlinedTextField(
        value = manualText,
        onValueChange = { manualText = it },
        modifier = Modifier.fillMaxWidth(),
        label = { Text("战报 JSON") },
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
          description = "请先查询或粘贴 JSON 解析。",
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
      XyzwSection(title = report.title, subtitle = report.createdAt ?: "时间未知") {
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
  XyzwSection(title = "Token", subtitle = "仅使用已保存的服务端 BIN。") {
    if (tokens.isEmpty()) {
      XyzwEmptyState(
        title = "暂无 Token",
        description = "请先在 Token 管理中导入 Token 并上传 BIN。",
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
