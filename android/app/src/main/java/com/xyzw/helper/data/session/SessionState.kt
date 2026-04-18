package com.xyzw.helper.data.session

import com.xyzw.helper.data.model.AuthUser
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

sealed interface SessionState {
  data object Unknown : SessionState
  data object Unauthenticated : SessionState
  data class Authenticated(
    val user: AuthUser,
  ) : SessionState
}

class SessionManager {
  private val mutableState = MutableStateFlow<SessionState>(SessionState.Unknown)
  val state: StateFlow<SessionState> = mutableState.asStateFlow()

  fun setAuthenticated(user: AuthUser) {
    mutableState.value = SessionState.Authenticated(user)
  }

  fun clearSession() {
    mutableState.value = SessionState.Unauthenticated
  }

  fun reset() {
    mutableState.value = SessionState.Unknown
  }
}
