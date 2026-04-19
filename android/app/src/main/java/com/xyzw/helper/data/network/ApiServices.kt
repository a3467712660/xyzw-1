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
import com.xyzw.helper.data.model.DailyTaskEntry
import com.xyzw.helper.data.model.DailyTaskHistoryItem
import com.xyzw.helper.data.model.DailyTaskStatusSummary
import com.xyzw.helper.data.model.FeedbackItem
import com.xyzw.helper.data.model.GameRole
import com.xyzw.helper.data.model.InviteCodeItem
import com.xyzw.helper.data.model.NotificationItem
import com.xyzw.helper.data.model.ReferralAttributionItem
import com.xyzw.helper.data.model.ReferralConversionItem
import com.xyzw.helper.data.model.ReferralOverview
import com.xyzw.helper.data.model.ReferralProfile
import com.xyzw.helper.data.model.RefreshPayload
import com.xyzw.helper.data.model.RegisterResultPayload
import com.xyzw.helper.data.model.TaskControlLogItem
import com.xyzw.helper.data.model.TaskControlStateSnapshot
import com.xyzw.helper.data.model.UserPreferenceItem
import com.xyzw.helper.data.model.UserSecurityEventItem
import com.xyzw.helper.data.model.UserSensitiveConfirmResult
import com.xyzw.helper.data.model.UserTokenActivationBinding
import com.xyzw.helper.data.model.WechatContactAdminItem
import com.xyzw.helper.data.model.BinDownloadTicket
import com.xyzw.helper.data.model.BinFileItem
import com.xyzw.helper.data.model.BinFileUploadResult
import com.xyzw.helper.data.model.BattleReportCatalog
import com.xyzw.helper.data.model.BattleReportListPayload
import com.xyzw.helper.data.model.BattleReportParsePayload
import com.xyzw.helper.data.model.GameFeatureActionResult
import com.xyzw.helper.data.model.GameFeatureCatalog
import com.xyzw.helper.data.model.GameFeatureSummary
import com.xyzw.helper.data.model.GameLineup
import com.xyzw.helper.data.model.GameLineupApplyResult
import com.xyzw.helper.data.model.GameLineupsPayload
import com.xyzw.helper.data.model.GameWorkbenchActionResult
import com.xyzw.helper.data.model.GameWorkbenchBootstrap
import com.xyzw.helper.data.model.GameWorkbenchCatalog
import com.xyzw.helper.data.model.GameWorkbenchSectionSnapshot
import com.xyzw.helper.data.model.LegionWarSnapshot
import com.xyzw.helper.data.model.RenderedReplayResult
import com.xyzw.helper.data.model.TokenActivationStatus
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import okhttp3.RequestBody
import okhttp3.ResponseBody
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
import retrofit2.http.Streaming
import retrofit2.http.Url

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

  @PUT("user/profile")
  suspend fun updateProfile(
    @Body request: ProfileUpdateRequest,
  ): Response<ApiEnvelope<AuthUser>>

  @PUT("user/password")
  suspend fun changePassword(
    @Body request: UpdatePasswordRequest,
  ): Response<ApiEnvelope<Unit>>

  @POST("user/confirm-password")
  suspend fun confirmSensitiveAction(
    @Body request: UserSensitiveConfirmRequest,
  ): Response<ApiEnvelope<UserSensitiveConfirmResult>>

  @GET("user/preferences/{key}")
  suspend fun getPreference(
    @Path("key") key: String,
  ): Response<ApiEnvelope<UserPreferenceItem>>

  @PUT("user/preferences/{key}")
  suspend fun setPreference(
    @Path("key") key: String,
    @Header(USER_CONFIRM_HEADER) confirmToken: String? = null,
    @Body request: PreferenceValueRequest,
  ): Response<ApiEnvelope<UserPreferenceItem>>

  @GET("user/security-events")
  suspend fun getSecurityEvents(
    @Query("limit") limit: Int = 50,
    @Query("eventType") eventType: String? = null,
  ): Response<ApiEnvelope<List<UserSecurityEventItem>>>

  @GET("user/referral-profile")
  suspend fun getReferralProfile(): Response<ApiEnvelope<ReferralProfile?>>

  @POST("user/referral-profile/generate")
  suspend fun generateReferralProfile(
    @Body request: EmptyRequest = EmptyRequest(),
  ): Response<ApiEnvelope<ReferralProfile>>

  @GET("user/referral-overview")
  suspend fun getReferralOverview(): Response<ApiEnvelope<ReferralOverview>>

  @GET("user/referral-conversions")
  suspend fun getReferralConversions(
    @Query("limit") limit: Int = 200,
  ): Response<ApiEnvelope<List<ReferralConversionItem>>>
}

