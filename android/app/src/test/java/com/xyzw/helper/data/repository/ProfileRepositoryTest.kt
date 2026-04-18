package com.xyzw.helper.data.repository

import com.xyzw.helper.data.network.ApiResult
import com.xyzw.helper.data.network.ApiResultParser
import com.xyzw.helper.data.network.UserApi
import com.xyzw.helper.data.session.UserSensitiveActionSession
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.JsonPrimitive
import okhttp3.mockwebserver.Dispatcher
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import okhttp3.mockwebserver.RecordedRequest
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import retrofit2.create

class ProfileRepositoryTest {
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
  fun `confirm sensitive action caches token and sends header for preference`() = runBlocking {
    server.dispatcher = object : Dispatcher() {
      override fun dispatch(request: RecordedRequest): MockResponse =
        when (request.path) {
          "/api/v1/user/confirm-password" -> jsonResponse(
            200,
            """{"success":true,"data":{"token":"user-confirm-1","expiresAt":"2099-01-01T00:00:00Z"}}""",
          )
          "/api/v1/user/preferences/security.remote_bin_download_enabled" -> {
            assertEquals("user-confirm-1", request.getHeader("x-user-confirm-token"))
            jsonResponse(
              200,
              """{"success":true,"data":{"key":"security.remote_bin_download_enabled","value":true,"expiresAt":"2099-01-01T00:00:00Z","updatedAt":"2026-04-19T00:00:00Z"}}""",
            )
          }
          else -> MockResponse().setResponseCode(404)
        }
    }

    val harness = createRepositoryHarness(server.url("/api/v1/"))
    val api = harness.retrofit.create<UserApi>()
    val repository = ProfileRepository(api, ApiResultParser(), UserSensitiveActionSession())

    assertTrue(repository.confirmSensitiveAction(password = "secret") is ApiResult.Success<*>)
    assertTrue(
      repository.setPreference("security.remote_bin_download_enabled", JsonPrimitive(true)) is ApiResult.Success<*>,
    )
  }
}
