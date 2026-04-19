package com.xyzw.helper.ui.screens

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.xyzw.helper.data.model.BattleReportCatalog
import com.xyzw.helper.data.model.BattleReportItem
import com.xyzw.helper.data.model.GameFeatureCatalog
import com.xyzw.helper.data.model.GameFeatureSummary
import com.xyzw.helper.data.model.GameLineup
import com.xyzw.helper.data.model.GameLineupApplyResult
import com.xyzw.helper.data.model.GameWorkbenchBootstrap
import com.xyzw.helper.data.model.GameWorkbenchCatalog
import com.xyzw.helper.data.model.GameWorkbenchModule
import com.xyzw.helper.data.model.GameWorkbenchSectionSnapshot
import com.xyzw.helper.data.model.ImportedGameToken
import com.xyzw.helper.data.model.LegionWarSnapshot
import com.xyzw.helper.data.model.RenderedReplayResult
import com.xyzw.helper.data.network.ApiResult
import com.xyzw.helper.data.repository.BattleReportRepository
import com.xyzw.helper.data.repository.GameFeatureRepository
import com.xyzw.helper.data.repository.TokenManagementRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch

data class GameFeaturesUiState(
  val tokens: List<ImportedGameToken> = emptyList(),
  val selectedTokenId: String = "",
  val catalog: GameFeatureCatalog = GameFeatureCatalog(),
  val workbenchCatalog: GameWorkbenchCatalog = GameWorkbenchCatalog(),
  val workbenchBootstrap: GameWorkbenchBootstrap? = null,
  val selectedModuleId: String = "daily",
  val selectedSectionId: String = "daily",
  val sectionSnapshot: GameWorkbenchSectionSnapshot? = null,
  val renderedReplay: RenderedReplayResult? = null,
  val renderedReplayImageBytes: ByteArray? = null,
  val summary: GameFeatureSummary? = null,
  val isLoading: Boolean = true,
  val isMutating: Boolean = false,
  val errorMessage: String? = null,
  val actionMessage: String? = null,
)

data class LegionWarUiState(
  val tokens: List<ImportedGameToken> = emptyList(),
  val selectedTokenId: String = "",
  val snapshot: LegionWarSnapshot? = null,
  val isLoading: Boolean = false,
  val errorMessage: String? = null,
  val actionMessage: String? = null,
)

data class LineupAssistantUiState(
  val tokens: List<ImportedGameToken> = emptyList(),
  val selectedTokenId: String = "",
  val lineups: List<GameLineup> = emptyList(),
  val currentFormation: Int? = null,
  val lastApplyResult: GameLineupApplyResult? = null,
  val isLoading: Boolean = false,
  val isMutating: Boolean = false,
  val errorMessage: String? = null,
  val actionMessage: String? = null,
)

data class BattleReportsUiState(
  val tokens: List<ImportedGameToken> = emptyList(),
  val selectedTokenId: String = "",
  val catalog: BattleReportCatalog = BattleReportCatalog(),
  val selectedReportType: String = "salt-field",
  val queryDate: String = defaultBattleReportDate("salt-field"),
  val reports: List<BattleReportItem> = emptyList(),
  val parsedReport: BattleReportItem? = null,
  val isLoading: Boolean = true,
  val errorMessage: String? = null,
  val actionMessage: String? = null,
)

private fun preferredTokenId(tokens: List<ImportedGameToken>, current: String): String {
  if (current.isNotBlank() && tokens.any { it.id == current }) return current
  return tokens.firstOrNull { it.binFilePresent }?.id ?: tokens.firstOrNull()?.id.orEmpty()
}

private fun ViewModel.restoreRemoteBinTokens(tokenRepository: TokenManagementRepository) {
  viewModelScope.launch {
    tokenRepository.listBinFiles()
  }
}

