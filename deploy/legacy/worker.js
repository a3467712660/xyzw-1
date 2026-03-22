const parseAllowedOrigins = (env) => {
  const raw = String(env.CORS_ALLOWED_ORIGINS || "").trim();
  if (!raw) {
    return new Set(["https://app.example.com"]);
  }
  return new Set(
    raw
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  );
};

const isCredentialedCorsEnabled = (env) =>
  String(env.CORS_ALLOW_CREDENTIALS || "true").trim().toLowerCase() === "true";

const buildCorsHeaders = (request, env) => {
  const origin = String(request.headers.get("Origin") || "").trim();
  const allowedOrigins = parseAllowedOrigins(env);
  const credentials = isCredentialedCorsEnabled(env);

  const baseHeaders = {
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, X-CSRF-Token, X-User-Confirm-Token, X-Admin-Confirm-Token",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };

  if (!origin) {
    return {
      origin,
      allowed: true,
      headers: baseHeaders,
    };
  }

  if (!allowedOrigins.has(origin)) {
    return {
      origin,
      allowed: false,
      headers: baseHeaders,
    };
  }

  const headers = {
    ...baseHeaders,
    "Access-Control-Allow-Origin": origin,
  };
  if (credentials) {
    headers["Access-Control-Allow-Credentials"] = "true";
  }

  return {
    origin,
    allowed: true,
    headers,
  };
};

export default {
  async fetch(request, env, _ctx) {
    const url = new URL(request.url);
    const backendOrigin = env.BACKEND_ORIGIN;
    const enableBackendProxy = env.ENABLE_BACKEND_PROXY === "true";
    const cors = buildCorsHeaders(request, env);

    if (request.method === "OPTIONS") {
      if (!cors.allowed) {
        return new Response("CORS origin denied", {
          status: 403,
          headers: {
            ...cors.headers,
            "Content-Type": "text/plain; charset=utf-8",
          },
        });
      }
      return new Response(null, {
        status: 204,
        headers: cors.headers,
      });
    }

    const proxies = [
      {
        prefix: "/api/weixin-long",
        target: "https://long.open.weixin.qq.com",
        headers: {
          "User-Agent": "Mozilla/5.0 (Linux; Android 7.0; Mi-4c Build/NRD90M; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/53.0.2785.49 Mobile MQQBrowser/6.2 TBS/043632 Safari/537.36 MicroMessenger/6.6.1.1220(0x26060135) NetType/WIFI Language/zh_CN",
          Accept: "*/*",
          Referer: "https://open.weixin.qq.com/",
        },
      },
      {
        prefix: "/api/weixin",
        target: "https://open.weixin.qq.com",
        headers: {
          "User-Agent": "Mozilla/5.0 (Linux; Android 7.0; Mi-4c Build/NRD90M; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/53.0.2785.49 Mobile MQQBrowser/6.2 TBS/043632 Safari/537.36 MicroMessenger/6.6.1.1220(0x26060135) NetType/WIFI Language/zh_CN",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
          Referer: "https://open.weixin.qq.com/",
        },
      },
      {
        prefix: "/api/hortor",
        target: "https://comb-platform.hortorgames.com",
        stripPrefix: true,
        headers: {
          "User-Agent": "Mozilla/5.0 (Linux; Android 12; 23117RK66C Build/V417IR; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/95.0.4638.74 Mobile Safari/537.36",
          Accept: "*/*",
          Host: "comb-platform.hortorgames.com",
          Connection: "keep-alive",
          "Content-Type": "text/plain; charset=utf-8",
          Origin: "https://open.weixin.qq.com",
          Referer: "https://open.weixin.qq.com/",
        },
      },
      ...(enableBackendProxy && backendOrigin
        ? [
            {
              prefix: "/api/v1",
              target: backendOrigin,
              stripPrefix: false,
              headers: {},
            },
            {
              prefix: "/ws",
              target: backendOrigin,
              stripPrefix: false,
              headers: {},
            },
          ]
        : []),
    ].sort((a, b) => b.prefix.length - a.prefix.length);

    const proxy = proxies.find((p) => url.pathname.startsWith(p.prefix));

    if (proxy) {
      if (!cors.allowed && cors.origin) {
        return new Response(JSON.stringify({ error: "CORS origin denied" }), {
          status: 403,
          headers: {
            ...cors.headers,
            "Content-Type": "application/json",
          },
        });
      }

      const targetUrl = new URL(proxy.target);
      targetUrl.pathname = proxy.stripPrefix === false
        ? url.pathname
        : (url.pathname.replace(proxy.prefix, "") || "/");
      targetUrl.search = url.search;

      const newHeaders = new Headers(request.headers);
      Object.entries(proxy.headers).forEach(([key, value]) => {
        newHeaders.set(key, value);
      });

      if (proxy.headers.Host) {
        newHeaders.set("Host", proxy.headers.Host);
      }

      const newRequest = new Request(targetUrl.toString(), {
        method: request.method,
        headers: newHeaders,
        body: request.body,
        redirect: "follow",
      });

      try {
        const response = await fetch(newRequest);
        const newResponse = new Response(response.body, response);
        Object.entries(cors.headers).forEach(([key, value]) => {
          newResponse.headers.set(key, value);
        });
        return newResponse;
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500,
          headers: {
            ...cors.headers,
            "Content-Type": "application/json",
          },
        });
      }
    }

    if (env.ASSETS) {
      const assetResponse = await env.ASSETS.fetch(request);
      const next = new Response(assetResponse.body, assetResponse);
      Object.entries(cors.headers).forEach(([key, value]) => {
        next.headers.set(key, value);
      });
      return next;
    }

    return new Response("Not Found", {
      status: 404,
      headers: cors.headers,
    });
  },
};
