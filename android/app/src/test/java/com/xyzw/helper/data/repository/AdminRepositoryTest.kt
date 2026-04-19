package com.xyzw.helper.data.repository

import com.xyzw.helper.data.model.AuthUser
import com.xyzw.helper.data.network.AdminApi
import com.xyzw.helper.data.network.ApiResult
import com.xyzw.helper.data.network.ApiResultParser
import com.xyzw.helper.data.network.NetworkFactory
import com.xyzw.helper.data.session.InMemoryCookieStore
import com.xyzw.helper.data.session.SecureCookieJar
import com.xyzw.helper.data.session.SessionManager
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

class AdminRepositoryTest {
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
  fun `list users success returns admin users`() = runBlocking {
    server.dispatcher = object : okhttp3.mockwebserver.Dispatcher() {
      override fun dispatch(request: RecordedRequest): MockResponse =
        when (request.path) {
          "/api/v1/admin/users" -> jsonResponse(
            200,
            """
            {"success":true,"data":[{"id":"u-1","username":"alice","email":"a@example.com","isAdmin":true,"accessScope":"full","mfaEnabled":true,"tokenBindLimit":12,"roleCount":3,"inviteCount":2,"refreshSecondVerifyEnabled":true,"createdAt":"2026-04-18T12:00:00Z","lastLoginAt":"2026-04-18T12:10:00Z","isCurrentUser":true}]}
            """.trimIndent(),
          )

          else -> MockResponse().setResponseCode(404)
        }
    }

    val harness = createHarness(server.url("/api/v1/"))
    val result = harness.repository.listUsers()

    assertTrue(result is ApiResult.Success<*>)
    result as ApiResult.Success<List<com.xyzw.helper.data.model.AdminUserItem>>
    assertEquals(1, result.data.size)
    assertEquals("alice", result.data.first().username)
    assertEquals(true, result.data.first().isAdmin)
  }

  @Test
  fun `403 admin failures map to permission or confirmation message`() = runBlocking {
    server.dispatcher = object : okhttp3.mockwebserver.Dispatcher() {
      override fun dispatch(request: RecordedRequest): MockResponse =
        when (request.path) {
          "/api/v1/admin/users" -> jsonResponse(
            403,
            """
            {"success":false,"message":"高危操作需要二次确认，请先验证当前密码","error":{"code":"ADMIN_CONFIRM_REQUIRED","message":"高危操作需要二次确认，请先验证当前密码"}}
            """.trimIndent(),
          )

          else -> MockResponse().setResponseCode(404)
        }
    }

    val harness = createHarness(server.url("/api/v1/"))
    val result = harness.repository.listUsers()

    assertTrue(result is ApiResult.Failure)
    result as ApiResult.Failure
    assertEquals(403, result.error.httpStatus)
    assertEquals("权限不足或需要管理员确认", result.error.message)
  }

  @Test
  fun `401 admin request refreshes and retries successfully`() = runBlocking {
    var usersAttempt = 0
    server.dispatcher = object : okhttp3.mockwebserver.Dispatcher() {
      override fun dispatch(request: RecordedRequest): MockResponse =
        when (request.path) {
          "/api/v1/admin/users" -> {
            usersAttempt += 1
            if (usersAttempt == 1) {
              jsonResponse(
                401,
                """
                {"success":false,"message":"登录状态无效或已过期","error":{"code":"AUTH_INVALID_TOKEN","message":"登录状态无效或已过期"}}
                """.trimIndent(),
              )
            } else {
              jsonResponse(
                200,
                """
                {"success":true,"data":[{"id":"u-2","username":"bob","isAdmin":false,"accessScope":"task_control_only","tokenBindLimit":1,"roleCount":0,"inviteCount":0,"refreshSecondVerifyEnabled":true,"createdAt":"2026-04-18T12:00:00Z","lastLoginAt":null,"isCurrentUser":false}]}
                """.trimIndent(),
              )
            }
          }

          "/api/v1/auth/refresh" -> jsonResponse(
            200,
            """
            {"success":true,"data":{"token":"refreshed"}}
            """.trimIndent(),
            cookies = listOf(
              "xyzw_access_token=access-2; Path=/; HttpOnly",
            ),
          )

          else -> MockResponse().setResponseCode(404)
        }
    }

    val harness = createHarness(server.url("/api/v1/"))
    harness.cookieJar.seed(
      server.url("/"),
      listOf(
        testCookie(server.url("/"), "xyzw_access_token", "access-1", "/"),
        testCookie(server.url("/"), "xyzw_refresh_token", "refresh-1", "/api/v1/auth"),
        testCookie(server.url("/"), "xyzw_csrf_token", "csrf-1", "/"),
      ),
    )
    harness.sessionManager.setAuthenticated(AuthUser(id = "admin-1", username = "admin", isAdmin = true))

    val result = harness.repository.listUsers()

    assertTrue(result is ApiResult.Success<*>)
    result as ApiResult.Success<List<com.xyzw.helper.data.model.AdminUserItem>>
    assertEquals(1, result.data.size)
    assertEquals("/api/v1/admin/users", server.takeRequest().path)
    assertEquals("/api/v1/auth/refresh", server.takeRequest().path)
    assertEquals("/api/v1/admin/users", server.takeRequest().path)
  }