class GameFeaturesViewModel(
  private val repository: GameFeatureRepository,
  tokenRepository: TokenManagementRepository,
) : ViewModel() {
  private val mutableState = MutableStateFlow(GameFeaturesUiState())
  val uiState: StateFlow<GameFeaturesUiState> = mutableState.asStateFlow()

  init {
    restoreRemoteBinTokens(tokenRepository)
    viewModelScope.launch {
      tokenRepository.tokens.collectLatest { tokens ->
        val previousTokenId = mutableState.value.selectedTokenId
        val nextTokenId = preferredTokenId(tokens, previousTokenId)
        mutableState.value = mutableState.value.copy(
          tokens = tokens,
          selectedTokenId = nextTokenId,
        )
        if (previousTokenId.isBlank() && nextTokenId.isNotBlank()) {
          refreshSummary()
        }
      }
    }
    refresh()
  }

  fun selectToken(tokenId: String) {
    mutableState.value = mutableState.value.copy(selectedTokenId = tokenId)
    refreshWorkbench()
  }

  fun selectModule(moduleId: String) {
    val module = mutableState.value.workbenchCatalog.modules.firstOrNull { it.id == moduleId }
    val sectionId = module?.defaultSectionId?.takeIf { it.isNotBlank() }
      ?: module?.sections?.firstOrNull()?.id
      ?: mutableState.value.selectedSectionId
    mutableState.value = mutableState.value.copy(
      selectedModuleId = moduleId,
      selectedSectionId = sectionId,
      sectionSnapshot = null,
    )
    refreshSection()
  }

  fun selectSection(sectionId: String) {
    val moduleId = moduleForSection(mutableState.value.workbenchCatalog.modules, sectionId)
      ?: mutableState.value.selectedModuleId
    mutableState.value = mutableState.value.copy(
      selectedModuleId = moduleId,
      selectedSectionId = sectionId,
      sectionSnapshot = null,
    )
    refreshSection()
  }

  fun refresh() {
    viewModelScope.launch {
      mutableState.value = mutableState.value.copy(isLoading = true, errorMessage = null)
      when (val catalog = repository.getWorkbenchCatalog()) {
        is ApiResult.Success -> {
          val defaultModuleId = catalog.data.defaultModuleId.ifBlank { catalog.data.modules.firstOrNull()?.id.orEmpty() }
          val defaultSectionId = catalog.data.defaultSectionId.ifBlank {
            catalog.data.modules.firstOrNull { it.id == defaultModuleId }?.defaultSectionId.orEmpty()
          }
          mutableState.value = mutableState.value.copy(
            workbenchCatalog = catalog.data,
            selectedModuleId = mutableState.value.selectedModuleId.takeIf { current ->
              catalog.data.modules.any { it.id == current }
            } ?: defaultModuleId,
            selectedSectionId = mutableState.value.selectedSectionId.takeIf { current ->
              catalog.data.modules.any { module -> module.sections.any { it.id == current } }
            } ?: defaultSectionId.ifBlank { "daily" },
          )
          refreshWorkbench(keepLoading = true)
        }
        is ApiResult.Failure -> loadLegacyGameFeatures(catalog.error.message)
      }
    }
  }

  private suspend fun loadLegacyGameFeatures(fallbackError: String) {
    when (val catalog = repository.getCatalog()) {
      is ApiResult.Success -> {
        mutableState.value = mutableState.value.copy(catalog = catalog.data)
        refreshSummary(keepLoading = true)
      }
      is ApiResult.Failure -> mutableState.value = mutableState.value.copy(
        isLoading = false,
        errorMessage = catalog.error.message.ifBlank { fallbackError },
      )
    }
  }

  fun refreshSummary(keepLoading: Boolean = false) {
    val tokenId = mutableState.value.selectedTokenId
    if (tokenId.isBlank()) {
      mutableState.value = mutableState.value.copy(isLoading = false, summary = null)
      return
    }
    viewModelScope.launch {
      if (!keepLoading) mutableState.value = mutableState.value.copy(isLoading = true, errorMessage = null)
      when (val result = repository.getSummary(tokenId)) {
        is ApiResult.Success -> mutableState.value = mutableState.value.copy(
          isLoading = false,
          summary = result.data,
        )
        is ApiResult.Failure -> mutableState.value = mutableState.value.copy(
          isLoading = false,
          errorMessage = result.error.message,
        )
      }
    }
  }

  fun refreshWorkbench(keepLoading: Boolean = false) {
    val tokenId = mutableState.value.selectedTokenId
    if (tokenId.isBlank()) {
      mutableState.value = mutableState.value.copy(isLoading = false, summary = null, sectionSnapshot = null)
      return
    }
    viewModelScope.launch {
      if (!keepLoading) mutableState.value = mutableState.value.copy(isLoading = true, errorMessage = null)
      when (val bootstrap = repository.getWorkbenchBootstrap(tokenId)) {
        is ApiResult.Success -> {
          val nextModuleId = bootstrap.data.selectedModuleId.ifBlank { mutableState.value.selectedModuleId }
          val nextSectionId = bootstrap.data.selectedSectionId.ifBlank { mutableState.value.selectedSectionId }
          mutableState.value = mutableState.value.copy(
            isLoading = false,
            workbenchBootstrap = bootstrap.data,
            selectedModuleId = nextModuleId,
            selectedSectionId = nextSectionId,
            summary = GameFeatureSummary(
              tokenId = bootstrap.data.tokenId,
              roleName = bootstrap.data.roleName,
              serverName = bootstrap.data.serverName,
              binAvailable = bootstrap.data.binAvailable,
              connectionStatus = bootstrap.data.connectionStatus,
              recommendedAction = bootstrap.data.recommendation,
            ),
          )
          refreshSection()
        }
        is ApiResult.Failure -> refreshSummary(keepLoading = keepLoading)
      }
    }
  }

  fun refreshSection() {
    val state = mutableState.value
    val tokenId = state.selectedTokenId
    val sectionId = state.selectedSectionId
    if (tokenId.isBlank() || sectionId.isBlank()) return
    viewModelScope.launch {
      mutableState.value = mutableState.value.copy(isLoading = true, errorMessage = null)
      when (val result = repository.getWorkbenchSection(tokenId, sectionId)) {
        is ApiResult.Success -> mutableState.value = mutableState.value.copy(
          isLoading = false,
          sectionSnapshot = result.data,
          selectedModuleId = result.data.moduleId,
          selectedSectionId = result.data.sectionId,
        )
        is ApiResult.Failure -> mutableState.value = mutableState.value.copy(
          isLoading = false,
          errorMessage = result.error.message,
        )
      }
    }
  }

  fun runAction(actionId: String) {
    val tokenId = mutableState.value.selectedTokenId
    if (tokenId.isBlank()) {
      mutableState.value = mutableState.value.copy(errorMessage = "请先导入并选择令牌")
      return
    }
    viewModelScope.launch {
      mutableState.value = mutableState.value.copy(isMutating = true, errorMessage = null)
      when (val result = repository.runAction(tokenId, actionId)) {
        is ApiResult.Success -> mutableState.value = mutableState.value.copy(
          isMutating = false,
          actionMessage = result.message ?: result.data.message.ifBlank { "游戏功能已执行" },
        )
        is ApiResult.Failure -> mutableState.value = mutableState.value.copy(
          isMutating = false,
          errorMessage = result.error.message,
        )
      }
    }
  }

  fun runWorkbenchAction(cardId: String, actionId: String) {
    val state = mutableState.value
    val tokenId = state.selectedTokenId
    if (tokenId.isBlank()) {
      mutableState.value = state.copy(errorMessage = "请先导入并选择令牌")
      return
    }
    viewModelScope.launch {
      mutableState.value = mutableState.value.copy(isMutating = true, errorMessage = null)
      when (
        val result = repository.runWorkbenchAction(
          tokenId = tokenId,
          sectionId = state.selectedSectionId,
          cardId = cardId,
          actionId = actionId,
        )
      ) {
        is ApiResult.Success -> {
          mutableState.value = mutableState.value.copy(
            isMutating = false,
            actionMessage = result.message ?: result.data.message.ifBlank { "游戏工作台动作已执行" },
          )
          refreshSection()
        }
        is ApiResult.Failure -> mutableState.value = mutableState.value.copy(
          isMutating = false,
          errorMessage = result.error.message,
        )
      }
    }
  }

  fun renderReplay(cardId: String) {
    val state = mutableState.value
    val tokenId = state.selectedTokenId
    if (tokenId.isBlank()) {
      mutableState.value = state.copy(errorMessage = "请先导入并选择令牌")
      return
    }
    viewModelScope.launch {
      mutableState.value = mutableState.value.copy(isMutating = true, errorMessage = null)
      when (
        val result = repository.renderWorkbenchReplay(
          tokenId = tokenId,
          payload = mapOf(
            "cardId" to cardId,
            "sectionId" to state.selectedSectionId,
          ),
        )
      ) {
        is ApiResult.Success -> mutableState.value = mutableState.value.copy(
          isMutating = false,
          renderedReplay = result.data,
          renderedReplayImageBytes = (repository.downloadRenderedReplayImage(result.data.imageUrl) as? ApiResult.Success)?.data,
          actionMessage = result.message ?: "回放渲染已生成",
        )
        is ApiResult.Failure -> mutableState.value = mutableState.value.copy(
          isMutating = false,
          errorMessage = result.error.message,
        )
      }
    }
  }

  fun consumeMessage() {
    mutableState.value = mutableState.value.copy(actionMessage = null, errorMessage = null)
  }
}