interface SystemApi {
  @GET("version")
  suspend fun getVersion(): Response<ApiEnvelope<BuildInfo>>
}

interface GameRoleApi {
  @GET("gamerole_list")
  suspend fun listRoles(): Response<ApiEnvelope<List<GameRole>>>

  @POST("gameroles")
  suspend fun createRole(
    @Body request: GameRoleUpsertRequest,
  ): Response<ApiEnvelope<GameRole>>

  @GET("gameroles/{roleId}")
  suspend fun getRoleDetail(
    @Path("roleId") roleId: String,
  ): Response<ApiEnvelope<GameRole>>

  @PUT("gameroles/{roleId}")
  suspend fun updateRole(
    @Path("roleId") roleId: String,
    @Body request: GameRoleUpsertRequest,
  ): Response<ApiEnvelope<GameRole>>

  @DELETE("gameroles/{roleId}")
  suspend fun deleteRole(
    @Path("roleId") roleId: String,
  ): Response<ApiEnvelope<Unit>>
}

interface DailyTaskApi {
  @GET("daily-tasks")
  suspend fun listTasks(
    @Query("roleId") roleId: String? = null,
  ): Response<ApiEnvelope<List<DailyTaskEntry>>>

  @GET("daily-tasks/status")
  suspend fun getStatus(
    @Query("roleId") roleId: String,
  ): Response<ApiEnvelope<DailyTaskStatusSummary>>

  @POST("daily-tasks/{taskId}/complete")
  suspend fun completeTask(
    @Path("taskId") taskId: String,
    @Body request: Map<String, String>,
  ): Response<ApiEnvelope<Unit>>

  @PUT("daily-tasks/{taskId}")
  suspend fun updateTask(
    @Path("taskId") taskId: String,
    @Body request: DailyTaskUpdateRequest,
  ): Response<ApiEnvelope<Unit>>

  @GET("daily-tasks/history")
  suspend fun getHistory(
    @Query("roleId") roleId: String,
    @Query("page") page: Int = 1,
    @Query("limit") limit: Int = 20,
  ): Response<ApiEnvelope<List<DailyTaskHistoryItem>>>
}

interface TaskControlApi {
  @GET("task-control/state")
  suspend fun getState(): Response<ApiEnvelope<JsonObject>>

  @PUT("task-control/state")
  suspend fun saveState(
    @Body request: JsonObject,
  ): Response<ApiEnvelope<JsonObject>>

  @GET("task-control/logs")
  suspend fun getLogs(
    @Query("limit") limit: Int = 100,
  ): Response<ApiEnvelope<List<TaskControlLogItem>>>

  @DELETE("task-control/logs")
  suspend fun clearLogs(): Response<ApiEnvelope<Unit>>
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

  @POST("feedbacks")
  suspend fun createFeedback(
    @Body request: FeedbackCreateRequest,
  ): Response<ApiEnvelope<Unit>>

  @PATCH("feedbacks/{id}")
  suspend fun updateByAdmin(
    @Path("id") id: String,
    @Body request: AdminFeedbackUpdateRequest,
  ): Response<ApiEnvelope<FeedbackItem>>
}

interface TokenManagementApi {
  @POST("token-import/proxy")
  suspend fun proxyFetch(
    @Body request: TokenImportProxyRequest,
  ): Response<JsonElement>

  @GET("bin-files")
  suspend fun listBinFiles(): Response<ApiEnvelope<List<BinFileItem>>>

  @PUT("bin-files/{tokenId}")
  suspend fun uploadBinFile(
    @Path("tokenId") tokenId: String,
    @Body requestBody: RequestBody,
  ): Response<ApiEnvelope<BinFileUploadResult>>

  @POST("bin-files/{tokenId}/download-ticket")
  suspend fun createDownloadTicket(
    @Path("tokenId") tokenId: String,
    @Header(USER_CONFIRM_HEADER) confirmToken: String? = null,
    @Body request: EmptyRequest = EmptyRequest(),
  ): Response<ApiEnvelope<BinDownloadTicket>>

  @POST("bin-files/{tokenId}/download")
  suspend fun downloadBinFile(
    @Path("tokenId") tokenId: String,
    @Body request: Map<String, String>,
  ): Response<ResponseBody>

  @DELETE("bin-files/{tokenId}")
  suspend fun deleteBinFile(
    @Path("tokenId") tokenId: String,
  ): Response<ApiEnvelope<Unit>>

