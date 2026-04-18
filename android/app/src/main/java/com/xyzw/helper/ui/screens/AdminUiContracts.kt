package com.xyzw.helper.ui.screens

import com.xyzw.helper.data.model.AdminActionError
import com.xyzw.helper.data.model.AdminTaskControlLogsQuery
import com.xyzw.helper.data.model.AuthUser
import com.xyzw.helper.data.network.ApiError
import com.xyzw.helper.ui.navigation.AppRoute

const val ADMIN_FORBIDDEN_MESSAGE = "权限不足或需要管理员确认"

data class AdminEntrySpec(
  val showEntry: Boolean,
  val route: String?,
)

data class AdminTaskControlLogFilters(
  val username: String = "",
  val taskName: String = "",
  val status: String = "",
  val taskId: String = "",
  val message: String = "",
  val limit: Int = 500,
) {
  fun normalizedLimit(): Int =
    limit.coerceIn(1, 2_000)

  fun toQuery(): AdminTaskControlLogsQuery =
    AdminTaskControlLogsQuery(
      username = username.trim(),
      taskName = taskName.trim(),
      status = status.trim(),
      taskId = taskId.trim(),
      message = message.trim(),
      limit = normalizedLimit(),
    )
}

fun buildAdminEntrySpec(user: AuthUser?): AdminEntrySpec =
  if (user?.isAdmin == true) {
    AdminEntrySpec(
      showEntry = true,
      route = AppRoute.AdminHub.route,
    )
  } else {
    AdminEntrySpec(
      showEntry = false,
      route = null,
    )
  }

fun ApiError.toAdminActionError(): AdminActionError =
  AdminActionError(
    message = if (httpStatus == 403) ADMIN_FORBIDDEN_MESSAGE else message,
    code = code,
    httpStatus = httpStatus,
  )