  @Test
  fun `confirm sensitive action failure preserves failure semantics`() = runBlocking {
    server.dispatcher = object : okhttp3.mockwebserver.Dispatcher() {
      override fun dispatch(request: RecordedRequest): MockResponse =
        when (request.path) {
          "/api/v1/admin/confirm-password" -> jsonResponse(
            400,
            """
            {"success":false,"message":"二次确认失败，请检查凭证后重试","error":{"code":"ADMIN_CONFIRM_FAILED","message":"二次确认失败，请检查凭证后重试"}}
            """.trimIndent(),
          )

          else -> MockResponse().setResponseCode(404)
        }
    }

    val harness = createHarness(server.url("/api/v1/"))
    val result = harness.repository.confirmSensitiveAction(password = "wrong-password")

    assertTrue(result is ApiResult.Failure)
    result as ApiResult.Failure
    assertEquals(400, result.error.httpStatus)
    assertEquals("二次确认失败，请检查凭证后重试", result.error.message)
  }

  @Test
  fun `sensitive admin actions attach cached admin confirm token`() = runBlocking {
    server.dispatcher = object : okhttp3.mockwebserver.Dispatcher() {
      override fun dispatch(request: RecordedRequest): MockResponse =
        when (request.path) {
          "/api/v1/admin/confirm-password" -> jsonResponse(
            200,
            """
            {"success":true,"data":{"token":"admin-confirm-1","expiresAt":"2099-01-01T00:00:00Z"}}
            """.trimIndent(),
          )

          "/api/v1/admin/users/u-1/admin" -> {
            assertEquals("admin-confirm-1", request.getHeader("X-Admin-Confirm-Token"))
            jsonResponse(
              200,
              """
              {"success":true,"message":"已授予管理员权限"}
              """.trimIndent(),
            )
          }

          else -> MockResponse().setResponseCode(404)
        }
    }

    val harness = createHarness(server.url("/api/v1/"))
    val confirm = harness.repository.confirmSensitiveAction(password = "admin-password")
    assertTrue(confirm is ApiResult.Success<*>)

    val result = harness.repository.updateUserAdmin(id = "u-1", isAdmin = true)

    assertTrue(result is ApiResult.Success<*>)
    assertEquals("admin-confirm-1", harness.repository.cachedConfirmToken()?.token)
  }

  @Test
  fun `reveal invite 410 keeps one time display message`() = runBlocking {
    server.dispatcher = object : okhttp3.mockwebserver.Dispatcher() {
      override fun dispatch(request: RecordedRequest): MockResponse =
        when (request.path) {
          "/api/v1/admin/confirm-password" -> jsonResponse(
            200,
            """{"success":true,"data":{"token":"admin-confirm-1","expiresAt":"2099-01-01T00:00:00Z"}}""",
          )

          "/api/v1/admin/invite-codes/invite-1/reveal" -> {
            assertEquals("admin-confirm-1", request.getHeader("X-Admin-Confirm-Token"))
            jsonResponse(
              410,
              """{"success":false,"message":"邀请码明码仅在创建时返回，创建后不可再次查看"}""",
            )
          }

          else -> MockResponse().setResponseCode(404)
        }
    }

    val harness = createHarness(server.url("/api/v1/"))
    assertTrue(harness.repository.confirmSensitiveAction(password = "admin-password") is ApiResult.Success<*>)

    val result = harness.repository.revealInviteCode("invite-1")

    assertTrue(result is ApiResult.Failure)
    result as ApiResult.Failure
    assertEquals(410, result.error.httpStatus)
    assertEquals("邀请码明码仅在创建时返回，创建后不可再次查看", result.error.message)
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
    val adminApi = retrofit.create(AdminApi::class.java)
    val repository = AdminRepository(
      api = adminApi,
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
    val repository: AdminRepository,
    val sessionManager: SessionManager,
    val cookieJar: SecureCookieJar,
  )
}
