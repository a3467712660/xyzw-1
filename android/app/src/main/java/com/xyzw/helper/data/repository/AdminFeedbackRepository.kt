package com.xyzw.helper.data.repository

import com.xyzw.helper.data.model.FeedbackItem
import com.xyzw.helper.data.network.AdminFeedbackUpdateRequest
import com.xyzw.helper.data.network.ApiResult
import com.xyzw.helper.data.network.ApiResultParser
import com.xyzw.helper.data.network.FeedbackApi

class AdminFeedbackRepository(
  private val api: FeedbackApi,
  private val parser: ApiResultParser,
) {
  suspend fun listFeedbacks(status: String? = null): ApiResult<List<FeedbackItem>> =
    parser.parse(api.listFeedbacks(status))

  suspend fun updateTicket(
    id: String,
    status: String,
    adminNote: String,
  ): ApiResult<FeedbackItem> =
    parser.parse(
      api.updateByAdmin(
        id = id,
        request = AdminFeedbackUpdateRequest(
          status = status,
          adminNote = adminNote.ifBlank { null },
        ),
      ),
    )
}
