package com.xyzw.helper.data.repository

import com.xyzw.helper.data.model.TaskControlLogItem
import com.xyzw.helper.data.model.TaskControlStateSnapshot
import com.xyzw.helper.data.model.TaskControlTaskRow
import com.xyzw.helper.data.network.ApiResult
import com.xyzw.helper.data.network.ApiResultParser
import com.xyzw.helper.data.network.NetworkFactory
import com.xyzw.helper.data.network.TaskControlApi
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.decodeFromJsonElement
import kotlinx.serialization.json.encodeToJsonElement
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

class TaskControlRepository(
  private val api: TaskControlApi,
  private val parser: ApiResultParser,
) {
  suspend fun getState(): ApiResult<TaskControlStateSnapshot> =
    when (val result = parser.parse(api.getState())) {
      is ApiResult.Success -> ApiResult.Success(parseStateSnapshot(result.data), result.message)
      is ApiResult.Failure -> result
    }

  suspend fun saveState(state: TaskControlStateSnapshot): ApiResult<TaskControlStateSnapshot> {
    val request = JsonObject(
      mapOf(
        "tasks" to JsonArray(rawRowsForSave(state)),
      ),
    )
    return when (val result = parser.parse(api.saveState(request))) {
      is ApiResult.Success -> {
        val updatedAt = result.data["updatedAt"]?.jsonPrimitive?.contentOrNull ?: state.updatedAt
        ApiResult.Success(state.copy(updatedAt = updatedAt), result.message)
      }
      is ApiResult.Failure -> result
    }
  }

  suspend fun getLogs(limit: Int = 100): ApiResult<List<TaskControlLogItem>> =
    parser.parse(api.getLogs(limit))

  suspend fun clearLogs(): ApiResult<Unit> =
    parser.parseUnit(api.clearLogs())

  private fun parseStateSnapshot(payload: JsonObject): TaskControlStateSnapshot {
    val rawTasks = (payload["tasks"] as? JsonArray)
      ?.mapNotNull { it as? JsonObject }
      .orEmpty()
    val tasks = rawTasks.mapNotNull { raw ->
      runCatching {
        NetworkFactory.json.decodeFromJsonElement<TaskControlTaskRow>(raw)
      }.getOrNull()
    }
    return TaskControlStateSnapshot(
      tasks = tasks,
      rawTasks = rawTasks,
      updatedAt = payload["updatedAt"]?.jsonPrimitive?.contentOrNull,
    )
  }

  private fun rawRowsForSave(state: TaskControlStateSnapshot): List<JsonObject> =
    if (state.rawTasks.isNotEmpty()) {
      state.rawTasks
    } else {
      state.tasks.map {
        NetworkFactory.json.encodeToJsonElement(it).jsonObject
      }
    }
}
