package com.xyzw.helper.ui.screens

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import com.xyzw.helper.data.model.BattleReportCatalog
import com.xyzw.helper.data.model.BattleReportItem
import com.xyzw.helper.data.model.BattleReportType
import com.xyzw.helper.data.model.GameFeatureCatalog
import com.xyzw.helper.data.model.GameFeatureCatalogItem
import com.xyzw.helper.data.model.GameFeatureSummary
import com.xyzw.helper.data.model.GameLineup
import com.xyzw.helper.data.model.GameLineupApplyResult
import com.xyzw.helper.data.model.GameLineupApplyStage
import com.xyzw.helper.data.model.GameLineupSlot
import com.xyzw.helper.data.model.GameWorkbenchCard
import com.xyzw.helper.data.model.GameWorkbenchCardAction
import com.xyzw.helper.data.model.GameWorkbenchCatalog
import com.xyzw.helper.data.model.GameWorkbenchGroup
import com.xyzw.helper.data.model.GameWorkbenchMetric
import com.xyzw.helper.data.model.GameWorkbenchModule
import com.xyzw.helper.data.model.GameWorkbenchSection
import com.xyzw.helper.data.model.GameWorkbenchSectionSnapshot
import com.xyzw.helper.data.model.LegionWarSnapshot
import com.xyzw.helper.data.model.LegionWarNode
import com.xyzw.helper.data.model.RenderedReplayResult
import com.xyzw.helper.ui.theme.XyzwTheme
import com.xyzw.helper.data.storage.ThemeMode
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

@RunWith(RobolectricTestRunner::class)
class GameAndBattleScreensSmokeTest {
  @get:Rule
  val composeRule = createComposeRule()

  @Test
  fun `game hub screen shows native entries`() {
    composeRule.setContent {
      XyzwTheme(themeMode = ThemeMode.LIGHT) {
        GameHubScreen(
          tokenCount = 1,
          onBack = {},
          onOpenGameFeatures = {},
          onOpenLegionWar = {},
          onOpenLineupAssistant = {},
          onOpenBattleReports = {},
        )
      }
    }
    composeRule.onNodeWithText("游戏中心").assertIsDisplayed()
    composeRule.onNodeWithText("游戏功能").performScrollTo().assertIsDisplayed()
  }

  @Test
  fun `game features screen shows summary and actions`() {
    composeRule.setContent {
      XyzwTheme(themeMode = ThemeMode.LIGHT) {
        GameFeaturesScreenContent(
          state = GameFeaturesUiState(
            workbenchCatalog = GameWorkbenchCatalog(
              groups = listOf(GameWorkbenchGroup("operations", "运营", "日常和工具")),
              modules = listOf(
                GameWorkbenchModule(
                  id = "daily",
                  label = "日常",
                  groupId = "operations",
                  description = "日常模块",
                  defaultSectionId = "daily",
                  sections = listOf(GameWorkbenchSection("daily", "日常", "日常任务")),
                ),
              ),
              defaultModuleId = "daily",
              defaultSectionId = "daily",
            ),
            selectedModuleId = "daily",
            selectedSectionId = "daily",
            sectionSnapshot = GameWorkbenchSectionSnapshot(
              tokenId = "token-1",
              moduleId = "daily",
              sectionId = "daily",
              title = "日常",
              cards = listOf(
                GameWorkbenchCard(
                  id = "daily-task-status",
                  type = "task",
                  title = "日常任务",
                  subtitle = "领取奖励",
                  status = "ready",
                  tone = "success",
                  metrics = listOf(GameWorkbenchMetric("进度", "3/5")),
                  actions = listOf(GameWorkbenchCardAction("daily-tasks", "领取奖励")),
                ),
              ),
            ),
            summary = GameFeatureSummary(tokenId = "token-1", roleName = "Alice", binAvailable = true),
            renderedReplay = RenderedReplayResult(
              renderId = "render-1",
              imageUrl = "/api/v1/game-features/rendered-replays/render-1/image",
              summary = "胜利",
            ),
          ),
          onBack = {},
          onRefresh = {},
          onRunAction = {},
          onRunWorkbenchAction = { _, _ -> },
          onRenderReplay = {},
        )
      }
    }
    composeRule.onNodeWithText("游戏功能工作台").performScrollTo().assertIsDisplayed()
    composeRule.onAllNodesWithText("Alice").assertCountEquals(2)
    composeRule.onNodeWithText("模块导航").performScrollTo().assertIsDisplayed()
    composeRule.onNodeWithText("模块详情").performScrollTo().assertIsDisplayed()
    composeRule.onNodeWithText("最近活动").performScrollTo().assertIsDisplayed()
    composeRule.onNodeWithText("权限与连接提示").performScrollTo().assertIsDisplayed()
    composeRule.onNodeWithText("卡片详情").performScrollTo().assertIsDisplayed()
    composeRule.onNodeWithText("回放渲染结果").performScrollTo().assertIsDisplayed()
  }

