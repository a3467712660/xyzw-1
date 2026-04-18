package com.xyzw.helper.ui.screens

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.xyzw.helper.app.LocalSessionController
import com.xyzw.helper.app.RealtimeCoordinator
import com.xyzw.helper.data.model.BinFileItem
import com.xyzw.helper.data.model.DailyTaskEntry
import com.xyzw.helper.data.model.DailyTaskHistoryItem
import com.xyzw.helper.data.model.DailyTaskStatusSummary
import com.xyzw.helper.data.model.FeedbackItem
import com.xyzw.helper.data.model.GameRole
import com.xyzw.helper.data.model.ImportedGameToken
import com.xyzw.helper.data.model.ReferralConversionItem
import com.xyzw.helper.data.model.ReferralOverview
import com.xyzw.helper.data.model.ReferralProfile
import com.xyzw.helper.data.model.TaskControlLogItem
import com.xyzw.helper.data.model.TaskControlStateSnapshot
import com.xyzw.helper.data.network.ApiResult
import com.xyzw.helper.data.network.GameRoleUpsertRequest
import com.xyzw.helper.data.repository.DailyTaskRepository
import com.xyzw.helper.data.repository.FeedbackUserRepository
import com.xyzw.helper.data.repository.GameRoleRepository
import com.xyzw.helper.data.repository.ProfileRepository
import com.xyzw.helper.data.repository.ReferralRepository
import com.xyzw.helper.data.repository.TokenManagementRepository
import com.xyzw.helper.data.repository.TaskControlRepository
import com.xyzw.helper.data.storage.AppPreferencesStore
import com.xyzw.helper.data.storage.ThemeMode
import com.xyzw.helper.websocket.WsEvent
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonPrimitive
import java.io.OutputStream
import java.time.Instant

data class TokenManagementUiState(
  val tokens: List<ImportedGameToken> = emptyList(),
  val binFiles: List<BinFileItem> = emptyList(),
  val isLoading: Boolean = true,
  val isImporting: Boolean = false,
  val actionMessage: String? = null,
  val errorMessage: String? = null,
  val pendingDownload: PendingTokenBinDownload? = null,
)

data class PendingTokenBinDownload(
  val tokenId: String,
  val bytes: ByteArray,
)

