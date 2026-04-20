import * as dns from "node:dns";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import { isHostAllowed } from "./hostAllowlist.js";

const REDIRECT_STATUS_CODES = new Set([301, 302, 303, 307, 308]);
const DEFAULT_MAX_REDIRECTS = 3;

const IPV4_BLOCKLIST = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
];
const PROXY_FAKE_IPV4_RANGES = [
  ["198.18.0.0", 15],
];

const IPV6_BLOCKLIST_PREFIXES = [
  "::/128",
  "::1/128",
  "fc00::/7",
  "fe80::/10",
  "ff00::/8",
];

const stripIpv6Brackets = (value) =>
  String(value || "").trim().replace(/^\[(.*)\]$/, "$1");

const normalizeIp = (value) => stripIpv6Brackets(value).toLowerCase();

const normalizeHost = (value) => stripIpv6Brackets(value).trim().toLowerCase();

const extractIpv4MappedIpv6 = (value) => {
  const match = normalizeIp(value).match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  return match?.[1] || "";
};

const toComparableIp = (value) => {
  const normalized = normalizeIp(value);
  return extractIpv4MappedIpv6(normalized) || normalized;
};

const mapIpv4ToInt = (value) =>
  value
    .split(".")
    .map((segment) => Number(segment))
    .reduce((acc, segment) => (acc << 8) + segment, 0) >>> 0;

const ipv4CidrContains = (ip, cidrBase, prefixLength) => {
  const mask =
    prefixLength === 0 ? 0 : (0xffffffff << (32 - prefixLength)) >>> 0;
  return (mapIpv4ToInt(ip) & mask) === (mapIpv4ToInt(cidrBase) & mask);
};

const matchesIpv6BlockedPrefix = (ip) => {
  if (ip === "::" || ip === "::1") {
    return true;
  }

  if (/^fc/i.test(ip) || /^fd/i.test(ip)) {
    return true;
  }

  if (/^ff/i.test(ip)) {
    return true;
  }

  return /^fe[89ab]/i.test(ip);
};

const isProxyFakeIpAddress = (value) => {
  const normalized = toComparableIp(value);
  if (net.isIP(normalized) !== 4) {
    return false;
  }
  return PROXY_FAKE_IPV4_RANGES.some(([cidrBase, prefixLength]) =>
    ipv4CidrContains(normalized, cidrBase, prefixLength),
  );
};

export const isBlockedIpAddress = (
  value,
  { allowProxyFakeIpAddresses = false } = {},
) => {
  const normalized = toComparableIp(value);
  const family = net.isIP(normalized);
  if (family === 4) {
    if (allowProxyFakeIpAddresses && isProxyFakeIpAddress(normalized)) {
      return false;
    }
    return IPV4_BLOCKLIST.some(([cidrBase, prefixLength]) =>
      ipv4CidrContains(normalized, cidrBase, prefixLength),
    );
  }

  if (family === 6) {
    return IPV6_BLOCKLIST_PREFIXES.some(() =>
      matchesIpv6BlockedPrefix(normalized),
    );
  }

  return false;
};

const matchesContentType = (contentType, allowedContentTypes = []) => {
  const normalized = String(contentType || "")
    .split(";")[0]
    .trim()
    .toLowerCase();
  if (!normalized) {
    return false;
  }

  return allowedContentTypes.some((entry) => {
    const allowed = String(entry || "").trim().toLowerCase();
    if (!allowed) {
      return false;
    }
    if (allowed.endsWith("/*+json")) {
      const prefix = allowed.slice(0, -"*+json".length);
      return normalized.startsWith(prefix) && normalized.endsWith("+json");
    }
    return normalized === allowed;
  });
};

const getHeaderValue = (headers, name) => {
  if (!headers) {
    return "";
  }
  if (typeof headers.get === "function") {
    return String(headers.get(name) || "").trim();
  }

  const direct = headers[String(name).toLowerCase()] ?? headers[name];
  if (Array.isArray(direct)) {
    return direct.join(", ").trim();
  }
  return String(direct || "").trim();
};

