package com.xyzw.helper.ui.screens

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextClearance
import androidx.compose.ui.test.performTextInput
import com.xyzw.helper.data.model.AuthUser
import com.xyzw.helper.data.model.DailyTaskEntry
import com.xyzw.helper.data.model.DailyTaskSettings
import com.xyzw.helper.data.storage.ThemeMode
import com.xyzw.helper.ui.theme.XyzwTheme
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class FeatureScreensV21Test {
  @get:Rule
  val composeRule = createComposeRule()

  @Test
  fun `profile password fields hide typed text`() {
    composeRule.setContent {
      XyzwTheme(themeMode = ThemeMode.LIGHT) {
        var current by remember { mutableStateOf("") }
        var next by remember { mutableStateOf("") }
        ProfilePasswordFields(
          currentPassword = current,
          newPassword = next,
          onCurrentPasswordChange = { current = it },
          onNewPasswordChange = { next = it },
          onSubmit = {},
        )
      }
    }

    composeRule.onNodeWithTag("profile-current-password").performTextInput("current-secret")
    composeRule.onNodeWithTag("profile-new-password").performTextInput("next-secret")

    composeRule.onAllNodesWithText("current-secret").assertCountEquals(0)
    composeRule.onAllNodesWithText("next-secret").assertCountEquals(0)
  }

  @Test
  fun `feedback submit failure path keeps draft inputs`() {
    var submitted = false
    composeRule.setContent {
      XyzwTheme(themeMode = ThemeMode.LIGHT) {
        var type by remember { mutableStateOf("bug") }
        var title by remember { mutableStateOf("") }
        var content by remember { mutableStateOf("") }
        FeedbackSubmitForm(
          type = type,
          title = title,
          content = content,
          isSubmitting = false,
          onTypeChange = { type = it },
          onTitleChange = { title = it },
          onContentChange = { content = it },
          onSubmit = { submitted = true },
        )
      }
    }

    composeRule.onNodeWithTag("feedback-title").performTextInput("无法同步")
    composeRule.onNodeWithTag("feedback-content").performTextInput("提交失败也要保留内容")
    composeRule.onNodeWithTag("feedback-submit").performClick()

    assertTrue(submitted)
    composeRule.onNodeWithText("无法同步").assertIsDisplayed()
    composeRule.onNodeWithText("提交失败也要保留内容").assertIsDisplayed()
  }

  @Test
  fun `role delete confirm dialog requires explicit confirmation`() {
    var confirmed = false
    composeRule.setContent {
      XyzwTheme(themeMode = ThemeMode.LIGHT) {
        RoleDeleteConfirmDialog(
          roleName = "测试角色",
          onConfirm = { confirmed = true },
          onDismiss = {},
        )
      }
    }

    composeRule.onNodeWithText("确认删除角色“测试角色”？删除后需要重新创建。").assertIsDisplayed()
    assertEquals(false, confirmed)
    composeRule.onNodeWithText("删除").performClick()
    assertEquals(true, confirmed)
  }

  @Test
  fun `token delete confirm dialog requires explicit confirmation`() {
    var confirmed = false
    composeRule.setContent {
      XyzwTheme(themeMode = ThemeMode.LIGHT) {
        TokenDeleteConfirmDialog(
          onConfirm = { confirmed = true },
          onDismiss = {},
        )
      }
    }

    composeRule.onNodeWithText("确认从本机加密工作区移除该 Token？服务端 BIN 文件不会自动删除。").assertIsDisplayed()
    assertEquals(false, confirmed)
    composeRule.onNodeWithText("删除").performClick()
    assertEquals(true, confirmed)
  }

  @Test
  fun `bin delete confirm dialog requires explicit confirmation`() {
    var confirmed = false
    composeRule.setContent {
      XyzwTheme(themeMode = ThemeMode.LIGHT) {
        BinDeleteConfirmDialog(
          onConfirm = { confirmed = true },
          onDismiss = {},
        )
      }
    }

    composeRule.onNodeWithText("确认删除服务端保存的 BIN 文件？删除后需要重新上传。").assertIsDisplayed()
    assertEquals(false, confirmed)
    composeRule.onNodeWithText("删除").performClick()
    assertEquals(true, confirmed)
  }

  @Test
  fun `admin confirm password field hides typed text`() {
    composeRule.setContent {
      XyzwTheme(themeMode = ThemeMode.LIGHT) {
        AdminConfirmDialog(
          currentUser = AuthUser(id = "admin-1", username = "admin", isAdmin = true, mfaEnabled = false),
          request = AdminConfirmDialogRequest("危险操作") {},
          onDismiss = {},
          onConfirm = { _, _ -> },
        )
      }
    }

    composeRule.onNodeWithTag("admin-confirm-password").performTextInput("admin-secret")

    composeRule.onAllNodesWithText("admin-secret").assertCountEquals(0)
  }

  @Test
  fun `daily task config saves delay cron and notification`() {
    var captured: SavedTaskConfig? = null
    val task = DailyTaskEntry(
      id = "daily",
      title = "日常任务",
      settings = DailyTaskSettings(
        enabled = true,
        autoExecute = true,
        notification = true,
        delay = 5,
        cronExpr = "0 1 * * *",
      ),
    )
    composeRule.setContent {
      XyzwTheme(themeMode = ThemeMode.LIGHT) {
        DailyTaskConfigDialog(
          task = task,
          onDismiss = {},
          onSave = { enabled, autoExecute, notification, delay, cronExpr ->
            captured = SavedTaskConfig(enabled, autoExecute, notification, delay, cronExpr)
          },
        )
      }
    }

    composeRule.onNodeWithTag("daily-task-delay").performTextClearance()
    composeRule.onNodeWithTag("daily-task-delay").performTextInput("30")
    composeRule.onNodeWithTag("daily-task-cron").performTextClearance()
    composeRule.onNodeWithTag("daily-task-cron").performTextInput("*/10 * * * *")
    composeRule.onNodeWithTag("daily-task-notification").performClick()
    composeRule.onNodeWithTag("daily-task-save").performClick()

    assertEquals(SavedTaskConfig(true, true, false, 30, "*/10 * * * *"), captured)
  }

  @Test
  fun `referral share button emits system share content`() {
    var sharedText = ""
    composeRule.setContent {
      XyzwTheme(themeMode = ThemeMode.LIGHT) {
        ReferralShareButton(
          referralCode = "ABC123",
          shareUrl = "https://xyzw.example/r/ABC123",
          onShare = { sharedText = it },
        )
      }
    }

    composeRule.onNodeWithText("系统分享").assertIsDisplayed()
    composeRule.onNodeWithText("系统分享").performClick()

    assertEquals("使用我的推广链接注册：https://xyzw.example/r/ABC123", sharedText)
  }

  private data class SavedTaskConfig(
    val enabled: Boolean,
    val autoExecute: Boolean,
    val notification: Boolean,
    val delay: Int,
    val cronExpr: String,
  )
}
