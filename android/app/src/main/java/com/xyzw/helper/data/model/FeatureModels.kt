package com.xyzw.helper.data.model

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject

@Serializable
enum class TokenImportSource {
  MANUAL,
  URL,
}

@Serializable
data class ImportedGameToken(
  val id: String,
  val rawToken: String,
  val displayName: String,
  val roleId: String = "",
  val sessId: String = "",
  val region: String = "",
  val roleName: String = "",
  val roleIndex: String = "",
  val source: TokenImportSource = TokenImportSource.MANUAL,
  val sourceUrl: String? = null,
  val importedAt: String,
  val updatedAt: String,
  val activationBound: Boolean = false,
  val activationActive: Boolean = false,
  val activationExpiresAt: String? = null,
  val activationBoundAt: String? = null,
  val binFilePresent: Boolean = false,
  val lastSyncAt: String? = null,
  val lastError: String? = null,
)

@Serializable
data class TokenActivationStatus(
  val tokenId: String? = null,
  val roleId: String = "",
  val roleName: String = "",
  val region: String = "",
  val roleIndex: String = "",
  val accountIdentity: String = "",
  val roleCompositeLabel: String? = null,
  val sessId: String = "",
  val gameAccountId: String = "",
  val active: Boolean = false,
  val bound: Boolean = false,
  val expiresAt: String? = null,
  val boundAt: String? = null,
)

@Serializable
data class UserTokenActivationBinding(
  val id: String,
  val tokenId: String,
  val roleId: String? = null,
  val roleName: String? = null,
  val region: String? = null,
  val roleIndex: String? = null,
  val accountIdentity: String? = null,
  val expiresAt: String? = null,
  val boundAt: String? = null,
  val active: Boolean = false,
)

@Serializable
data class BinFileItem(
  val tokenId: String,
  val fileName: String,
  val size: Long,
  val createdAt: String,
  val updatedAt: String,
)

@Serializable
data class BinFileUploadResult(
  val tokenId: String,
  val size: Long,
  val checksum: String,
)

@Serializable
data class BinDownloadTicket(
  val ticket: String,
  val expiresAt: String,
  val tokenId: String,
)

@Serializable
data class DailyTaskProgress(
  val current: Int = 0,
  val total: Int = 0,
)

@Serializable
data class DailyTaskSettings(
  val autoExecute: Boolean = false,
  val delay: Int = 0,
  val notification: Boolean = true,
  val enabled: Boolean = false,
  val cronExpr: String = "",
)

@Serializable
data class DailyTaskLogEntry(
  val id: String,
  val timestamp: Long,
  val type: String = "info",
  val message: String,
)

@Serializable
data class DailyTaskEntry(
  val id: String,
  val title: String,
  val subtitle: String = "",
  val icon: String? = null,
  val completed: Boolean = false,
  val canExecute: Boolean = false,
  val progress: DailyTaskProgress = DailyTaskProgress(),
  val reward: String? = null,
  val nextReset: String? = null,
  val settings: DailyTaskSettings = DailyTaskSettings(),
  val details: List<JsonElement> = emptyList(),
  val logs: List<DailyTaskLogEntry> = emptyList(),
)

@Serializable
data class DailyTaskStatusSummary(
  val total: Int = 0,
  val completed: Int = 0,
  val percentage: Int = 0,
)

@Serializable
data class DailyTaskHistoryItem(
  val id: String,
  val status: String = "",
  val message: String = "",
  val runAt: String = "",
  val source: String = "",
  val title: String = "",
  val taskKey: String = "",
)

@Serializable
data class TaskControlTaskRow(
  val id: String,
  val enabled: Boolean = false,
  val cronExpr: String = "",
  val tokenIds: List<String> = emptyList(),
  val tokenNameMap: Map<String, String> = emptyMap(),
  val tokenRoleIdMap: Map<String, String> = emptyMap(),
  val lastRunAt: String = "",
  val quietDeferredAt: String = "",
  val quietDeferredReason: String = "",
  val wsUrl: String = "",
)

@Serializable
data class TaskControlStateSnapshot(
  val tasks: List<TaskControlTaskRow> = emptyList(),
  val updatedAt: String? = null,
  val rawTasks: List<JsonObject> = emptyList(),
)

@Serializable
data class TaskControlLogItem(
  val id: String,
  val taskId: String? = null,
  val taskName: String = "",
  val status: String = "info",
  val message: String = "",
  val createdAt: String,
)

@Serializable
data class UserSensitiveConfirmResult(
  val token: String,
  val expiresAt: String,
)

@Serializable
data class UserPreferenceItem(
  val key: String,
  val value: JsonElement? = null,
  val expiresAt: String? = null,
  val updatedAt: String? = null,
)

@Serializable
data class UserSecurityEventItem(
  val id: String,
  val userId: String? = null,
  val eventType: String,
  val detail: JsonObject = JsonObject(emptyMap()),
  val ip: String? = null,
  val userAgent: String? = null,
  val createdAt: String,
)

@Serializable
data class ReferralProfile(
  val id: String,
  val userId: String,
  val referralCode: String,
  val shareUrl: String,
  val createdAt: String,
  val updatedAt: String,
)

@Serializable
data class ReferralOverview(
  val profile: ReferralProfile? = null,
  val invitedUsersCount: Int = 0,
  val pendingAmountCents: Int = 0,
  val paidAmountCents: Int = 0,
)