const discardResponseBody = (response) => {
  if (Buffer.isBuffer(response?.bodyBuffer)) {
    return;
  }

  const source = response?.body ?? response;
  if (!source) {
    return;
  }

  if (typeof source.getReader === "function") {
    source
      .getReader()
      .cancel()
      .catch(() => {});
    return;
  }

  if (typeof source.resume === "function") {
    source.resume();
    return;
  }

  if (typeof source.destroy === "function") {
    source.destroy();
  }
};

const createTimeoutError = () =>
  new ProxySafetyError("TIMEOUT", "upstream request timed out", {
    statusCode: 502,
  });

const getRemainingMs = (deadlineAt) => Math.max(0, deadlineAt - Date.now());

const getRemainingMsOrThrow = (deadlineAt) => {
  const remainingMs = getRemainingMs(deadlineAt);
  if (remainingMs <= 0) {
    throw createTimeoutError();
  }
  return remainingMs;
};

const readNodeResponseBodyWithinLimit = async (source, maxBytes, remainingMs) => {
  if (remainingMs <= 0) {
    throw createTimeoutError();
  }

  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    let settled = false;
    const timeoutError = createTimeoutError();
    const timer = setTimeout(() => {
      source.destroy?.();
      finish(timeoutError);
    }, remainingMs);

    const cleanup = () => {
      clearTimeout(timer);
      source.off("data", onData);
      source.off("end", onEnd);
      source.off("error", onError);
    };

    const finish = (error, buffer = null) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      if (error) {
        reject(error);
        return;
      }
      resolve(buffer || Buffer.alloc(0));
    };

    const onData = (value) => {
      const chunk = Buffer.from(value);
      total += chunk.length;
      if (total > maxBytes) {
        const error = new ProxySafetyError(
          "RESPONSE_TOO_LARGE",
          "upstream response exceeded max bytes",
          { statusCode: 502 },
        );
        source.destroy?.();
        finish(error);
        return;
      }
      chunks.push(chunk);
    };

    const onEnd = () => {
      finish(null, Buffer.concat(chunks, total));
    };

    const onError = (error) => {
      finish(error);
    };

    source.on("data", onData);
    source.on("end", onEnd);
    source.on("error", onError);
  });
};

