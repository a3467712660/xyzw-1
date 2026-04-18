package com.xyzw.helper.data.model

import kotlinx.serialization.Serializable

@Serializable
data class AuthUser(
  val id: String,
  val username: String,
  val email: String? = null,
  val nickname: String? = null,
  val phone: String? = null,
  val isAdmin: Boolean? = null,
  val accessScope: String? = null,
  val mfaEnabled: Boolean? = null,
  val tokenVersion: Int? = null,
  val lastLoginAt: String? = null,
)

@Serializable
data class AuthLoginPayload(
  val token: String? = null,
  val user: AuthUser? = null,
  val mfaRequired: Boolean = false,
  val mfaChallengeToken: String? = null,
  val status: String? = null,
)

@Serializable
data class CsrfPayload(
  val headerName: String = "x-csrf-token",
  val token: String? = null,
  val hasRefreshTokenCookie: Boolean = false,
)

@Serializable
data class RegisterResultPayload(
  val isTemporaryInvite: Boolean = false,
  val trialExpiresAt: String? = null,
  val referralAttributed: Boolean = false,
)

@Serializable
data class RefreshPayload(
  val token: String? = null,
)

@Serializable
data class BuildInfo(
  val appVersion: String = "",
  val backendVersion: String = "",
  val gitSha: String = "",
  val buildId: String = "",
  val buildTime: String = "",
)

@Serializable
data class GameRole(
  val id: String,
  val name: String,
  val server: String,
  val profession: String,
  val level: Int = 1,
  val account: String = "",
  val note: String = "",
  val avatar: String = "",
  val isActive: Boolean = true,
  val exp: Int = 0,
  val gold: Long = 0L,
  val vip: Boolean = false,
  val createdAt: String? = null,
  val updatedAt: String? = null,
)

@Serializable
data class NotificationItem(
  val id: String,
  val type: String,
  val title: String,
  val content: String,
  val isRead: Boolean = false,
  val readAt: String? = null,
  val createdAt: String,
)

@Serializable
data class FeedbackItem(
  val id: String,
  val type: String,
  val title: String,
  val content: String,
  val status: String = "open",
  val username: String? = null,
  val adminNote: String? = null,
  val createdAt: String,
  val updatedAt: String? = null,
)

@Serializable
data class DailyTaskItem(
  val id: String,
  val name: String,
  val completed: Boolean = false,
)

@Serializable
data class TaskControlTask(
  val taskId: String = "",
  val taskName: String = "",
  val status: String = "info",
  val message: String = "",
)

@Serializable
data class TaskControlStatePayload(
  val tasks: List<TaskControlTask> = emptyList(),
  val updatedAt: String? = null,
)

data class AdminConfirmCredential(
  val password: String? = null,
  val totpCode: String? = null,
  val recoveryCode: String? = null,
)

@Serializable
data class AdminConfirmToken(
  val token: String,
  val expiresAt: String,
)

data class AdminActionError(
  val message: String,
  val code: String? = null,
  val httpStatus: Int = 0,
)

@Serializable
data class AdminUserItem(
  val id: String,
  val username: String,
  val email: String? = null,
  val isAdmin: Boolean = false,
  val mfaEnabled: Boolean = false,
  val accessScope: String = "full",
  val tokenBindLimit: Int = 999,
  val roleCount: Int = 0,
  val inviteCount: Int = 0,
  val refreshSecondVerifyEnabled: Boolean = true,
  val createdAt: String? = null,
  val lastLoginAt: String? = null,
  val updatedAt: String? = null,
  val isCurrentUser: Boolean = false,
)

@Serializable
data class AdminUserTokenActivationItem(
  val id: String,
  val userId: String? = null,
  val tokenId: String? = null,
  val roleId: String? = null,
  val roleName: String? = null,
  val roleIndex: String? = null,
  val region: String? = null,
  val accountIdentity: String? = null,
  val bindingUsername: String? = null,
  val boundAt: String? = null,
  val expiresAt: String? = null,
  val isActive: Boolean? = null,
  val active: Boolean = false,
)

@Serializable
data class AdminUserTokenActivationsPayload(
  val userId: String,
  val username: String,
  val total: Int = 0,
  val activeCount: Int = 0,
  val expiredCount: Int = 0,
  val items: List<AdminUserTokenActivationItem> = emptyList(),
)

