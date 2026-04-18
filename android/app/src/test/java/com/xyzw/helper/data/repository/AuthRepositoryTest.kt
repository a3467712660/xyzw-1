package com.xyzw.helper.data.repository

import com.xyzw.helper.data.model.AuthUser
import com.xyzw.helper.data.network.ApiEnvelope
import com.xyzw.helper.data.network.ApiResult
import com.xyzw.helper.data.network.ApiResultParser
import com.xyzw.helper.data.network.AuthApi
import com.xyzw.helper.data.network.AuthBootstrapHelper
import com.xyzw.helper.data.network.NetworkFactory
import com.xyzw.helper.data.session.InMemoryCookieStore
import com.xyzw.helper.data.session.SecureCookieJar
import com.xyzw.helper.data.session.SessionManager
import com.xyzw.helper.data.session.SessionState
import kotlinx.coroutines.runBlocking
import okhttp3.Dispatcher
import okhttp3.HttpUrl
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import okhttp3.mockwebserver.RecordedRequest
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import retrofit2.Retrofit

class AuthRepositoryTest {
  private lateinit var server: MockWebServer

  @Before
  fun setUp() {
    server = MockWebServer()
    server.start()
  }

  @After
  fun tearDown() {
    server.shutdown()
  }

  @Test
  fun `login success hydrates current user`() = runBlocking {
    server.dispatcher = object : okhttp3.mockwebserver.Dispatcher() {
      override fun dispatch(request: RecordedRequest): MockResponse =
        when (request.path) {
          "/api/v1/auth/csrf" -> jsonResponse(
            200,
            """
            {"success":true,"data":{"headerName":"x-csrf-token","token":"csrf-1","hasRefreshTokenCookie":false}}
            """.trimIndent(),
            cookies = listOf(
              "xyzw_csrf_session=csrf-session-1; Path=/; HttpOnly",
              "xyzw_csrf_token=csrf-1; Path=/",
            ),
          )

          "/api/v1/auth/login" -> {
            assertEquals("csrf-1", request.getHeader("X-CSRF-Token"))
            jsonResponse(
              200,
              """
              {"success":true,"message":"登录成功","data":{"user":{"id":"u-1","username":"alice"}}}
              """.trimIndent(),
              cookies = listOf(
                "xyzw_access_token=access-1; Path=/; HttpOnly",
                "xyzw_refresh_token=refresh-1; Path=/api/v1/auth; HttpOnly",
              ),
            )
          }

          "/api/v1/auth/me" -> jsonResponse(
            200,
            """
            {"success":true,"data":{"id":"u-1","username":"alice","isAdmin":false,"mfaEnabled":true}}
            """.trimIndent(),
          )

          else -> MockResponse().setResponseCode(404)
        }
    }

    val harness = createHarness(server.url("/api/v1/"))

    val result = harness.repository.login(
      username = "alice",
      password = "secret",
      rememberMe = true,
    )

    assertTrue(result is LoginResult.Authenticated)
    result as LoginResult.Authenticated
    assertEquals("alice", result.user.username)
    assertTrue(harness.sessionManager.state.value is SessionState.Authenticated)
    assertEquals("/api/v1/auth/csrf", server.takeRequest().path)
    assertEquals("/api/v1/auth/login", server.takeRequest().path)
    assertEquals("/api/v1/auth/me", server.takeRequest().path)
  }

  @Test
  fun `login mfa required keeps session unauthenticated`() = runBlocking {
    server.dispatcher = object : okhttp3.mockwebserver.Dispatcher() {
      override fun dispatch(request: RecordedRequest): MockResponse =
        when (request.path) {
          "/api/v1/auth/csrf" -> jsonResponse(
            200,
            """
            {"success":true,"data":{"headerName":"x-csrf-token","token":"csrf-2","hasRefreshTokenCookie":false}}
            """.trimIndent(),
            cookies = listOf(
              "xyzw_csrf_session=csrf-session-2; Path=/; HttpOnly",
              "xyzw_csrf_token=csrf-2; Path=/",
            ),
          )

          "/api/v1/auth/login" -> jsonResponse(
            200,
            """
            {"success":true,"message":"需要二步验证","data":{"mfaRequired":true,"mfaChallengeToken":"challenge-1"}}
            """.trimIndent(),
          )

          else -> MockResponse().setResponseCode(404)
        }
    }

    val harness = createHarness(server.url("/api/v1/"))

    val result = harness.repository.login(
      username = "alice",
      password = "secret",
      rememberMe = false,
    )

    assertTrue(result is LoginResult.MfaRequired)
    result as LoginResult.MfaRequired
    assertEquals("challenge-1", result.challengeToken)
    assertTrue(harness.sessionManager.state.value is SessionState.Unauthenticated)
    assertEquals("/api/v1/auth/csrf", server.takeRequest().path)
    assertEquals("/api/v1/auth/login", server.takeRequest().path)
  }