const readWithDeadline = async (readFn, onTimeout, remainingMs) => {
  if (remainingMs <= 0) {
    throw createTimeoutError();
  }

  const timeoutError = createTimeoutError();
  let timer = null;

  try {
    return await Promise.race([
      Promise.resolve().then(readFn),
      new Promise((_, reject) => {
        timer = setTimeout(async () => {
          try {
            await onTimeout?.(timeoutError);
          } catch {
            // ignore cancellation errors on timeout cleanup
          }
          reject(timeoutError);
        }, remainingMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
};

const readResponseBodyWithinLimit = async (response, maxBytes, remainingMs) => {
  if (remainingMs <= 0) {
    throw createTimeoutError();
  }

  if (Buffer.isBuffer(response?.bodyBuffer)) {
    if (response.bodyBuffer.length > maxBytes) {
      throw new ProxySafetyError(
        "RESPONSE_TOO_LARGE",
        "upstream response exceeded max bytes",
        { statusCode: 502 },
      );
    }
    return Buffer.from(response.bodyBuffer);
  }

  const source = response?.body ?? response;
  if (!source) {
    return Buffer.alloc(0);
  }

  if (typeof source.getReader === "function") {
    const reader = source.getReader();

    try {
      return await readWithDeadline(
        async () => {
          const chunks = [];
          let total = 0;

          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              break;
            }
            const chunk = Buffer.from(value);
            total += chunk.length;
            if (total > maxBytes) {
              await reader.cancel();
              throw new ProxySafetyError(
                "RESPONSE_TOO_LARGE",
                "upstream response exceeded max bytes",
                { statusCode: 502 },
              );
            }
            chunks.push(chunk);
          }

          return Buffer.concat(chunks, total);
        },
        async (timeoutError) => {
          await reader.cancel(timeoutError);
        },
        remainingMs,
      );
    } finally {
      try {
        reader.releaseLock();
      } catch {
        // ignore reader release errors after cancel/end
      }
    }
  }

  if (typeof source.on === "function") {
    return readNodeResponseBodyWithinLimit(source, maxBytes, remainingMs);
  }

  if (typeof response?.arrayBuffer === "function") {
    const buffer = Buffer.from(
      await readWithDeadline(
        () => response.arrayBuffer(),
        null,
        remainingMs,
      ),
    );
    if (buffer.length > maxBytes) {
      throw new ProxySafetyError(
        "RESPONSE_TOO_LARGE",
        "upstream response exceeded max bytes",
        { statusCode: 502 },
      );
    }
    return buffer;
  }

  return Buffer.alloc(0);
};

const buildRedirectRequestState = ({ status, method, headers, body }) => {
  const nextMethod = String(method || "GET").toUpperCase();
  if (
    status === 303 ||
    ((status === 301 || status === 302) && nextMethod === "POST")
  ) {
    const nextHeaders = { ...(headers || {}) };
    delete nextHeaders["content-type"];
    delete nextHeaders["Content-Type"];
    delete nextHeaders["content-length"];
    delete nextHeaders["Content-Length"];
    return {
      method: "GET",
      headers: nextHeaders,
      body: undefined,
    };
  }

  return {
    method: nextMethod,
    headers: { ...(headers || {}) },
    body,
  };
};

const sanitizeLookupResult = (result) => {
  if (Array.isArray(result)) {
    return result
      .map((entry) => ({
        address: normalizeIp(entry?.address),
        family:
          Number(entry?.family) || net.isIP(normalizeIp(entry?.address)),
      }))
      .filter((entry) => entry.address);
  }

  return sanitizeLookupResult([result]);
};

const resolveAddressesForHost = async (
  hostname,
  lookup,
  { allowProxyFakeIpAddresses = false } = {},
) => {
  const normalizedHost = normalizeHost(hostname);
  const directIpFamily = net.isIP(normalizedHost);
  if (directIpFamily) {
    return [{ address: normalizedHost, family: directIpFamily }];
  }

  let result;
  try {
    result = await lookup(normalizedHost, { all: true, verbatim: true });
  } catch (error) {
    throw new ProxySafetyError(
      "DNS_RESOLUTION_FAILED",
      error?.message || "dns lookup failed",
      { statusCode: 502, cause: error },
    );
  }

  const addresses = sanitizeLookupResult(result);
  if (addresses.length === 0) {
    throw new ProxySafetyError(
      "DNS_RESOLUTION_FAILED",
      "dns lookup returned no addresses",
      { statusCode: 502 },
    );
  }

  if (
    addresses.some((entry) =>
      isBlockedIpAddress(entry.address, { allowProxyFakeIpAddresses }),
    )
  ) {
    throw new ProxySafetyError(
      "PRIVATE_IP_BLOCKED",
      "resolved address is private or reserved",
      { statusCode: 403, details: { addressCount: addresses.length } },
    );
  }

  return addresses;
};

const createPinnedLookup = (hostname, addresses) => {
  const normalizedHost = normalizeHost(hostname);
  const normalizedAddresses = addresses.map((entry) => ({
    address: normalizeIp(entry.address),
    family: Number(entry.family) || net.isIP(normalizeIp(entry.address)),
  }));

  return (lookupHostname, options, callback) => {
    const normalizedLookupHost = normalizeHost(lookupHostname);
    if (normalizedLookupHost !== normalizedHost) {
      callback(
        new Error(
          `proxy pinned lookup host mismatch: ${normalizedLookupHost || "unknown"}`,
        ),
      );
      return;
    }

    const nextOptions =
      options && typeof options === "object" ? options : {};
    const requestedFamily = Number(nextOptions.family) || 0;
    const matches = normalizedAddresses.filter(
      (entry) => requestedFamily === 0 || entry.family === requestedFamily,
    );

    if (matches.length === 0) {
      callback(
        new Error(
          `proxy pinned lookup missing ${requestedFamily ? `IPv${requestedFamily}` : "address"} for ${normalizedHost}`,
        ),
      );
      return;
    }

    if (nextOptions.all) {
      callback(
        null,
        matches.map((entry) => ({
          address: entry.address,
          family: entry.family,
        })),
      );
      return;
    }

    callback(null, matches[0].address, matches[0].family);
  };
};

const assertConnectedAddressAllowed = (
  connectedAddress,
  addresses,
  { allowProxyFakeIpAddresses = false } = {},
) => {
  const comparableConnectedAddress = toComparableIp(connectedAddress);
  if (!comparableConnectedAddress) {
    return;
  }

  const allowedAddresses = new Set(
    addresses.map((entry) => toComparableIp(entry.address)),
  );
  if (
    isBlockedIpAddress(comparableConnectedAddress, {
      allowProxyFakeIpAddresses,
    }) ||
    !allowedAddresses.has(comparableConnectedAddress)
  ) {
    throw new ProxySafetyError(
      "PRIVATE_IP_BLOCKED",
      "connected address is private or drifted outside validated dns results",
      {
        statusCode: 403,
        details: {
          connectedAddress: comparableConnectedAddress,
          addressCount: addresses.length,
        },
      },
    );
  }
};

const performPinnedNodeRequest = async ({
  url,
  method,
  headers,
  body,
  timeoutMs,
  lookup,
}) =>
  new Promise((resolve, reject) => {
    const isHttps = url.protocol === "https:";
    const transport = isHttps ? https : http;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const request = transport.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || undefined,
        path: `${url.pathname}${url.search}`,
        method,
        headers,
        lookup,
        signal: controller.signal,
        ...(isHttps && !net.isIP(url.hostname)
          ? { servername: url.hostname }
          : {}),
      },
      (response) => {
        clearTimeout(timer);
        resolve({
          status: response.statusCode || 0,
          headers: response.headers || {},
          body: response,
          connectedAddress:
            response.socket?.remoteAddress ||
            request.socket?.remoteAddress ||
            "",
        });
      },
    );

    request.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });

    if (body === undefined || body === null) {
      request.end();
      return;
    }
    request.end(body);
  });

