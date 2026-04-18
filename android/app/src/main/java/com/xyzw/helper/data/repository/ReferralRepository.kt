package com.xyzw.helper.data.repository

import com.xyzw.helper.data.model.ReferralConversionItem
import com.xyzw.helper.data.model.ReferralOverview
import com.xyzw.helper.data.model.ReferralProfile
import com.xyzw.helper.data.network.ApiResult
import com.xyzw.helper.data.network.ApiResultParser
import com.xyzw.helper.data.network.UserApi

class ReferralRepository(
  private val api: UserApi,
  private val parser: ApiResultParser,
) {
  suspend fun getReferralProfile(): ApiResult<ReferralProfile?> =
    parser.parse(api.getReferralProfile())

  suspend fun generateReferralProfile(): ApiResult<ReferralProfile> =
    parser.parse(api.generateReferralProfile())

  suspend fun getReferralOverview(): ApiResult<ReferralOverview> =
    parser.parse(api.getReferralOverview())

  suspend fun getReferralConversions(limit: Int = 200): ApiResult<List<ReferralConversionItem>> =
    parser.parse(api.getReferralConversions(limit))
}
