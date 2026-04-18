package com.xyzw.helper.data.network

import com.xyzw.helper.data.model.ActivationCodeItem
import com.xyzw.helper.data.model.AdminConfirmToken
import com.xyzw.helper.data.model.AdminMfaResetLinkPayload
import com.xyzw.helper.data.model.AdminPasswordResetCodePayload
import com.xyzw.helper.data.model.AdminTaskControlLogItem
import com.xyzw.helper.data.model.AdminUserItem
import com.xyzw.helper.data.model.AdminUserTokenActivationsPayload
import com.xyzw.helper.data.model.AuthLoginPayload
import com.xyzw.helper.data.model.AuthUser
import com.xyzw.helper.data.model.BuildInfo
import com.xyzw.helper.data.model.CsrfPayload
import com.xyzw.helper.data.model.DailyTaskItem
import com.xyzw.helper.data.model.FeedbackItem
import com.xyzw.helper.data.model.GameRole
import com.xyzw.helper.data.model.InviteCodeItem
import com.xyzw.helper.data.model.NotificationItem
import com.xyzw.helper.data.model.ReferralAttributionItem
import com.xyzw.helper.data.model.ReferralConversionItem
import com.xyzw.helper.data.model.RefreshPayload
import com.xyzw.helper.data.model.RegisterResultPayload
import com.xyzw.helper.data.model.TaskControlStatePayload
import com.xyzw.helper.data.model.WechatContactAdminItem
import kotlinx.serialization.Serializable
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.Headers
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Path
import retrofit2.http.Query

interface AuthApi {
  @GET("auth/csrf")
  @Headers(SKIP_REFRESH_HEADER_LINE)
  suspend fun ensureCsrf(): Response<ApiEnvelope<CsrfPayload>>

  @POST("auth/login")
  @Headers(SKIP_REFRESH_HEADER_LINE)
  suspend fun login(
    @Body request: LoginRequest,
  ): Response<ApiEnvelope<AuthLoginPayload>>

  @POST("auth/mfa/verify")
  @Headers(SKIP_REFRESH_HEADER_LINE)
  suspend fun verifyMfa(
    @Body request: VerifyMfaRequest,
  ): Response<ApiEnvelope<AuthLoginPayload>>

  @POST("auth/register")
  @Headers(SKIP_REFRESH_HEADER_LINE)
  suspend fun register(
    @Body request: RegisterRequest,
  ): Response<ApiEnvelope<RegisterResultPayload>>

  @POST("auth/password-reset")
  @Headers(SKIP_REFRESH_HEADER_LINE)
  suspend fun resetPassword(
    @Body request: ResetPasswordRequest,
  ): Response<ApiEnvelope<Unit>>

  @POST("auth/logout")
  @Headers(SKIP_REFRESH_HEADER_LINE)
  suspend fun logout(
    @Body request: EmptyRequest = EmptyRequest(),
  ): Response<ApiEnvelope<Unit>>

  @POST("auth/refresh")
  @Headers(SKIP_REFRESH_HEADER_LINE)
  suspend fun refresh(
    @Body request: EmptyRequest = EmptyRequest(),
  ): Response<ApiEnvelope<RefreshPayload>>

  @GET("auth/me")
  suspend fun getMe(): Response<ApiEnvelope<AuthUser>>
}

interface UserApi {
  @GET("user/profile")
  suspend fun getProfile(): Response<ApiEnvelope<AuthUser>>
}

interface SystemApi {
  @GET("version")
  suspend fun getVersion(): Response<ApiEnvelope<BuildInfo>>
}

interface GameRoleApi {
  @GET("gamerole_list")
  suspend fun listRoles(): Response<ApiEnvelope<List<GameRole>>>
}

interface DailyTaskApi {
  @GET("daily-tasks")
  suspend fun listTasks(
    @Query("roleId") roleId: String? = null,
  ): Response<ApiEnvelope<List<DailyTaskItem>>>
}

interface TaskControlApi {
  @GET("task-control/state")
  suspend fun getState(): Response<ApiEnvelope<TaskControlStatePayload>>

  @GET("task-control/logs")
  suspend fun getLogs(
    @Query("limit") limit: Int = 100,
  ): Response<ApiEnvelope<List<TaskControlStatePayload>>>
}

interface NotificationApi {
  @GET("notifications")
  suspend fun listNotifications(
    @Query("limit") limit: Int = 50,
    @Query("unreadOnly") unreadOnly: String? = null,
  ): Response<ApiEnvelope<List<NotificationItem>>>

