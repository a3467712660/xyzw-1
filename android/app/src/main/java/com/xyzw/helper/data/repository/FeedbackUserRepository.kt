package com.xyzw.helper.data.repository

import com.xyzw.helper.data.model.FeedbackItem
import com.xyzw.helper.data.network.ApiResult
import com.xyzw.helper.data.network.ApiResultParser
import com.xyzw.helper.data.network.FeedbackApi
import com.xyzw.helper.data.network.FeedbackCreateRequest

interface FeedbackUserDataSource {
  suspend fun listFeedbacks(status: String? = null): ApiResult<List<FeedbackItem>>

  suspend fun createFeedback(
    type: String,
    title: String,
    content: String,
  ): ApiResult<Unit>
}

class FeedbackUserRepository(
  private val api: FeedbackApi,
  private val parser: ApiResultParser,
) : FeedbackUserDataSource {
  override suspend fun listFeedbacks(status: String?): ApiResult<List<FeedbackItem>> =
    parser.parse(api.listFeedbacks(status))

  override suspend fun createFeedback(
    type: String,
    title: String,
    content: String,
  ): ApiResult<Unit> =
    parser.parseUnit(
      api.createFeedback(
        FeedbackCreateRequest(
          type = type,
          title = title,
          content = content,
        ),
      ),
    )
}
