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
import com.xyzw.helper.data.network.ApiError
import com.xyzw.helper.data.network.ApiResult
import com.xyzw.helper.data.repository.BattleReportRepository
import com.xyzw.helper.data.repository.BattleReportErrorMapper
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
  val emptyReason: String = "",
  val businessCode: String = "",
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
  private var workbenchRequestVersion = 0
  private var sectionRequestVersion = 0

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
          refreshWorkbench()
        }
      }
    }
    refresh()
  }

  fun selectToken(tokenId: String) {
    workbenchRequestVersion += 1
    sectionRequestVersion += 1
    mutableState.value = mutableState.value.copy(
      selectedTokenId = tokenId,
      sectionSnapshot = null,
      renderedReplay = null,
      renderedReplayImageBytes = null,
    )
    refreshWorkbench()
  }

  fun selectModule(moduleId: String) {
    val module = mutableState.value.workbenchCatalog.modules.firstOrNull { it.id == moduleId }
    val sectionId = module?.sections
      ?.firstOrNull { it.id == module.defaultSectionId && it.id.isNotBlank() }
      ?.id
      ?: module?.sections?.firstOrNull { it.id.isNotBlank() }?.id
      ?: ""
    sectionRequestVersion += 1
    mutableState.value = mutableState.value.copy(
      selectedModuleId = moduleId,
      selectedSectionId = sectionId,
      sectionSnapshot = null,
      renderedReplay = null,
      renderedReplayImageBytes = null,
      isLoading = sectionId.isNotBlank(),
    )
    if (module != null && sectionId.isNotBlank()) {
      refreshSection()
    }
  }

  fun selectSection(sectionId: String) {
    val moduleId = moduleForSection(mutableState.value.workbenchCatalog.modules, sectionId)
    sectionRequestVersion += 1
    mutableState.value = mutableState.value.copy(
      selectedModuleId = moduleId ?: mutableState.value.selectedModuleId,
      selectedSectionId = sectionId,
      sectionSnapshot = null,
      renderedReplay = null,
      renderedReplayImageBytes = null,
      isLoading = moduleId != null,
    )
    if (moduleId != null) {
      refreshSection()
    }
  }

  fun refresh() {
    viewModelScope.launch {
      mutableState.value = mutableState.value.copy(isLoading = true, errorMessage = null)
      val catalog = runCatching { repository.getWorkbenchCatalog() }.getOrElse { error ->
        ApiResult.Failure(ApiError.local(error.message ?: "游戏工作台加载失败"))
      }
      when (catalog) {
        is ApiResult.Success -> {
          val modules = catalog.data.modules
          val defaultModuleId = catalog.data.defaultModuleId
            .takeIf { id -> modules.any { it.id == id } }
            ?: modules.firstOrNull { it.id.isNotBlank() }?.id.orEmpty()
          val defaultModule = modules.firstOrNull { it.id == defaultModuleId }
          val defaultSectionId = catalog.data.defaultSectionId
            .takeIf { id -> defaultModule?.sections?.any { it.id == id } == true }
            ?: defaultModule?.defaultSectionId?.takeIf { id -> defaultModule.sections.any { it.id == id } }
            ?: defaultModule?.sections?.firstOrNull { it.id.isNotBlank() }?.id.orEmpty()
          mutableState.value = mutableState.value.copy(
            workbenchCatalog = catalog.data,
            selectedModuleId = mutableState.value.selectedModuleId.takeIf { current ->
              modules.any { it.id == current }
            } ?: defaultModuleId,
            selectedSectionId = mutableState.value.selectedSectionId.takeIf { current ->
              modules.any { module -> module.sections.any { it.id == current } }
            } ?: defaultSectionId,
          )
          if (modules.isEmpty()) {
            mutableState.value = mutableState.value.copy(isLoading = false, sectionSnapshot = null)
          } else {
            refreshWorkbench(keepLoading = true)
          }
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
      val result = runCatching { repository.getSummary(tokenId) }.getOrElse { error ->
        ApiResult.Failure(ApiError.local(error.message ?: "游戏功能状态加载失败"))
      }
      when (result) {
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
    val requestVersion = ++workbenchRequestVersion
    viewModelScope.launch {
      if (!keepLoading) mutableState.value = mutableState.value.copy(isLoading = true, errorMessage = null)
      val bootstrap = runCatching { repository.getWorkbenchBootstrap(tokenId) }.getOrElse { error ->
        ApiResult.Failure(ApiError.local(error.message ?: "游戏工作台加载失败"))
      }
      if (requestVersion != workbenchRequestVersion || tokenId != mutableState.value.selectedTokenId) return@launch
      when (bootstrap) {
        is ApiResult.Success -> {
          val modules = mutableState.value.workbenchCatalog.modules
          val nextModuleId = mutableState.value.selectedModuleId.takeIf { id -> modules.any { it.id == id } }
            ?: bootstrap.data.selectedModuleId.takeIf { id -> modules.any { it.id == id } }
            ?: modules.firstOrNull { it.id.isNotBlank() }?.id.orEmpty()
          val module = modules.firstOrNull { it.id == nextModuleId }
          val nextSectionId = mutableState.value.selectedSectionId.takeIf { id -> module?.sections?.any { it.id == id } == true }
            ?: bootstrap.data.selectedSectionId.takeIf { id -> module?.sections?.any { it.id == id } == true }
            ?: module?.defaultSectionId?.takeIf { id -> module.sections.any { it.id == id } }
            ?: module?.sections?.firstOrNull { it.id.isNotBlank() }?.id.orEmpty()
          mutableState.value = mutableState.value.copy(
            isLoading = nextSectionId.isNotBlank(),
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
          if (nextSectionId.isNotBlank()) {
            refreshSection()
          } else {
            mutableState.value = mutableState.value.copy(isLoading = false, sectionSnapshot = null)
          }
        }
        is ApiResult.Failure -> refreshSummary(keepLoading = keepLoading)
      }
    }
  }

  fun refreshSection() {
    val state = mutableState.value
    val tokenId = state.selectedTokenId
    val sectionId = state.selectedSectionId
    val selectedModuleId = state.selectedModuleId
    if (tokenId.isBlank() || sectionId.isBlank()) {
      mutableState.value = mutableState.value.copy(isLoading = false, sectionSnapshot = null)
      return
    }
    val requestVersion = ++sectionRequestVersion
    viewModelScope.launch {
      mutableState.value = mutableState.value.copy(isLoading = true, errorMessage = null)
      val result = runCatching { repository.getWorkbenchSection(tokenId, sectionId) }.getOrElse { error ->
        ApiResult.Failure(ApiError.local(error.message ?: "模块数据加载失败"))
      }
      if (
        requestVersion != sectionRequestVersion ||
        tokenId != mutableState.value.selectedTokenId ||
        sectionId != mutableState.value.selectedSectionId
      ) return@launch
      when (result) {
        is ApiResult.Success -> {
          val resultModuleId = result.data.moduleId.ifBlank { selectedModuleId }
          if (resultModuleId != mutableState.value.selectedModuleId) return@launch
          mutableState.value = mutableState.value.copy(
            isLoading = false,
            sectionSnapshot = result.data.copy(
              moduleId = resultModuleId,
              sectionId = result.data.sectionId.ifBlank { sectionId },
            ),
            selectedModuleId = resultModuleId,
            selectedSectionId = result.data.sectionId.ifBlank { sectionId },
          )
        }
        is ApiResult.Failure -> mutableState.value = mutableState.value.copy(
          isLoading = false,
          sectionSnapshot = null,
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
      reports = emptyList(),
      emptyReason = "",
      businessCode = "",
      actionMessage = if (nextDate != mutableState.value.queryDate) "已切换到最近比赛日" else mutableState.value.actionMessage,
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
            emptyReason = "",
            businessCode = "",
          )
        }
        is ApiResult.Failure -> mutableState.value = mutableState.value.copy(
          isLoading = false,
          errorMessage = BattleReportErrorMapper.friendlyMessage(result.error),
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
          emptyReason = result.data.emptyReason,
          businessCode = result.data.businessCode,
          actionMessage = if (result.data.emptyReason.isBlank()) "战报已刷新" else null,
        )
        is ApiResult.Failure -> mutableState.value = mutableState.value.copy(
          isLoading = false,
          errorMessage = BattleReportErrorMapper.friendlyMessage(result.error),
          emptyReason = "",
          businessCode = "",
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
          emptyReason = "",
          businessCode = "",
          actionMessage = "战报已解析",
        )
        is ApiResult.Failure -> mutableState.value = mutableState.value.copy(
          isLoading = false,
          errorMessage = BattleReportErrorMapper.friendlyMessage(result.error),
        )
      }
    }
  }

  fun consumeParsedReport() {
    mutableState.value = mutableState.value.copy(parsedReport = null)
  }

  fun consumeMessage() {
    mutableState.value = mutableState.value.copy(actionMessage = null, errorMessage = null)
  }
}
