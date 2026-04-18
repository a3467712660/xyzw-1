package com.xyzw.helper.data.repository

import com.xyzw.helper.data.model.NotificationItem
import com.xyzw.helper.data.network.ApiResult
import com.xyzw.helper.data.network.ApiResultParser
import com.xyzw.helper.data.network.NotificationApi

class NotificationRepository(
  private val api: NotificationApi,
  private val parser: ApiResultParser,
) {
  suspend fun listNotifications(
    limit: Int = 50,
    unreadOnly: Boolean = false,
  ): ApiResult<List<NotificationItem>> =
    parser.parse(
      api.listNotifications(
        limit = limit,
        unreadOnly = if (unreadOnly) "1" else null,
      ),
    )

  suspend fun markRead(id: String): ApiResult<Unit> =
    parser.parseUnit(api.markRead(id))

  suspend fun markAllRead(): ApiResult<Unit> =
    parser.parseUnit(api.markAllRead())
}
