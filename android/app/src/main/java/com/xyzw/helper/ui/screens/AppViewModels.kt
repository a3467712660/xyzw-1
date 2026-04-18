package com.xyzw.helper.ui.screens

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.xyzw.helper.app.LocalSessionController
import com.xyzw.helper.app.RealtimeCoordinator
import com.xyzw.helper.data.model.AuthUser
import com.xyzw.helper.data.model.BuildInfo
import com.xyzw.helper.data.model.GameRole
import com.xyzw.helper.data.model.NotificationItem
import com.xyzw.helper.data.network.ApiError
import com.xyzw.helper.data.network.ApiResult
import com.xyzw.helper.data.repository.AuthRepository
import com.xyzw.helper.data.repository.GameRoleRepository
import com.xyzw.helper.data.repository.LoginResult
import com.xyzw.helper.data.repository.NotificationRepository
import com.xyzw.helper.data.repository.SystemRepository
import com.xyzw.helper.data.session.SessionManager
import com.xyzw.helper.data.session.SessionState
import com.xyzw.helper.websocket.WsEvent
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed interface SplashDestination {
  data object Pending : SplashDestination
  data object Login : SplashDestination
  data object Main : SplashDestination
}

data class SplashUiState(
  val destination: SplashDestination = SplashDestination.Pending,
)

class SplashViewModel(
  private val authRepository: AuthRepository,
) : ViewModel() {
  private val mutableState = MutableStateFlow(SplashUiState())
  val uiState: StateFlow<SplashUiState> = mutableState.asStateFlow()

  init {
    viewModelScope.launch {
      mutableState.value = when (authRepository.bootstrapSession()) {
        is ApiResult.Success -> SplashUiState(SplashDestination.Main)
        is ApiResult.Failure -> SplashUiState(SplashDestination.Login)
      }
    }
  }
}

data class AuthUiState(
  val isLoading: Boolean = false,
  val errorMessage: String? = null,
  val pendingChallengeToken: String? = null,
  val useRecoveryCode: Boolean = false,
)

sealed interface AuthEvent {
  data object NavigateMain : AuthEvent
  data object NavigateMfa : AuthEvent
  data object NavigateLogin : AuthEvent
}

