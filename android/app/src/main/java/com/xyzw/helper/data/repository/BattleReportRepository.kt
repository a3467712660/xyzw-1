package com.xyzw.helper.data.repository

import com.xyzw.helper.data.model.BattleReportCatalog
import com.xyzw.helper.data.model.BattleReportListPayload
import com.xyzw.helper.data.model.BattleReportParsePayload
import com.xyzw.helper.data.network.ApiResult
import com.xyzw.helper.data.network.ApiResultParser
import com.xyzw.helper.data.network.BattleReportApi
import com.xyzw.helper.data.network.BattleReportParseRequest
import com.xyzw.helper.data.network.BattleReportQueryRequest

class BattleReportRepository(
  private val api: BattleReportApi,
  private val parser: ApiResultParser,
) {
  suspend fun getCatalog(): ApiResult<BattleReportCatalog> =
    parser.parse(api.getCatalog())

  suspend fun queryReports(
    tokenId: String,
    reportType: String,
    date: String = "",
  ): ApiResult<BattleReportListPayload> =
    when (val result = parser.parse(api.queryReports(tokenId, BattleReportQueryRequest(reportType, date)))) {
      is ApiResult.Success -> {
        if (BattleReportErrorMapper.isNoData(result.data.businessCode, result.data.emptyReason)) {
          ApiResult.Success(BattleReportErrorMapper.noDataPayload(), result.message)
        } else {
          result
        }
      }
      is ApiResult.Failure -> {
        if (BattleReportErrorMapper.isNoData(result.error)) {
          ApiResult.Success(BattleReportErrorMapper.noDataPayload())
        } else {
          ApiResult.Failure(result.error.copy(message = BattleReportErrorMapper.friendlyMessage(result.error)))
        }
      }
    }

  suspend fun parseReport(rawText: String): ApiResult<BattleReportParsePayload> =
    when (val result = parser.parse(api.parseReport(BattleReportParseRequest(rawText)))) {
      is ApiResult.Success -> result
      is ApiResult.Failure -> ApiResult.Failure(
        result.error.copy(message = BattleReportErrorMapper.friendlyMessage(result.error)),
      )
    }
}