  @PATCH("notifications/{id}/read")
  suspend fun markRead(
    @Path("id") id: String,
    @Body request: EmptyRequest = EmptyRequest(),
  ): Response<ApiEnvelope<Unit>>

  @PATCH("notifications/read-all")
  suspend fun markAllRead(
    @Body request: EmptyRequest = EmptyRequest(),
  ): Response<ApiEnvelope<Unit>>

  @DELETE("notifications")
  suspend fun clearAll(): Response<ApiEnvelope<Unit>>
}

interface FeedbackApi {
  @GET("feedbacks")
  suspend fun listFeedbacks(
    @Query("status") status: String? = null,
  ): Response<ApiEnvelope<List<FeedbackItem>>>

  @PATCH("feedbacks/{id}")
  suspend fun updateByAdmin(
    @Path("id") id: String,
    @Body request: AdminFeedbackUpdateRequest,
  ): Response<ApiEnvelope<FeedbackItem>>
}

interface AdminApi {
  @POST("admin/confirm-password")
  suspend fun confirmSensitiveAction(
    @Body request: SensitiveConfirmPayload,
  ): Response<ApiEnvelope<AdminConfirmToken>>

  @GET("admin/users")
  suspend fun listUsers(): Response<ApiEnvelope<List<AdminUserItem>>>

  @GET("admin/users/{id}/token-activations")
  suspend fun listUserTokenActivations(
    @Path("id") id: String,
  ): Response<ApiEnvelope<AdminUserTokenActivationsPayload>>

  @PATCH("admin/users/{id}/admin")
  suspend fun updateUserAdmin(
    @Path("id") id: String,
    @Header("X-Admin-Confirm-Token") confirmToken: String,
    @Body request: AdminUpdateUserAdminRequest,
  ): Response<ApiEnvelope<Unit>>

  @PATCH("admin/users/{id}/access-scope")
  suspend fun updateUserAccessScope(
    @Path("id") id: String,
    @Header("X-Admin-Confirm-Token") confirmToken: String,
    @Body request: AdminUpdateAccessScopeRequest,
  ): Response<ApiEnvelope<Unit>>

  @PATCH("admin/users/{id}/token-bind-limit")
  suspend fun updateUserTokenBindLimit(
    @Path("id") id: String,
    @Header("X-Admin-Confirm-Token") confirmToken: String,
    @Body request: AdminUpdateTokenBindLimitRequest,
  ): Response<ApiEnvelope<Unit>>

  @PATCH("admin/users/{id}/password")
  suspend fun resetUserPassword(
    @Path("id") id: String,
    @Header("X-Admin-Confirm-Token") confirmToken: String,
    @Body request: AdminResetPasswordRequest,
  ): Response<ApiEnvelope<Unit>>

  @POST("admin/users/{id}/password-reset-code")
  suspend fun createPasswordResetCode(
    @Path("id") id: String,
    @Header("X-Admin-Confirm-Token") confirmToken: String,
    @Body request: AdminCreatePasswordResetCodeRequest,
  ): Response<ApiEnvelope<AdminPasswordResetCodePayload>>

  @POST("admin/users/{id}/mfa-reset-link")
  suspend fun createMfaResetLink(
    @Path("id") id: String,
    @Header("X-Admin-Confirm-Token") confirmToken: String,
    @Body request: EmptyRequest = EmptyRequest(),
  ): Response<ApiEnvelope<AdminMfaResetLinkPayload>>

  @POST("admin/users/{id}/revoke-sessions")
  suspend fun revokeSessions(
    @Path("id") id: String,
    @Header("X-Admin-Confirm-Token") confirmToken: String,
    @Body request: EmptyRequest = EmptyRequest(),
  ): Response<ApiEnvelope<Unit>>

  @DELETE("admin/users/{id}")
  suspend fun deleteUser(
    @Path("id") id: String,
    @Header("X-Admin-Confirm-Token") confirmToken: String,
  ): Response<ApiEnvelope<Unit>>

  @GET("admin/invite-codes")
  suspend fun listInviteCodes(): Response<ApiEnvelope<List<InviteCodeItem>>>

  @POST("admin/invite-codes")
  suspend fun createInviteCodes(
    @Header("X-Admin-Confirm-Token") confirmToken: String,
    @Body request: AdminCreateInviteCodesRequest,
  ): Response<ApiEnvelope<List<InviteCodeItem>>>

  @PATCH("admin/invite-codes/{id}/disable")
  suspend fun disableInviteCode(
    @Path("id") id: String,
    @Header("X-Admin-Confirm-Token") confirmToken: String,
    @Body request: EmptyRequest = EmptyRequest(),
  ): Response<ApiEnvelope<Unit>>

