package com.xyzw.helper.data.network

import okhttp3.Cookie
import okhttp3.CookieJar
import okhttp3.HttpUrl
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.Interceptor
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.Protocol
import okhttp3.Request
import okhttp3.Response
import okhttp3.ResponseBody.Companion.toResponseBody
import okhttp3.RequestBody.Companion.toRequestBody
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class CsrfInterceptorTest {
  private val baseUrl = "http://example.com/api/v1/auth/login".toHttpUrl()

  @Test
  fun `adds csrf header from xyzw cookie for unsafe requests`() {
    val jar = TestCookieJar()
    jar.saveFromResponse(baseUrl, listOf(cookie("xyzw_csrf_token", "csrf-token-1")))

    val request = Request.Builder()
      .url(baseUrl)
      .post("{}".toRequestBody("application/json".toMediaType()))
      .build()

    val response = CsrfInterceptor(jar).intercept(FakeChain(request))

    assertEquals("csrf-token-1", response.request.header("X-CSRF-Token"))
  }

  @Test
  fun `falls back to host prefixed csrf cookie`() {
    val jar = TestCookieJar()
    jar.saveFromResponse(baseUrl, listOf(cookie("__Host-xyzw_csrf_token", "csrf-token-2")))

    val request = Request.Builder()
      .url(baseUrl)
      .patch("{}".toRequestBody("application/json".toMediaType()))
      .build()

    val response = CsrfInterceptor(jar).intercept(FakeChain(request))

    assertEquals("csrf-token-2", response.request.header("X-CSRF-Token"))
  }

  @Test
  fun `skips safe methods`() {
    val jar = TestCookieJar()
    jar.saveFromResponse(baseUrl, listOf(cookie("xyzw_csrf_token", "csrf-token-3")))

    val request = Request.Builder()
      .url(baseUrl)
      .get()
      .build()

    val response = CsrfInterceptor(jar).intercept(FakeChain(request))

    assertNull(response.request.header("X-CSRF-Token"))
  }

  private fun cookie(name: String, value: String): Cookie =
    Cookie.Builder()
      .name(name)
      .value(value)
      .domain(baseUrl.host)
      .path("/")
      .build()

  private class TestCookieJar : CookieJar {
    private val cookies = mutableListOf<Cookie>()

    override fun saveFromResponse(url: HttpUrl, cookies: List<Cookie>) {
      this.cookies.removeAll { stored ->
        cookies.any { next ->
          next.name == stored.name && next.domain == stored.domain && next.path == stored.path
        }
      }
      this.cookies += cookies
    }

    override fun loadForRequest(url: HttpUrl): List<Cookie> = cookies.filter { it.matches(url) }
  }

  private class FakeChain(
    private val initialRequest: Request,
  ) : Interceptor.Chain {
    override fun request(): Request = initialRequest

    override fun proceed(request: Request): Response =
      Response.Builder()
        .request(request)
        .protocol(Protocol.HTTP_1_1)
        .code(200)
        .message("OK")
        .body("ok".toResponseBody("text/plain".toMediaType()))
        .build()

    override fun call() = throw UnsupportedOperationException()
    override fun connectTimeoutMillis(): Int = 1_000
    override fun connection() = null
    override fun readTimeoutMillis(): Int = 1_000
    override fun withConnectTimeout(timeout: Int, unit: java.util.concurrent.TimeUnit) = this
    override fun withReadTimeout(timeout: Int, unit: java.util.concurrent.TimeUnit) = this
    override fun withWriteTimeout(timeout: Int, unit: java.util.concurrent.TimeUnit) = this
    override fun writeTimeoutMillis(): Int = 1_000
  }
}
