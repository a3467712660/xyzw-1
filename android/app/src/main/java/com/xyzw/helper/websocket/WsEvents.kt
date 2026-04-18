package com.xyzw.helper.websocket

import com.xyzw.helper.data.model.NotificationItem
import kotlinx.serialization.Serializable

sealed interface WsEvent {
  data class Connected(
    val at: String,
  ) : WsEvent

  data class Reauthenticated(
    val at: String,
  ) : WsEvent

  data class NotificationNew(
    val notification: NotificationItem,
  ) : WsEvent

  data class NotificationReadAll(
    val at: String? = null,
  ) : WsEvent

  data class NotificationCleared(
    val at: String? = null,
  ) : WsEvent

  data class TaskDone(
    val taskConfigId: String,
    val roleId: String,
    val source: String,
    val at: String,
    val message: String,
  ) : WsEvent

  data class TaskControlStateUpdated(
    val updatedAt: String? = null,
  ) : WsEvent
}

@Serializable
internal data class WsNotificationEnvelope(
  val id: String,
  val type: String,
  val title: String,
  val content: String,
  val isRead: Boolean = false,
  val readAt: String? = null,
  val createdAt: String,
)
