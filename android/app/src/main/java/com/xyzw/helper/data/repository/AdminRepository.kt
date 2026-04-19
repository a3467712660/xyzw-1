package com.xyzw.helper.data.repository

import com.xyzw.helper.data.model.ActivationCodeItem
import com.xyzw.helper.data.model.AdminConfirmCredential
import com.xyzw.helper.data.model.AdminConfirmToken
import com.xyzw.helper.data.model.AdminMfaResetLinkPayload
import com.xyzw.helper.data.model.AdminPasswordResetCodePayload
import com.xyzw.helper.data.model.AdminTaskControlLogItem
import com.xyzw.helper.data.model.AdminTaskControlLogsQuery
import com.xyzw.helper.data.model.AdminUserItem
import com.xyzw.helper.data.model.AdminUserTokenActivationsPayload
import com.xyzw.helper.data.model.InviteCodeItem
import com.xyzw.helper.data.model.ReferralAttributionItem
import com.xyzw.helper.data.model.ReferralConversionItem
import com.xyzw.helper.data.model.WechatContactAdminItem
import com.xyzw.helper.data.network.AdminApi
import com.xyzw.helper.data.network.AdminChangelogBroadcastRequest
import com.xyzw.helper.data.network.AdminChangelogBroadcastResult
import com.xyzw.helper.data.network.AdminCreateActivationCodesRequest
import com.xyzw.helper.data.network.AdminCreateInviteCodesRequest
import com.xyzw.helper.data.network.AdminMarkReferralPaidRequest
import com.xyzw.helper.data.network.AdminRejectReferralRequest
import com.xyzw.helper.data.network.AdminResetPasswordRequest
import com.xyzw.helper.data.network.AdminUpdateAccessScopeRequest
import com.xyzw.helper.data.network.AdminUpdateTokenBindLimitRequest
import com.xyzw.helper.data.network.AdminUpdateUserAdminRequest
import com.xyzw.helper.data.network.AdminWechatContactRequest
import com.xyzw.helper.data.network.ApiError
import com.xyzw.helper.data.network.ApiResult
import com.xyzw.helper.data.network.ApiResultParser
import com.xyzw.helper.data.network.EmptyRequest
import com.xyzw.helper.data.network.SensitiveConfirmPayload
import kotlinx.serialization.json.JsonObject
import java.time.Instant

private const val ADMIN_FORBIDDEN_MESSAGE = "权限不足或需要管理员确认"
private const val ADMIN_CONFIRM_REQUIRED_CODE = "ADMIN_CONFIRM_REQUIRED"

