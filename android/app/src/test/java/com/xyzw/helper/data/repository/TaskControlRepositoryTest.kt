package com.xyzw.helper.data.repository

import com.xyzw.helper.data.network.ApiResult
import com.xyzw.helper.data.network.ApiResultParser
import com.xyzw.helper.data.network.TaskControlApi
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

class TaskControlRepositoryTest {
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
  fun `get state and logs parse`() = runBlocking {
    server.dispatcher = object : Dispatcher() {
      override fun dispatch(request: RecordedRequest): MockResponse =
        when (request.path) {
          "/api/v1/task-control/state" -> jsonResponse(
            200,
            """{"success":true,"data":{"tasks":[{"id":"daily","enabled":true,"cronExpr":"0 6 * * *","tokenIds":["token-1"],"tokenNameMap":{"token-1":"Alice"},"tokenRoleIdMap":{"token-1":"role-1"},"lastRunAt":"","quietDeferredAt":"","quietDeferredReason":"","wsUrl":""}],"updatedAt":"2026-04-19T00:00:00Z"}}""",
          )
          "/api/v1/task-control/logs?limit=100" -> jsonResponse(
            200,
            """{"success":true,"data":[{"id":"log-1","taskId":"daily","taskName":"日常","status":"info","message":"ok","createdAt":"2026-04-19T00:00:00Z"}]}""",
          )
          else -> MockResponse().setResponseCode(404)
        }
    }

    val harness = createRepositoryHarness(server.url("/api/v1/"))
    val api = harness.retrofit.create<TaskControlApi>()
    val repository = TaskControlRepository(api, ApiResultParser())

    assertTrue(repository.getState() is ApiResult.Success<*>)
    assertTrue(repository.getLogs() is ApiResult.Success<*>)
  }

  @Test
  fun `clear logs hits delete endpoint`() = runBlocking {
    server.dispatcher = object : Dispatcher() {
      override fun dispatch(request: RecordedRequest): MockResponse =
        when (request.path) {
          "/api/v1/task-control/logs" -> {
            assertEquals("DELETE", request.method)
            jsonResponse(200, """{"success":true,"message":"cleared"}""")
          }
          else -> MockResponse().setResponseCode(404)
        }
    }

    val harness = createRepositoryHarness(server.url("/api/v1/"))
    val api = harness.retrofit.create<TaskControlApi>()
    val repository = TaskControlRepository(api, ApiResultParser())

    assertTrue(repository.clearLogs() is ApiResult.Success<*>)
  }
}
