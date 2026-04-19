package com.xyzw.helper.data.repository

import com.xyzw.helper.data.network.ApiResult
import com.xyzw.helper.data.network.ApiResultParser
import com.xyzw.helper.data.network.GameFeatureApi
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

class GameFeatureRepositoryTest {
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
  fun `catalog summary and action parse successfully without exposing token body`() = runBlocking {
    server.dispatcher = object : Dispatcher() {
      override fun dispatch(request: RecordedRequest): MockResponse =
        when (request.path) {
          "/api/v1/game-features/catalog" -> jsonResponse(
            200,
            """{"success":true,"data":{"features":[{"id":"daily-tasks","title":"日常任务","description":"领取奖励","enabled":true}],"legionWar":{"enabled":true},"lineupAssistant":{"enabled":true}}}""",
          )
          "/api/v1/game-features/token-1/summary" -> {
            assertEquals("POST", request.method)
            jsonResponse(
              200,
              """{"success":true,"data":{"tokenId":"token-1","roleName":"Alice","serverName":"一区","binAvailable":true,"connectionStatus":"ready","recommendedAction":"可执行游戏功能"}}""",
            )
          }
          "/api/v1/game-features/token-1/action" -> {
            assertEquals("POST", request.method)
            val body = request.body.readUtf8()
            assertTrue(body.contains("\"actionId\":\"daily-tasks\""))
            assertEquals(false, body.contains("rawToken"))
            jsonResponse(
              200,
              """{"success":true,"data":{"actionId":"daily-tasks","status":"success","message":"已发送"}}""",
            )
          }
          else -> MockResponse().setResponseCode(404)
        }
    }

    val harness = createRepositoryHarness(server.url("/api/v1/"))
    val repository = GameFeatureRepository(
      api = harness.retrofit.create<GameFeatureApi>(),
      parser = ApiResultParser(),
    )

    assertTrue(repository.getCatalog() is ApiResult.Success<*>)
    assertTrue(repository.getSummary("token-1") is ApiResult.Success<*>)
    assertTrue(repository.runAction("token-1", "daily-tasks") is ApiResult.Success<*>)
  }

  @Test
  fun `lineup save and apply errors are surfaced`() = runBlocking {
    server.dispatcher = object : Dispatcher() {
      override fun dispatch(request: RecordedRequest): MockResponse =
        when (request.path) {
          "/api/v1/game-features/token-1/lineups" -> when (request.method) {
            "GET" -> jsonResponse(
              200,
              """{"success":true,"data":{"currentFormation":1,"saved":[{"id":"lineup-1","name":"一队","teamId":1,"slots":[]}]}}""",
            )
            "PUT" -> jsonResponse(
              400,
              """{"success":false,"message":"阵容格式无效"}""",
            )
            else -> MockResponse().setResponseCode(405)
          }
          "/api/v1/game-features/token-1/lineups/apply" -> jsonResponse(
            404,
            """{"success":false,"message":"未找到阵容"}""",
          )
          else -> MockResponse().setResponseCode(404)
        }
    }

    val harness = createRepositoryHarness(server.url("/api/v1/"))
    val repository = GameFeatureRepository(harness.retrofit.create(), ApiResultParser())

    assertTrue(repository.getLineups("token-1") is ApiResult.Success<*>)
    assertTrue(repository.saveLineups("token-1", emptyList()) is ApiResult.Failure)
    assertTrue(repository.applyLineup("token-1", "missing") is ApiResult.Failure)
  }
}
