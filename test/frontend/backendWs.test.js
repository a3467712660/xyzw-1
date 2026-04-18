/* eslint-disable test/no-import-node-test */
import test from "node:test";
import assert from "node:assert/strict";
import jiti from "jiti";

globalThis.window = globalThis.window || {};
globalThis.window.location = {
  protocol: "http:",
  host: "127.0.0.1:3000",
};
globalThis.window.setTimeout = globalThis.setTimeout;
globalThis.window.clearTimeout = globalThis.clearTimeout;

let lastSocket = null;

class FakeWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  constructor(url) {
    this.url = url;
    this.readyState = FakeWebSocket.CONNECTING;
    this.sent = [];
    this.onopen = null;
    this.onmessage = null;
    this.onerror = null;
    this.onclose = null;
    lastSocket = this;
  }

  send(payload) {
    this.sent.push(payload);
  }

  close() {
    this.readyState = FakeWebSocket.CLOSED;
    if (typeof this.onclose === "function") {
      this.onclose();
    }
  }

  open() {
    this.readyState = FakeWebSocket.OPEN;
    if (typeof this.onopen === "function") {
      this.onopen();
    }
  }
}

globalThis.WebSocket = FakeWebSocket;

const loadModule = jiti(import.meta.url, { interopDefault: true });
const {
  connectBackendWs,
  disconnectBackendWs,
} = loadModule("../../src/utils/backendWs.js");

test("backend ws client does not send auth token frame on open even when a token argument is passed", () => {
  connectBackendWs("legacy-token");
  assert.ok(lastSocket, "expected websocket instance");
  lastSocket.open();

  assert.deepEqual(lastSocket.sent, []);

  disconnectBackendWs();
});
