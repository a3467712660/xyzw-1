package com.xyzw.helper.ui.screens

import android.content.Context
import android.os.Looper
import androidx.test.core.app.ApplicationProvider
import com.xyzw.helper.data.network.ApiResultParser
import com.xyzw.helper.data.network.GameFeatureApi
import com.xyzw.helper.data.network.TokenManagementApi
import com.xyzw.helper.data.repository.GameFeatureRepository
import com.xyzw.helper.data.repository.TokenManagementRepository
import com.xyzw.helper.data.repository.createRepositoryHarness
import com.xyzw.helper.data.repository.jsonResponse
import com.xyzw.helper.data.session.UserSensitiveActionSession
import com.xyzw.helper.data.storage.SecureTokenWorkspaceStore
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
import org.robolectric.Shadows.shadowOf
import retrofit2.create

@RunWith(RobolectricTestRunner::class)
class GameFeaturesViewModelTest {
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
  fun `game features restores remote bin token when local workspace is empty`() {
    server.dispatcher = object : Dispatcher() {
      override fun dispatch(request: RecordedRequest): MockResponse =
        when (request.path) {
          "/api/v1/game-features/catalog" -> jsonResponse(
            200,
            """{"success":true,"data":{"features":[{"id":"daily-tasks","title":"日常任务","enabled":true}],"legionWar":{"enabled":true},"lineupAssistant":{"enabled":true}}}""",
          )
          "/api/v1/bin-files" -> jsonResponse(
            200,
            """{"success":true,"data":[{"tokenId":"token-1","fileName":"token-1.bin","size":4,"createdAt":"2026-04-19T00:00:00Z","updatedAt":"2026-04-19T01:00:00Z"}]}""",
          )
          "/api/v1/token-activations/my" -> jsonResponse(
            200,
            """{"success":true,"data":[{"id":"bind-1","tokenId":"token-1","roleId":"role-1","roleName":"Alice","region":"一区","roleIndex":"1","expiresAt":"2099-01-01T00:00:00Z","boundAt":"2026-04-19T00:00:00Z","active":true}]}""",
          )
          "/api/v1/game-features/token-1/summary" -> jsonResponse(
            200,
            """{"success":true,"data":{"tokenId":"token-1","roleName":"Alice","serverName":"一区","binAvailable":true,"connectionStatus":"ready","recommendedAction":"可执行游戏功能"}}""",
          )
          else -> MockResponse().setResponseCode(404)
        }
    }
    val context = ApplicationProvider.getApplicationContext<Context>()
    val preferences = context.getSharedPreferences("game_features_vm_restore", Context.MODE_PRIVATE).apply {
      edit().clear().commit()
    }
    val harness = createRepositoryHarness(server.url("/api/v1/"))
    val parser = ApiResultParser()
    val tokenRepository = TokenManagementRepository(
      api = harness.retrofit.create<TokenManagementApi>(),
      parser = parser,
      store = SecureTokenWorkspaceStore(context, preferences),
      sensitiveActionSession = UserSensitiveActionSession(),
    )
    val viewModel = GameFeaturesViewModel(
      repository = GameFeatureRepository(harness.retrofit.create<GameFeatureApi>(), parser),
      tokenRepository = tokenRepository,
    )

    val restored = waitUntil { viewModel.uiState.value.tokens.isNotEmpty() }

    assertTrue(restored)
    assertEquals("token-1", viewModel.uiState.value.selectedTokenId)
    assertEquals("Alice", viewModel.uiState.value.tokens.single().displayName)
    assertEquals(true, viewModel.uiState.value.tokens.single().binFilePresent)
  }

