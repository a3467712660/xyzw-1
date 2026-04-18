package com.xyzw.helper.data.session

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.time.Instant

data class UserSensitiveActionState(
  val token: String? = null,
  val expiresAt: String? = null,
) {
  val isActive: Boolean
    get() {
      val rawExpiresAt = expiresAt ?: return false
      val expiresAtInstant = runCatching { Instant.parse(rawExpiresAt) }.getOrNull() ?: return false
      return token != null && expiresAtInstant.isAfter(Instant.now())
    }
}

class UserSensitiveActionSession {
  private val mutableState = MutableStateFlow(UserSensitiveActionState())
  val state: StateFlow<UserSensitiveActionState> = mutableState.asStateFlow()

  fun store(token: String, expiresAt: String) {
    mutableState.value = UserSensitiveActionState(
      token = token,
      expiresAt = expiresAt,
    )
  }

  fun currentToken(): String? =
    mutableState.value
      .takeIf { it.isActive }
      ?.token

  fun clear() {
    mutableState.value = UserSensitiveActionState()
  }
}