  @Test
  fun `game features empty catalog does not crash`() {
    composeRule.setContent {
      XyzwTheme(themeMode = ThemeMode.LIGHT) {
        GameFeaturesScreenContent(
          state = GameFeaturesUiState(isLoading = false),
          onBack = {},
          onRefresh = {},
          onRunAction = {},
        )
      }
    }

    composeRule.onNodeWithText("暂无游戏功能").performScrollTo().assertIsDisplayed()
  }

  @Test
  fun `game features module without section does not crash`() {
    composeRule.setContent {
      XyzwTheme(themeMode = ThemeMode.LIGHT) {
        GameFeaturesScreenContent(
          state = GameFeaturesUiState(
            isLoading = false,
            workbenchCatalog = GameWorkbenchCatalog(
              groups = listOf(GameWorkbenchGroup("operations", "运营")),
              modules = listOf(
                GameWorkbenchModule(
                  id = "daily",
                  label = "日常",
                  groupId = "operations",
                  sections = emptyList(),
                ),
              ),
            ),
            selectedModuleId = "daily",
            selectedSectionId = "missing",
          ),
          onBack = {},
          onRefresh = {},
          onRunAction = {},
        )
      }
    }

    composeRule.onNodeWithText("暂无分区数据").performScrollTo().assertIsDisplayed()
  }

  @Test
  fun `game features missing selected module does not crash`() {
    composeRule.setContent {
      XyzwTheme(themeMode = ThemeMode.LIGHT) {
        GameFeaturesScreenContent(
          state = GameFeaturesUiState(
            isLoading = false,
            workbenchCatalog = GameWorkbenchCatalog(
              groups = listOf(GameWorkbenchGroup("operations", "运营")),
              modules = listOf(
                GameWorkbenchModule(
                  id = "daily",
                  label = "日常",
                  groupId = "operations",
                  sections = listOf(GameWorkbenchSection("daily", "日常")),
                ),
              ),
            ),
            selectedModuleId = "missing",
            selectedSectionId = "daily",
          ),
          onBack = {},
          onRefresh = {},
          onRunAction = {},
        )
      }
    }

    composeRule.onNodeWithText("模块不可用").performScrollTo().assertIsDisplayed()
  }

  @Test
  fun `game features empty section snapshot does not crash`() {
    composeRule.setContent {
      XyzwTheme(themeMode = ThemeMode.LIGHT) {
        GameFeaturesScreenContent(
          state = GameFeaturesUiState(
            isLoading = false,
            workbenchCatalog = GameWorkbenchCatalog(
              groups = listOf(GameWorkbenchGroup("operations", "运营")),
              modules = listOf(
                GameWorkbenchModule(
                  id = "daily",
                  label = "日常",
                  groupId = "operations",
                  sections = listOf(GameWorkbenchSection("daily", "日常")),
                ),
              ),
            ),
            selectedModuleId = "daily",
            selectedSectionId = "daily",
            sectionSnapshot = null,
          ),
          onBack = {},
          onRefresh = {},
          onRunAction = {},
        )
      }
    }

    composeRule.onNodeWithText("暂无模块数据").performScrollTo().assertIsDisplayed()
  }