  @Test
  fun `game features workbench loads modules section cards actions and replay result`() {
    server.dispatcher = object : Dispatcher() {
      override fun dispatch(request: RecordedRequest): MockResponse =
        when (request.path) {
          "/api/v1/bin-files" -> jsonResponse(200, """{"success":true,"data":[]}""")
          "/api/v1/game-features/workbench/catalog" -> jsonResponse(
            200,
            """{"success":true,"data":{"groups":[{"id":"operations","label":"运营","caption":"日常和工具"}],"modules":[{"id":"daily","label":"日常","groupId":"operations","description":"日常模块","defaultSectionId":"daily","sections":[{"id":"daily","label":"日常","description":"日常任务"}]}],"defaultModuleId":"daily","defaultSectionId":"daily"}}""",
          )
          "/api/v1/game-features/token-1/workbench/bootstrap" -> jsonResponse(
            200,
            """{"success":true,"data":{"tokenId":"token-1","roleName":"Alice","serverName":"一区","binAvailable":true,"connectionStatus":"ready","selectedModuleId":"daily","selectedSectionId":"daily","recommendation":"可以执行游戏功能","groups":[],"modules":[]}}""",
          )
          "/api/v1/game-features/token-1/workbench/section" -> jsonResponse(
            200,
            """{"success":true,"data":{"tokenId":"token-1","moduleId":"daily","sectionId":"daily","title":"日常","subtitle":"日常任务","status":"ready","cards":[{"id":"daily-task-status","type":"task","title":"日常任务","subtitle":"领取奖励","status":"ready","tone":"success","iconKey":"task","metrics":[{"label":"进度","value":"3/5","tone":"neutral"}],"actions":[{"id":"daily-tasks","label":"领取奖励","enabled":true}]}],"updatedAt":"2026-04-19T00:00:00Z"}}""",
          )
          "/api/v1/game-features/token-1/workbench/action" -> jsonResponse(
            200,
            """{"success":true,"message":"游戏工作台动作已执行","data":{"actionId":"daily-tasks","status":"success","message":"已执行","sectionId":"daily","cardId":"daily-task-status"}}""",
          )
          "/api/v1/game-features/token-1/workbench/replay-render" -> jsonResponse(
            200,
            """{"success":true,"data":{"renderId":"render-1","imageUrl":"/api/v1/game-features/rendered-replays/render-1/image","summary":"胜利","diagnostics":{"renderer":"fake"},"expiresAt":"2099-01-01T00:00:00Z"}}""",
          )
          else -> MockResponse().setResponseCode(404)
        }
    }
    val context = ApplicationProvider.getApplicationContext<Context>()
    val preferences = context.getSharedPreferences("game_features_vm_workbench", Context.MODE_PRIVATE).apply {
      edit().clear().commit()
    }
    val harness = createRepositoryHarness(server.url("/api/v1/"))
    val parser = ApiResultParser()
    val tokenRepository = TokenManagementRepository(
      api = harness.retrofit.create<TokenManagementApi>(),
      parser = parser,
      store = SecureTokenWorkspaceStore(context, preferences),
      sensitiveActionSession = UserSensitiveActionSession(),
    )
    tokenRepository.saveImportedToken(
      com.xyzw.helper.data.model.ImportedGameToken(
        id = "token-1",
        rawToken = "",
        displayName = "Alice",
        importedAt = "2026-04-19T00:00:00Z",
        updatedAt = "2026-04-19T00:00:00Z",
        binFilePresent = true,
      ),
    )
    val viewModel = GameFeaturesViewModel(
      repository = GameFeatureRepository(harness.retrofit.create<GameFeatureApi>(), parser),
      tokenRepository = tokenRepository,
    )

    assertTrue(waitUntil { viewModel.uiState.value.workbenchCatalog.modules.isNotEmpty() })
    assertEquals("daily", viewModel.uiState.value.selectedModuleId)
    assertEquals("daily", viewModel.uiState.value.selectedSectionId)
    assertTrue(waitUntil { viewModel.uiState.value.sectionSnapshot?.cards?.isNotEmpty() == true })
    assertEquals("daily-task-status", viewModel.uiState.value.sectionSnapshot!!.cards.single().id)

    viewModel.runWorkbenchAction("daily-task-status", "daily-tasks")
    assertTrue(waitUntil { viewModel.uiState.value.actionMessage == "游戏工作台动作已执行" })

    viewModel.renderReplay("fight-pvp-replay")
    assertTrue(waitUntil { viewModel.uiState.value.renderedReplay?.renderId == "render-1" })
  }

