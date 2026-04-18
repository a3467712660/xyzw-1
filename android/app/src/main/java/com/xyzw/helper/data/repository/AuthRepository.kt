package com.xyzw.helper.data.repository

import com.xyzw.helper.data.model.AuthUser
import com.xyzw.helper.data.model.RegisterResultPayload
import com.xyzw.helper.data.network.ApiResult
import com.xyzw.helper.data.network.ApiResultParser
import com.xyzw.helper.data.network.AuthApi
import com.xyzw.helper.data.network.AuthBootstrapHelper
import com.xyzw.helper.data.network.LoginRequest
import com.xyzw.helper.data.network.RegisterRequest
import com.xyzw.helper.data.network.ResetPasswordRequest
import com.xyzw.helper.data.network.VerifyMfaRequest
import com.xyzw.helper.data.session.SessionManager

sealed interface LoginResult {
  data class Authenticated(
    val user: AuthUser,
  ) : LoginResult

  data class MfaRequired(
    val challengeToken: String,
  ) : LoginResult

  data class Failure(
    val error: com.xyzw.helper.data.network.ApiError,
  ) : LoginResult
}

class AuthRepository(
  private val authApi: AuthApi,
  private val sessionManager: SessionManager,
  private val authBootstrapHelper: AuthBootstrapHelper,
  private val parser: ApiResultParser,
) {
  suspend fun bootstrapSession(): ApiResult<AuthUser> {
    authBootstrapHelper.ensureCsrf()
    return fetchCurrentUser()
  }

  suspend fun login(
    username: String,
    password: String,
    rememberMe: Boolean,
  ): LoginResult {
    val csrf = authBootstrapHelper.ensureCsrf()
    if (csrf is ApiResult.Failure) {
      return LoginResult.Failure(csrf.error)
    }

    return when (
      val login = parser.parse(
        authApi.login(
          LoginRequest(
            username = username,
            password = password,
            rememberMe = rememberMe,
          ),
        ),
      )
    ) {
      is ApiResult.Failure -> {
        sessionManager.clearSession()
        LoginResult.Failure(login.error)
      }

      is ApiResult.Success -> {
        if (login.data.mfaRequired && !login.data.mfaChallengeToken.isNullOrBlank()) {
          sessionManager.clearSession()
          LoginResult.MfaRequired(login.data.mfaChallengeToken)
        } else {
          when (val currentUser = fetchCurrentUser()) {
            is ApiResult.Success -> LoginResult.Authenticated(currentUser.data)
            is ApiResult.Failure -> LoginResult.Failure(currentUser.error)
          }
        }
      }
    }
  }

  suspend fun verifyMfa(
    challengeToken: String,
    totpCode: String? = null,
    recoveryCode: String? = null,
  ): ApiResult<AuthUser> {
    val csrf = authBootstrapHelper.ensureCsrf()
    if (csrf is ApiResult.Failure) {
      return csrf
    }

    return when (
      val verifyResult = parser.parse(
        authApi.verifyMfa(
          VerifyMfaRequest(
            mfaChallengeToken = challengeToken,
            totpCode = totpCode,
            recoveryCode = recoveryCode,
          ),
        ),
      )
    ) {
      is ApiResult.Failure -> {
        sessionManager.clearSession()
        verifyResult
      }

      is ApiResult.Success -> fetchCurrentUser()
    }
  }

  suspend fun register(
    username: String,
    email: String?,
    password: String,
    inviteCode: String,
    referralCode: String,
  ): ApiResult<RegisterResultPayload> {
    val csrf = authBootstrapHelper.ensureCsrf()
    if (csrf is ApiResult.Failure) {
      return csrf
    }
    return parser.parse(
      authApi.register(
        RegisterRequest(
          username = username,
          email = email,
          password = password,
          inviteCode = inviteCode,
          referralCode = referralCode,
        ),
      ),
    )
  }

  suspend fun resetPassword(
    identity: String,
    shortCode: String,
    newPassword: String,
  ): ApiResult<Unit> {
    val csrf = authBootstrapHelper.ensureCsrf()
    if (csrf is ApiResult.Failure) {
      return ApiResult.Failure(csrf.error)
    }
    return parser.parseUnit(
      authApi.resetPassword(
        ResetPasswordRequest(
          identity = identity,
          shortCode = shortCode,
          newPassword = newPassword,
        ),
      ),
    )
  }

  suspend fun logout(): ApiResult<Unit> {
    val csrf = authBootstrapHelper.ensureCsrf()
    if (csrf is ApiResult.Failure) {
      sessionManager.clearSession()
      return ApiResult.Failure(csrf.error)
    }
    val result = parser.parseUnit(authApi.logout())
    sessionManager.clearSession()
    return result
  }

  suspend fun refresh(): ApiResult<Unit> =
    when (val result = parser.parse(authApi.refresh())) {
      is ApiResult.Success -> ApiResult.Success(Unit, result.message)
      is ApiResult.Failure -> result
    }

  suspend fun fetchCurrentUser(): ApiResult<AuthUser> {
    val result = parser.parse(authApi.getMe())
    if (result is ApiResult.Success) {
      sessionManager.setAuthenticated(result.data)
    } else if (result is ApiResult.Failure) {
      sessionManager.clearSession()
    }
    return result
  }
}
