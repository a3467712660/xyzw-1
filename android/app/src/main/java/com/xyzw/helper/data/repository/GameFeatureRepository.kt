package com.xyzw.helper.data.repository

import com.xyzw.helper.data.model.GameFeatureActionResult
import com.xyzw.helper.data.model.GameFeatureCatalog
import com.xyzw.helper.data.model.GameFeatureSummary
import com.xyzw.helper.data.model.GameLineup
import com.xyzw.helper.data.model.GameLineupApplyResult
import com.xyzw.helper.data.model.GameLineupsPayload
import com.xyzw.helper.data.model.LegionWarSnapshot
import com.xyzw.helper.data.network.ApiResult
import com.xyzw.helper.data.network.ApiResultParser
import com.xyzw.helper.data.network.GameFeatureActionRequest
import com.xyzw.helper.data.network.GameFeatureApi
import com.xyzw.helper.data.network.GameLineupApplyRequest
import com.xyzw.helper.data.network.GameLineupsSaveRequest

class GameFeatureRepository(
  private val api: GameFeatureApi,
  private val parser: ApiResultParser,
) {
  suspend fun getCatalog(): ApiResult<GameFeatureCatalog> =
    parser.parse(api.getCatalog())

  suspend fun getSummary(tokenId: String): ApiResult<GameFeatureSummary> =
    parser.parse(api.getSummary(tokenId))

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
}
