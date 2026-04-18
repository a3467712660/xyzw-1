package com.xyzw.helper.data.network

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import okhttp3.ResponseBody
import retrofit2.Response

class ApiResultParser(
  private val json: Json = NetworkFactory.json,
) {
  fun <T> parse(response: Response<ApiEnvelope<T>>): ApiResult<T> {
    val body = response.body()
    if (response.isSuccessful && body != null) {
      if (!body.success) {
        return ApiResult.Failure(
          ApiError(
            httpStatus = response.code(),
            code = body.error?.code,
            message = body.error?.message ?: body.message ?: "请求失败",
          ),
        )
      }
      val data = body.data
      if (data == null) {
        return ApiResult.Failure(
          ApiError.local(
            message = "响应缺少 data",
            httpStatus = response.code(),
          ),
        )
      }
      return ApiResult.Success(data = data, message = body.message)
    }

    return ApiResult.Failure(parseError(response))
  }

  fun parseUnit(response: Response<ApiEnvelope<Unit>>): ApiResult<Unit> {
    val body = response.body()
    if (response.isSuccessful && body != null) {
      if (!body.success) {
        return ApiResult.Failure(
          ApiError(
            httpStatus = response.code(),
            code = body.error?.code,
            message = body.error?.message ?: body.message ?: "请求失败",
          ),
        )
      }
      return ApiResult.Success(Unit, body.message)
    }
    return ApiResult.Failure(parseError(response))
  }

  private fun <T> parseError(response: Response<ApiEnvelope<T>>): ApiError {
    val rawBody = response.errorBody()?.consumeText()?.ifBlank { null }
    if (!rawBody.isNullOrBlank()) {
      val parsed = runCatching {
        json.decodeFromString(
          ApiEnvelope.serializer(JsonElement.serializer()),
          rawBody,
        )
      }.getOrNull()

      if (parsed != null && !parsed.success) {
        return ApiError(
          httpStatus = response.code(),
          code = parsed.error?.code,
          message = parsed.error?.message ?: parsed.message ?: "请求失败",
          rawBody = rawBody,
        )
      }

      return ApiError(
        httpStatus = response.code(),
        message = "响应解析失败",
        rawBody = rawBody,
      )
    }

    val body = response.body()
    if (body != null && !body.success) {
      return ApiError(
        httpStatus = response.code(),
        code = body.error?.code,
        message = body.error?.message ?: body.message ?: "请求失败",
      )
    }

    return ApiError.local(
      message = "请求失败",
      httpStatus = response.code(),
    )
  }

  private fun ResponseBody.consumeText(): String =
    use { it.string() }
}