private fun moduleForSection(
  modules: List<GameWorkbenchModule>,
  sectionId: String,
): String? =
  modules.firstOrNull { module -> module.sections.any { it.id == sectionId } }?.id

class LegionWarViewModel(
  private val repository: GameFeatureRepository,
  tokenRepository: TokenManagementRepository,
) : ViewModel() {
  private val mutableState = MutableStateFlow(LegionWarUiState())
  val uiState: StateFlow<LegionWarUiState> = mutableState.asStateFlow()

  init {
    restoreRemoteBinTokens(tokenRepository)
    viewModelScope.launch {
      tokenRepository.tokens.collectLatest { tokens ->
        mutableState.value = mutableState.value.copy(
          tokens = tokens,
          selectedTokenId = preferredTokenId(tokens, mutableState.value.selectedTokenId),
        )
      }
    }
  }

  fun selectToken(tokenId: String) {
    mutableState.value = mutableState.value.copy(selectedTokenId = tokenId)
  }

  fun refresh() {
    val tokenId = mutableState.value.selectedTokenId
    if (tokenId.isBlank()) {
      mutableState.value = mutableState.value.copy(errorMessage = "请先导入并选择令牌")
      return
    }
    viewModelScope.launch {
      mutableState.value = mutableState.value.copy(isLoading = true, errorMessage = null)
      when (val result = repository.getLegionWarSnapshot(tokenId)) {
        is ApiResult.Success -> mutableState.value = mutableState.value.copy(
          isLoading = false,
          snapshot = result.data,
          actionMessage = "军团战数据已刷新",
        )
        is ApiResult.Failure -> mutableState.value = mutableState.value.copy(
          isLoading = false,
          errorMessage = result.error.message,
        )
      }
    }
  }

  fun broadcastReviveInfo() {
    val state = mutableState.value
    val tokenId = state.selectedTokenId
    val legions = state.snapshot?.legions.orEmpty()
    if (tokenId.isBlank()) {
      mutableState.value = state.copy(errorMessage = "请先导入并选择令牌")
      return
    }
    if (legions.isEmpty()) {
      mutableState.value = state.copy(errorMessage = "没有可发送的战队免费复活信息")
      return
    }
    viewModelScope.launch {
      mutableState.value = mutableState.value.copy(isLoading = true, errorMessage = null)
      when (val result = repository.broadcastLegionWarReviveInfo(tokenId, legions)) {
        is ApiResult.Success -> mutableState.value = mutableState.value.copy(
          isLoading = false,
          actionMessage = result.message ?: "免费复活信息已发送到战队频道",
        )
        is ApiResult.Failure -> mutableState.value = mutableState.value.copy(
          isLoading = false,
          errorMessage = result.error.message,
        )
      }
    }
  }

  fun consumeMessage() {
    mutableState.value = mutableState.value.copy(actionMessage = null, errorMessage = null)
  }
}

