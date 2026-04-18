import { EventEmitter } from "node:events";
import https from "node:https";
import { PassThrough } from "node:stream";

const toBuffer = (value) => {
  if (Buffer.isBuffer(value)) {
    return Buffer.from(value);
  }
  if (value instanceof Uint8Array) {
    return Buffer.from(value);
  }
  if (value === undefined || value === null) {
    return Buffer.alloc(0);
  }
  return Buffer.from(String(value), "utf8");
};

const normalizeHeaders = (headers = {}) => {
  const normalized = {};
  Object.entries(headers).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      normalized[String(key).toLowerCase()] = value.map((entry) => String(entry));
      return;
    }
    normalized[String(key).toLowerCase()] = String(value);
  });
  return normalized;
};

export const buildRequestUrl = (options = {}) =>
  new URL(
    `${String(options.protocol || "https:")}//${String(options.hostname || "").trim()}${
      options.port ? `:${options.port}` : ""
    }${String(options.path || "/")}`,
  );

export const callLookup = (lookup, hostname, { family = 0, all = false } = {}) =>
  new Promise((resolve, reject) => {
    lookup(
      hostname,
      {
        family,
        all,
        verbatim: true,
      },
      (error, address, resolvedFamily) => {
        if (error) {
          reject(error);
          return;
        }
        if (all) {
          resolve(address);
          return;
        }
        resolve({
          address: String(address || ""),
          family: Number(resolvedFamily) || 0,
        });
      },
    );
  });

export const mockHttpsRequest = (t, responder) => {
  const requestMock = t.mock.method(https, "request", (options, onResponse) => {
    const chunks = [];
    const req = new EventEmitter();

    req.setTimeout = (_timeoutMs, callback) => {
      if (typeof callback === "function") {
        req.once("timeout", callback);
      }
      return req;
    };

    req.write = (chunk, encoding, callback) => {
      let nextEncoding = encoding;
      let nextCallback = callback;
      if (typeof nextEncoding === "function") {
        nextCallback = nextEncoding;
        nextEncoding = undefined;
      }
      chunks.push(
        Buffer.isBuffer(chunk)
          ? Buffer.from(chunk)
          : Buffer.from(String(chunk || ""), nextEncoding || "utf8"),
      );
      if (typeof nextCallback === "function") {
        nextCallback();
      }
      return true;
    };

    req.end = (chunk, encoding, callback) => {
      let nextChunk = chunk;
      let nextEncoding = encoding;
      let nextCallback = callback;
      if (typeof nextChunk === "function") {
        nextCallback = nextChunk;
        nextChunk = undefined;
        nextEncoding = undefined;
      } else if (typeof nextEncoding === "function") {
        nextCallback = nextEncoding;
        nextEncoding = undefined;
      }

      if (nextChunk !== undefined) {
        req.write(nextChunk, nextEncoding);
      }
      if (typeof nextCallback === "function") {
        nextCallback();
      }

      queueMicrotask(async () => {
        try {
          const responseSpec = (await responder({
            options,
            url: buildRequestUrl(options),
            bodyBuffer: Buffer.concat(chunks),
          })) || {};
          const response = new PassThrough();
          response.statusCode = Number(responseSpec.status) || 200;
          response.headers = normalizeHeaders(responseSpec.headers);
          response.socket = {
            remoteAddress: responseSpec.connectedAddress
              ? String(responseSpec.connectedAddress)
              : undefined,
          };
          onResponse?.(response);
          if (responseSpec.bodyBuffer) {
            response.end(toBuffer(responseSpec.bodyBuffer));
            return;
          }
          response.end(toBuffer(responseSpec.body));
        } catch (error) {
          req.emit("error", error);
        }
      });

      return req;
    };

    req.abort = () => req.destroy(new Error("request aborted"));
    req.destroy = (error) => {
      if (error) {
        queueMicrotask(() => req.emit("error", error));
      }
      return req;
    };

    return req;
  });

  t.after(() => requestMock.mock.restore());
  return requestMock;
};
