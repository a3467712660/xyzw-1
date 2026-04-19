package com.xyzw.helper.websocket

import okhttp3.OkHttpClient
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class WsSessionManagerTest {
  private val client = OkHttpClient()

  @Test
  fun `createRequest converts http base url to ws with ws path`() {
    val manager = WsSessionManager(
      client = client,
      serverBaseUrl = "http://10.0.2.2:8787",
      wsPath = "/ws",
      wsOrigin = "",
    )

    val request = manager.createRequest()

    assertEquals("ws://10.0.2.2:8787/ws", manager.createWebSocketUrl())
    assertEquals("/ws", request.url.encodedPath)
    assertNull(request.header("Origin"))
  }

  @Test
  fun `createRequest converts https base url to wss with ws path`() {
    val manager = WsSessionManager(
      client = client,
      serverBaseUrl = "https://xyzw.example.com",
      wsPath = "/ws",
      wsOrigin = "",
    )

    val request = manager.createRequest()

    assertEquals("wss://xyzw.example.com/ws", manager.createWebSocketUrl())
    assertEquals("/ws", request.url.encodedPath)
    assertNull(request.header("Origin"))
  }

  @Test
  fun `createRequest includes origin header when configured`() {
    val manager = WsSessionManager(
      client = client,
      serverBaseUrl = "https://xyzw.example.com",
      wsPath = "/ws",
      wsOrigin = "https://app.example.com",
    )

    val request = manager.createRequest()

    assertEquals("https://app.example.com", request.header("Origin"))
  }

  @Test
  fun `createRequest omits origin header when configured origin is blank`() {
    val manager = WsSessionManager(
      client = client,
      serverBaseUrl = "https://xyzw.example.com",
      wsPath = "/ws",
      wsOrigin = "   ",
    )

    val request = manager.createRequest()

    assertNull(request.header("Origin"))
  }
}