class LineupAssistantViewModel(
  private val repository: GameFeatureRepository,
  tokenRepository: TokenManagementRepository,
) : ViewModel() {
  private val mutableState = MutableStateFlow(LineupAssistantUiState())
  val uiState: StateFlow<LineupAssistantUiState> = mutableState.asStateFlow()

  init {
    restoreRemoteBinTokens(tokenRepository)
    viewModelScope.launch {
      tokenRepository.tokens.collectLatest { tokens ->
        mutableState.value = mutableState.value.copy(
          tokens = tokens,
          selectedTokenId = preferredTokenId(tokens, mutableState.value.selectedTokenId),
        )
      }
    }
  }

  fun selectToken(tokenId: String) {
    mutableState.value = mutableState.value.copy(selectedTokenId = tokenId)
    refresh()
  }

  fun refresh() {
    val tokenId = mutableState.value.selectedTokenId
    if (tokenId.isBlank()) {
      mutableState.value = mutableState.value.copy(errorMessage = "请先导入并选择令牌")
      return
    }
    viewModelScope.launch {
      mutableState.value = mutableState.value.copy(isLoading = true, errorMessage = null)
      when (val result = repository.getLineups(tokenId)) {
        is ApiResult.Success -> mutableState.value = mutableState.value.copy(
          isLoading = false,
          currentFormation = result.data.currentFormation,
          lineups = result.data.saved,
        )
        is ApiResult.Failure -> mutableState.value = mutableState.value.copy(
          isLoading = false,
          errorMessage = result.error.message,
        )
      }
    }
  }

  fun save(lineups: List<GameLineup>) {
    val tokenId = mutableState.value.selectedTokenId
    if (tokenId.isBlank()) return
    viewModelScope.launch {
      mutableState.value = mutableState.value.copy(isMutating = true, errorMessage = null)
      when (val result = repository.saveLineups(tokenId, lineups)) {
        is ApiResult.Success -> mutableState.value = mutableState.value.copy(
          isMutating = false,
          lineups = result.data.saved,
          actionMessage = result.message ?: "阵容已保存",
        )
        is ApiResult.Failure -> mutableState.value = mutableState.value.copy(
          isMutating = false,
          errorMessage = result.error.message,
        )
      }
    }
  }

  fun apply(lineupId: String) {
    val tokenId = mutableState.value.selectedTokenId
    if (tokenId.isBlank()) return
    viewModelScope.launch {
      mutableState.value = mutableState.value.copy(isMutating = true, errorMessage = null)
      when (val result = repository.applyLineup(tokenId, lineupId)) {
        is ApiResult.Success -> mutableState.value = mutableState.value.copy(
          isMutating = false,
          lastApplyResult = result.data,
          actionMessage = result.message ?: "阵容应用流程已完成",
        )
        is ApiResult.Failure -> mutableState.value = mutableState.value.copy(
          isMutating = false,
          errorMessage = result.error.message,
        )
      }
    }
  }

  fun consumeMessage() {
    mutableState.value = mutableState.value.copy(actionMessage = null, errorMessage = null)
  }
}

