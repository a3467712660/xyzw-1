package com.xyzw.helper.data.network

import kotlinx.serialization.Serializable
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import retrofit2.Response

class ApiResultParserTest {
  private val parser = ApiResultParser()

  @Test
  fun `parses success envelope`() {
    val response = Response.success(
      ApiEnvelope(
        success = true,
        data = SamplePayload(id = "role-1"),
        message = "ok",
      ),
    )

    val result = parser.parse(response)

    assertTrue(result is ApiResult.Success)
    result as ApiResult.Success
    assertEquals("role-1", result.data.id)
    assertEquals("ok", result.message)
  }

  @Test
  fun `parses failure envelope`() {
    val responseBody = """
      {"success":false,"message":"需要登录","error":{"code":"AUTH_INVALID_TOKEN","message":"需要登录"}}
    """.trimIndent().toResponseBody("application/json".toMediaType())

    val response = Response.error<ApiEnvelope<SamplePayload>>(401, responseBody)

    val result = parser.parse(response)

    assertTrue(result is ApiResult.Failure)
    result as ApiResult.Failure
    assertEquals(401, result.error.httpStatus)
    assertEquals("AUTH_INVALID_TOKEN", result.error.code)
    assertEquals("需要登录", result.error.message)
  }

  @Test
  fun `non envelope body becomes parse failure`() {
    val responseBody = """{"unexpected":true}"""
      .toResponseBody("application/json".toMediaType())

    val response = Response.error<ApiEnvelope<SamplePayload>>(500, responseBody)

    val result = parser.parse(response)

    assertTrue(result is ApiResult.Failure)
    result as ApiResult.Failure
    assertEquals(500, result.error.httpStatus)
    assertEquals("服务器异常，请稍后再试", result.error.message)
    assertEquals("""{"unexpected":true}""", result.error.rawBody)
  }

  @Test
  fun `empty 429 response uses friendly rate limit message`() {
    val response = Response.error<ApiEnvelope<SamplePayload>>(
      429,
      "".toResponseBody("application/json".toMediaType()),
    )

    val result = parser.parse(response)

    assertTrue(result is ApiResult.Failure)
    result as ApiResult.Failure
    assertEquals(429, result.error.httpStatus)
    assertEquals("操作过于频繁，请稍后再试", result.error.message)
  }

  @Serializable
  private data class SamplePayload(
    val id: String,
  )
}
