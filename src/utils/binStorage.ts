import api from "@/api";
import useIndexedDB from "@/hooks/useIndexedDB";

const { getArrayBuffer, deleteArrayBuffer } = useIndexedDB();

const normalizeArrayBuffer = (value: ArrayBuffer | Uint8Array) => {
  if (value instanceof ArrayBuffer) {
    return value;
  }

  return value.buffer.slice(
    value.byteOffset,
    value.byteOffset + value.byteLength,
  ) as ArrayBuffer;
};

const migrateLegacyBin = async (
  tokenId: string,
  legacyKeys: string[] = [],
): Promise<ArrayBuffer | null> => {
  const keys = [tokenId, ...legacyKeys.filter(Boolean)];

  for (const key of keys) {
    const localBuffer = await getArrayBuffer(key);
    if (!localBuffer) {
      continue;
    }

    try {
      await api.binFiles.save(tokenId, localBuffer);
      await Promise.all(keys.map((item) => deleteArrayBuffer(item)));
    } catch {
      // 保留本地副本作为兼容兜底。
    }

    return localBuffer;
  }

  return null;
};

export const saveBinBuffer = async (
  tokenId: string,
  buffer: ArrayBuffer | Uint8Array,
) => {
  const normalized = normalizeArrayBuffer(buffer);
  await api.binFiles.save(tokenId, normalized);
  await deleteArrayBuffer(tokenId);
  return normalized;
};

export const loadBinBuffer = async (
  tokenId: string,
  legacyKeys: string[] = [],
  options: { confirmToken?: string } = {},
): Promise<ArrayBuffer | null> => {
  try {
    const response = await api.binFiles.get(tokenId, options.confirmToken || "");
    return normalizeArrayBuffer(response.data);
  } catch {
    return migrateLegacyBin(tokenId, legacyKeys);
  }
};

export const deleteBinBuffer = async (
  tokenId: string,
  legacyKeys: string[] = [],
) => {
  try {
    await api.binFiles.delete(tokenId);
  } catch {
    // 服务端不存在时继续清理本地兼容数据。
  }

  await Promise.all(
    [tokenId, ...legacyKeys.filter(Boolean)].map((key) =>
      deleteArrayBuffer(key),
    ),
  );
};