class BattleReportsViewModel(
  private val repository: BattleReportRepository,
  tokenRepository: TokenManagementRepository,
) : ViewModel() {
  private val mutableState = MutableStateFlow(BattleReportsUiState())
  val uiState: StateFlow<BattleReportsUiState> = mutableState.asStateFlow()

  init {
    restoreRemoteBinTokens(tokenRepository)
    viewModelScope.launch {
      tokenRepository.tokens.collectLatest { tokens ->
        mutableState.value = mutableState.value.copy(
          tokens = tokens,
          selectedTokenId = preferredTokenId(tokens, mutableState.value.selectedTokenId),
        )
      }
    }
    refreshCatalog()
  }

  fun selectToken(tokenId: String) {
    mutableState.value = mutableState.value.copy(selectedTokenId = tokenId)
  }

  fun setReportType(reportType: String) {
    val currentDate = parseBattleReportDate(mutableState.value.queryDate)
    val nextDate = if (
      currentDate != null
      && isSelectableBattleReportDate(reportType, currentDate)
    ) {
      mutableState.value.queryDate
    } else {
      defaultBattleReportDate(reportType)
    }
    mutableState.value = mutableState.value.copy(
      selectedReportType = reportType,
      queryDate = nextDate,
    )
  }

  fun setQueryDate(date: String) {
    mutableState.value = mutableState.value.copy(queryDate = date)
  }

  fun refreshCatalog() {
    viewModelScope.launch {
      mutableState.value = mutableState.value.copy(isLoading = true, errorMessage = null)
      when (val result = repository.getCatalog()) {
        is ApiResult.Success -> {
          val firstReportType = result.data.types
            .firstOrNull { isDateBackedBattleReportType(it.id) }
            ?.id
            ?: result.data.types.firstOrNull()?.id
            ?: "salt-field"
          mutableState.value = mutableState.value.copy(
            isLoading = false,
            catalog = result.data,
            selectedReportType = firstReportType,
            queryDate = defaultBattleReportDate(firstReportType),
          )
        }
        is ApiResult.Failure -> mutableState.value = mutableState.value.copy(
          isLoading = false,
          errorMessage = result.error.message,
        )
      }
    }
  }

  fun queryReports() {
    val state = mutableState.value
    if (state.selectedTokenId.isBlank()) {
      mutableState.value = state.copy(errorMessage = "请先导入并选择令牌")
      return
    }
    val queryDate = state.queryDate.ifBlank { defaultBattleReportDate(state.selectedReportType) }
    viewModelScope.launch {
      mutableState.value = mutableState.value.copy(isLoading = true, errorMessage = null, queryDate = queryDate)
      when (val result = repository.queryReports(state.selectedTokenId, state.selectedReportType, queryDate)) {
        is ApiResult.Success -> mutableState.value = mutableState.value.copy(
          isLoading = false,
          reports = result.data.reports,
          actionMessage = "战报已刷新",
        )
        is ApiResult.Failure -> mutableState.value = mutableState.value.copy(
          isLoading = false,
          errorMessage = result.error.message,
        )
      }
    }
  }

  fun parseReport(rawText: String) {
    viewModelScope.launch {
      mutableState.value = mutableState.value.copy(isLoading = true, errorMessage = null)
      when (val result = repository.parseReport(rawText)) {
        is ApiResult.Success -> mutableState.value = mutableState.value.copy(
          isLoading = false,
          parsedReport = result.data.report,
          reports = result.data.report?.let { listOf(it) }.orEmpty(),
          actionMessage = "战报已解析",
        )
        is ApiResult.Failure -> mutableState.value = mutableState.value.copy(
          isLoading = false,
          errorMessage = result.error.message,
        )
      }
    }
  }

  fun consumeMessage() {
    mutableState.value = mutableState.value.copy(actionMessage = null, errorMessage = null)
  }
}