  @POST("token-activations/status")
  suspend fun getActivationStatus(
    @Body request: Map<String, String>,
  ): Response<ApiEnvelope<TokenActivationStatus>>

  @GET("token-activations/my")
  suspend fun listActivationBindings(): Response<ApiEnvelope<List<UserTokenActivationBinding>>>
}

interface GameFeatureApi {
  @GET("game-features/catalog")
  suspend fun getCatalog(): Response<ApiEnvelope<GameFeatureCatalog>>

  @GET("game-features/workbench/catalog")
  suspend fun getWorkbenchCatalog(): Response<ApiEnvelope<GameWorkbenchCatalog>>

  @POST("game-features/{tokenId}/summary")
  suspend fun getSummary(
    @Path("tokenId") tokenId: String,
    @Body request: EmptyRequest = EmptyRequest(),
  ): Response<ApiEnvelope<GameFeatureSummary>>

  @POST("game-features/{tokenId}/action")
  suspend fun runAction(
    @Path("tokenId") tokenId: String,
    @Body request: GameFeatureActionRequest,
  ): Response<ApiEnvelope<GameFeatureActionResult>>

  @POST("game-features/{tokenId}/workbench/bootstrap")
  suspend fun getWorkbenchBootstrap(
    @Path("tokenId") tokenId: String,
    @Body request: EmptyRequest = EmptyRequest(),
  ): Response<ApiEnvelope<GameWorkbenchBootstrap>>

  @POST("game-features/{tokenId}/workbench/section")
  suspend fun getWorkbenchSection(
    @Path("tokenId") tokenId: String,
    @Body request: GameWorkbenchSectionRequest,
  ): Response<ApiEnvelope<GameWorkbenchSectionSnapshot>>

  @POST("game-features/{tokenId}/workbench/action")
  suspend fun runWorkbenchAction(
    @Path("tokenId") tokenId: String,
    @Body request: GameWorkbenchActionRequest,
  ): Response<ApiEnvelope<GameWorkbenchActionResult>>

  @POST("game-features/{tokenId}/workbench/replay-render")
  suspend fun renderWorkbenchReplay(
    @Path("tokenId") tokenId: String,
    @Body request: GameWorkbenchReplayRenderRequest,
  ): Response<ApiEnvelope<RenderedReplayResult>>

  @GET
  @Streaming
  suspend fun downloadRenderedReplayImage(
    @Url imageUrl: String,
  ): Response<ResponseBody>

  @POST("game-features/{tokenId}/legion-war/snapshot")
  suspend fun getLegionWarSnapshot(
    @Path("tokenId") tokenId: String,
    @Body request: EmptyRequest = EmptyRequest(),
  ): Response<ApiEnvelope<LegionWarSnapshot>>

  @GET("game-features/{tokenId}/lineups")
  suspend fun getLineups(
    @Path("tokenId") tokenId: String,
  ): Response<ApiEnvelope<GameLineupsPayload>>

  @PUT("game-features/{tokenId}/lineups")
  suspend fun saveLineups(
    @Path("tokenId") tokenId: String,
    @Body request: GameLineupsSaveRequest,
  ): Response<ApiEnvelope<GameLineupsPayload>>

  @POST("game-features/{tokenId}/lineups/apply")
  suspend fun applyLineup(
    @Path("tokenId") tokenId: String,
    @Body request: GameLineupApplyRequest,
  ): Response<ApiEnvelope<GameLineupApplyResult>>
}

interface BattleReportApi {
  @GET("battle-reports/catalog")
  suspend fun getCatalog(): Response<ApiEnvelope<BattleReportCatalog>>

  @POST("battle-reports/{tokenId}/query")
  suspend fun queryReports(
    @Path("tokenId") tokenId: String,
    @Body request: BattleReportQueryRequest,
  ): Response<ApiEnvelope<BattleReportListPayload>>

  @POST("battle-reports/parse")
  suspend fun parseReport(
    @Body request: BattleReportParseRequest,
  ): Response<ApiEnvelope<BattleReportParsePayload>>
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

  @POST("admin/invite-codes/{id}/reveal")
  suspend fun revealInviteCode(
    @Path("id") id: String,
    @Header("X-Admin-Confirm-Token") confirmToken: String,
    @Body request: EmptyRequest = EmptyRequest(),
  ): Response<ApiEnvelope<JsonObject>>

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

  @POST("admin/activation-codes/{id}/reveal")
  suspend fun revealActivationCode(
    @Path("id") id: String,
    @Header("X-Admin-Confirm-Token") confirmToken: String,
    @Body request: EmptyRequest = EmptyRequest(),
  ): Response<ApiEnvelope<JsonObject>>

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
