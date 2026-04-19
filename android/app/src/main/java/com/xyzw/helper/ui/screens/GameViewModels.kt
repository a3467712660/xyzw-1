package com.xyzw.helper.ui.screens

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.xyzw.helper.data.model.BattleReportCatalog
import com.xyzw.helper.data.model.BattleReportItem
import com.xyzw.helper.data.model.GameFeatureCatalog
import com.xyzw.helper.data.model.GameFeatureSummary
import com.xyzw.helper.data.model.GameLineup
import com.xyzw.helper.data.model.ImportedGameToken
import com.xyzw.helper.data.model.LegionWarSnapshot
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
  val queryDate: String = "",
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

class GameFeaturesViewModel(
  private val repository: GameFeatureRepository,
  tokenRepository: TokenManagementRepository,
) : ViewModel() {
  private val mutableState = MutableStateFlow(GameFeaturesUiState())
  val uiState: StateFlow<GameFeaturesUiState> = mutableState.asStateFlow()

  init {
    viewModelScope.launch {
      tokenRepository.tokens.collectLatest { tokens ->
        mutableState.value = mutableState.value.copy(
          tokens = tokens,
          selectedTokenId = preferredTokenId(tokens, mutableState.value.selectedTokenId),
        )
      }
    }
    refresh()
  }

  fun selectToken(tokenId: String) {
    mutableState.value = mutableState.value.copy(selectedTokenId = tokenId)
    refreshSummary()
  }

  fun refresh() {
    viewModelScope.launch {
      mutableState.value = mutableState.value.copy(isLoading = true, errorMessage = null)
      when (val catalog = repository.getCatalog()) {
        is ApiResult.Success -> {
          mutableState.value = mutableState.value.copy(catalog = catalog.data)
          refreshSummary(keepLoading = true)
        }
        is ApiResult.Failure -> mutableState.value = mutableState.value.copy(
          isLoading = false,
          errorMessage = catalog.error.message,
        )
      }
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

  fun consumeMessage() {
    mutableState.value = mutableState.value.copy(actionMessage = null, errorMessage = null)
  }
}

class LegionWarViewModel(
  private val repository: GameFeatureRepository,
  tokenRepository: TokenManagementRepository,
) : ViewModel() {
  private val mutableState = MutableStateFlow(LegionWarUiState())
  val uiState: StateFlow<LegionWarUiState> = mutableState.asStateFlow()

  init {
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
    mutableState.value = mutableState.value.copy(selectedReportType = reportType)
  }

  fun setQueryDate(date: String) {
    mutableState.value = mutableState.value.copy(queryDate = date)
  }

  fun refreshCatalog() {
    viewModelScope.launch {
      mutableState.value = mutableState.value.copy(isLoading = true, errorMessage = null)
      when (val result = repository.getCatalog()) {
        is ApiResult.Success -> mutableState.value = mutableState.value.copy(
          isLoading = false,
          catalog = result.data,
          selectedReportType = result.data.types.firstOrNull()?.id ?: "salt-field",
        )
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
    viewModelScope.launch {
      mutableState.value = mutableState.value.copy(isLoading = true, errorMessage = null)
      when (val result = repository.queryReports(state.selectedTokenId, state.selectedReportType, state.queryDate)) {
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