  @Test
  fun `game features backend failure shows error state`() {
    composeRule.setContent {
      XyzwTheme(themeMode = ThemeMode.LIGHT) {
        GameFeaturesScreenContent(
          state = GameFeaturesUiState(isLoading = false, errorMessage = "服务器异常，请稍后再试"),
          onBack = {},
          onRefresh = {},
          onRunAction = {},
        )
      }
    }

    composeRule.onNodeWithText("加载失败").performScrollTo().assertIsDisplayed()
    composeRule.onNodeWithText("服务器异常，请稍后再试").performScrollTo().assertIsDisplayed()
  }

  @Test
  fun `legion war screen shows snapshot`() {
    composeRule.setContent {
      XyzwTheme(themeMode = ThemeMode.LIGHT) {
        LegionWarScreenContent(
          state = LegionWarUiState(
            snapshot = LegionWarSnapshot(
              battlefieldId = "bf-1",
              nodes = listOf(
                LegionWarNode(id = "17,20", typeName = "据点", hp = 10, maxHp = 20, belongsLegionId = "l-1", belongsLegionName = "一队"),
                LegionWarNode(id = "18,20", typeName = "路线", hp = 0, maxHp = 20, belongsLegionId = "l-2", belongsLegionName = "二队"),
              ),
              legions = listOf(
                com.xyzw.helper.data.model.LegionWarLegion(id = "l-1", name = "一队", reviveLeft = 120),
                com.xyzw.helper.data.model.LegionWarLegion(id = "l-2", name = "二队", reviveLeft = 90),
              ),
            ),
          ),
          onBack = {},
          onRefresh = {},
        )
      }
    }
    composeRule.onNodeWithText("战场态势控制台").performScrollTo().assertIsDisplayed()
    composeRule.onNodeWithText("地图与战况").performScrollTo().assertIsDisplayed()
    composeRule.onNodeWithText("地图图例").performScrollTo().assertIsDisplayed()
    composeRule.onNodeWithText("路线与据点").performScrollTo().assertIsDisplayed()
    composeRule.onNodeWithText("操作面板").performScrollTo().assertIsDisplayed()
    composeRule.onNodeWithText("实时状态").performScrollTo().assertIsDisplayed()
    composeRule.onNodeWithText("17,20").performScrollTo().assertIsDisplayed()
  }

  @Test
  fun `lineup assistant screen shows saved lineup`() {
    composeRule.setContent {
      XyzwTheme(themeMode = ThemeMode.LIGHT) {
        LineupAssistantScreenContent(
          state = LineupAssistantUiState(
            lineups = listOf(
              GameLineup(
                id = "lineup-1",
                name = "一队",
                teamId = 1,
                slots = listOf(GameLineupSlot(position = 1, heroName = "主将", artifactId = "artifact-1", pearlId = "pearl-1")),
              ),
            ),
            lastApplyResult = GameLineupApplyResult(
              lineupId = "lineup-1",
              stages = listOf(
                GameLineupApplyStage("inspect-current", "success", "已查看当前阵容"),
                GameLineupApplyStage("equipment-review", "skipped", "后端未返回装备详情"),
              ),
            ),
          ),
          onBack = {},
          onRefresh = {},
          onSave = {},
          onApply = {},
        )
      }
    }
    composeRule.onNodeWithText("阵容工作台").performScrollTo().assertIsDisplayed()
    composeRule.onNodeWithText("阵容槽位棋盘").performScrollTo().assertIsDisplayed()
    composeRule.onNodeWithText("装备/鱼灵诊断").performScrollTo().assertIsDisplayed()
    composeRule.onNodeWithText("调试面板").performScrollTo().assertIsDisplayed()
    composeRule.onNodeWithText("装备详情缺失提示").performScrollTo().assertIsDisplayed()
    composeRule.onNodeWithText("一队").performScrollTo().assertIsDisplayed()
    composeRule.onNodeWithText("站位 1").performScrollTo().assertIsDisplayed()
  }