class TokenManagementViewModel(
  private val repository: TokenManagementRepository,
  private val profileRepository: ProfileRepository,
) : ViewModel() {
  private val mutableState = MutableStateFlow(TokenManagementUiState())
  val uiState: StateFlow<TokenManagementUiState> = mutableState.asStateFlow()

  init {
    viewModelScope.launch {
      repository.tokens.collectLatest { tokens ->
        mutableState.value = mutableState.value.copy(tokens = tokens)
      }
    }
    refresh()
  }

  fun refresh() {
    viewModelScope.launch {
      mutableState.value = mutableState.value.copy(isLoading = true, errorMessage = null)
      when (val result = repository.listBinFiles()) {
        is ApiResult.Success -> {
          val filesByTokenId = result.data.associateBy { it.tokenId }
          mutableState.value.tokens.forEach { token ->
            repository.updateImportedToken(token.id) { current ->
              current.copy(
                binFilePresent = filesByTokenId.containsKey(current.id),
                updatedAt = Instant.now().toString(),
              )
            }
          }
          mutableState.value = mutableState.value.copy(
            binFiles = result.data,
            isLoading = false,
          )
        }
        is ApiResult.Failure -> {
          mutableState.value = mutableState.value.copy(
            isLoading = false,
            errorMessage = result.error.message,
          )
        }
      }
    }
  }

  fun importManual(rawToken: String) {
    viewModelScope.launch {
      mutableState.value = mutableState.value.copy(isImporting = true, errorMessage = null)
      runCatching { repository.parseManualToken(rawToken) }
        .onSuccess { token ->
          repository.saveImportedToken(token)
          refreshActivation(token.id)
          mutableState.value = mutableState.value.copy(
            isImporting = false,
            actionMessage = "Token 已导入",
          )
        }
        .onFailure { error ->
          mutableState.value = mutableState.value.copy(
            isImporting = false,
            errorMessage = error.message ?: "Token 导入失败",
          )
        }
    }
  }

  fun importFromUrl(url: String) {
    viewModelScope.launch {
      mutableState.value = mutableState.value.copy(isImporting = true, errorMessage = null)
      when (val result = repository.proxyImport(url)) {
        is ApiResult.Success -> {
          result.data.forEach(repository::saveImportedToken)
          result.data.forEach { token -> refreshActivation(token.id) }
          mutableState.value = mutableState.value.copy(
            isImporting = false,
            actionMessage = "URL 导入完成",
          )
        }
        is ApiResult.Failure -> {
          mutableState.value = mutableState.value.copy(
            isImporting = false,
            errorMessage = result.error.message,
          )
        }
      }
    }
  }

  fun removeToken(tokenId: String) {
    repository.removeImportedToken(tokenId)
    mutableState.value = mutableState.value.copy(
      binFiles = mutableState.value.binFiles.filterNot { it.tokenId == tokenId },
    )
  }

  fun refreshActivation(tokenId: String) {
    val token = mutableState.value.tokens.firstOrNull { it.id == tokenId } ?: return
    viewModelScope.launch {
      when (val result = repository.getActivationStatus(token)) {
        is ApiResult.Success -> {
          repository.updateImportedToken(tokenId) { current ->
            current.copy(
              activationBound = result.data.bound,
              activationActive = result.data.active,
              activationExpiresAt = result.data.expiresAt,
              activationBoundAt = result.data.boundAt,
              lastSyncAt = Instant.now().toString(),
              lastError = null,
              updatedAt = Instant.now().toString(),
            )
          }
        }
        is ApiResult.Failure -> {
          repository.updateImportedToken(tokenId) { current ->
            current.copy(
              activationBound = false,
              activationActive = false,
              lastSyncAt = Instant.now().toString(),
              lastError = result.error.message,
              updatedAt = Instant.now().toString(),
            )
          }
        }
      }
    }
  }

  fun uploadBinFile(tokenId: String, bytes: ByteArray) {
    viewModelScope.launch {
      when (val result = repository.uploadBinFile(tokenId, bytes)) {
        is ApiResult.Success -> {
          repository.updateImportedToken(tokenId) { current ->
            current.copy(
              binFilePresent = true,
              updatedAt = Instant.now().toString(),
            )
          }
          mutableState.value = mutableState.value.copy(actionMessage = "BIN 文件已上传")
          refresh()
        }
        is ApiResult.Failure -> {
          mutableState.value = mutableState.value.copy(errorMessage = result.error.message)
        }
      }
    }
  }

  suspend fun confirmSensitiveAction(
    password: String? = null,
    totpCode: String? = null,
    recoveryCode: String? = null,
  ): ApiResult<com.xyzw.helper.data.model.UserSensitiveConfirmResult> =
    profileRepository.confirmSensitiveAction(password, totpCode, recoveryCode)

  fun requestBinDownload(tokenId: String) {
    viewModelScope.launch {
      when (val ticketResult = repository.createDownloadTicket(tokenId)) {
        is ApiResult.Success -> {
          when (val downloadResult = repository.downloadBinFile(tokenId, ticketResult.data.ticket)) {
            is ApiResult.Success -> {
              mutableState.value = mutableState.value.copy(
                pendingDownload = PendingTokenBinDownload(
                  tokenId = tokenId,
                  bytes = downloadResult.data,
                ),
                errorMessage = null,
              )
            }
            is ApiResult.Failure -> {
              mutableState.value = mutableState.value.copy(errorMessage = downloadResult.error.message)
            }
          }
        }
        is ApiResult.Failure -> {
          mutableState.value = mutableState.value.copy(errorMessage = ticketResult.error.message)
        }
      }
    }
  }

  fun completePendingDownload(outputStream: OutputStream) {
    val pending = mutableState.value.pendingDownload ?: return
    outputStream.use { stream -> stream.write(pending.bytes) }
    mutableState.value = mutableState.value.copy(
      pendingDownload = null,
      actionMessage = "BIN 文件已导出",
    )
  }

  fun cancelPendingDownload() {
    mutableState.value = mutableState.value.copy(pendingDownload = null)
  }

  fun deleteBinFile(tokenId: String) {
    viewModelScope.launch {
      when (val result = repository.deleteBinFile(tokenId)) {
        is ApiResult.Success -> {
          repository.updateImportedToken(tokenId) { current ->
            current.copy(
              binFilePresent = false,
              updatedAt = Instant.now().toString(),
            )
          }
          refresh()
        }
        is ApiResult.Failure -> {
          mutableState.value = mutableState.value.copy(errorMessage = result.error.message)
        }
      }
    }
  }

  fun consumeMessage() {
    mutableState.value = mutableState.value.copy(
      actionMessage = null,
      errorMessage = null,
    )
  }
}

