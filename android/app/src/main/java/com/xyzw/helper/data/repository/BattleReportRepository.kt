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
    parser.parse(api.queryReports(tokenId, BattleReportQueryRequest(reportType, date)))

  suspend fun parseReport(rawText: String): ApiResult<BattleReportParsePayload> =
    parser.parse(api.parseReport(BattleReportParseRequest(rawText)))
}