class AuthViewModel(
  private val authRepository: AuthRepository,
  sessionManager: SessionManager,
  private val localSessionController: LocalSessionController,
) : ViewModel() {
  private val mutableState = MutableStateFlow(AuthUiState())
  val uiState: StateFlow<AuthUiState> = mutableState.asStateFlow()

  private val mutableEvents = MutableSharedFlow<AuthEvent>()
  val events: SharedFlow<AuthEvent> = mutableEvents.asSharedFlow()

  init {
    viewModelScope.launch {
      sessionManager.state.collect { state ->
        if (state is SessionState.Unauthenticated) {
          mutableEvents.emit(AuthEvent.NavigateLogin)
        }
      }
    }
  }

  fun login(username: String, password: String, rememberMe: Boolean) {
    viewModelScope.launch {
      mutableState.value = mutableState.value.copy(isLoading = true, errorMessage = null)
      when (val result = authRepository.login(username, password, rememberMe)) {
        is LoginResult.Authenticated -> {
          mutableState.value = AuthUiState()
          mutableEvents.emit(AuthEvent.NavigateMain)
        }

        is LoginResult.MfaRequired -> {
          mutableState.value = AuthUiState(
            pendingChallengeToken = result.challengeToken,
          )
          mutableEvents.emit(AuthEvent.NavigateMfa)
        }

        is LoginResult.Failure -> {
          mutableState.value = mutableState.value.copy(
            isLoading = false,
            errorMessage = result.error.message,
          )
        }
      }
    }
  }

  fun verifyMfa(code: String) {
    val challengeToken = mutableState.value.pendingChallengeToken ?: return
    viewModelScope.launch {
      mutableState.value = mutableState.value.copy(isLoading = true, errorMessage = null)
      val result = if (mutableState.value.useRecoveryCode) {
        authRepository.verifyMfa(challengeToken = challengeToken, recoveryCode = code)
      } else {
        authRepository.verifyMfa(challengeToken = challengeToken, totpCode = code)
      }
      when (result) {
        is ApiResult.Success -> {
          mutableState.value = AuthUiState()
          mutableEvents.emit(AuthEvent.NavigateMain)
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

  fun register(
    username: String,
    email: String,
    password: String,
    inviteCode: String,
    referralCode: String,
  ) {
    viewModelScope.launch {
      mutableState.value = mutableState.value.copy(isLoading = true, errorMessage = null)
      val result = authRepository.register(
        username = username,
        email = email.ifBlank { null },
        password = password,
        inviteCode = inviteCode,
        referralCode = referralCode,
      )
      when (result) {
        is ApiResult.Success -> {
          mutableState.value = AuthUiState()
          mutableEvents.emit(AuthEvent.NavigateLogin)
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

  fun resetPassword(identity: String, shortCode: String, newPassword: String) {
    viewModelScope.launch {
      mutableState.value = mutableState.value.copy(isLoading = true, errorMessage = null)
      when (val result = authRepository.resetPassword(identity, shortCode, newPassword)) {
        is ApiResult.Success -> {
          mutableState.value = AuthUiState()
          mutableEvents.emit(AuthEvent.NavigateLogin)
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

  fun logout() {
    viewModelScope.launch {
      authRepository.logout()
      localSessionController.clearLocalSession()
      mutableState.value = AuthUiState()
      mutableEvents.emit(AuthEvent.NavigateLogin)
    }
  }

  fun toggleRecoveryMode() {
    mutableState.value = mutableState.value.copy(
      useRecoveryCode = !mutableState.value.useRecoveryCode,
      errorMessage = null,
      isLoading = false,
    )
  }

  fun clearError() {
    mutableState.value = mutableState.value.copy(errorMessage = null, isLoading = false)
  }
}

data class DashboardUiState(
  val user: AuthUser? = null,
  val versionInfo: BuildInfo? = null,
  val isLoading: Boolean = true,
  val errorMessage: String? = null,
  val wsConnected: Boolean = false,
)

class DashboardViewModel(
  sessionManager: SessionManager,
  private val systemRepository: SystemRepository,
  realtimeCoordinator: RealtimeCoordinator,
) : ViewModel() {
  private val mutableState = MutableStateFlow(DashboardUiState())
  val uiState: StateFlow<DashboardUiState> = mutableState.asStateFlow()

  init {
    viewModelScope.launch {
      sessionManager.state.collect { sessionState ->
        val user = when (sessionState) {
          is SessionState.Authenticated -> sessionState.user
          else -> null
        }
        mutableState.value = mutableState.value.copy(user = user)
      }
    }
    viewModelScope.launch {
      realtimeCoordinator.connectionState.collect { state ->
        mutableState.value = mutableState.value.copy(wsConnected = state.isConnected)
      }
    }
    refresh()
  }

  fun refresh() {
    viewModelScope.launch {
      mutableState.value = mutableState.value.copy(isLoading = true, errorMessage = null)
      when (val result = systemRepository.getVersion()) {
        is ApiResult.Success -> {
          mutableState.value = mutableState.value.copy(
            versionInfo = result.data,
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
}

data class RolesUiState(
  val roles: List<GameRole> = emptyList(),
  val isLoading: Boolean = true,
  val errorMessage: String? = null,
)

class RolesViewModel(
  private val repository: GameRoleRepository,
) : ViewModel() {
  private val mutableState = MutableStateFlow(RolesUiState())
  val uiState: StateFlow<RolesUiState> = mutableState.asStateFlow()

  init {
    refresh()
  }

  fun refresh() {
    viewModelScope.launch {
      mutableState.value = mutableState.value.copy(isLoading = true, errorMessage = null)
      when (val result = repository.listRoles()) {
        is ApiResult.Success -> {
          mutableState.value = RolesUiState(
            roles = result.data,
            isLoading = false,
          )
        }

        is ApiResult.Failure -> {
          mutableState.value = RolesUiState(
            roles = emptyList(),
            isLoading = false,
            errorMessage = result.error.message,
          )
        }
      }
    }
  }
}

data class NotificationsUiState(
  val notifications: List<NotificationItem> = emptyList(),
  val isLoading: Boolean = true,
  val errorMessage: String? = null,
)

class NotificationsViewModel(
  private val repository: NotificationRepository,
  realtimeCoordinator: RealtimeCoordinator,
) : ViewModel() {
  private val mutableState = MutableStateFlow(NotificationsUiState())
  val uiState: StateFlow<NotificationsUiState> = mutableState.asStateFlow()

  init {
    refresh()
    viewModelScope.launch {
      realtimeCoordinator.events.collect { event ->
        when (event) {
          is WsEvent.NotificationNew -> {
            mutableState.value = mutableState.value.copy(
              notifications = listOf(event.notification) + mutableState.value.notifications
                .filterNot { it.id == event.notification.id },
            )
          }
          is WsEvent.NotificationReadAll -> {
            mutableState.value = mutableState.value.copy(
              notifications = mutableState.value.notifications.map { it.copy(isRead = true) },
            )
          }
          is WsEvent.NotificationCleared -> {
            mutableState.value = mutableState.value.copy(notifications = emptyList())
          }
          else -> Unit
        }
      }
    }
  }

  fun refresh() {
    viewModelScope.launch {
      mutableState.value = mutableState.value.copy(isLoading = true, errorMessage = null)
      when (val result = repository.listNotifications()) {
        is ApiResult.Success -> {
          mutableState.value = NotificationsUiState(
            notifications = result.data,
            isLoading = false,
          )
        }

        is ApiResult.Failure -> {
          mutableState.value = NotificationsUiState(
            notifications = emptyList(),
            isLoading = false,
            errorMessage = result.error.message,
          )
        }
      }
    }
  }

  fun markRead(id: String) {
    viewModelScope.launch {
      when (repository.markRead(id)) {
        is ApiResult.Success -> {
          mutableState.value = mutableState.value.copy(
            notifications = mutableState.value.notifications.map { item ->
              if (item.id == id) item.copy(isRead = true) else item
            },
          )
        }

        is ApiResult.Failure -> Unit
      }
    }
  }

  fun markAllRead() {
    viewModelScope.launch {
      when (repository.markAllRead()) {
        is ApiResult.Success -> {
          mutableState.value = mutableState.value.copy(
            notifications = mutableState.value.notifications.map { it.copy(isRead = true) },
          )
        }

        is ApiResult.Failure -> Unit
      }
    }
  }

  fun clearAll() {
    viewModelScope.launch {
      when (repository.clearAll()) {
        is ApiResult.Success -> {
          mutableState.value = mutableState.value.copy(notifications = emptyList())
        }
        is ApiResult.Failure -> Unit
      }
    }
  }
}