data class RoleManagementUiState(
  val roles: List<GameRole> = emptyList(),
  val isLoading: Boolean = true,
  val selectedRole: GameRole? = null,
  val errorMessage: String? = null,
)

class RoleManagementViewModel(
  private val repository: GameRoleRepository,
) : ViewModel() {
  private val mutableState = MutableStateFlow(RoleManagementUiState())
  val uiState: StateFlow<RoleManagementUiState> = mutableState.asStateFlow()

  init {
    refresh()
  }

  fun refresh() {
    viewModelScope.launch {
      mutableState.value = mutableState.value.copy(isLoading = true, errorMessage = null)
      when (val result = repository.listRoles()) {
        is ApiResult.Success -> mutableState.value = mutableState.value.copy(
          roles = result.data,
          isLoading = false,
        )
        is ApiResult.Failure -> mutableState.value = mutableState.value.copy(
          roles = emptyList(),
          isLoading = false,
          errorMessage = result.error.message,
        )
      }
    }
  }

  fun selectRole(role: GameRole?) {
    mutableState.value = mutableState.value.copy(selectedRole = role)
  }

  suspend fun saveRole(
    existingId: String?,
    request: GameRoleUpsertRequest,
  ): ApiResult<GameRole> =
    when (val result = if (existingId.isNullOrBlank()) repository.createRole(
      name = request.name,
      server = request.server,
      profession = request.profession,
      level = request.level,
      account = request.account,
      note = request.note,
      avatar = request.avatar,
    ) else repository.updateRole(existingId, request)) {
      is ApiResult.Success -> {
        refresh()
        result
      }
      is ApiResult.Failure -> {
        mutableState.value = mutableState.value.copy(errorMessage = result.error.message)
        result
      }
    }

  suspend fun loadRoleDetail(roleId: String): ApiResult<GameRole> =
    when (val result = repository.getRoleDetail(roleId)) {
      is ApiResult.Success -> {
        mutableState.value = mutableState.value.copy(selectedRole = result.data)
        result
      }
      is ApiResult.Failure -> {
        mutableState.value = mutableState.value.copy(errorMessage = result.error.message)
        result
      }
    }

  suspend fun deleteRole(roleId: String): ApiResult<Unit> =
    when (val result = repository.deleteRole(roleId)) {
      is ApiResult.Success -> {
        refresh()
        mutableState.value = mutableState.value.copy(selectedRole = null)
        result
      }
      is ApiResult.Failure -> {
        mutableState.value = mutableState.value.copy(errorMessage = result.error.message)
        result
      }
    }
}

data class DailyTasksUiState(
  val roles: List<GameRole> = emptyList(),
  val selectedRoleId: String? = null,
  val statusSummary: DailyTaskStatusSummary = DailyTaskStatusSummary(),
  val tasks: List<DailyTaskEntry> = emptyList(),
  val history: List<DailyTaskHistoryItem> = emptyList(),
  val isLoading: Boolean = true,
  val errorMessage: String? = null,
)

