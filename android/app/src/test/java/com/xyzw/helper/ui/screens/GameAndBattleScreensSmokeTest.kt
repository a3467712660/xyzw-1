package com.xyzw.helper.ui.screens

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performScrollTo
import com.xyzw.helper.data.model.BattleReportCatalog
import com.xyzw.helper.data.model.BattleReportItem
import com.xyzw.helper.data.model.BattleReportType
import com.xyzw.helper.data.model.GameFeatureCatalog
import com.xyzw.helper.data.model.GameFeatureCatalogItem
import com.xyzw.helper.data.model.GameFeatureSummary
import com.xyzw.helper.data.model.GameLineup
import com.xyzw.helper.data.model.GameLineupSlot
import com.xyzw.helper.data.model.LegionWarSnapshot
import com.xyzw.helper.data.model.LegionWarNode
import com.xyzw.helper.ui.theme.XyzwTheme
import com.xyzw.helper.data.storage.ThemeMode
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

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
            catalog = GameFeatureCatalog(
              features = listOf(GameFeatureCatalogItem("daily-tasks", "日常任务", "领取奖励")),
            ),
            summary = GameFeatureSummary(tokenId = "token-1", roleName = "Alice", binAvailable = true),
          ),
          onBack = {},
          onRefresh = {},
          onRunAction = {},
        )
      }
    }
    composeRule.onNodeWithText("Alice").performScrollTo().assertIsDisplayed()
    composeRule.onNodeWithText("日常任务").performScrollTo().assertIsDisplayed()
  }

  @Test
  fun `legion war screen shows snapshot`() {
    composeRule.setContent {
      XyzwTheme(themeMode = ThemeMode.LIGHT) {
        LegionWarScreenContent(
          state = LegionWarUiState(
            snapshot = LegionWarSnapshot(
              battlefieldId = "bf-1",
              nodes = listOf(LegionWarNode(id = "17,20", typeName = "据点", hp = 10, maxHp = 20)),
              legions = emptyList(),
            ),
          ),
          onBack = {},
          onRefresh = {},
        )
      }
    }
    composeRule.onNodeWithText("军团战").assertIsDisplayed()
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
                slots = listOf(GameLineupSlot(position = 1, heroName = "主将")),
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
    composeRule.onNodeWithText("阵容助手").assertIsDisplayed()
    composeRule.onNodeWithText("一队").performScrollTo().assertIsDisplayed()
  }

  @Test
  fun `battle reports screen shows list`() {
    composeRule.setContent {
      XyzwTheme(themeMode = ThemeMode.LIGHT) {
        BattleReportsScreenContent(
          state = BattleReportsUiState(
            catalog = BattleReportCatalog(
              types = listOf(BattleReportType("salt-field", "盐场战报", "查询盐场战绩")),
            ),
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
    composeRule.onNodeWithText("战报功能").assertIsDisplayed()
    composeRule.onNodeWithText("战报").performScrollTo().assertIsDisplayed()
  }

  @Test
  fun `battle report detail screen shows summary`() {
    composeRule.setContent {
      XyzwTheme(themeMode = ThemeMode.LIGHT) {
        BattleReportDetailScreen(
          report = BattleReportItem(id = "r-1", reportType = "salt-field", title = "战报", summary = "胜利"),
          onBack = {},
        )
      }
    }
    composeRule.onNodeWithText("战报详情").assertIsDisplayed()
    composeRule.onNodeWithText("胜利").assertIsDisplayed()
  }
}
