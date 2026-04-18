package com.xyzw.helper.data.repository

import com.xyzw.helper.data.model.TaskControlLogItem
import com.xyzw.helper.data.model.TaskControlStateSnapshot
import com.xyzw.helper.data.network.ApiResult
import com.xyzw.helper.data.network.ApiResultParser
import com.xyzw.helper.data.network.TaskControlApi

class TaskControlRepository(
  private val api: TaskControlApi,
  private val parser: ApiResultParser,
) {
  suspend fun getState(): ApiResult<TaskControlStateSnapshot> =
    parser.parse(api.getState())

  suspend fun getLogs(limit: Int = 100): ApiResult<List<TaskControlLogItem>> =
    parser.parse(api.getLogs(limit))

  suspend fun clearLogs(): ApiResult<Unit> =
    parser.parseUnit(api.clearLogs())
}
