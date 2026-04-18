package com.xyzw.helper.data.repository

import com.xyzw.helper.data.model.DailyTaskEntry
import com.xyzw.helper.data.model.DailyTaskHistoryItem
import com.xyzw.helper.data.model.DailyTaskStatusSummary
import com.xyzw.helper.data.network.ApiResult
import com.xyzw.helper.data.network.ApiResultParser
import com.xyzw.helper.data.network.DailyTaskApi
import com.xyzw.helper.data.network.DailyTaskUpdateRequest

class DailyTaskRepository(
  private val api: DailyTaskApi,
  private val parser: ApiResultParser,
) {
  suspend fun listTasks(roleId: String): ApiResult<List<DailyTaskEntry>> =
    parser.parse(api.listTasks(roleId))

  suspend fun getStatus(roleId: String): ApiResult<DailyTaskStatusSummary> =
    parser.parse(api.getStatus(roleId))

  suspend fun completeTask(
    taskId: String,
    roleId: String,
  ): ApiResult<Unit> =
    parser.parseUnit(api.completeTask(taskId, mapOf("roleId" to roleId)))

  suspend fun updateTask(
    taskId: String,
    roleId: String,
    enabled: Boolean? = null,
    autoExecute: Boolean? = null,
    delay: Int? = null,
    notification: Boolean? = null,
    cronExpr: String? = null,
  ): ApiResult<Unit> =
    parser.parseUnit(
      api.updateTask(
        taskId = taskId,
        request = DailyTaskUpdateRequest(
          roleId = roleId,
          enabled = enabled,
          autoExecute = autoExecute,
          delay = delay,
          notification = notification,
          cronExpr = cronExpr,
        ),
      ),
    )

  suspend fun getHistory(
    roleId: String,
    page: Int = 1,
    limit: Int = 20,
  ): ApiResult<List<DailyTaskHistoryItem>> =
    parser.parse(
      api.getHistory(
        roleId = roleId,
        page = page,
        limit = limit,
      ),
    )
}
