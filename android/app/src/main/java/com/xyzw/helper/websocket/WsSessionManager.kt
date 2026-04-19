package com.xyzw.helper.websocket

import com.xyzw.helper.data.model.NotificationItem
import com.xyzw.helper.data.network.NetworkFactory
import kotlinx.serialization.json.jsonObject
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.WebSocket
import okhttp3.WebSocketListener

class WsSessionManager(
  private val client: OkHttpClient,
  private val serverBaseUrl: String,
  private val wsPath: String,
  private val wsOrigin: String,
) {
  fun connect(listener: WebSocketListener): WebSocket =
    client.newWebSocket(createRequest(), listener)

  fun createWebSocketUrl(): String {
    val baseUrl = serverBaseUrl.trim().trimEnd('/').toHttpUrl()
    val wsScheme = if (baseUrl.isHttps) "wss" else "ws"
    val normalizedPath = if (wsPath.startsWith("/")) wsPath else "/$wsPath"
    val defaultPort = if (baseUrl.isHttps) 443 else 80
    val portSuffix = when {
      baseUrl.port == defaultPort -> ""
      else -> ":${baseUrl.port}"
    }
    return "$wsScheme://${baseUrl.host}$portSuffix$normalizedPath"
  }

  fun createRequest(): Request {
    val wsUrl = createWebSocketUrl()
    return Request.Builder()
      .url(wsUrl)
      .apply {
        val normalizedOrigin = wsOrigin.trim().trimEnd('/')
        if (normalizedOrigin.isNotEmpty()) {
          header("Origin", normalizedOrigin)
        }
      }
      .build()
  }

  fun parseEvent(rawText: String): WsEvent? {
    val json = runCatching {
      NetworkFactory.json.parseToJsonElement(rawText).jsonObject
    }.getOrNull() ?: return null

    val type = json["type"]?.toString()?.trim('"').orEmpty()
    return when (type) {
      "connected" -> WsEvent.Connected(
        at = json["at"]?.toString()?.trim('"').orEmpty(),
      )
      "reauthenticated" -> WsEvent.Reauthenticated(
        at = json["at"]?.toString()?.trim('"').orEmpty(),
      )
      "notification:new" -> {
        val notificationJson = json["notification"] ?: return null
        val notification = NetworkFactory.json.decodeFromJsonElement(
          WsNotificationEnvelope.serializer(),
          notificationJson,
        )
        WsEvent.NotificationNew(
          notification = NotificationItem(
            id = notification.id,
            type = notification.type,
            title = notification.title,
            content = notification.content,
            isRead = notification.isRead,
            readAt = notification.readAt,
            createdAt = notification.createdAt,
          ),
        )
      }
      "notification:read_all" -> WsEvent.NotificationReadAll(
        at = json["at"]?.toString()?.trim('"'),
      )
      "notification:cleared" -> WsEvent.NotificationCleared(
        at = json["at"]?.toString()?.trim('"'),
      )
      "task:done" -> WsEvent.TaskDone(
        taskConfigId = json["taskConfigId"]?.toString()?.trim('"').orEmpty(),
        roleId = json["roleId"]?.toString()?.trim('"').orEmpty(),
        source = json["source"]?.toString()?.trim('"').orEmpty(),
        at = json["at"]?.toString()?.trim('"').orEmpty(),
        message = json["message"]?.toString()?.trim('"').orEmpty(),
      )
      "task-control:state-updated" -> WsEvent.TaskControlStateUpdated(
        updatedAt = json["updatedAt"]?.toString()?.trim('"'),
      )
      else -> null
    }
  }
}
