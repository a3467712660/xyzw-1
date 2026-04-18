package com.xyzw.helper.data.repository

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import com.xyzw.helper.data.network.ApiResult
import com.xyzw.helper.data.network.ApiResultParser
import com.xyzw.helper.data.network.TokenManagementApi
import com.xyzw.helper.data.session.UserSensitiveActionSession
import com.xyzw.helper.data.storage.SecureTokenWorkspaceStore
import kotlinx.coroutines.runBlocking
import okhttp3.mockwebserver.Dispatcher
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import okhttp3.mockwebserver.RecordedRequest
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import retrofit2.create

@RunWith(RobolectricTestRunner::class)
class TokenManagementRepositoryTest {
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
  fun `proxy import extracts complete token payload`() = runBlocking {
    server.dispatcher = object : Dispatcher() {
      override fun dispatch(request: RecordedRequest): MockResponse =
        when (request.path) {
          "/api/v1/token-import/proxy" -> {
            assertEquals("POST", request.method)
            jsonResponse(
              200,
              """{"success":true,"data":{"token":"{\"roleId\":\"role-1\",\"name\":\"Alice\",\"region\":\"一区\",\"sessId\":\"sess-1\"}"}}""",
            )
          }
          else -> MockResponse().setResponseCode(404)
        }
    }

    val context = ApplicationProvider.getApplicationContext<Context>()
    val preferences = context.getSharedPreferences("tm_repo_test", Context.MODE_PRIVATE).apply {
      edit().clear().commit()
    }
    val harness = createRepositoryHarness(server.url("/api/v1/"))
    val api = harness.retrofit.create<TokenManagementApi>()
    val repository = TokenManagementRepository(
      api = api,
      parser = ApiResultParser(),
      store = SecureTokenWorkspaceStore(context, preferences),
      sensitiveActionSession = UserSensitiveActionSession(),
    )

    val result = repository.proxyImport("https://trusted.example.com/token.json")

    assertTrue(result is ApiResult.Success<*>)
    result as ApiResult.Success
    assertEquals(1, result.data.size)
  }

  @Test
  fun `download ticket uses in memory confirm token and returns bytes`() = runBlocking {
    server.dispatcher = object : Dispatcher() {
      override fun dispatch(request: RecordedRequest): MockResponse =
        when (request.path) {
          "/api/v1/bin-files/token-1/download-ticket" -> {
            assertEquals("user-confirm-1", request.getHeader("x-user-confirm-token"))
            jsonResponse(
              200,
              """{"success":true,"data":{"ticket":"ticket-1","expiresAt":"2099-01-01T00:00:00Z","tokenId":"token-1"}}""",
            )
          }
          "/api/v1/bin-files/token-1/download" -> {
            assertEquals("POST", request.method)
            binaryResponse(byteArrayOf(1, 2, 3, 4))
          }
          else -> MockResponse().setResponseCode(404)
        }
    }

    val context = ApplicationProvider.getApplicationContext<Context>()
    val preferences = context.getSharedPreferences("tm_repo_test_2", Context.MODE_PRIVATE).apply {
      edit().clear().commit()
    }
    val sensitiveActionSession = UserSensitiveActionSession().apply {
      store("user-confirm-1", "2099-01-01T00:00:00Z")
    }
    val harness = createRepositoryHarness(server.url("/api/v1/"))
    val api = harness.retrofit.create<TokenManagementApi>()
    val repository = TokenManagementRepository(
      api = api,
      parser = ApiResultParser(),
      store = SecureTokenWorkspaceStore(context, preferences),
      sensitiveActionSession = sensitiveActionSession,
    )

    val ticketResult = repository.createDownloadTicket("token-1")
    assertTrue(ticketResult is ApiResult.Success<*>)

    val downloadResult = repository.downloadBinFile("token-1", "ticket-1")
    assertTrue(downloadResult is ApiResult.Success<*>)
    downloadResult as ApiResult.Success
    assertEquals(4, downloadResult.data.size)
  }
}
