package com.xyzw.helper.websocket

import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import okhttp3.HttpUrl.Companion.toHttpUrl

class WsSessionManager(
  private val client: OkHttpClient,
  private val serverBaseUrl: String,
  private val wsPath: String,
) {
  fun connect(listener: WebSocketListener): WebSocket =
    client.newWebSocket(createRequest(), listener)

  fun createRequest(): Request {
    val baseUrl = serverBaseUrl.trim().trimEnd('/').toHttpUrl()
    val wsScheme = if (baseUrl.isHttps) "wss" else "ws"
    val wsUrl = baseUrl.newBuilder()
      .scheme(wsScheme)
      .encodedPath(wsPath)
      .query(null)
      .build()
    return Request.Builder()
      .url(wsUrl)
      .build()
  }
}
