package com.xyzw.helper.ui.state

import com.xyzw.helper.data.network.ApiError

sealed interface Loadable<out T> {
  data object Loading : Loadable<Nothing>
  data class Data<T>(val value: T) : Loadable<T>
  data class Error(val message: String, val retryable: Boolean = true) : Loadable<Nothing>
}

data class ActionState(
  val isRunning: Boolean = false,
  val message: String? = null,
  val error: String? = null,
)

fun ApiError.toFriendlyMessage(): String =
  when (httpStatus) {
    401 -> "登录状态已失效，请重新登录"
    403 -> when (code) {
      "ADMIN_CONFIRM_REQUIRED",
      "ADMIN_CONFIRM_TOKEN_REQUIRED",
      "ADMIN_CONFIRM_TOKEN_INVALID",
      "ADMIN_CONFIRM_TOKEN_EXPIRED",
      -> "该操作需要管理员确认，请输入管理员确认密码"

      else -> "权限不足，无法完成当前操作"
    }

    404 -> "数据不存在或已被删除"
    409 -> message.ifBlank { "数据状态冲突，请刷新后重试" }
    429 -> "操作过于频繁，请稍后再试"
    in 500..599 -> "服务器异常，请稍后再试"
    else -> message.ifBlank { "请求失败，请稍后重试" }
  }

fun Throwable.toFriendlyMessage(defaultMessage: String = "操作失败，请稍后重试"): String =
  message?.takeIf { it.isNotBlank() } ?: defaultMessage