class DailyTasksViewModel(
  private val roleRepository: GameRoleRepository,
  private val dailyTaskRepository: DailyTaskRepository,
) : ViewModel() {
  private val mutableState = MutableStateFlow(DailyTasksUiState())
  val uiState: StateFlow<DailyTasksUiState> = mutableState.asStateFlow()

  init {
    refreshRoles()
  }

  fun refreshRoles() {
    viewModelScope.launch {
      when (val result = roleRepository.listRoles()) {
        is ApiResult.Success -> {
          val selectedRoleId = mutableState.value.selectedRoleId ?: result.data.firstOrNull()?.id
          mutableState.value = mutableState.value.copy(
            roles = result.data,
            selectedRoleId = selectedRoleId,
          )
          if (!selectedRoleId.isNullOrBlank()) {
            refresh(selectedRoleId)
          } else {
            mutableState.value = mutableState.value.copy(
              tasks = emptyList(),
              history = emptyList(),
              isLoading = false,
            )
          }
        }
        is ApiResult.Failure -> {
          mutableState.value = mutableState.value.copy(
            isLoading = false,
            errorMessage = result.error.message,
          )
        }
      }
    }
  }

  fun selectRole(roleId: String) {
    mutableState.value = mutableState.value.copy(selectedRoleId = roleId)
    refresh(roleId)
  }

  fun refresh(roleId: String = mutableState.value.selectedRoleId.orEmpty()) {
    if (roleId.isBlank()) {
      return
    }
    viewModelScope.launch {
      mutableState.value = mutableState.value.copy(isLoading = true, errorMessage = null)
      val tasksResult = dailyTaskRepository.listTasks(roleId)
      val statusResult = dailyTaskRepository.getStatus(roleId)
      val historyResult = dailyTaskRepository.getHistory(roleId)

      if (tasksResult is ApiResult.Success
        && statusResult is ApiResult.Success
        && historyResult is ApiResult.Success
      ) {
        mutableState.value = mutableState.value.copy(
          tasks = tasksResult.data,
          statusSummary = statusResult.data,
          history = historyResult.data,
          isLoading = false,
        )
      } else {
        val error = listOf(tasksResult, statusResult, historyResult)
          .filterIsInstance<ApiResult.Failure>()
          .firstOrNull()
        mutableState.value = mutableState.value.copy(
          isLoading = false,
          errorMessage = error?.error?.message ?: "任务加载失败",
        )
      }
    }
  }

  fun completeTask(taskId: String) {
    val roleId = mutableState.value.selectedRoleId ?: return
    viewModelScope.launch {
      when (val result = dailyTaskRepository.completeTask(taskId, roleId)) {
        is ApiResult.Success -> refresh(roleId)
        is ApiResult.Failure -> mutableState.value = mutableState.value.copy(errorMessage = result.error.message)
      }
    }
  }

  fun updateTask(task: DailyTaskEntry, enabled: Boolean, autoExecute: Boolean) {
    val roleId = mutableState.value.selectedRoleId ?: return
    viewModelScope.launch {
      when (
        val result = dailyTaskRepository.updateTask(
          taskId = task.id,
          roleId = roleId,
          enabled = enabled,
          autoExecute = autoExecute,
          delay = task.settings.delay,
          notification = task.settings.notification,
          cronExpr = task.settings.cronExpr.ifBlank { null },
        )
      ) {
        is ApiResult.Success -> refresh(roleId)
        is ApiResult.Failure -> mutableState.value = mutableState.value.copy(errorMessage = result.error.message)
      }
    }
  }
}

data class TaskControlUiState(
  val state: TaskControlStateSnapshot = TaskControlStateSnapshot(),
  val logs: List<TaskControlLogItem> = emptyList(),
  val localEvents: List<String> = emptyList(),
  val isLoading: Boolean = true,
  val errorMessage: String? = null,
)