@Serializable
data class AdminPasswordResetCodePayload(
  val userId: String,
  val username: String,
  val email: String? = null,
  val shortCode: String,
  val expiresAt: String,
  val expiresInMinutes: Int = 15,
)

@Serializable
data class AdminMfaResetLinkPayload(
  val userId: String,
  val username: String,
  val resetUrl: String,
  val resetPath: String,
  val expiresAt: String,
  val expiresInMinutes: Int = 5,
)

@Serializable
data class InviteCodeItem(
  val id: String,
  val code: String? = null,
  val maskedCode: String? = null,
  val codeMask: String? = null,
  val codeSuffix: String? = null,
  val createdAt: String,
  val expiresAt: String? = null,
  val autoDisableAt: String? = null,
  val isTemporary: Boolean = false,
  val featureScope: String = "full",
  val bindAccountLimit: Int = 1,
  val isActive: Boolean = true,
  val usedAt: String? = null,
  val createdBy: String? = null,
  val usedBy: String? = null,
)

@Serializable
data class ActivationCodeItem(
  val id: String,
  val code: String? = null,
  val maskedCode: String? = null,
  val codeMask: String? = null,
  val codeSuffix: String? = null,
  val createdAt: String,
  val featureScope: String = "full",
  val durationMonths: Int = 1,
  val saleAmountCents: Int = 0,
  val saleCurrency: String = "CNY",
  val isActive: Boolean = true,
  val isDeleted: Boolean = false,
  val usedAt: String? = null,
  val boundTokenId: String? = null,
  val boundGameAccountId: String? = null,
  val createdBy: String? = null,
  val usedBy: String? = null,
  val bindingId: String? = null,
  val bindingTokenId: String? = null,
  val bindingSessId: String? = null,
  val bindingRoleId: String? = null,
  val bindingRoleName: String? = null,
  val bindingRegion: String? = null,
  val bindingRoleIndex: String? = null,
  val bindingUserId: String? = null,
  val bindingUsername: String? = null,
  val bindingExpiresAt: String? = null,
  val bindingActive: Boolean = false,
)

@Serializable
data class AdminTaskControlLogItem(
  val id: String,
  val userId: String? = null,
  val username: String? = null,
  val taskId: String? = null,
  val taskName: String? = null,
  val status: String = "info",
  val message: String = "",
  val createdAt: String,
)

data class AdminTaskControlLogsQuery(
  val username: String = "",
  val taskName: String = "",
  val status: String = "",
  val taskId: String = "",
  val message: String = "",
  val limit: Int = 500,
)

@Serializable
data class WechatContactAdminItem(
  val id: String,
  val slug: String,
  val title: String,
  val subtitle: String? = null,
  val contactType: String,
  val targetUrl: String? = null,
  val wechatId: String? = null,
  val qrImageDataUrl: String? = null,
  val showInPricing: Boolean = true,
  val isActive: Boolean = true,
  val sortOrder: Int = 100,
  val createdBy: String? = null,
  val updatedBy: String? = null,
  val createdAt: String? = null,
  val updatedAt: String? = null,
)

@Serializable
data class ReferralAttributionItem(
  val id: String,
  val referrerUserId: String,
  val referrerUsername: String,
  val referredUserId: String,
  val referredUsername: String,
  val referralProfileId: String,
  val referralCodeSnapshot: String,
  val inviteCodeId: String? = null,
  val inviteCodeMask: String? = null,
  val registeredAt: String,
  val registerIp: String? = null,
  val registerUserAgent: String? = null,
  val createdAt: String,
  val updatedAt: String,
)

@Serializable
data class ReferralConversionItem(
  val id: String,
  val referrerUserId: String,
  val referrerUsername: String,
  val referredUserId: String,
  val referredUsername: String,
  val referralAttributionId: String,
  val activationCodeId: String,
  val activationCodeMask: String? = null,
  val tokenActivationId: String? = null,
  val conversionType: String,
  val featureScope: String,
  val durationMonths: Int = 1,
  val grossAmountCents: Int = 0,
  val rewardRateBps: Int = 0,
  val rewardAmountCents: Int = 0,
  val rewardStatus: String,
  val note: String? = null,
  val createdAt: String,
  val updatedAt: String,
  val paidAt: String? = null,
  val paidBy: String? = null,
  val paidByUsername: String? = null,
  val settlementChannel: String? = null,
  val settlementRef: String? = null,
  val settledAt: String? = null,
  val settledBy: String? = null,
  val settledByUsername: String? = null,
)