  @GET("admin/activation-codes")
  suspend fun listActivationCodes(): Response<ApiEnvelope<List<ActivationCodeItem>>>

  @POST("admin/activation-codes")
  suspend fun createActivationCodes(
    @Header("X-Admin-Confirm-Token") confirmToken: String,
    @Body request: AdminCreateActivationCodesRequest,
  ): Response<ApiEnvelope<List<ActivationCodeItem>>>

  @POST("admin/activation-codes/{id}/unbind")
  suspend fun unbindActivationCode(
    @Path("id") id: String,
    @Header("X-Admin-Confirm-Token") confirmToken: String,
    @Body request: EmptyRequest = EmptyRequest(),
  ): Response<ApiEnvelope<Unit>>

  @POST("admin/activation-codes/unbind-all")
  suspend fun unbindAllActivationCodes(
    @Header("X-Admin-Confirm-Token") confirmToken: String,
    @Body request: EmptyRequest = EmptyRequest(),
  ): Response<ApiEnvelope<Unit>>

  @PATCH("admin/activation-codes/{id}/disable")
  suspend fun disableActivationCode(
    @Path("id") id: String,
    @Header("X-Admin-Confirm-Token") confirmToken: String,
    @Body request: EmptyRequest = EmptyRequest(),
  ): Response<ApiEnvelope<Unit>>

  @DELETE("admin/activation-codes/{id}")
  suspend fun deleteActivationCode(
    @Path("id") id: String,
    @Header("X-Admin-Confirm-Token") confirmToken: String,
  ): Response<ApiEnvelope<Unit>>

  @GET("admin/task-control/logs")
  suspend fun listTaskControlLogs(
    @Query("limit") limit: Int = 500,
    @Query("username") username: String? = null,
    @Query("taskName") taskName: String? = null,
    @Query("status") status: String? = null,
    @Query("taskId") taskId: String? = null,
    @Query("message") message: String? = null,
  ): Response<ApiEnvelope<List<AdminTaskControlLogItem>>>

  @POST("admin/changelog/notify-all")
  suspend fun sendChangelogBroadcast(
    @Body request: AdminChangelogBroadcastRequest,
  ): Response<ApiEnvelope<AdminChangelogBroadcastResult>>

  @GET("admin/wechat-contacts")
  suspend fun listWechatContacts(): Response<ApiEnvelope<List<WechatContactAdminItem>>>

  @POST("admin/wechat-contacts")
  suspend fun createWechatContact(
    @Header("X-Admin-Confirm-Token") confirmToken: String,
    @Body request: AdminWechatContactRequest,
  ): Response<ApiEnvelope<WechatContactAdminItem>>

  @PUT("admin/wechat-contacts/{id}")
  suspend fun updateWechatContact(
    @Path("id") id: String,
    @Header("X-Admin-Confirm-Token") confirmToken: String,
    @Body request: AdminWechatContactRequest,
  ): Response<ApiEnvelope<WechatContactAdminItem>>

  @DELETE("admin/wechat-contacts/{id}")
  suspend fun deleteWechatContact(
    @Path("id") id: String,
    @Header("X-Admin-Confirm-Token") confirmToken: String,
  ): Response<ApiEnvelope<WechatContactDeletePayload>>

  @GET("admin/referrals/attributions")
  suspend fun listReferralAttributions(
    @Query("limit") limit: Int = 200,
  ): Response<ApiEnvelope<List<ReferralAttributionItem>>>

  @GET("admin/referrals/conversions")
  suspend fun listReferralConversions(
    @Query("limit") limit: Int = 200,
  ): Response<ApiEnvelope<List<ReferralConversionItem>>>

  @POST("admin/referrals/conversions/{id}/mark-paid")
  suspend fun markReferralConversionPaid(
    @Path("id") id: String,
    @Header("X-Admin-Confirm-Token") confirmToken: String,
    @Body request: AdminMarkReferralPaidRequest,
  ): Response<ApiEnvelope<ReferralConversionItem>>

  @POST("admin/referrals/conversions/{id}/reject")
  suspend fun rejectReferralConversion(
    @Path("id") id: String,
    @Header("X-Admin-Confirm-Token") confirmToken: String,
    @Body request: AdminRejectReferralRequest,
  ): Response<ApiEnvelope<ReferralConversionItem>>
}

@Serializable
data class AdminChangelogBroadcastResult(
  val sentCount: Int = 0,
)

@Serializable
data class WechatContactDeletePayload(
  val id: String,
)
