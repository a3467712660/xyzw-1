package com.xyzw.helper.ui.navigation

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performScrollTo
import com.xyzw.helper.data.model.AuthUser
import com.xyzw.helper.data.storage.ThemeMode
import com.xyzw.helper.ui.components.XyzwEmptyState
import com.xyzw.helper.ui.screens.AdminHubScreen
import com.xyzw.helper.ui.screens.AuthUiState
import com.xyzw.helper.ui.screens.DashboardScreen
import com.xyzw.helper.ui.screens.DashboardUiState
import com.xyzw.helper.ui.screens.LoginScreen
import com.xyzw.helper.ui.theme.XyzwTheme
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
      XyzwTheme(themeMode = ThemeMode.LIGHT) {
        MainShellBottomBar(
          items = defaultShellDestinations(),
          currentRoute = AppRoute.Dashboard.route,
          onNavigate = {},
        )
      }
    }

    composeRule.onNodeWithText("控制台").assertIsDisplayed()
    composeRule.onNodeWithText("工作台").assertIsDisplayed()
    composeRule.onNodeWithText("任务").assertIsDisplayed()
    composeRule.onNodeWithText("通知").assertIsDisplayed()
    composeRule.onNodeWithText("我的").assertIsDisplayed()
  }

  @Test
  fun `login page is visible`() {
    composeRule.setContent {
      XyzwTheme(themeMode = ThemeMode.LIGHT) {
        LoginScreen(
          uiState = AuthUiState(),
          onSubmit = { _, _, _ -> },
          onRegister = {},
          onForgotPassword = {},
        )
      }
    }

    composeRule.onNodeWithText("登录").assertIsDisplayed()
  }

  @Test
  fun `dashboard quick entries are visible`() {
    composeRule.setContent {
      XyzwTheme(themeMode = ThemeMode.LIGHT) {
        DashboardScreen(
          uiState = DashboardUiState(
            user = AuthUser(id = "u-1", username = "alice", isAdmin = true),
            roleCount = 2,
            tokenCount = 1,
            unreadNotificationCount = 3,
            taskCompletionPercent = 50,
            taskSummaryText = "1/2",
            isLoading = false,
          ),
          showAdminEntry = true,
          onRefresh = {},
          onOpenTokens = {},
          onOpenRoles = {},
          onOpenDailyTasks = {},
          onOpenFeedback = {},
          onOpenReferral = {},
          onOpenNotifications = {},
          onOpenAdminHub = {},
        )
      }
    }

    composeRule.onNodeWithText("Token 管理").performScrollTo().assertIsDisplayed()
    composeRule.onNodeWithText("日常任务").performScrollTo().assertIsDisplayed()
    composeRule.onNodeWithText("管理员中心").performScrollTo().assertIsDisplayed()
  }

  @Test
  fun `token empty state can be displayed`() {
    composeRule.setContent {
      XyzwTheme(themeMode = ThemeMode.LIGHT) {
        XyzwEmptyState(
          title = "暂无 Token",
          description = "暂无 Token，立即导入",
          primaryActionLabel = "立即导入",
          onPrimaryAction = {},
        )
      }
    }

    composeRule.onNodeWithText("暂无 Token").assertIsDisplayed()
    composeRule.onNodeWithText("立即导入").assertIsDisplayed()
  }

  @Test
  fun `admin hub denies non admin users`() {
    composeRule.setContent {
      XyzwTheme(themeMode = ThemeMode.LIGHT) {
        AdminHubScreen(
          currentUser = AuthUser(id = "u-1", username = "bob", isAdmin = false),
          onBack = {},
          onOpenUsers = {},
          onOpenInvites = {},
          onOpenActivationCodes = {},
          onOpenFeedbackTickets = {},
          onOpenTaskLogs = {},
          onOpenChangelogBroadcast = {},
          onOpenWechatContacts = {},
          onOpenReferrals = {},
        )
      }
    }

    composeRule.onNodeWithText("权限不足或需要管理员确认").assertIsDisplayed()
  }
}