const defaultLookup = (...args) => dns.promises.lookup(...args);

const defaultLogProxySafetyEvent = ({
  route,
  host,
  reason,
  status,
  redirectHost,
  resolvedAddressCount,
}) => {
  // eslint-disable-next-line no-console
  console.warn(
    `[proxy-safety] route=${String(route || "").trim() || "unknown"} host=${String(host || "").trim() || "unknown"} reason=${String(reason || "").trim() || "unknown"} redirectHost=${String(redirectHost || "").trim() || "none"} resolvedAddressCount=${Number(resolvedAddressCount) || 0} status=${Number(status) || 0}`,
  );
};

export class ProxySafetyError extends Error {
  constructor(
    reason,
    message,
    { statusCode = 502, details = null, cause = null } = {},
  ) {
    super(message);
    this.name = "ProxySafetyError";
    this.reason = String(reason || "FETCH_FAILED");
    this.statusCode = Number(statusCode) || 502;
    this.details = details || null;
    this.cause = cause || null;
  }
}

export const fetchProxyResource = async ({
  route = "",
  url,
  method = "GET",
  headers = {},
  body = undefined,
  allowedHosts,
  fallbackAllowedHosts = [],
  allowedContentTypes = [],
  timeoutMs,
  maxResponseBytes,
  maxRedirects = DEFAULT_MAX_REDIRECTS,
  lookup = defaultLookup,
  requestImpl = null,
  logEvent = defaultLogProxySafetyEvent,
  allowProxyFakeIpAddresses = false,
}) => {
  if (requestImpl && process.env.NODE_ENV !== "test") {
    throw new ProxySafetyError(
      "FETCH_IMPL_NOT_ALLOWED",
      "custom request impl is only allowed in test",
      { statusCode: 502 },
    );
  }

  const effectiveRequestImpl = requestImpl || performPinnedNodeRequest;

  let currentUrl = new URL(url);
  let currentRequestState = {
    method: String(method || "GET").toUpperCase(),
    headers: { ...(headers || {}) },
    body,
  };

  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    const deadlineAt = Date.now() + timeoutMs;

    if (!["http:", "https:"].includes(currentUrl.protocol)) {
      throw new ProxySafetyError(
        "UNSUPPORTED_PROTOCOL",
        "unsupported upstream protocol",
        { statusCode: 400 },
      );
    }

    if (currentUrl.username || currentUrl.password) {
      throw new ProxySafetyError(
        "CREDENTIALS_NOT_ALLOWED",
        "credentials in upstream url are not allowed",
        { statusCode: 400 },
      );
    }

    if (
      !isHostAllowed(currentUrl.hostname, allowedHosts, fallbackAllowedHosts)
    ) {
      throw new ProxySafetyError(
        hop > 0 ? "REDIRECT_BLOCKED" : "HOST_NOT_ALLOWED",
        hop > 0
          ? "redirect target host is not allowlisted"
          : "upstream host is not allowlisted",
        { statusCode: hop > 0 ? 502 : 403 },
      );
    }

    const addresses = await resolveAddressesForHost(currentUrl.hostname, lookup, {
      allowProxyFakeIpAddresses,
    });
    const pinnedLookup = createPinnedLookup(currentUrl.hostname, addresses);

    let response;
    try {
      response = await effectiveRequestImpl({
        url: currentUrl,
        method: currentRequestState.method,
        headers: currentRequestState.headers,
        body: currentRequestState.body,
        timeoutMs: getRemainingMsOrThrow(deadlineAt),
        lookup: pinnedLookup,
        resolvedAddresses: addresses,
      });
      assertConnectedAddressAllowed(response?.connectedAddress, addresses, {
        allowProxyFakeIpAddresses,
      });
    } catch (error) {
      const isTimeout =
        String(error?.name || "").toLowerCase() === "aborterror" ||
        String(error?.code || "").toUpperCase() === "ABORT_ERR";
      if (error instanceof ProxySafetyError) {
        throw error;
      }
      throw new ProxySafetyError(
        isTimeout ? "TIMEOUT" : "FETCH_FAILED",
        error?.message || "upstream fetch failed",
        { statusCode: 502, cause: error, details: { addressCount: addresses.length } },
      );
    }

    if (REDIRECT_STATUS_CODES.has(response.status)) {
      const location = getHeaderValue(response.headers, "location");
      if (!location) {
        discardResponseBody(response);
        logEvent({
          route,
          host: currentUrl.hostname,
          reason: "REDIRECT_BLOCKED",
          status: response.status,
          redirectHost: "",
          resolvedAddressCount: addresses.length,
        });
        throw new ProxySafetyError(
          "REDIRECT_BLOCKED",
          "redirect response missing location header",
          { statusCode: 502 },
        );
      }
      if (hop >= maxRedirects) {
        discardResponseBody(response);
        logEvent({
          route,
          host: currentUrl.hostname,
          reason: "REDIRECT_BLOCKED",
          status: response.status,
          redirectHost: "",
          resolvedAddressCount: addresses.length,
        });
        throw new ProxySafetyError(
          "REDIRECT_BLOCKED",
          "too many upstream redirects",
          { statusCode: 502 },
        );
      }

      const nextUrl = new URL(location, currentUrl);
      discardResponseBody(response);
      logEvent({
        route,
        host: currentUrl.hostname,
        reason: "REDIRECT",
        status: response.status,
        redirectHost: nextUrl.hostname,
        resolvedAddressCount: addresses.length,
      });
      currentUrl = nextUrl;
      currentRequestState = buildRedirectRequestState({
        status: response.status,
        method: currentRequestState.method,
        headers: currentRequestState.headers,
        body: currentRequestState.body,
      });
      continue;
    }

    const contentType = getHeaderValue(response.headers, "content-type");
    if (!matchesContentType(contentType, allowedContentTypes)) {
      discardResponseBody(response);
      logEvent({
        route,
        host: currentUrl.hostname,
        reason: "CONTENT_TYPE_NOT_ALLOWED",
        status: response.status,
        redirectHost: "",
        resolvedAddressCount: addresses.length,
      });
      throw new ProxySafetyError(
        "CONTENT_TYPE_NOT_ALLOWED",
        "upstream content type is not allowed",
        { statusCode: 502 },
      );
    }

    const bodyBuffer = await readResponseBodyWithinLimit(
      response,
      maxResponseBytes,
      getRemainingMsOrThrow(deadlineAt),
    );
    return {
      status: response.status,
      bodyBuffer,
      contentType,
      finalUrl: currentUrl.toString(),
      resolvedAddressCount: addresses.length,
    };
  }

  throw new ProxySafetyError(
    "REDIRECT_BLOCKED",
    "redirect resolution failed",
    {
      statusCode: 502,
    },
  );
};