  @Test
  fun `battle reports screen shows compact list`() {
    composeRule.setContent {
      XyzwTheme(themeMode = ThemeMode.LIGHT) {
        BattleReportsScreenContent(
          state = BattleReportsUiState(
            catalog = BattleReportCatalog(
              types = listOf(BattleReportType("salt-field", "盐场战报", "查询盐场战绩")),
            ),
            queryDate = "2026/04/18",
            reports = listOf(
              BattleReportItem(
                id = "r-1",
                reportType = "salt-field",
                title = "战报",
                summary = "胜利",
              ),
            ),
          ),
          onBack = {},
          onRefresh = {},
          onQuery = {},
          onParse = {},
          onOpenDetail = {},
        )
      }
    }
    composeRule.onAllNodesWithText("战报").assertCountEquals(2)
    composeRule.onAllNodesWithText("盐场").assertCountEquals(2)
    composeRule.onNodeWithText("蟠桃园").assertIsDisplayed()
    composeRule.onNodeWithText("选择日期：2026/04/18").performScrollTo().assertIsDisplayed()
    composeRule.onNodeWithText("查看").performScrollTo().assertIsDisplayed()
    composeRule.onNodeWithText("粘贴解析").performScrollTo().assertIsDisplayed()
    composeRule.onAllNodesWithText("Report Center").assertCountEquals(0)
    composeRule.onAllNodesWithText("战报专属卡片").assertCountEquals(0)
  }

  @Test
  fun `battle reports 200020 shows empty state without raw code error`() {
    composeRule.setContent {
      XyzwTheme(themeMode = ThemeMode.LIGHT) {
        BattleReportsScreenContent(
          state = BattleReportsUiState(
            selectedReportType = "peach-garden",
            queryDate = "2026/04/19",
            emptyReason = "当天暂无战报，可能未参加或战报尚未生成",
            businessCode = "200020",
            isLoading = false,
          ),
          onBack = {},
          onRefresh = {},
          onQuery = {},
          onParse = {},
          onOpenDetail = {},
        )
      }
    }

    composeRule.onNodeWithText("当天暂无战报，可能未参加或战报尚未生成").performScrollTo().assertIsDisplayed()
    composeRule.onNodeWithText("可尝试切换到最近比赛日").performScrollTo().assertIsDisplayed()
    composeRule.onAllNodesWithText("加载失败").assertCountEquals(0)
    composeRule.onAllNodesWithText("200020").assertCountEquals(0)
  }

  @Test
  fun `battle report detail screen shows peach garden visual card and hides raw json by default`() {
    composeRule.setContent {
      XyzwTheme(themeMode = ThemeMode.LIGHT) {
        BattleReportDetailScreen(
          report = BattleReportItem(
            id = "r-1",
            reportType = "peach-garden",
            title = "蟠桃园战报",
            summary = "胜利",
            detail = JsonObject(
              mapOf(
                "isWin" to JsonPrimitive(true),
                "score" to JsonPrimitive(1200),
                "player" to JsonPrimitive("Alice"),
                "enemy" to JsonPrimitive("Bob"),
                "debugOnly" to JsonPrimitive("hidden-until-expanded"),
              ),
            ),
          ),
          onBack = {},
        )
      }
    }
    composeRule.onNodeWithText("战报详情").assertIsDisplayed()
    composeRule.onNodeWithText("蟠桃园战报").performScrollTo().assertIsDisplayed()
    composeRule.onNodeWithText("后端未返回图像，仅提供结构化数据，已转为原生战报卡").performScrollTo().assertIsDisplayed()
    composeRule.onNodeWithText("我方").performScrollTo().assertIsDisplayed()
    composeRule.onNodeWithText("Alice").performScrollTo().assertIsDisplayed()
    composeRule.onAllNodesWithText("hidden-until-expanded").assertCountEquals(0)
    composeRule.onNodeWithText("查看原始数据").performScrollTo().performClick()
    composeRule.onNodeWithText("原始数据").performScrollTo().assertIsDisplayed()
    composeRule.onNodeWithText("hidden-until-expanded").performScrollTo().assertIsDisplayed()
  }
}