class TaskControlViewModel(
  private val repository: TaskControlRepository,
  realtimeCoordinator: RealtimeCoordinator,
) : ViewModel() {
  private val mutableState = MutableStateFlow(TaskControlUiState())
  val uiState: StateFlow<TaskControlUiState> = mutableState.asStateFlow()

  init {
    refresh()
    viewModelScope.launch {
      realtimeCoordinator.events.collect { event ->
        when (event) {
          is WsEvent.TaskDone -> {
            mutableState.value = mutableState.value.copy(
              localEvents = listOf(event.message) + mutableState.value.localEvents,
            )
            refresh()
          }
          is WsEvent.TaskControlStateUpdated -> refresh()
          else -> Unit
        }
      }
    }
  }

  fun refresh() {
    viewModelScope.launch {
      mutableState.value = mutableState.value.copy(isLoading = true, errorMessage = null)
      val stateResult = repository.getState()
      val logsResult = repository.getLogs()
      if (stateResult is ApiResult.Success && logsResult is ApiResult.Success) {
        mutableState.value = mutableState.value.copy(
          state = stateResult.data,
          logs = logsResult.data,
          isLoading = false,
        )
      } else {
        val error = listOf(stateResult, logsResult)
          .filterIsInstance<ApiResult.Failure>()
          .firstOrNull()
        mutableState.value = mutableState.value.copy(
          isLoading = false,
          errorMessage = error?.error?.message ?: "任务控制加载失败",
        )
      }
    }
  }

  fun clearLocalState() {
    mutableState.value = mutableState.value.copy(localEvents = emptyList())
  }

  fun clearServerLogs() {
    viewModelScope.launch {
      when (val result = repository.clearLogs()) {
        is ApiResult.Success -> refresh()
        is ApiResult.Failure -> mutableState.value = mutableState.value.copy(errorMessage = result.error.message)
      }
    }
  }
}

data class FeedbackUiState(
  val feedbacks: List<FeedbackItem> = emptyList(),
  val isLoading: Boolean = true,
  val errorMessage: String? = null,
)

class FeedbackViewModel(
  private val repository: FeedbackUserRepository,
) : ViewModel() {
  private val mutableState = MutableStateFlow(FeedbackUiState())
  val uiState: StateFlow<FeedbackUiState> = mutableState.asStateFlow()

  init {
    refresh()
  }

  fun refresh() {
    viewModelScope.launch {
      mutableState.value = mutableState.value.copy(isLoading = true, errorMessage = null)
      when (val result = repository.listFeedbacks()) {
        is ApiResult.Success -> mutableState.value = mutableState.value.copy(
          feedbacks = result.data,
          isLoading = false,
        )
        is ApiResult.Failure -> mutableState.value = mutableState.value.copy(
          isLoading = false,
          errorMessage = result.error.message,
        )
      }
    }
  }

  fun submitFeedback(type: String, title: String, content: String) {
    viewModelScope.launch {
      when (val result = repository.createFeedback(type, title, content)) {
        is ApiResult.Success -> refresh()
        is ApiResult.Failure -> mutableState.value = mutableState.value.copy(errorMessage = result.error.message)
      }
    }
  }
}

data class ReferralUiState(
  val overview: ReferralOverview = ReferralOverview(),
  val conversions: List<ReferralConversionItem> = emptyList(),
  val isLoading: Boolean = true,
  val errorMessage: String? = null,
)

class ReferralViewModel(
  private val repository: ReferralRepository,
) : ViewModel() {
  private val mutableState = MutableStateFlow(ReferralUiState())
  val uiState: StateFlow<ReferralUiState> = mutableState.asStateFlow()

  init {
    refresh()
  }

  fun refresh() {
    viewModelScope.launch {
      mutableState.value = mutableState.value.copy(isLoading = true, errorMessage = null)
      val overviewResult = repository.getReferralOverview()
      val conversionsResult = repository.getReferralConversions()
      if (overviewResult is ApiResult.Success && conversionsResult is ApiResult.Success) {
        mutableState.value = mutableState.value.copy(
          overview = overviewResult.data,
          conversions = conversionsResult.data,
          isLoading = false,
        )
      } else {
        val error = listOf(overviewResult, conversionsResult)
          .filterIsInstance<ApiResult.Failure>()
          .firstOrNull()
        mutableState.value = mutableState.value.copy(
          isLoading = false,
          errorMessage = error?.error?.message ?: "推广数据加载失败",
        )
      }
    }
  }

  fun generateProfile() {
    viewModelScope.launch {
      when (val result = repository.generateReferralProfile()) {
        is ApiResult.Success -> refresh()
        is ApiResult.Failure -> mutableState.value = mutableState.value.copy(errorMessage = result.error.message)
      }
    }
  }
}

