const normalizeSecretValue = (value) => {
  if (Array.isArray(value)) {
    return String(value[0] || "").trim();
  }
  return String(value || "").trim();
};

const getRouteHash = (route) => {
  if (route?.hash !== undefined) {
    return String(route.hash || "");
  }
  if (typeof window !== "undefined") {
    return String(window.location.hash || "");
  }
  return "";
};

const parseHashParams = (route) => {
  const rawHash = getRouteHash(route).replace(/^#/, "");
  return new URLSearchParams(rawHash);
};

export const readRouteSecret = (route, key) => {
  const normalizedKey = String(key || "").trim();
  if (!normalizedKey) {
    return { value: "", source: "" };
  }

  const hashParams = parseHashParams(route);
  const hashValue = normalizeSecretValue(hashParams.get(normalizedKey));
  if (hashValue) {
    return { value: hashValue, source: "hash" };
  }

  const queryValue = normalizeSecretValue(route?.query?.[normalizedKey]);
  if (queryValue) {
    return { value: queryValue, source: "query" };
  }

  return { value: "", source: "" };
};

export const buildRouteWithoutSecret = (route, key) => {
  const normalizedKey = String(key || "").trim();
  const query = {};
  Object.entries(route?.query || {}).forEach(([queryKey, value]) => {
    if (queryKey === normalizedKey || value == null) {
      return;
    }
    query[queryKey] = value;
  });

  const hashParams = parseHashParams(route);
  if (normalizedKey) {
    hashParams.delete(normalizedKey);
  }
  const nextHash = hashParams.toString();

  return {
    path: route?.path || "/",
    query,
    hash: nextHash ? `#${nextHash}` : "",
  };
};
