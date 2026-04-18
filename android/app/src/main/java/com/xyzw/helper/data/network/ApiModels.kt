package com.xyzw.helper.data.network

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class ApiEnvelope<T>(
  val success: Boolean,
  val data: T? = null,
  val message: String? = null,
  val error: ApiEnvelopeError? = null,
)

@Serializable
data class ApiEnvelopeError(
  val code: String? = null,
  val message: String? = null,
)

data class ApiError(
  val httpStatus: Int,
  val code: String? = null,
  val message: String,
  val rawBody: String? = null,
) {
  companion object {
    fun local(
      message: String,
      code: String? = null,
      httpStatus: Int = 0,
      rawBody: String? = null,
    ) = ApiError(
      httpStatus = httpStatus,
      code = code,
      message = message,
      rawBody = rawBody,
    )
  }
}

sealed interface ApiResult<out T> {
  data class Success<T>(
    val data: T,
    val message: String? = null,
  ) : ApiResult<T>

  data class Failure(
    val error: ApiError,
  ) : ApiResult<Nothing>
}

const val SKIP_REFRESH_HEADER = "X-XYZW-Skip-Refresh"
const val SKIP_REFRESH_HEADER_LINE = "$SKIP_REFRESH_HEADER: 1"

@Serializable
data class LoginRequest(
  val username: String,
  val password: String,
  val rememberMe: Boolean,
)

@Serializable
data class VerifyMfaRequest(
  val mfaChallengeToken: String,
  val totpCode: String? = null,
  val recoveryCode: String? = null,
)

@Serializable
data class RegisterRequest(
  val username: String,
  val email: String? = null,
  val password: String,
  val inviteCode: String,
  val referralCode: String = "",
)

@Serializable
data class ResetPasswordRequest(
  val identity: String,
  val shortCode: String,
  val newPassword: String,
)

@Serializable
data class SensitiveConfirmPayload(
  val password: String? = null,
  val totpCode: String? = null,
  val recoveryCode: String? = null,
)

@Serializable
data class AdminUpdateUserAdminRequest(
  val isAdmin: Boolean,
)

@Serializable
data class AdminUpdateAccessScopeRequest(
  val accessScope: String,
)

@Serializable
data class AdminUpdateTokenBindLimitRequest(
  val tokenBindLimit: Int,
)

@Serializable
data class AdminResetPasswordRequest(
  val password: String,
)

@Serializable
data class AdminCreatePasswordResetCodeRequest(
  val expiresInMinutes: Int = 15,
)

@Serializable
data class AdminCreateInviteCodesRequest(
  val count: Int = 1,
  val expiresAt: String? = null,
  val isTemporary: Boolean = false,
  val featureScope: String = "full",
  val bindAccountLimit: Int = 1,
)

@Serializable
data class AdminCreateActivationCodesRequest(
  val count: Int = 1,
  val featureScope: String = "full",
  val durationMonths: Int,
  val saleAmountCents: Int = 0,
)

@Serializable
data class AdminFeedbackUpdateRequest(
  val status: String,
  val adminNote: String? = null,
)

@Serializable
data class AdminChangelogBroadcastRequest(
  val version: String,
  val title: String? = null,
  val content: String? = null,
  val path: String = "/changelog",
)

@Serializable
data class AdminWechatContactRequest(
  val slug: String,
  val title: String,
  val subtitle: String = "",
  val contactType: String,
  val targetUrl: String = "",
  val wechatId: String = "",
  val qrImageDataUrl: String = "",
  val showInPricing: Boolean = true,
  val isActive: Boolean = true,
  val sortOrder: Int = 100,
)

@Serializable
data class AdminMarkReferralPaidRequest(
  val channel: String,
  val settlementRef: String = "",
  val note: String = "",
)

@Serializable
data class AdminRejectReferralRequest(
  val note: String,
)

@Serializable
class EmptyRequest

@Serializable
data class NotificationListQuery(
  @SerialName("limit") val limit: Int = 50,
  @SerialName("unreadOnly") val unreadOnly: String? = null,
)