class AdminRepository(
  private val api: AdminApi,
  private val parser: ApiResultParser,
  private val nowProvider: () -> Long = { System.currentTimeMillis() },
) {
  private var cachedConfirmToken: AdminConfirmToken? = null
  private var cachedConfirmExpiresAtMillis: Long = 0L

  fun cachedConfirmToken(): AdminConfirmToken? =
    currentValidConfirmToken()

  fun clearCachedConfirmToken() {
    cachedConfirmToken = null
    cachedConfirmExpiresAtMillis = 0L
  }

  suspend fun confirmSensitiveAction(
    password: String? = null,
    totpCode: String? = null,
    recoveryCode: String? = null,
  ): ApiResult<AdminConfirmToken> =
    confirmSensitiveAction(
      AdminConfirmCredential(
        password = password?.takeIf { it.isNotBlank() },
        totpCode = totpCode?.takeIf { it.isNotBlank() },
        recoveryCode = recoveryCode?.takeIf { it.isNotBlank() },
      ),
    )

  suspend fun confirmSensitiveAction(
    credential: AdminConfirmCredential,
  ): ApiResult<AdminConfirmToken> {
    val result = parser.parse(
      api.confirmSensitiveAction(
        SensitiveConfirmPayload(
          password = credential.password,
          totpCode = credential.totpCode,
          recoveryCode = credential.recoveryCode,
        ),
      ),
    )
    return when (val normalized = normalizeAdminResult(result)) {
      is ApiResult.Success -> {
        cachedConfirmToken = normalized.data
        cachedConfirmExpiresAtMillis = parseInstantMillis(normalized.data.expiresAt)
        normalized
      }

      is ApiResult.Failure -> {
        clearCachedConfirmToken()
        normalized
      }
    }
  }

  suspend fun listUsers(): ApiResult<List<AdminUserItem>> =
    normalizeAdminResult(parser.parse(api.listUsers()))

  suspend fun listUserTokenActivations(id: String): ApiResult<AdminUserTokenActivationsPayload> =
    normalizeAdminResult(parser.parse(api.listUserTokenActivations(id)))

  suspend fun updateUserAdmin(id: String, isAdmin: Boolean): ApiResult<Unit> =
    withSensitiveConfirmToken { token ->
      parser.parseUnit(
        api.updateUserAdmin(
          id = id,
          confirmToken = token,
          request = AdminUpdateUserAdminRequest(isAdmin = isAdmin),
        ),
      )
    }

  suspend fun updateUserAccessScope(id: String, accessScope: String): ApiResult<Unit> =
    withSensitiveConfirmToken { token ->
      parser.parseUnit(
        api.updateUserAccessScope(
          id = id,
          confirmToken = token,
          request = AdminUpdateAccessScopeRequest(accessScope = accessScope),
        ),
      )
    }

  suspend fun updateUserTokenBindLimit(id: String, tokenBindLimit: Int): ApiResult<Unit> =
    withSensitiveConfirmToken { token ->
      parser.parseUnit(
        api.updateUserTokenBindLimit(
          id = id,
          confirmToken = token,
          request = AdminUpdateTokenBindLimitRequest(tokenBindLimit = tokenBindLimit),
        ),
      )
    }

  suspend fun resetUserPassword(id: String, password: String): ApiResult<Unit> =
    withSensitiveConfirmToken { token ->
      parser.parseUnit(
        api.resetUserPassword(
          id = id,
          confirmToken = token,
          request = AdminResetPasswordRequest(password = password),
        ),
      )
    }

  suspend fun createPasswordResetCode(
    id: String,
    expiresInMinutes: Int = 15,
  ): ApiResult<AdminPasswordResetCodePayload> =
    withSensitiveConfirmToken { token ->
      normalizeAdminResult(
        parser.parse(
          api.createPasswordResetCode(
            id = id,
            confirmToken = token,
            request = com.xyzw.helper.data.network.AdminCreatePasswordResetCodeRequest(
              expiresInMinutes = expiresInMinutes,
            ),
          ),
        ),
      )
    }

  suspend fun createMfaResetLink(id: String): ApiResult<AdminMfaResetLinkPayload> =
    withSensitiveConfirmToken { token ->
      normalizeAdminResult(
        parser.parse(
          api.createMfaResetLink(
            id = id,
            confirmToken = token,
            request = EmptyRequest(),
          ),
        ),
      )
    }

  suspend fun revokeSessions(id: String): ApiResult<Unit> =
    withSensitiveConfirmToken { token ->
      parser.parseUnit(
        api.revokeSessions(
          id = id,
          confirmToken = token,
          request = EmptyRequest(),
        ),
      )
    }

  suspend fun deleteUser(id: String): ApiResult<Unit> =
    withSensitiveConfirmToken { token ->
      parser.parseUnit(
        api.deleteUser(
          id = id,
          confirmToken = token,
        ),
      )
    }

  suspend fun listInviteCodes(): ApiResult<List<InviteCodeItem>> =
    normalizeAdminResult(parser.parse(api.listInviteCodes()))

  suspend fun createInviteCodes(
    count: Int,
    isTemporary: Boolean,
    bindAccountLimit: Int,
    featureScope: String = "full",
    expiresAt: String? = null,
  ): ApiResult<List<InviteCodeItem>> =
    withSensitiveConfirmToken { token ->
      normalizeAdminResult(
        parser.parse(
          api.createInviteCodes(
            confirmToken = token,
            request = AdminCreateInviteCodesRequest(
              count = count,
              expiresAt = expiresAt,
              isTemporary = isTemporary,
              featureScope = featureScope,
              bindAccountLimit = bindAccountLimit,
            ),
          ),
        ),
      )
    }

  suspend fun disableInviteCode(id: String): ApiResult<Unit> =
    withSensitiveConfirmToken { token ->
      parser.parseUnit(
        api.disableInviteCode(
          id = id,
          confirmToken = token,
          request = EmptyRequest(),
        ),
      )
    }

  suspend fun revealInviteCode(id: String): ApiResult<JsonObject> =
    withSensitiveConfirmToken { token ->
      normalizeAdminResult(
        parser.parse(
          api.revealInviteCode(
            id = id,
            confirmToken = token,
            request = EmptyRequest(),
          ),
        ),
      )
    }

  suspend fun listActivationCodes(): ApiResult<List<ActivationCodeItem>> =
    normalizeAdminResult(parser.parse(api.listActivationCodes()))

  suspend fun createActivationCodes(
    count: Int,
    featureScope: String,
    durationMonths: Int,
    saleAmountCents: Int,
  ): ApiResult<List<ActivationCodeItem>> =
    withSensitiveConfirmToken { token ->
      normalizeAdminResult(
        parser.parse(
          api.createActivationCodes(
            confirmToken = token,
            request = AdminCreateActivationCodesRequest(
              count = count,
              featureScope = featureScope,
              durationMonths = durationMonths,
              saleAmountCents = saleAmountCents,
            ),
          ),
        ),
      )
    }

  suspend fun unbindActivationCode(id: String): ApiResult<Unit> =
    withSensitiveConfirmToken { token ->
      parser.parseUnit(
        api.unbindActivationCode(
          id = id,
          confirmToken = token,
          request = EmptyRequest(),
        ),
      )
    }

  suspend fun unbindAllActivationCodes(): ApiResult<Unit> =
    withSensitiveConfirmToken { token ->
      parser.parseUnit(
        api.unbindAllActivationCodes(
          confirmToken = token,
          request = EmptyRequest(),
        ),
      )
    }

  suspend fun disableActivationCode(id: String): ApiResult<Unit> =
    withSensitiveConfirmToken { token ->
      parser.parseUnit(
        api.disableActivationCode(
          id = id,
          confirmToken = token,
          request = EmptyRequest(),
        ),
      )
    }

  suspend fun deleteActivationCode(id: String): ApiResult<Unit> =
    withSensitiveConfirmToken { token ->
      parser.parseUnit(
        api.deleteActivationCode(
          id = id,
          confirmToken = token,
        ),
      )
    }

  suspend fun revealActivationCode(id: String): ApiResult<JsonObject> =
    withSensitiveConfirmToken { token ->
      normalizeAdminResult(
        parser.parse(
          api.revealActivationCode(
            id = id,
            confirmToken = token,
            request = EmptyRequest(),
          ),
        ),
      )
    }

  suspend fun listTaskControlLogs(
    query: AdminTaskControlLogsQuery,
  ): ApiResult<List<AdminTaskControlLogItem>> =
    normalizeAdminResult(
      parser.parse(
        api.listTaskControlLogs(
          limit = query.limit,
          username = query.username.takeIf { it.isNotBlank() },
          taskName = query.taskName.takeIf { it.isNotBlank() },
          status = query.status.takeIf { it.isNotBlank() },
          taskId = query.taskId.takeIf { it.isNotBlank() },
          message = query.message.takeIf { it.isNotBlank() },
        ),
      ),
    )

  suspend fun sendChangelogBroadcast(
    version: String,
    title: String,
    content: String,
    path: String = "/changelog",
  ): ApiResult<AdminChangelogBroadcastResult> =
    normalizeAdminResult(
      parser.parse(
        api.sendChangelogBroadcast(
          AdminChangelogBroadcastRequest(
            version = version,
            title = title.ifBlank { null },
            content = content.ifBlank { null },
            path = path,
          ),
        ),
      ),
    )

  suspend fun listWechatContacts(): ApiResult<List<WechatContactAdminItem>> =
    normalizeAdminResult(parser.parse(api.listWechatContacts()))

  suspend fun createWechatContact(
    request: AdminWechatContactRequest,
  ): ApiResult<WechatContactAdminItem> =
    withSensitiveConfirmToken { token ->
      normalizeAdminResult(
        parser.parse(
          api.createWechatContact(
            confirmToken = token,
            request = request,
          ),
        ),
      )
    }

  suspend fun updateWechatContact(
    id: String,
    request: AdminWechatContactRequest,
  ): ApiResult<WechatContactAdminItem> =
    withSensitiveConfirmToken { token ->
      normalizeAdminResult(
        parser.parse(
          api.updateWechatContact(
            id = id,
            confirmToken = token,
            request = request,
          ),
        ),
      )
    }

  suspend fun deleteWechatContact(id: String): ApiResult<Unit> =
    withSensitiveConfirmToken { token ->
      when (val result = normalizeAdminResult(parser.parse(api.deleteWechatContact(id, token)))) {
        is ApiResult.Success -> ApiResult.Success(Unit, result.message)
        is ApiResult.Failure -> result
      }
    }

  suspend fun listReferralAttributions(limit: Int = 200): ApiResult<List<ReferralAttributionItem>> =
    normalizeAdminResult(parser.parse(api.listReferralAttributions(limit = limit)))

  suspend fun listReferralConversions(limit: Int = 200): ApiResult<List<ReferralConversionItem>> =
    normalizeAdminResult(parser.parse(api.listReferralConversions(limit = limit)))

  suspend fun markReferralConversionPaid(
    id: String,
    channel: String,
    settlementRef: String,
    note: String,
  ): ApiResult<ReferralConversionItem> =
    withSensitiveConfirmToken { token ->
      normalizeAdminResult(
        parser.parse(
          api.markReferralConversionPaid(
            id = id,
            confirmToken = token,
            request = AdminMarkReferralPaidRequest(
              channel = channel,
              settlementRef = settlementRef,
              note = note,
            ),
          ),
        ),
      )
    }

  suspend fun rejectReferralConversion(
    id: String,
    note: String,
  ): ApiResult<ReferralConversionItem> =
    withSensitiveConfirmToken { token ->
      normalizeAdminResult(
        parser.parse(
          api.rejectReferralConversion(
            id = id,
            confirmToken = token,
            request = AdminRejectReferralRequest(note = note),
          ),
        ),
      )
    }

  private fun currentValidConfirmToken(): AdminConfirmToken? {
    val token = cachedConfirmToken ?: return null
    if (cachedConfirmExpiresAtMillis <= nowProvider() + 3_000L) {
      clearCachedConfirmToken()
      return null
    }
    return token
  }

  private suspend fun <T> withSensitiveConfirmToken(
    block: suspend (String) -> ApiResult<T>,
  ): ApiResult<T> {
    val token = currentValidConfirmToken()?.token
      ?: return ApiResult.Failure(
        ApiError.local(
          message = ADMIN_FORBIDDEN_MESSAGE,
          code = ADMIN_CONFIRM_REQUIRED_CODE,
          httpStatus = 403,
        ),
      )
    return when (val result = normalizeAdminResult(block(token))) {
      is ApiResult.Success -> result
      is ApiResult.Failure -> {
        if (shouldClearConfirmCache(result.error)) {
          clearCachedConfirmToken()
        }
        result
      }
    }
  }

  private fun <T> normalizeAdminResult(result: ApiResult<T>): ApiResult<T> =
    when (result) {
      is ApiResult.Success -> result
      is ApiResult.Failure -> {
        if (result.error.httpStatus == 403) {
          ApiResult.Failure(
            result.error.copy(message = ADMIN_FORBIDDEN_MESSAGE),
          )
        } else {
          result
        }
      }
    }

  private fun shouldClearConfirmCache(error: ApiError): Boolean =
    error.httpStatus == 403 ||
      (error.code ?: "").startsWith("ADMIN_CONFIRM_") ||
      error.message.contains("二次确认")

  private fun parseInstantMillis(value: String): Long =
    runCatching { Instant.parse(value).toEpochMilli() }.getOrElse { 0L }
}
