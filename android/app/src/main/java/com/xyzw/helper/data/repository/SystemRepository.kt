package com.xyzw.helper.data.repository

import com.xyzw.helper.data.model.BuildInfo
import com.xyzw.helper.data.network.ApiResult
import com.xyzw.helper.data.network.ApiResultParser
import com.xyzw.helper.data.network.SystemApi

class SystemRepository(
  private val api: SystemApi,
  private val parser: ApiResultParser,
) {
  suspend fun getVersion(): ApiResult<BuildInfo> =
    parser.parse(api.getVersion())
}
