import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import { createApp } from "../src/app/createApp.js";
import { initDatabase } from "../src/db/database.js";
import { env } from "../src/config/env.js";

const makeBaseUrl = (server) => {
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("test server address unavailable");
  }
  return `http://127.0.0.1:${address.port}`;
};

const createServer = async () => {
  const { app } = createApp();
  const server = await new Promise((resolve, reject) => {
    const next = app.listen(0, "127.0.0.1", () => resolve(next));
    next.on("error", reject);
  });
  return server;
};

const requestLocal = ({ url, method = "GET", headers = {}, body = "" }) => {
  const target = new URL(url);
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: target.hostname,
        port: target.port,
        path: `${target.pathname}${target.search}`,
        method,
        headers,
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          resolve({
            status: res.statusCode || 0,
            headers: res.headers,
            body: Buffer.concat(chunks).toString("utf8"),
          });
        });
      },
    );
    req.on("error", reject);
    if (body) {
      req.write(body);
    }
    req.end();
  });
};

const openSse = (url) => {
  const target = new URL(url);
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: target.hostname,
        port: target.port,
        path: `${target.pathname}${target.search}`,
        method: "GET",
        headers: {
          accept: "text/event-stream",
        },
      },
      (res) => {
        if (Number(res.statusCode || 0) !== 200) {
          const chunks = [];
          res.on("data", (chunk) => chunks.push(chunk));
          res.on("end", () => {
            reject(
              new Error(
                `unexpected status ${String(res.statusCode || 0)}: ${Buffer.concat(chunks).toString("utf8")}`,
              ),
            );
          });
          return;
        }

        const onData = (chunk) => {
          const text = String(chunk || "");
          if (!text.trim()) {
            return;
          }
          res.off("data", onData);
          resolve({ req, res, firstChunk: text });
        };
        res.on("data", onData);
      },
    );
    req.on("error", reject);
    req.end();
  });
};

const closeSse = async (connection) => {
  if (!connection) {
    return;
  }
  await new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) {
        return;
      }
      settled = true;
      resolve();
    };
    connection.res.once("close", finish);
    connection.req.destroy();
    connection.res.destroy();
    setTimeout(finish, 50);
  });
};

test("public wechat contacts SSE enforces global connection limit", async (t) => {
  await initDatabase();
  const prevGlobal = env.publicWechatContactsSseMaxGlobal;
  const prevPerIp = env.publicWechatContactsSseMaxPerIp;
  env.publicWechatContactsSseMaxGlobal = 2;
  env.publicWechatContactsSseMaxPerIp = 5;
  t.after(() => {
    env.publicWechatContactsSseMaxGlobal = prevGlobal;
    env.publicWechatContactsSseMaxPerIp = prevPerIp;
  });

  const server = await createServer();

  const baseUrl = makeBaseUrl(server);
  const first = await openSse(`${baseUrl}/api/v1/public/wechat-contacts/stream`);
  const second = await openSse(`${baseUrl}/api/v1/public/wechat-contacts/stream`);
  t.after(async () => {
    await closeSse(first);
    await closeSse(second);
    await new Promise((resolve) => server.close(resolve));
  });

  const blocked = await requestLocal({
    url: `${baseUrl}/api/v1/public/wechat-contacts/stream`,
  });

  assert.equal(blocked.status, 429);
  assert.match(blocked.body, /公开联系人订阅过于频繁/);
});

test("public wechat contacts SSE enforces per-IP limit and recovers after disconnect", async (t) => {
  await initDatabase();
  const prevGlobal = env.publicWechatContactsSseMaxGlobal;
  const prevPerIp = env.publicWechatContactsSseMaxPerIp;
  env.publicWechatContactsSseMaxGlobal = 10;
  env.publicWechatContactsSseMaxPerIp = 1;
  t.after(() => {
    env.publicWechatContactsSseMaxGlobal = prevGlobal;
    env.publicWechatContactsSseMaxPerIp = prevPerIp;
  });

  const server = await createServer();
  let active = null;
  let reopened = null;
  t.after(async () => {
    await closeSse(active);
    await closeSse(reopened);
    await new Promise((resolve) => server.close(resolve));
  });

  const baseUrl = makeBaseUrl(server);
  active = await openSse(`${baseUrl}/api/v1/public/wechat-contacts/stream`);

  const blocked = await requestLocal({
    url: `${baseUrl}/api/v1/public/wechat-contacts/stream`,
  });
  assert.equal(blocked.status, 429);

  await closeSse(active);
  await new Promise((resolve) => setTimeout(resolve, 50));

  reopened = await openSse(`${baseUrl}/api/v1/public/wechat-contacts/stream`);
  assert.ok(reopened.firstChunk.length > 0);
});
