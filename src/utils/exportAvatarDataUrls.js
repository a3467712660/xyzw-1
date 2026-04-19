const DEFAULT_MAX_BYTES = 60 * 1024;
const DEFAULT_TOTAL_BUDGET = 2 * 1024 * 1024;
const DEFAULT_CONCURRENCY = 4;

export const normalizeExportAvatarUrl = (value) => {
  const raw = String(value || "")
    .replace(/`/g, "")
    .replace(/^["']+|["']+$/g, "")
    .trim();
  if (!raw) return "";
  if (raw.startsWith("//")) {
    return `https:${raw}`;
  }
  if (raw.startsWith("/") && typeof window !== "undefined") {
    return `${window.location.origin}${raw}`;
  }
  return raw;
};

const blobToDataUrl = (blob) =>
  new Promise((resolve) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result || "")));
    reader.addEventListener("error", () => resolve(""));
    reader.readAsDataURL(blob);
  });

const sniffImageMimeType = (bytes) => {
  if (!bytes || bytes.length < 12) return "";
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4E &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0D &&
    bytes[5] === 0x0A &&
    bytes[6] === 0x1A &&
    bytes[7] === 0x0A
  ) {
    return "image/png";
  }
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
    return "image/jpeg";
  }
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  return "";
};

const fetchAvatarDataUrl = async (avatarUrl, { maxBytes }) => {
  const normalizedUrl = normalizeExportAvatarUrl(avatarUrl);
  if (!normalizedUrl) return "";
  try {
    const response = await fetch(normalizedUrl, {
      credentials: "omit",
      mode: "cors",
      referrerPolicy: "no-referrer",
    });
    if (!response.ok) {
      return "";
    }
    const type = String(response.headers.get("content-type") || "")
      .split(";")[0]
      .trim()
      .toLowerCase();
    const acceptedTypes = ["", "application/octet-stream", "binary/octet-stream", "image/png", "image/jpeg", "image/jpg", "image/webp"];
    if (!acceptedTypes.includes(type)) {
      return "";
    }
    const body = await response.arrayBuffer();
    if (!body.byteLength || body.byteLength > maxBytes) {
      return "";
    }
    const sniffedType = sniffImageMimeType(new Uint8Array(body));
    const safeType = type.startsWith("image/") ? type : sniffedType;
    if (!safeType) {
      return "";
    }
    return await blobToDataUrl(new Blob([body], { type: safeType }));
  } catch {
    return "";
  }
};

export const resolveExportAvatarDataUrls = async (
  items,
  {
    concurrency = DEFAULT_CONCURRENCY,
    maxBytes = DEFAULT_MAX_BYTES,
    totalBudget = DEFAULT_TOTAL_BUDGET,
    urlGetter = (item) => item?.avatar || item?.avatarUrl || item?.headImg || "",
  } = {},
) => {
  const rows = Array.isArray(items) ? items : [];
  const output = new Array(rows.length).fill("");
  let cursor = 0;
  let totalSize = 0;

  const workers = Array.from(
    { length: Math.min(concurrency, rows.length) },
    async () => {
      while (cursor < rows.length) {
        const index = cursor;
        cursor += 1;
        if (totalSize >= totalBudget) continue;
        const avatarDataUrl = await fetchAvatarDataUrl(urlGetter(rows[index]), {
          maxBytes,
        });
        if (!avatarDataUrl) continue;
        const nextSize = avatarDataUrl.length;
        if (totalSize + nextSize > totalBudget) {
          continue;
        }
        totalSize += nextSize;
        output[index] = avatarDataUrl;
      }
    },
  );

  await Promise.all(workers);
  return output;
};
