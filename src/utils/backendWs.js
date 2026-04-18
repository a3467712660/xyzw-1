let socket = null;
let reconnectTimer = null;
let retryCount = 0;
let currentToken = null;
let shouldReconnect = false;

const listeners = new Set();

const buildWsUrl = () => {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/ws`;
};

const emit = (payload) => {
  listeners.forEach((handler) => {
    try {
      handler(payload);
    } catch (error) {
      console.error("backend ws listener error:", error);
    }
  });
};

const clearReconnect = () => {
  if (reconnectTimer) {
    window.clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
};

const scheduleReconnect = () => {
  if (!shouldReconnect)
    return;
  clearReconnect();

  const delay = Math.min(10000, 1000 * 2 ** retryCount);
  retryCount += 1;

  reconnectTimer = window.setTimeout(() => {
    connectBackendWs(currentToken);
  }, delay);
};

export const connectBackendWs = (_token = null) => {
  const normalizedToken = null;
  const sameUserOpen
    = socket
      && currentToken === normalizedToken
      && (socket.readyState === WebSocket.OPEN
        || socket.readyState === WebSocket.CONNECTING);

  if (sameUserOpen)
    return;

  disconnectBackendWs();

  shouldReconnect = true;
  currentToken = normalizedToken;
  const wsUrl = buildWsUrl();
  socket = new WebSocket(wsUrl);

  socket.onopen = () => {
    retryCount = 0;
    if (currentToken) {
      socket.send(
        JSON.stringify({
          type: "auth",
          token: currentToken,
        }),
      );
    }
    emit({ type: "ws:open" });
  };

  socket.onmessage = (event) => {
    try {
      const payload = JSON.parse(event.data);
      emit(payload);
    } catch (error) {
      console.error("backend ws parse error:", error);
    }
  };

  socket.onerror = () => {
    emit({ type: "ws:error" });
  };

  socket.onclose = () => {
    emit({ type: "ws:close" });
    scheduleReconnect();
  };
};

export const subscribeBackendWs = (handler) => {
  listeners.add(handler);
  return () => {
    listeners.delete(handler);
  };
};

export const disconnectBackendWs = () => {
  clearReconnect();
  shouldReconnect = false;
  currentToken = null;

  if (socket) {
    socket.onopen = null;
    socket.onmessage = null;
    socket.onerror = null;
    socket.onclose = null;

    if (
      socket.readyState === WebSocket.OPEN
      || socket.readyState === WebSocket.CONNECTING
    ) {
      socket.close();
    }

    socket = null;
  }
};