  @Test
  fun `refresh failure clears session after unauthorized me request`() = runBlocking {
    server.dispatcher = object : okhttp3.mockwebserver.Dispatcher() {
      override fun dispatch(request: RecordedRequest): MockResponse =
        when (request.path) {
          "/api/v1/auth/me" -> jsonResponse(
            401,
            """
            {"success":false,"message":"登录状态无效或已过期","error":{"code":"AUTH_INVALID_TOKEN","message":"登录状态无效或已过期"}}
            """.trimIndent(),
          )

          "/api/v1/auth/refresh" -> jsonResponse(
            401,
            """
            {"success":false,"message":"刷新令牌无效，请重新登录","error":{"code":"AUTH_REFRESH_INVALID","message":"刷新令牌无效，请重新登录"}}
            """.trimIndent(),
          )

          else -> MockResponse().setResponseCode(404)
        }
    }

    val harness = createHarness(server.url("/api/v1/"))
    harness.cookieJar.seed(
      server.url("/"),
      listOf(
        testCookie(server.url("/"), "xyzw_access_token", "access-2", "/"),
        testCookie(server.url("/"), "xyzw_refresh_token", "refresh-2", "/api/v1/auth"),
        testCookie(server.url("/"), "xyzw_csrf_token", "csrf-3", "/"),
      ),
    )
    harness.sessionManager.setAuthenticated(AuthUser(id = "u-1", username = "alice"))

    val result = harness.repository.fetchCurrentUser()

    assertTrue(result is ApiResult.Failure)
    assertTrue(harness.sessionManager.state.value is SessionState.Unauthenticated)
    assertTrue(harness.cookieJar.loadForRequest(server.url("/")).isEmpty())
    assertEquals("/api/v1/auth/me", server.takeRequest().path)
    assertEquals("/api/v1/auth/refresh", server.takeRequest().path)
  }

  private fun createHarness(baseUrl: HttpUrl): TestHarness {
    val sessionManager = SessionManager()
    val cookieJar = SecureCookieJar(InMemoryCookieStore())
    val refreshClient = NetworkFactory.createRefreshClient(cookieJar)
    val mainClient = NetworkFactory.createMainClient(
      cookieJar = cookieJar,
      sessionManager = sessionManager,
      baseUrl = baseUrl,
      refreshClient = refreshClient,
      dispatcher = Dispatcher(),
    )
    val retrofit = Retrofit.Builder()
      .baseUrl(baseUrl)
      .client(mainClient)
      .addConverterFactory(NetworkFactory.serializationConverter())
      .build()
    val authApi = retrofit.create(AuthApi::class.java)
    val repository = AuthRepository(
      authApi = authApi,
      sessionManager = sessionManager,
      authBootstrapHelper = AuthBootstrapHelper(authApi, ApiResultParser()),
      parser = ApiResultParser(),
    )
    return TestHarness(
      repository = repository,
      sessionManager = sessionManager,
      cookieJar = cookieJar,
    )
  }

  private fun jsonResponse(
    code: Int,
    body: String,
    cookies: List<String> = emptyList(),
  ): MockResponse {
    val response = MockResponse()
      .setResponseCode(code)
      .setHeader("Content-Type", "application/json")
      .setBody(body)
    cookies.forEach { cookie ->
      response.addHeader("Set-Cookie", cookie)
    }
    return response
  }

  private fun testCookie(baseUrl: HttpUrl, name: String, value: String, path: String) =
    okhttp3.Cookie.Builder()
      .name(name)
      .value(value)
      .domain(baseUrl.host)
      .path(path)
      .build()

  private data class TestHarness(
    val repository: AuthRepository,
    val sessionManager: SessionManager,
    val cookieJar: SecureCookieJar,
  )
}
