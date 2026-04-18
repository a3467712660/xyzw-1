package com.xyzw.helper.data.repository

import com.xyzw.helper.data.network.ApiResult
import com.xyzw.helper.data.network.ApiResultParser
import com.xyzw.helper.data.network.FeedbackApi
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
import retrofit2.create

class AdminFeedbackRepositoryTest {
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
  fun `admin update ticket parses updated response`() = runBlocking {
    server.dispatcher = object : Dispatcher() {
      override fun dispatch(request: RecordedRequest): MockResponse =
        when (request.path) {
          "/api/v1/feedbacks/fb-1" -> {
            assertEquals("PATCH", request.method)
            jsonResponse(
              200,
              """{"success":true,"data":{"id":"fb-1","type":"bug","title":"标题","content":"内容","status":"resolved","username":"alice","adminNote":"done","createdAt":"2026-04-19T00:00:00Z","updatedAt":"2026-04-19T00:01:00Z"}}""",
            )
          }
          else -> MockResponse().setResponseCode(404)
        }
    }

    val harness = createRepositoryHarness(server.url("/api/v1/"))
    val api = harness.retrofit.create<FeedbackApi>()
    val repository = AdminFeedbackRepository(api, ApiResultParser())
    val result = repository.updateTicket("fb-1", "resolved", "done")

    assertTrue(result is ApiResult.Success<*>)
    result as ApiResult.Success
    assertEquals("resolved", result.data.status)
  }
}
