package com.xyzw.helper.data.repository

import com.xyzw.helper.data.network.ApiResult
import com.xyzw.helper.data.network.ApiResultParser
import com.xyzw.helper.data.network.GameFeatureApi
import com.xyzw.helper.data.model.LegionWarLegion
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

  @Test
  fun `workbench catalog section action and replay render parse successfully`() = runBlocking {
    server.dispatcher = object : Dispatcher() {
      override fun dispatch(request: RecordedRequest): MockResponse =
        when (request.path) {
          "/api/v1/game-features/workbench/catalog" -> jsonResponse(
            200,
            """{"success":true,"data":{"groups":[{"id":"operations","label":"运营","caption":"日常和工具"}],"modules":[{"id":"daily","label":"日常","groupId":"operations","description":"日常模块","defaultSectionId":"daily","sections":[{"id":"daily","label":"日常","description":"日常任务"}]}],"defaultModuleId":"daily","defaultSectionId":"daily"}}""",
          )
          "/api/v1/game-features/token-1/workbench/bootstrap" -> jsonResponse(
            200,
            """{"success":true,"data":{"tokenId":"token-1","roleName":"Alice","serverName":"一区","binAvailable":true,"connectionStatus":"ready","selectedModuleId":"daily","selectedSectionId":"daily","recommendation":"可以执行游戏功能","groups":[],"modules":[]}}""",
          )
          "/api/v1/game-features/token-1/workbench/section" -> {
            assertTrue(request.body.readUtf8().contains("\"sectionId\":\"daily\""))
            jsonResponse(
              200,
              """{"success":true,"data":{"tokenId":"token-1","moduleId":"daily","sectionId":"daily","title":"日常","subtitle":"日常任务","status":"ready","cards":[{"id":"daily-task-status","type":"task","title":"日常任务","subtitle":"领取奖励","status":"ready","tone":"success","iconKey":"task","metrics":[{"label":"进度","value":"3/5","tone":"neutral"}],"actions":[{"id":"daily-tasks","label":"领取奖励","enabled":true}],"detail":{"safe":true}}],"updatedAt":"2026-04-19T00:00:00Z"}}""",
            )
          }
          "/api/v1/game-features/token-1/workbench/action" -> {
            val body = request.body.readUtf8()
            assertTrue(body.contains("\"actionId\":\"daily-tasks\""))
            jsonResponse(
              200,
              """{"success":true,"message":"游戏工作台动作已执行","data":{"actionId":"daily-tasks","status":"success","message":"已执行","sectionId":"daily","cardId":"daily-task-status","card":{"id":"daily-task-status","title":"日常任务"}}}""",
            )
          }
          "/api/v1/game-features/token-1/workbench/replay-render" -> jsonResponse(
            200,
            """{"success":true,"data":{"renderId":"render-1","imageUrl":"/api/v1/game-features/rendered-replays/render-1/image","summary":"胜利","diagnostics":{"renderer":"fake"},"expiresAt":"2099-01-01T00:00:00Z"}}""",
          )
          "/api/v1/game-features/rendered-replays/render-1/image" -> MockResponse()
            .setResponseCode(200)
            .setHeader("Content-Type", "image/svg+xml")
            .setBody("<svg></svg>")
          else -> MockResponse().setResponseCode(404)
        }
    }

    val harness = createRepositoryHarness(server.url("/api/v1/"))
    val repository = GameFeatureRepository(harness.retrofit.create(), ApiResultParser())

    val catalog = repository.getWorkbenchCatalog()
    val bootstrap = repository.getWorkbenchBootstrap("token-1")
    val section = repository.getWorkbenchSection("token-1", "daily")
    val action = repository.runWorkbenchAction("token-1", "daily", "daily-task-status", "daily-tasks")
    val replay = repository.renderWorkbenchReplay("token-1", mapOf("shape" to "fight-pvp"))

    assertTrue(catalog is ApiResult.Success<*>)
    assertTrue(bootstrap is ApiResult.Success<*>)
    assertTrue(section is ApiResult.Success<*>)
    assertTrue(action is ApiResult.Success<*>)
    assertTrue(replay is ApiResult.Success<*>)
    replay as ApiResult.Success
    val image = repository.downloadRenderedReplayImage(replay.data.imageUrl)
    assertTrue(image is ApiResult.Success<*>)
    image as ApiResult.Success<ByteArray>
    assertEquals("<svg></svg>", image.data.decodeToString())
    section as ApiResult.Success
    assertEquals("daily-task-status", section.data.cards.single().id)
  }

  @Test
  fun `legion war revive broadcast posts sanitized legion summary`() = runBlocking {
    server.dispatcher = object : Dispatcher() {
      override fun dispatch(request: RecordedRequest): MockResponse =
        when (request.path) {
          "/api/v1/game-features/token-1/legion-war/broadcast-revive" -> {
            assertEquals("POST", request.method)
            val body = request.body.readUtf8()
            assertTrue(body.contains("\"name\":\"一队\""))
            assertTrue(body.contains("\"reviveLeft\":140"))
            assertEquals(false, body.contains("rawToken"))
            jsonResponse(
              200,
              """{"success":true,"message":"免费复活信息已发送到战队频道","data":{"status":"success","sentCount":1,"messages":["一队:剩140"]}}""",
            )
          }
          else -> MockResponse().setResponseCode(404)
        }
    }

    val harness = createRepositoryHarness(server.url("/api/v1/"))
    val repository = GameFeatureRepository(harness.retrofit.create(), ApiResultParser())

    val result = repository.broadcastLegionWarReviveInfo(
      "token-1",
      listOf(LegionWarLegion(id = "l-1", name = "一队", reviveLeft = 140)),
    )

    assertTrue(result is ApiResult.Success<*>)
    result as ApiResult.Success
    assertEquals(1, result.data.sentCount)
  }
}
