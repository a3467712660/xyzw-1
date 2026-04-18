package com.xyzw.helper.ui.navigation

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class MainShellSmokeTest {
  @get:Rule
  val composeRule = createComposeRule()

  @Test
  fun `main shell bottom navigation is visible`() {
    composeRule.setContent {
      MainShellBottomBar(
        items = defaultShellDestinations(),
        currentRoute = AppRoute.Dashboard.route,
        onNavigate = {},
      )
    }

    composeRule.onNodeWithText("控制台").assertIsDisplayed()
    composeRule.onNodeWithText("工作台").assertIsDisplayed()
    composeRule.onNodeWithText("任务").assertIsDisplayed()
    composeRule.onNodeWithText("通知").assertIsDisplayed()
    composeRule.onNodeWithText("我的").assertIsDisplayed()
  }
}
