package com.xyzw.helper.data.repository

import com.xyzw.helper.data.model.BinDownloadTicket
import com.xyzw.helper.data.model.BinFileItem
import com.xyzw.helper.data.model.BinFileUploadResult
import com.xyzw.helper.data.model.ImportedGameToken
import com.xyzw.helper.data.model.TokenActivationStatus
import com.xyzw.helper.data.model.UserTokenActivationBinding
import com.xyzw.helper.data.network.ApiError
import com.xyzw.helper.data.network.ApiResult
import com.xyzw.helper.data.network.TokenImportProxyRequest
import com.xyzw.helper.data.network.TokenManagementApi
import com.xyzw.helper.data.session.UserSensitiveActionSession
import com.xyzw.helper.data.storage.SecureTokenWorkspaceStore
import com.xyzw.helper.data.token.TokenImportParser
import kotlinx.serialization.json.JsonElement
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody

class TokenManagementRepository(
  private val api: TokenManagementApi,
  private val parser: com.xyzw.helper.data.network.ApiResultParser,
  private val store: SecureTokenWorkspaceStore,
  private val sensitiveActionSession: UserSensitiveActionSession,
) {
  val tokens = store.tokens

  fun saveImportedToken(token: ImportedGameToken) {
    store.upsert(token)
  }

  fun removeImportedToken(tokenId: String) {
    store.remove(tokenId)
  }

  fun updateImportedToken(tokenId: String, transform: (ImportedGameToken) -> ImportedGameToken) {
    store.update(tokenId, transform)
  }

  fun parseManualToken(rawToken: String): ImportedGameToken =
    TokenImportParser.parseManualToken(
      rawToken = rawToken,
      source = com.xyzw.helper.data.model.TokenImportSource.MANUAL,
    )

  suspend fun proxyImport(url: String): ApiResult<List<ImportedGameToken>> {
    val response = api.proxyFetch(TokenImportProxyRequest(url))
    if (!response.isSuccessful) {
      return ApiResult.Failure(
        ApiError(
          httpStatus = response.code(),
          message = response.errorBody()?.string().orEmpty().ifBlank { "URL 导入失败" },
        ),
      )
    }
    val payload = response.body()
    if (payload == null) {
      return ApiResult.Failure(ApiError.local("URL 导入响应为空"))
    }
    return runCatching {
      ApiResult.Success(TokenImportParser.parseProxyPayload(payload, url))
    }.getOrElse { error ->
      ApiResult.Failure(ApiError.local(error.message ?: "URL 导入解析失败"))
    }
  }

  suspend fun listBinFiles(): ApiResult<List<BinFileItem>> =
    parser.parse(api.listBinFiles())

  suspend fun uploadBinFile(
    tokenId: String,
    bytes: ByteArray,
  ): ApiResult<BinFileUploadResult> =
    parser.parse(
      api.uploadBinFile(
        tokenId = tokenId,
        requestBody = bytes.toRequestBody("application/octet-stream".toMediaType()),
      ),
    )

  suspend fun createDownloadTicket(
    tokenId: String,
    confirmToken: String? = sensitiveActionSession.currentToken(),
  ): ApiResult<BinDownloadTicket> =
    parser.parse(
      api.createDownloadTicket(
        tokenId = tokenId,
        confirmToken = confirmToken,
      ),
    )

  suspend fun downloadBinFile(
    tokenId: String,
    ticket: String,
  ): ApiResult<ByteArray> {
    val response = api.downloadBinFile(tokenId, mapOf("ticket" to ticket))
    if (!response.isSuccessful) {
      return ApiResult.Failure(
        ApiError(
          httpStatus = response.code(),
          message = response.errorBody()?.string().orEmpty().ifBlank { "BIN 下载失败" },
        ),
      )
    }
    val body = response.body() ?: return ApiResult.Failure(ApiError.local("BIN 下载响应为空"))
    return ApiResult.Success(body.bytes())
  }

  suspend fun deleteBinFile(tokenId: String): ApiResult<Unit> =
    parser.parseUnit(api.deleteBinFile(tokenId))

  suspend fun getActivationStatus(
    token: ImportedGameToken,
  ): ApiResult<TokenActivationStatus> =
    parser.parse(
      api.getActivationStatus(
        mapOf(
          "tokenId" to token.id,
          "roleId" to token.roleId,
          "gameAccountId" to token.roleId,
          "sessId" to token.sessId,
          "roleName" to token.roleName,
          "region" to token.region,
          "server" to token.region,
          "roleIndex" to token.roleIndex,
        ).filterValues { value -> value.isNotBlank() },
      ),
    )

  suspend fun listActivationBindings(): ApiResult<List<UserTokenActivationBinding>> =
    parser.parse(api.listActivationBindings())
}
