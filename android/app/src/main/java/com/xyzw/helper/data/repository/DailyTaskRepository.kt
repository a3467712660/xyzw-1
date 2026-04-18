package com.xyzw.helper.data.repository

import com.xyzw.helper.data.model.DailyTaskItem
import com.xyzw.helper.data.network.ApiResult
import com.xyzw.helper.data.network.ApiResultParser
import com.xyzw.helper.data.network.DailyTaskApi

class DailyTaskRepository(
  private val api: DailyTaskApi,
  private val parser: ApiResultParser,
) {
  suspend fun listTasks(roleId: String? = null): ApiResult<List<DailyTaskItem>> =
    parser.parse(api.listTasks(roleId))
}
