package com.xyzw.helper.app

import com.xyzw.helper.data.session.SessionManager
import com.xyzw.helper.data.session.SessionState
import com.xyzw.helper.websocket.WsEvent
import com.xyzw.helper.websocket.WsSessionManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener

data class RealtimeConnectionState(
  val status: String = "idle",
  val lastConnectedAt: String? = null,
  val lastError: String? = null,
) {
  val isConnected: Boolean
    get() = status == "connected"
}

class RealtimeCoordinator(
  private val sessionManager: SessionManager,
  private val wsSessionManager: WsSessionManager,
) {
  private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
  private val mutableState = MutableStateFlow(RealtimeConnectionState())
  val connectionState: StateFlow<RealtimeConnectionState> = mutableState.asStateFlow()

  private val mutableEvents = MutableSharedFlow<WsEvent>(extraBufferCapacity = 32)
  val events: SharedFlow<WsEvent> = mutableEvents.asSharedFlow()

  private var socket: WebSocket? = null
  private var reconnectAttempts = 0
  private var reconnectJob: Job? = null
  private var shouldReconnect = false

  init {
    scope.launch {
      sessionManager.state.collect { sessionState ->
        when (sessionState) {
          is SessionState.Authenticated -> connect()
          SessionState.Unauthenticated,
          SessionState.Unknown,
          -> disconnect(reconnect = false)
        }
      }
    }
  }

  fun connect() {
    if (socket != null) {
      return
    }
    shouldReconnect = true
    mutableState.value = mutableState.value.copy(
      status = "connecting",
      lastError = null,
    )
    socket = wsSessionManager.connect(object : WebSocketListener() {
      override fun onOpen(webSocket: WebSocket, response: Response) {
        reconnectAttempts = 0
        mutableState.value = mutableState.value.copy(status = "open")
      }

      override fun onMessage(webSocket: WebSocket, text: String) {
        val event = wsSessionManager.parseEvent(text) ?: return
        when (event) {
          is WsEvent.Connected -> {
            reconnectAttempts = 0
            mutableState.value = mutableState.value.copy(
              status = "connected",
              lastConnectedAt = event.at,
              lastError = null,
            )
          }
          is WsEvent.Reauthenticated -> {
            mutableState.value = mutableState.value.copy(
              status = "connected",
              lastConnectedAt = event.at,
              lastError = null,
            )
          }
          else -> Unit
        }
        mutableEvents.tryEmit(event)
      }

      override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
        socket = null
        mutableState.value = mutableState.value.copy(
          status = "error",
          lastError = t.message ?: "websocket error",
        )
        scheduleReconnect()
      }

      override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
        webSocket.close(code, reason)
      }

      override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
        socket = null
        if (shouldReconnect) {
          mutableState.value = mutableState.value.copy(
            status = "disconnected",
            lastError = reason.ifBlank { null },
          )
          scheduleReconnect()
        } else {
          mutableState.value = RealtimeConnectionState()
        }
      }
    })
  }

  fun disconnect(reconnect: Boolean = false) {
    shouldReconnect = reconnect
    reconnectJob?.cancel()
    reconnectJob = null
    socket?.close(1000, if (reconnect) "reconnect" else "logout")
    socket = null
    if (!reconnect) {
      reconnectAttempts = 0
      mutableState.value = RealtimeConnectionState()
    }
  }

  private fun scheduleReconnect() {
    if (!shouldReconnect || reconnectJob != null) {
      return
    }
    reconnectJob = scope.launch {
      val delayMs = backoffDelay(reconnectAttempts)
      reconnectAttempts += 1
      delay(delayMs)
      reconnectJob = null
      if (shouldReconnect && sessionManager.state.value is SessionState.Authenticated) {
        connect()
      }
    }
  }

  private fun backoffDelay(attempt: Int): Long =
    when (attempt) {
      0 -> 1_000
      1 -> 2_000
      2 -> 4_000
      3 -> 8_000
      4 -> 16_000
      else -> 30_000
    }
}