  @Test
  fun `lineup assistant stores apply stages for debug panel`() {
    server.dispatcher = object : Dispatcher() {
      override fun dispatch(request: RecordedRequest): MockResponse =
        when (request.path) {
          "/api/v1/bin-files" -> jsonResponse(200, """{"success":true,"data":[]}""")
          "/api/v1/game-features/token-1/lineups" -> jsonResponse(
            200,
            """{"success":true,"data":{"currentFormation":1,"saved":[{"id":"lineup-1","name":"一队","teamId":1,"slots":[{"position":1,"heroName":"主将"}]}]}}""",
          )
          "/api/v1/game-features/token-1/lineups/apply" -> jsonResponse(
            200,
            """{"success":true,"message":"阵容应用流程已完成","data":{"lineupId":"lineup-1","stages":[{"id":"inspect-current","status":"success","message":"已查看当前阵容"},{"id":"arrange-slots","status":"success","message":"已整理站位"}]}}""",
          )
          else -> MockResponse().setResponseCode(404)
        }
    }
    val context = ApplicationProvider.getApplicationContext<Context>()
    val preferences = context.getSharedPreferences("lineup_assistant_vm_apply", Context.MODE_PRIVATE).apply {
      edit().clear().commit()
    }
    val harness = createRepositoryHarness(server.url("/api/v1/"))
    val parser = ApiResultParser()
    val tokenRepository = TokenManagementRepository(
      api = harness.retrofit.create<TokenManagementApi>(),
      parser = parser,
      store = SecureTokenWorkspaceStore(context, preferences),
      sensitiveActionSession = UserSensitiveActionSession(),
    )
    tokenRepository.saveImportedToken(
      com.xyzw.helper.data.model.ImportedGameToken(
        id = "token-1",
        rawToken = "",
        displayName = "Alice",
        importedAt = "2026-04-19T00:00:00Z",
        updatedAt = "2026-04-19T00:00:00Z",
        binFilePresent = true,
      ),
    )
    val viewModel = LineupAssistantViewModel(
      repository = GameFeatureRepository(harness.retrofit.create<GameFeatureApi>(), parser),
      tokenRepository = tokenRepository,
    )

    viewModel.refresh()
    assertTrue(waitUntil { viewModel.uiState.value.lineups.isNotEmpty() })
    viewModel.apply("lineup-1")

    assertTrue(waitUntil { viewModel.uiState.value.lastApplyResult?.stages?.size == 2 })
    assertEquals("inspect-current", viewModel.uiState.value.lastApplyResult!!.stages.first().id)
    assertEquals("阵容应用流程已完成", viewModel.uiState.value.actionMessage)
  }

  @Test
  fun `legion war view model broadcasts revive summary through repository`() {
    server.dispatcher = object : Dispatcher() {
      override fun dispatch(request: RecordedRequest): MockResponse =
        when (request.path) {
          "/api/v1/bin-files" -> jsonResponse(200, """{"success":true,"data":[]}""")
          "/api/v1/game-features/token-1/legion-war/snapshot" -> jsonResponse(
            200,
            """{"success":true,"data":{"battlefieldId":"bf-1","nodes":[],"legions":[{"id":"l-1","name":"一队","reviveLeft":140}]}}""",
          )
          "/api/v1/game-features/token-1/legion-war/broadcast-revive" -> {
            val body = request.body.readUtf8()
            assertTrue(body.contains("\"name\":\"一队\""))
            jsonResponse(
              200,
              """{"success":true,"message":"免费复活信息已发送到战队频道","data":{"status":"success","sentCount":1,"messages":["一队:剩140"]}}""",
            )
          }
          else -> MockResponse().setResponseCode(404)
        }
    }
    val context = ApplicationProvider.getApplicationContext<Context>()
    val preferences = context.getSharedPreferences("legion_war_vm_broadcast", Context.MODE_PRIVATE).apply {
      edit().clear().commit()
    }
    val harness = createRepositoryHarness(server.url("/api/v1/"))
    val parser = ApiResultParser()
    val tokenRepository = TokenManagementRepository(
      api = harness.retrofit.create<TokenManagementApi>(),
      parser = parser,
      store = SecureTokenWorkspaceStore(context, preferences),
      sensitiveActionSession = UserSensitiveActionSession(),
    )
    tokenRepository.saveImportedToken(
      com.xyzw.helper.data.model.ImportedGameToken(
        id = "token-1",
        rawToken = "",
        displayName = "Alice",
        importedAt = "2026-04-19T00:00:00Z",
        updatedAt = "2026-04-19T00:00:00Z",
        binFilePresent = true,
      ),
    )
    val viewModel = LegionWarViewModel(
      repository = GameFeatureRepository(harness.retrofit.create<GameFeatureApi>(), parser),
      tokenRepository = tokenRepository,
    )

    viewModel.refresh()
    assertTrue(waitUntil { viewModel.uiState.value.snapshot?.legions?.isNotEmpty() == true })
    viewModel.broadcastReviveInfo()

    assertTrue(waitUntil { viewModel.uiState.value.actionMessage == "免费复活信息已发送到战队频道" })
  }

  private fun waitUntil(condition: () -> Boolean): Boolean {
    val deadline = System.currentTimeMillis() + 2_000L
    while (System.currentTimeMillis() < deadline) {
      shadowOf(Looper.getMainLooper()).idle()
      if (condition()) return true
      Thread.sleep(20L)
    }
    shadowOf(Looper.getMainLooper()).idle()
    return condition()
  }
}
