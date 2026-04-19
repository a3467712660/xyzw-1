package com.xyzw.helper.ui.screens

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextClearance
import androidx.compose.ui.test.performTextInput
import androidx.compose.ui.Modifier
import com.xyzw.helper.data.model.AuthUser
import com.xyzw.helper.data.model.DailyTaskEntry
import com.xyzw.helper.data.model.DailyTaskSettings
import com.xyzw.helper.data.storage.ThemeMode
import com.xyzw.helper.ui.components.ActionGrid
import com.xyzw.helper.ui.components.ActionGridItem
import com.xyzw.helper.ui.components.AppHero
import com.xyzw.helper.ui.components.DangerZoneCard
import com.xyzw.helper.ui.components.DenseInfoRow
import com.xyzw.helper.ui.components.MobileDataCard
import com.xyzw.helper.ui.components.PageToolbar
import com.xyzw.helper.ui.components.SectionCard
import com.xyzw.helper.ui.components.SummaryGrid
import com.xyzw.helper.ui.components.SummaryMetric
import com.xyzw.helper.ui.components.SurfacePrimaryButton
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
  fun `non game app surface primitives render web parity hierarchy`() {
    composeRule.setContent {
      XyzwTheme(themeMode = ThemeMode.LIGHT) {
        androidx.compose.foundation.layout.Column(
          modifier = Modifier.verticalScroll(rememberScrollState()),
        ) {
          AppHero(
            eyebrow = "Token 工作区",
            title = "令牌管理",
            description = "导入、校验、BIN 上传导出和远程恢复状态集中在同一处。",
          )
          SummaryGrid(
            items = listOf(
              SummaryMetric("已导入角色", "2", "本机加密工作区"),
              SummaryMetric("BIN 文件", "1", "服务端保存"),
            ),
          )
          SectionCard(title = "导入令牌", description = "支持手动粘贴和受信任链接导入。") {
            PageToolbar(title = "角色筛选", description = "选择角色后查看状态。") {
              SurfacePrimaryButton(text = "刷新", onClick = {})
            }
          }
          ActionGrid(
            items = listOf(
              ActionGridItem(title = "任务控制", description = "查看任务控制状态。", onClick = {}),
              ActionGridItem(title = "管理员中心", description = "处理账号和工单。", onClick = {}),
            ),
          )
          MobileDataCard(title = "alice", subtitle = "管理员") {
            DenseInfoRow("权限范围", "全功能")
          }
          DangerZoneCard(title = "危险区", description = "退出登录会清除本机会话。") {
            DenseInfoRow("操作", "退出登录")
          }
        }
      }
    }

    composeRule.onNodeWithText("Token 工作区").assertIsDisplayed()
    composeRule.onNodeWithText("已导入角色").assertIsDisplayed()
    composeRule.onNodeWithText("导入令牌").assertIsDisplayed()
    composeRule.onNodeWithText("任务控制").performScrollTo().assertIsDisplayed()
    composeRule.onNodeWithText("权限范围").performScrollTo().assertIsDisplayed()
    composeRule.onNodeWithText("危险区").performScrollTo().assertIsDisplayed()
  }

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

    composeRule.onNodeWithText("确认从本机加密工作区移除该令牌？服务端二进制文件不会自动删除。").assertIsDisplayed()
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

    composeRule.onNodeWithText("确认删除服务端保存的二进制文件？删除后需要重新上传。").assertIsDisplayed()
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