data class ProfileSettingsUiState(
  val profile: com.xyzw.helper.data.model.AuthUser? = null,
  val remoteBinDownloadEnabled: Boolean = false,
  val refreshSecondVerifyEnabled: Boolean = true,
  val securityEvents: List<com.xyzw.helper.data.model.UserSecurityEventItem> = emptyList(),
  val isLoading: Boolean = true,
  val errorMessage: String? = null,
)

class ProfileSettingsViewModel(
  private val repository: ProfileRepository,
  private val preferencesStore: AppPreferencesStore,
  private val localSessionController: LocalSessionController,
) : ViewModel() {
  private val mutableState = MutableStateFlow(ProfileSettingsUiState())
  val uiState: StateFlow<ProfileSettingsUiState> = mutableState.asStateFlow()

  companion object {
    const val REMOTE_BIN_DOWNLOAD_PREF_KEY = "security.remote_bin_download_enabled"
    const val REFRESH_SECOND_VERIFY_PREF_KEY = "security.token_refresh_second_verify_enabled"
  }

  init {
    refresh()
  }

  fun refresh() {
    viewModelScope.launch {
      mutableState.value = mutableState.value.copy(isLoading = true, errorMessage = null)
      val profileResult = repository.getProfile()
      val remotePref = repository.getPreference(REMOTE_BIN_DOWNLOAD_PREF_KEY)
      val refreshPref = repository.getPreference(REFRESH_SECOND_VERIFY_PREF_KEY)
      val securityEvents = repository.getSecurityEvents()

      if (
        profileResult is ApiResult.Success
        && remotePref is ApiResult.Success
        && refreshPref is ApiResult.Success
        && securityEvents is ApiResult.Success
      ) {
        mutableState.value = mutableState.value.copy(
          profile = profileResult.data,
          remoteBinDownloadEnabled = (remotePref.data.value as? JsonPrimitive)?.content == "true",
          refreshSecondVerifyEnabled = (refreshPref.data.value as? JsonPrimitive)?.content != "false",
          securityEvents = securityEvents.data,
          isLoading = false,
        )
      } else {
        val error = listOf(profileResult, remotePref, refreshPref, securityEvents)
          .filterIsInstance<ApiResult.Failure>()
          .firstOrNull()
        mutableState.value = mutableState.value.copy(
          isLoading = false,
          errorMessage = error?.error?.message ?: "个人设置加载失败",
        )
      }
    }
  }

  suspend fun confirmSensitiveAction(
    password: String? = null,
    totpCode: String? = null,
    recoveryCode: String? = null,
  ): ApiResult<com.xyzw.helper.data.model.UserSensitiveConfirmResult> =
    repository.confirmSensitiveAction(password, totpCode, recoveryCode)

  fun saveProfile(email: String, nickname: String, phone: String) {
    viewModelScope.launch {
      when (val result = repository.updateProfile(email, nickname, phone)) {
        is ApiResult.Success -> refresh()
        is ApiResult.Failure -> mutableState.value = mutableState.value.copy(errorMessage = result.error.message)
      }
    }
  }

  fun changePassword(currentPassword: String, newPassword: String) {
    viewModelScope.launch {
      when (val result = repository.changePassword(currentPassword, newPassword)) {
        is ApiResult.Success -> {
          repository.clearSensitiveActionToken()
          localSessionController.clearLocalSession()
        }
        is ApiResult.Failure -> mutableState.value = mutableState.value.copy(errorMessage = result.error.message)
      }
    }
  }

  fun setThemeMode(mode: ThemeMode) {
    viewModelScope.launch {
      preferencesStore.setThemeMode(mode)
    }
  }

  fun updateRemoteBinDownload(enabled: Boolean) {
    viewModelScope.launch {
      when (val result = repository.setPreference(REMOTE_BIN_DOWNLOAD_PREF_KEY, JsonPrimitive(enabled))) {
        is ApiResult.Success -> refresh()
        is ApiResult.Failure -> mutableState.value = mutableState.value.copy(errorMessage = result.error.message)
      }
    }
  }
}
