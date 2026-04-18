import * as dns from "node:dns";
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

const IPV6_BLOCKLIST_PREFIXES = [
  "::/128",
  "::1/128",
  "fc00::/7",
  "fe80::/10",
  "ff00::/8",
];

const stripIpv6Brackets = (value) => String(value || "").trim().replace(/^\[(.*)\]$/, "$1");

const normalizeIp = (value) => stripIpv6Brackets(value).toLowerCase();

const normalizeHost = (value) => stripIpv6Brackets(value).trim().toLowerCase();

const mapIpv4ToInt = (value) =>
  value
    .split(".")
    .map((segment) => Number(segment))
    .reduce((acc, segment) => (acc << 8) + segment, 0) >>> 0;

const ipv4CidrContains = (ip, cidrBase, prefixLength) => {
  const mask = prefixLength === 0 ? 0 : (0xffffffff << (32 - prefixLength)) >>> 0;
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

const extractIpv4MappedIpv6 = (value) => {
  const match = normalizeIp(value).match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  return match?.[1] || "";
};

export const isBlockedIpAddress = (value) => {
  const normalized = normalizeIp(value);
  const mappedIpv4 = extractIpv4MappedIpv6(normalized);
  if (mappedIpv4) {
    return isBlockedIpAddress(mappedIpv4);
  }

  const family = net.isIP(normalized);
  if (family === 4) {
    return IPV4_BLOCKLIST.some(([cidrBase, prefixLength]) =>
      ipv4CidrContains(normalized, cidrBase, prefixLength),
    );
  }

  if (family === 6) {
    return IPV6_BLOCKLIST_PREFIXES.some(() => matchesIpv6BlockedPrefix(normalized));
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

const readResponseBodyWithinLimit = async (response, maxBytes) => {
  if (!response.body) {
    return Buffer.alloc(0);
  }

  if (typeof response.body.getReader !== "function") {
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > maxBytes) {
      throw new ProxySafetyError(
        "RESPONSE_TOO_LARGE",
        "upstream response exceeded max bytes",
        { statusCode: 502 },
      );
    }
    return buffer;
  }

  const reader = response.body.getReader();
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
};

const buildRedirectRequestState = ({ status, method, headers, body }) => {
  const nextMethod = String(method || "GET").toUpperCase();
  if (status === 303 || ((status === 301 || status === 302) && nextMethod === "POST")) {
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
        family: Number(entry?.family) || net.isIP(normalizeIp(entry?.address)),
      }))
      .filter((entry) => entry.address);
  }

  return sanitizeLookupResult([result]);
};

const resolveAddressesForHost = async (hostname, lookup) => {
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

  if (addresses.some((entry) => isBlockedIpAddress(entry.address))) {
    throw new ProxySafetyError(
      "PRIVATE_IP_BLOCKED",
      "resolved address is private or reserved",
      { statusCode: 403, details: { addressCount: addresses.length } },
    );
  }

  return addresses;
};

const defaultLookup = (...args) => dns.promises.lookup(...args);

const defaultFetch = (...args) => global.fetch(...args);

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
  constructor(reason, message, { statusCode = 502, details = null, cause = null } = {}) {
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
  fetchImpl = defaultFetch,
  logEvent = defaultLogProxySafetyEvent,
}) => {
  let currentUrl = new URL(url);
  let currentRequestState = {
    method: String(method || "GET").toUpperCase(),
    headers: { ...(headers || {}) },
    body,
  };

  for (let hop = 0; hop <= maxRedirects; hop += 1) {
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

    if (!isHostAllowed(currentUrl.hostname, allowedHosts, fallbackAllowedHosts)) {
      throw new ProxySafetyError(
        hop > 0 ? "REDIRECT_BLOCKED" : "HOST_NOT_ALLOWED",
        hop > 0 ? "redirect target host is not allowlisted" : "upstream host is not allowlisted",
        { statusCode: hop > 0 ? 502 : 403 },
      );
    }

    const addresses = await resolveAddressesForHost(currentUrl.hostname, lookup);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let response;
    try {
      response = await fetchImpl(currentUrl.toString(), {
        method: currentRequestState.method,
        headers: currentRequestState.headers,
        body: currentRequestState.body,
        redirect: "manual",
        signal: controller.signal,
      });
    } catch (error) {
      const isTimeout =
        String(error?.name || "").toLowerCase() === "aborterror";
      throw new ProxySafetyError(
        isTimeout ? "TIMEOUT" : "FETCH_FAILED",
        error?.message || "upstream fetch failed",
        { statusCode: 502, cause: error, details: { addressCount: addresses.length } },
      );
    } finally {
      clearTimeout(timer);
    }

    if (REDIRECT_STATUS_CODES.has(response.status)) {
      const location = String(response.headers.get("location") || "").trim();
      if (!location) {
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

    const contentType = String(response.headers.get("content-type") || "").trim();
    if (!matchesContentType(contentType, allowedContentTypes)) {
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

    const bodyBuffer = await readResponseBodyWithinLimit(response, maxResponseBytes);
    return {
      status: response.status,
      bodyBuffer,
      contentType,
      finalUrl: currentUrl.toString(),
      resolvedAddressCount: addresses.length,
    };
  }

  throw new ProxySafetyError("REDIRECT_BLOCKED", "redirect resolution failed", {
    statusCode: 502,
  });
};
