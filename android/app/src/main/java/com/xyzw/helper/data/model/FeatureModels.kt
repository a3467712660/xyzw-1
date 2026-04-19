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
data class GameFeatureCatalogItem(
  val id: String,
  val title: String,
  val description: String = "",
  val enabled: Boolean = true,
)

@Serializable
data class GameFeatureArea(
  val enabled: Boolean = true,
  val title: String = "",
)

@Serializable
data class GameFeatureCatalog(
  val features: List<GameFeatureCatalogItem> = emptyList(),
  val legionWar: GameFeatureArea = GameFeatureArea(title = "军团战"),
  val lineupAssistant: GameFeatureArea = GameFeatureArea(title = "阵容助手"),
)

@Serializable
data class GameFeatureSummary(
  val tokenId: String = "",
  val roleName: String = "",
  val serverName: String = "",
  val binAvailable: Boolean = false,
  val connectionStatus: String = "",
  val recommendedAction: String = "",
)

@Serializable
data class GameFeatureActionResult(
  val actionId: String,
  val status: String = "",
  val message: String = "",
  val detail: JsonElement? = null,
)

@Serializable
data class GameWorkbenchGroup(
  val id: String = "",
  val label: String = "",
  val caption: String = "",
)

@Serializable
data class GameWorkbenchSection(
  val id: String = "",
  val label: String = "",
  val description: String = "",
)

@Serializable
data class GameWorkbenchModule(
  val id: String = "",
  val label: String = "",
  val groupId: String = "",
  val description: String = "",
  val defaultSectionId: String = "",
  val sections: List<GameWorkbenchSection> = emptyList(),
)

@Serializable
data class GameWorkbenchCatalog(
  val groups: List<GameWorkbenchGroup> = emptyList(),
  val modules: List<GameWorkbenchModule> = emptyList(),
  val defaultModuleId: String = "daily",
  val defaultSectionId: String = "daily",
)

@Serializable
data class GameWorkbenchBootstrap(
  val tokenId: String,
  val roleName: String = "",
  val serverName: String = "",
  val binAvailable: Boolean = false,
  val connectionStatus: String = "",
  val selectedModuleId: String = "daily",
  val selectedSectionId: String = "daily",
  val recommendation: String = "",
  val groups: List<GameWorkbenchGroup> = emptyList(),
  val modules: List<GameWorkbenchModule> = emptyList(),
)

@Serializable
data class GameWorkbenchMetric(
  val label: String = "",
  val value: String = "",
  val tone: String = "neutral",
)

@Serializable
data class GameWorkbenchCardAction(
  val id: String = "",
  val label: String = "",
  val enabled: Boolean = true,
)

@Serializable
data class GameWorkbenchCard(
  val id: String = "",
  val type: String = "rawDetail",
  val title: String = "",
  val subtitle: String = "",
  val status: String = "",
  val tone: String = "neutral",
  val iconKey: String = "",
  val metrics: List<GameWorkbenchMetric> = emptyList(),
  val actions: List<GameWorkbenchCardAction> = emptyList(),
  val detail: JsonElement? = null,
)

@Serializable
data class GameWorkbenchSectionSnapshot(
  val tokenId: String = "",
  val moduleId: String = "",
  val sectionId: String = "",
  val title: String = "",
  val subtitle: String = "",
  val status: String = "",
  val cards: List<GameWorkbenchCard> = emptyList(),
  val updatedAt: String = "",
)

@Serializable
data class GameWorkbenchActionResult(
  val actionId: String,
  val status: String = "",
  val message: String = "",
  val sectionId: String = "",
  val cardId: String = "",
  val card: GameWorkbenchCard? = null,
  val detail: JsonElement? = null,
)

@Serializable
data class RenderedReplayResult(
  val renderId: String,
  val imageUrl: String,
  val summary: String = "",
  val diagnostics: JsonElement? = null,
  val expiresAt: String = "",
)

@Serializable
data class LegionWarNode(
  val id: String,
  val typeName: String = "",
  val hp: Long = 0,
  val maxHp: Long = 0,
  val belongsLegionId: String = "",
  val belongsLegionName: String = "",
  val point: Long = 0,
)

@Serializable
data class LegionWarLegion(
  val id: String,
  val name: String = "",
  val reviveLeft: Int = 0,
  val color: String = "",
)

@Serializable
data class LegionWarSnapshot(
  val battlefieldId: String = "",
  val nodes: List<LegionWarNode> = emptyList(),
  val legions: List<LegionWarLegion> = emptyList(),
  val rawSummary: JsonElement? = null,
)

@Serializable
data class LegionWarBroadcastResult(
  val status: String = "",
  val sentCount: Int = 0,
  val messages: List<String> = emptyList(),
)

@Serializable
data class GameLineupSlot(
  val position: Int,
  val heroId: String = "",
  val heroName: String = "",
  val artifactId: String = "",
  val pearlId: String = "",
)

@Serializable
data class GameLineup(
  val id: String,
  val name: String,
  val teamId: Int? = null,
  val slots: List<GameLineupSlot> = emptyList(),
  val updatedAt: String? = null,
)

@Serializable
data class GameLineupsPayload(
  val currentFormation: Int? = null,
  val saved: List<GameLineup> = emptyList(),
)

@Serializable
data class GameLineupApplyStage(
  val id: String,
  val status: String = "",
  val message: String = "",
)

@Serializable
data class GameLineupApplyResult(
  val lineupId: String,
  val stages: List<GameLineupApplyStage> = emptyList(),
)

@Serializable
data class BattleReportType(
  val id: String = "",
  val title: String = "",
  val description: String = "",
)

@Serializable
data class BattleReportCatalog(
  val types: List<BattleReportType> = emptyList(),
)

@Serializable
data class BattleReportItem(
  val id: String = "",
  val reportType: String = "",
  val title: String = "",
  val summary: String = "",
  val createdAt: String? = null,
  val detail: JsonElement? = null,
)

@Serializable
data class BattleReportListPayload(
  val reports: List<BattleReportItem> = emptyList(),
  val emptyReason: String = "",
  val businessCode: String = "",
)

@Serializable
data class BattleReportParsePayload(
  val report: BattleReportItem? = null,
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
