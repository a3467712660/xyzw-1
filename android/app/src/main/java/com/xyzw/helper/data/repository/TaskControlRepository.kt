package com.xyzw.helper.data.repository

import com.xyzw.helper.data.model.TaskControlStatePayload
import com.xyzw.helper.data.network.ApiResult
import com.xyzw.helper.data.network.ApiResultParser
import com.xyzw.helper.data.network.TaskControlApi

class TaskControlRepository(
  private val api: TaskControlApi,
  private val parser: ApiResultParser,
) {
  suspend fun getState(): ApiResult<TaskControlStatePayload> =
    parser.parse(api.getState())
}
