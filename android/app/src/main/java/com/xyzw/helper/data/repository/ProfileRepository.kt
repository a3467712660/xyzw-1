package com.xyzw.helper.data.repository

import com.xyzw.helper.data.model.AuthUser
import com.xyzw.helper.data.model.UserPreferenceItem
import com.xyzw.helper.data.model.UserSecurityEventItem
import com.xyzw.helper.data.model.UserSensitiveConfirmResult
import com.xyzw.helper.data.network.ApiResult
import com.xyzw.helper.data.network.ApiResultParser
import com.xyzw.helper.data.network.PreferenceValueRequest
import com.xyzw.helper.data.network.ProfileUpdateRequest
import com.xyzw.helper.data.network.UpdatePasswordRequest
import com.xyzw.helper.data.network.UserApi
import com.xyzw.helper.data.network.UserSensitiveConfirmRequest
import com.xyzw.helper.data.session.UserSensitiveActionSession
import kotlinx.serialization.json.JsonElement

class ProfileRepository(
  private val api: UserApi,
  private val parser: ApiResultParser,
  private val sensitiveActionSession: UserSensitiveActionSession,
) {
  suspend fun confirmSensitiveAction(
    password: String? = null,
    totpCode: String? = null,
    recoveryCode: String? = null,
  ): ApiResult<UserSensitiveConfirmResult> =
    when (
      val result = parser.parse(
        api.confirmSensitiveAction(
          UserSensitiveConfirmRequest(
            password = password?.takeIf { it.isNotBlank() },
            totpCode = totpCode?.takeIf { it.isNotBlank() },
            recoveryCode = recoveryCode?.takeIf { it.isNotBlank() },
          ),
        ),
      )
    ) {
      is ApiResult.Success -> {
        sensitiveActionSession.store(
          token = result.data.token,
          expiresAt = result.data.expiresAt,
        )
        result
      }
      is ApiResult.Failure -> result
    }

  suspend fun getProfile(): ApiResult<AuthUser> =
    parser.parse(api.getProfile())

  suspend fun updateProfile(
    email: String,
    nickname: String,
    phone: String,
  ): ApiResult<AuthUser> =
    parser.parse(
      api.updateProfile(
        ProfileUpdateRequest(
          email = email,
          nickname = nickname,
          phone = phone,
        ),
      ),
    )

  suspend fun changePassword(
    currentPassword: String,
    newPassword: String,
  ): ApiResult<Unit> =
    parser.parseUnit(
      api.changePassword(
        UpdatePasswordRequest(
          currentPassword = currentPassword,
          newPassword = newPassword,
        ),
      ),
    )

  suspend fun getPreference(key: String): ApiResult<UserPreferenceItem> =
    parser.parse(api.getPreference(key))

  suspend fun setPreference(
    key: String,
    value: JsonElement,
  ): ApiResult<UserPreferenceItem> =
    parser.parse(
      api.setPreference(
        key = key,
        confirmToken = sensitiveActionSession.currentToken(),
        request = PreferenceValueRequest(value),
      ),
    )

  suspend fun getSecurityEvents(
    limit: Int = 50,
    eventType: String = "",
  ): ApiResult<List<UserSecurityEventItem>> =
    parser.parse(
      api.getSecurityEvents(
        limit = limit,
        eventType = eventType.ifBlank { null },
      ),
    )

  fun clearSensitiveActionToken() {
    sensitiveActionSession.clear()
  }
}
