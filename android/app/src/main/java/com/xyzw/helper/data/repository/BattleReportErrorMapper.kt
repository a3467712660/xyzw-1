package com.xyzw.helper.data.repository

import com.xyzw.helper.data.model.BattleReportListPayload
import com.xyzw.helper.data.network.ApiError

object BattleReportErrorMapper {
  const val NO_DATA_CODE = "200020"
  const val NO_DATA_BUSINESS_CODE = "BATTLE_REPORT_NO_DATA"
  const val NO_DATA_MESSAGE = "当天暂无战报，可能未参加或战报尚未生成"

  fun noDataPayload(): BattleReportListPayload =
    BattleReportListPayload(
      reports = emptyList(),
      emptyReason = NO_DATA_MESSAGE,
      businessCode = NO_DATA_CODE,
    )

  fun isNoData(error: ApiError): Boolean =
    isNoData(error.code, error.message, error.rawBody)

  fun isNoData(
    code: String?,
    message: String?,
    rawBody: String? = null,
  ): Boolean {
    val values = listOf(code, message, rawBody)
      .filterNotNull()
      .map { it.trim() }
    return values.any { value ->
      value == NO_DATA_CODE ||
        value.equals(NO_DATA_BUSINESS_CODE, ignoreCase = true) ||
        value.contains("\"code\":\"$NO_DATA_CODE\"") ||
        value.contains("\"code\":$NO_DATA_CODE") ||
        value.contains("\"errCode\":$NO_DATA_CODE") ||
        value.contains(NO_DATA_BUSINESS_CODE, ignoreCase = true) ||
        value.contains("服务器错误: $NO_DATA_CODE") ||
        value.contains(" $NO_DATA_CODE ") ||
        value.contains(":$NO_DATA_CODE") ||
        value.contains("：$NO_DATA_CODE")
    }
  }

  fun friendlyMessage(error: ApiError): String =
    when {
      isNoData(error) -> NO_DATA_MESSAGE
      error.code.equals("GAME_COMMAND_TIMEOUT", ignoreCase = true) -> "游戏服务响应超时，请稍后重试。"
      error.code.equals("GAME_BIN_MISSING", ignoreCase = true) ||
        error.code.equals("BIN_FILE_NOT_FOUND", ignoreCase = true) -> "当前角色缺少 BIN，请先上传或恢复。"
      error.code.equals("GAME_TOKEN_INVALID", ignoreCase = true) ||
        error.code.equals("GAME_TOKEN_DECODE_FAILED", ignoreCase = true) -> "当前角色令牌失效，请重新导入。"
      error.httpStatus == 403 -> "权限不足或远程功能未开启。"
      error.httpStatus == 401 -> "登录已过期，请重新登录。"
      error.httpStatus >= 500 -> "服务器处理战报失败，请稍后重试。"
      error.code.equals("BATTLE_REPORT_UNSUPPORTED", ignoreCase = true) -> "战报格式不支持，请检查粘贴内容"
      else -> error.message.ifBlank { "战报处理失败，请稍后重试。" }
    }
}
