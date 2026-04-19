package com.xyzw.helper.data.repository

import com.xyzw.helper.data.network.ApiResult
import com.xyzw.helper.data.network.ApiResultParser
import com.xyzw.helper.data.network.DailyTaskApi
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

class DailyTaskRepositoryTest {
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
  fun `list status and history parse successfully`() = runBlocking {
    server.dispatcher = object : Dispatcher() {
      override fun dispatch(request: RecordedRequest): MockResponse =
        when (request.path) {
          "/api/v1/daily-tasks?roleId=role-1" -> jsonResponse(
            200,
            """
            {"success":true,"data":[{"id":"task-1","title":"每日签到","subtitle":"获取奖励","completed":false,"canExecute":true,"progress":{"current":0,"total":1},"settings":{"autoExecute":false,"delay":0,"notification":true,"enabled":true,"cronExpr":"0 6 * * *"},"details":[],"logs":[]}]}
            """.trimIndent(),
          )
          "/api/v1/daily-tasks/status?roleId=role-1" -> jsonResponse(
            200,
            """{"success":true,"data":{"total":1,"completed":0,"percentage":0}}""",
          )
          "/api/v1/daily-tasks/history?roleId=role-1&page=1&limit=20" -> jsonResponse(
            200,
            """{"success":true,"data":[{"id":"run-1","status":"success","message":"ok","runAt":"2026-04-19T00:00:00Z","source":"manual","title":"每日签到","taskKey":"daily_signin"}]}""",
          )
          else -> MockResponse().setResponseCode(404)
        }
    }

    val harness = createRepositoryHarness(server.url("/api/v1/"))
    val api = harness.retrofit.create<DailyTaskApi>()
    val repository = DailyTaskRepository(api, ApiResultParser())

    assertTrue(repository.listTasks("role-1") is ApiResult.Success<*>)
    assertTrue(repository.getStatus("role-1") is ApiResult.Success<*>)
    assertTrue(repository.getHistory("role-1") is ApiResult.Success<*>)
  }

  @Test
  fun `complete task posts role id`() = runBlocking {
    server.dispatcher = object : Dispatcher() {
      override fun dispatch(request: RecordedRequest): MockResponse =
        when (request.path) {
          "/api/v1/daily-tasks/task-1/complete" -> {
            assertEquals("POST", request.method)
            assertTrue(request.body.readUtf8().contains("role-1"))
            jsonResponse(200, """{"success":true,"message":"ok"}""")
          }
          else -> MockResponse().setResponseCode(404)
        }
    }

    val harness = createRepositoryHarness(server.url("/api/v1/"))
    val api = harness.retrofit.create<DailyTaskApi>()
    val repository = DailyTaskRepository(api, ApiResultParser())

    assertTrue(repository.completeTask("task-1", "role-1") is ApiResult.Success<*>)
  }

  @Test
  fun `update task sends delay cron and notification fields`() = runBlocking {
    server.dispatcher = object : Dispatcher() {
      override fun dispatch(request: RecordedRequest): MockResponse =
        when (request.path) {
          "/api/v1/daily-tasks/task-1" -> {
            assertEquals("PUT", request.method)
            val body = request.body.readUtf8()
            assertTrue(body.contains("\"roleId\":\"role-1\""))
            assertTrue(body.contains("\"delay\":30"))
            assertTrue(body.contains("\"notification\":false"))
            assertTrue(body.contains("\"cronExpr\":\"*/10 * * * *\""))
            jsonResponse(200, """{"success":true,"message":"saved"}""")
          }
          else -> MockResponse().setResponseCode(404)
        }
    }

    val harness = createRepositoryHarness(server.url("/api/v1/"))
    val repository = DailyTaskRepository(harness.retrofit.create(), ApiResultParser())

    assertTrue(
      repository.updateTask(
        taskId = "task-1",
        roleId = "role-1",
        enabled = true,
        autoExecute = true,
        delay = 30,
        notification = false,
        cronExpr = "*/10 * * * *",
      ) is ApiResult.Success<*>,
    )
  }
}
