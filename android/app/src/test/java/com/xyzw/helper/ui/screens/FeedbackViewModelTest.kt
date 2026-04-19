package com.xyzw.helper.ui.screens

import android.os.Looper
import com.xyzw.helper.data.model.FeedbackItem
import com.xyzw.helper.data.network.ApiError
import com.xyzw.helper.data.network.ApiResult
import com.xyzw.helper.data.repository.FeedbackUserDataSource
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf

@RunWith(RobolectricTestRunner::class)
class FeedbackViewModelTest {
  @Test
  fun `submit failure keeps clear draft signal unchanged`() {
    val repository = FakeFeedbackUserDataSource(
      createResult = ApiResult.Failure(ApiError.local("提交失败")),
    )
    val viewModel = FeedbackViewModel(repository)
    shadowOf(Looper.getMainLooper()).idle()
    val beforeSignal = viewModel.uiState.value.clearDraftSignal

    viewModel.submitFeedback("bug", "标题", "内容")
    shadowOf(Looper.getMainLooper()).idle()

    val state = viewModel.uiState.value
    assertEquals(beforeSignal, state.clearDraftSignal)
    assertFalse(state.isSubmitting)
    assertEquals("提交失败", state.errorMessage)
  }

  @Test
  fun `submit success increments clear draft signal`() {
    val repository = FakeFeedbackUserDataSource(
      createResult = ApiResult.Success(Unit, "反馈已提交"),
    )
    val viewModel = FeedbackViewModel(repository)
    shadowOf(Looper.getMainLooper()).idle()
    val beforeSignal = viewModel.uiState.value.clearDraftSignal

    viewModel.submitFeedback("bug", "标题", "内容")
    shadowOf(Looper.getMainLooper()).idle()

    val state = viewModel.uiState.value
    assertTrue(state.clearDraftSignal > beforeSignal)
    assertFalse(state.isSubmitting)
    assertEquals("反馈已提交", state.actionMessage)
  }

  private class FakeFeedbackUserDataSource(
    private val createResult: ApiResult<Unit>,
  ) : FeedbackUserDataSource {
    override suspend fun listFeedbacks(status: String?): ApiResult<List<FeedbackItem>> =
      ApiResult.Success(emptyList())

    override suspend fun createFeedback(
      type: String,
      title: String,
      content: String,
    ): ApiResult<Unit> = createResult
  }
}

