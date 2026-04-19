package com.xyzw.helper.data.repository

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
import com.xyzw.helper.data.network.ApiResult
import com.xyzw.helper.data.network.ApiError
import com.xyzw.helper.data.network.ApiResultParser
import com.xyzw.helper.data.network.GameFeatureActionRequest
import com.xyzw.helper.data.network.GameFeatureApi
import com.xyzw.helper.data.network.GameWorkbenchActionRequest
import com.xyzw.helper.data.network.GameWorkbenchReplayRenderRequest
import com.xyzw.helper.data.network.GameWorkbenchSectionRequest
import com.xyzw.helper.data.network.GameLineupApplyRequest
import com.xyzw.helper.data.network.GameLineupsSaveRequest
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject

class GameFeatureRepository(
  private val api: GameFeatureApi,
  private val parser: ApiResultParser,
) {
  suspend fun getCatalog(): ApiResult<GameFeatureCatalog> =
    parser.parse(api.getCatalog())

  suspend fun getWorkbenchCatalog(): ApiResult<GameWorkbenchCatalog> =
    parser.parse(api.getWorkbenchCatalog())

  suspend fun getSummary(tokenId: String): ApiResult<GameFeatureSummary> =
    parser.parse(api.getSummary(tokenId))

  suspend fun getWorkbenchBootstrap(tokenId: String): ApiResult<GameWorkbenchBootstrap> =
    parser.parse(api.getWorkbenchBootstrap(tokenId))

  suspend fun getWorkbenchSection(
    tokenId: String,
    sectionId: String,
  ): ApiResult<GameWorkbenchSectionSnapshot> =
    parser.parse(api.getWorkbenchSection(tokenId, GameWorkbenchSectionRequest(sectionId)))

  suspend fun runWorkbenchAction(
    tokenId: String,
    sectionId: String,
    cardId: String,
    actionId: String,
  ): ApiResult<GameWorkbenchActionResult> =
    parser.parse(
      api.runWorkbenchAction(
        tokenId,
        GameWorkbenchActionRequest(
          sectionId = sectionId,
          cardId = cardId,
          actionId = actionId,
        ),
      ),
    )

  suspend fun renderWorkbenchReplay(
    tokenId: String,
    payload: Map<String, String> = emptyMap(),
  ): ApiResult<RenderedReplayResult> =
    parser.parse(
      api.renderWorkbenchReplay(
        tokenId,
        GameWorkbenchReplayRenderRequest(payload.toJsonObject()),
      ),
    )

  suspend fun downloadRenderedReplayImage(imageUrl: String): ApiResult<ByteArray> {
    if (imageUrl.isBlank()) {
      return ApiResult.Failure(ApiError.local("回放渲染图地址为空"))
    }
    val response = api.downloadRenderedReplayImage(imageUrl)
    if (!response.isSuccessful) {
      return ApiResult.Failure(
        ApiError(
          httpStatus = response.code(),
          message = response.errorBody()?.string().orEmpty().ifBlank { "回放渲染图下载失败" },
        ),
      )
    }
    val body = response.body() ?: return ApiResult.Failure(ApiError.local("回放渲染图响应为空"))
    return runCatching {
      body.use { it.bytes() }
    }.fold(
      onSuccess = { ApiResult.Success(it) },
      onFailure = { ApiResult.Failure(ApiError.local(it.message ?: "回放渲染图读取失败")) },
    )
  }

  suspend fun runAction(
    tokenId: String,
    actionId: String,
  ): ApiResult<GameFeatureActionResult> =
    parser.parse(api.runAction(tokenId, GameFeatureActionRequest(actionId)))

  suspend fun getLegionWarSnapshot(tokenId: String): ApiResult<LegionWarSnapshot> =
    parser.parse(api.getLegionWarSnapshot(tokenId))

  suspend fun getLineups(tokenId: String): ApiResult<GameLineupsPayload> =
    parser.parse(api.getLineups(tokenId))

  suspend fun saveLineups(
    tokenId: String,
    saved: List<GameLineup>,
  ): ApiResult<GameLineupsPayload> =
    parser.parse(api.saveLineups(tokenId, GameLineupsSaveRequest(saved)))

  suspend fun applyLineup(
    tokenId: String,
    lineupId: String,
  ): ApiResult<GameLineupApplyResult> =
    parser.parse(api.applyLineup(tokenId, GameLineupApplyRequest(lineupId)))

  private fun Map<String, String>.toJsonObject(): JsonObject =
    buildJsonObject {
      forEach { (key, value) ->
        put(key, JsonPrimitive(value))
      }
    }
}
