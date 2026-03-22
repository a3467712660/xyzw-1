import { triggerBlobDownload } from "@/utils/download";
import { getTokenSortConfig, setTokenSortConfig } from "@/services/tokenImport/tokenImportPreferences";
import { NCheckbox, NInput, NRadio, NRadioGroup } from "naive-ui/es";
import { computed, h, ref } from "vue";

const MAX_IMPORT_FILE_SIZE = 1024 * 1024;
const EXPORT_CONFIRM_KEYWORD = "EXPORT";
const ENCRYPTED_FORMAT = "xyzw-token-export-encrypted";
const ENCRYPTION_ITERATIONS = 250000;
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const isEncryptedExportPayload = (payload) => Boolean(
  payload
  && typeof payload === "object"
  && payload.format === ENCRYPTED_FORMAT
  && payload.ciphertext,
);

const arrayBufferToBase64 = (buffer) => {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
};

const base64ToUint8Array = (base64) => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

const deriveEncryptionKey = async (passphrase, salt) => {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(passphrase),
    { name: "PBKDF2" },
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: ENCRYPTION_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
};

const containsSensitiveTokenFields = (payload) => {
  const tokenList = payload?.payload?.tokens || payload?.tokens || [];
  if (!Array.isArray(tokenList))
    return false;
  return tokenList.some((token) => String(token?.token || "").trim().length > 0);
};

export function useTokenImportListActions({
  dialog,
  loadBinFiles,
  message,
  refreshToken,
  t,
  tokenStore,
}) {
  const dragIndex = ref(null);
  const sortConfig = ref(getTokenSortConfig());

  const sortedTokens = computed(() => {
    if (sortConfig.value.field === "manual") {
      return tokenStore.gameTokens;
    }

    return [...tokenStore.gameTokens].sort((tokenA, tokenB) => {
      let valueA;
      let valueB;

      switch (sortConfig.value.field) {
        case "name":
          valueA = tokenA.name?.toLowerCase() || "";
          valueB = tokenB.name?.toLowerCase() || "";
          break;
        case "server":
          valueA = tokenA.server?.toLowerCase() || "";
          valueB = tokenB.server?.toLowerCase() || "";
          break;
        case "createdAt":
          valueA = new Date(tokenA.createdAt || 0).getTime();
          valueB = new Date(tokenB.createdAt || 0).getTime();
          break;
        case "lastUsed":
          valueA = new Date(tokenA.lastUsed || 0).getTime();
          valueB = new Date(tokenB.lastUsed || 0).getTime();
          break;
        default:
          valueA = tokenA.name?.toLowerCase() || "";
          valueB = tokenB.name?.toLowerCase() || "";
      }

      if (valueA < valueB) {
        return sortConfig.value.direction === "asc" ? -1 : 1;
      }
      if (valueA > valueB) {
        return sortConfig.value.direction === "asc" ? 1 : -1;
      }
      return 0;
    });
  });

  const toggleSort = (field) => {
    if (sortConfig.value.field === field) {
      sortConfig.value.direction
        = sortConfig.value.direction === "asc" ? "desc" : "asc";
    } else {
      sortConfig.value.field = field;
      sortConfig.value.direction = "asc";
    }

    setTokenSortConfig(sortConfig.value);
  };

  const getSortIcon = (field) => {
    if (sortConfig.value.field !== field)
      return null;
    return sortConfig.value.direction === "asc" ? "↑" : "↓";
  };

  const handleDragStart = (index, event) => {
    dragIndex.value = index;
    event.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (index, event) => {
    event.preventDefault();
    if (dragIndex.value === null || dragIndex.value === index)
      return;

    const currentTokens = [...sortedTokens.value];
    const draggedItem = currentTokens[dragIndex.value];

    currentTokens.splice(dragIndex.value, 1);
    currentTokens.splice(index, 0, draggedItem);

    tokenStore.gameTokens = currentTokens;
    sortConfig.value.field = "manual";
    setTokenSortConfig(sortConfig.value);
    dragIndex.value = null;
    message.success(t("tokenImport.messages.tokenOrderUpdated"));
  };

  const refreshAllTokens = async () => {
    if (!tokenStore.gameTokens.length) {
      message.warning(t("tokenImport.messages.noRefreshableTokens"));
      return;
    }

    const tokensToRefresh = tokenStore.gameTokens.filter(
      (token) =>
        token.importMethod === "url"
        || token.importMethod === "wxQrcode"
        || token.importMethod === "bin",
    );
    const manualTokens = tokenStore.gameTokens.filter(
      (token) => token.importMethod === "manual",
    );

    if (tokensToRefresh.length === 0) {
      message.warning(t("tokenImport.messages.noAutoRefreshTokens"));
      return;
    }

    dialog.warning({
      title: t("tokenImport.dialogs.bulkRefresh.title"),
      content: t("tokenImport.dialogs.bulkRefresh.content"),
      positiveText: t("tokenImport.dialogs.bulkRefresh.confirm"),
      negativeText: t("tokenImport.common.cancel"),
      onPositiveClick: async () => {
        try {
          let successCount = 0;
          let failCount = 0;
          const loadingMessage = message.loading(
            t("tokenImport.messages.bulkRefreshProgress", {
              current: 0,
              total: tokensToRefresh.length,
            }),
            { duration: 0 },
          );

          for (let i = 0; i < tokensToRefresh.length; i++) {
            const token = tokensToRefresh[i];

            try {
              loadingMessage.content = t("tokenImport.messages.bulkRefreshItemProgress", {
                current: i + 1,
                total: tokensToRefresh.length,
                name: token.name,
              });
              await refreshToken(token);
              successCount++;
            } catch (error) {
              console.error(`刷新Token "${token.name}" 失败:`, error);
              failCount++;
            }

            if (i < tokensToRefresh.length - 1) {
              await new Promise((resolve) => setTimeout(resolve, 500));
            }
          }

          loadingMessage.destroy();

          if (failCount === 0) {
            message.success(
              t("tokenImport.messages.bulkRefreshAllSuccess", {
                count: successCount,
              }),
            );
          } else {
            message.warning(
              t("tokenImport.messages.bulkRefreshPartial", {
                success: successCount,
                fail: failCount,
              }),
            );
          }

          if (manualTokens.length > 0) {
            message.info(
              t("tokenImport.messages.manualTokensNeedRefresh", {
                count: manualTokens.length,
              }),
            );
          }
        } catch (error) {
          message.error(
            t("tokenImport.messages.bulkRefreshError", {
              error: error.message,
            }),
          );
        }
      },
    });
  };

  const exportTokens = () => {
    const selectedMode = ref("metadata");
    const exportKeyword = ref("");
    const plaintextRiskAccepted = ref(false);
    const encryptPassphrase = ref("");

    const encryptExportPayload = async (passphrase, payload) => {
      if (!crypto?.subtle) {
        throw new Error(t("tokenImport.messages.webCryptoUnsupported"));
      }
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const key = await deriveEncryptionKey(passphrase, salt);
      const plaintextBytes = textEncoder.encode(JSON.stringify(payload));
      const ciphertext = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        key,
        plaintextBytes,
      );

      return {
        version: 1,
        format: ENCRYPTED_FORMAT,
        exportedAt: new Date().toISOString(),
        kdf: {
          name: "PBKDF2",
          hash: "SHA-256",
          iterations: ENCRYPTION_ITERATIONS,
          salt: arrayBufferToBase64(salt),
        },
        cipher: {
          name: "AES-GCM",
          iv: arrayBufferToBase64(iv),
        },
        ciphertext: arrayBufferToBase64(ciphertext),
      };
    };

    dialog.warning({
      title: t("tokenImport.exportWizard.title"),
      positiveText: t("tokenImport.exportWizard.confirm"),
      negativeText: t("tokenImport.common.cancel"),
      content: () =>
        h("div", { style: "display:flex;flex-direction:column;gap:12px;" }, [
          h("div", { style: "line-height:1.5;" }, t("tokenImport.exportWizard.description")),
          h(
            NRadioGroup,
            {
              "value": selectedMode.value,
              "onUpdate:value": (value) => {
                selectedMode.value = String(value || "metadata");
              },
            },
            {
              default: () => [
                h("div", { style: "display:flex;flex-direction:column;gap:8px;" }, [
                  h(
                    NRadio,
                    { value: "metadata" },
                    { default: () => t("tokenImport.exportWizard.modes.metadata") },
                  ),
                  h(
                    NRadio,
                    { value: "encrypted" },
                    { default: () => t("tokenImport.exportWizard.modes.encrypted") },
                  ),
                  h(
                    NRadio,
                    { value: "plaintext" },
                    { default: () => t("tokenImport.exportWizard.modes.plaintext") },
                  ),
                ]),
              ],
            },
          ),
          selectedMode.value === "plaintext"
            ? h("div", { style: "display:flex;flex-direction:column;gap:8px;" }, [
                h(
                  "div",
                  { style: "color:#d03050;line-height:1.5;" },
                  t("tokenImport.exportWizard.plaintextWarning"),
                ),
                h(
                  NCheckbox,
                  {
                    "checked": plaintextRiskAccepted.value,
                    "onUpdate:checked": (checked) => {
                      plaintextRiskAccepted.value = Boolean(checked);
                    },
                  },
                  { default: () => t("tokenImport.exportWizard.riskAcknowledge") },
                ),
                h(NInput, {
                  "value": exportKeyword.value,
                  "placeholder": t("tokenImport.exportWizard.keywordPlaceholder"),
                  "onUpdate:value": (value) => {
                    exportKeyword.value = String(value || "");
                  },
                }),
              ])
            : null,
          selectedMode.value === "encrypted"
            ? h(NInput, {
                "type": "password",
                "showPasswordOn": "click",
                "value": encryptPassphrase.value,
                "placeholder": t("tokenImport.exportWizard.passphrasePlaceholder"),
                "onUpdate:value": (value) => {
                  encryptPassphrase.value = String(value || "");
                },
              })
            : null,
        ]),
      onPositiveClick: async () => {
        if (selectedMode.value === "plaintext") {
          const keyword = String(exportKeyword.value || "").trim();
          if (!plaintextRiskAccepted.value || keyword !== EXPORT_CONFIRM_KEYWORD) {
            message.warning(t("tokenImport.messages.exportPlaintextConfirmMissing"));
            return false;
          }
        }

        if (selectedMode.value === "encrypted") {
          if (!crypto?.subtle) {
            message.error(t("tokenImport.messages.webCryptoUnsupported"));
            return false;
          }
          if (String(encryptPassphrase.value || "").trim().length < 8) {
            message.warning(t("tokenImport.messages.passphraseTooShort"));
            return false;
          }
        }

        try {
          const fileDate = new Date().toISOString().split("T")[0];
          if (selectedMode.value === "encrypted") {
            const rawPayload = tokenStore.exportTokens({ mode: "full" });
            const encryptedPayload = await encryptExportPayload(
              String(encryptPassphrase.value || "").trim(),
              rawPayload,
            );
            const dataBlob = new Blob([JSON.stringify(encryptedPayload, null, 2)], {
              type: "application/json",
            });
            triggerBlobDownload({
              blob: dataBlob,
              fileName: `tokens_backup_${fileDate}.json.enc`,
              appendToBody: false,
            });
            message.success(t("tokenImport.messages.tokensExportedEncrypted"));
            return true;
          }

          const exportMode = selectedMode.value === "plaintext" ? "full" : "metadata";
          const data = tokenStore.exportTokens({ mode: exportMode });
          const dataStr = JSON.stringify(data, null, 2);
          const dataBlob = new Blob([dataStr], { type: "application/json" });
          triggerBlobDownload({
            blob: dataBlob,
            fileName: `tokens_backup_${fileDate}.json`,
            appendToBody: false,
          });
          message.success(
            selectedMode.value === "plaintext"
              ? t("tokenImport.messages.tokensExportedPlaintext")
              : t("tokenImport.messages.tokensExportedMetadata"),
          );
          return true;
        } catch (error) {
          message.error(
            t("tokenImport.messages.exportFailedWithReason", {
              error: error?.message || "",
            }),
          );
          return false;
        }
      },
    });
  };

  const importTokenFile = () => {
    const requestPassphraseByDialog = ({
      title,
      prompt,
      placeholder,
      positiveText,
      negativeText,
    }) =>
      new Promise((resolve) => {
        const passphrase = ref("");
        let settled = false;
        const finish = (value) => {
          if (settled)
            return;
          settled = true;
          resolve(String(value || ""));
        };

        dialog.warning({
          title,
          positiveText,
          negativeText,
          content: () =>
            h("div", { style: "display:flex;flex-direction:column;gap:12px;" }, [
              h("div", { style: "line-height:1.5;" }, String(prompt || "")),
              h(NInput, {
                "type": "password",
                "showPasswordOn": "click",
                "value": passphrase.value,
                placeholder,
                "autofocus": true,
                "onUpdate:value": (value) => {
                  passphrase.value = String(value || "");
                },
              }),
            ]),
          onPositiveClick: () => {
            const normalized = String(passphrase.value || "").trim();
            if (normalized.length < 8) {
              message.warning(t("tokenImport.messages.passphraseTooShort"));
              return false;
            }
            finish(normalized);
            return true;
          },
          onNegativeClick: () => {
            finish("");
          },
          onClose: () => {
            finish("");
          },
        });
      });

    const decryptImportPayload = async (passphrase, encryptedPayload) => {
      if (!crypto?.subtle) {
        throw new Error(t("tokenImport.messages.webCryptoUnsupported"));
      }
      const salt = base64ToUint8Array(encryptedPayload?.kdf?.salt || "");
      const iv = base64ToUint8Array(encryptedPayload?.cipher?.iv || "");
      const ciphertext = base64ToUint8Array(encryptedPayload?.ciphertext || "");
      const iterations = Number(encryptedPayload?.kdf?.iterations || ENCRYPTION_ITERATIONS);
      if (!salt.length || !iv.length || !ciphertext.length) {
        throw new Error(t("tokenImport.messages.decryptFormatInvalid"));
      }

      const keyMaterial = await crypto.subtle.importKey(
        "raw",
        textEncoder.encode(passphrase),
        { name: "PBKDF2" },
        false,
        ["deriveKey"],
      );
      const key = await crypto.subtle.deriveKey(
        {
          name: "PBKDF2",
          salt,
          iterations,
          hash: "SHA-256",
        },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        false,
        ["decrypt"],
      );
      const plaintext = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        key,
        ciphertext,
      );
      return JSON.parse(textDecoder.decode(plaintext));
    };

    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,.enc,.json.enc";
    input.onchange = async (e) => {
      const file = e?.target?.files?.[0];
      if (file) {
        if (file.size > MAX_IMPORT_FILE_SIZE) {
          message.error(
            t("tokenImport.messages.importFileTooLarge", {
              maxSizeMb: 1,
            }),
          );
          return;
        }

        try {
          const fileText = await file.text();
          const parsedData = JSON.parse(fileText);
          let importPayload = parsedData;
          if (isEncryptedExportPayload(parsedData)) {
            const passphrase = await requestPassphraseByDialog({
              title: t("tokenImport.importWizard.decryptTitle"),
              prompt: t("tokenImport.importWizard.decryptPrompt"),
              placeholder: t("tokenImport.importWizard.decryptPlaceholder"),
              positiveText: t("tokenImport.common.confirm"),
              negativeText: t("tokenImport.common.cancel"),
            });
            if (!passphrase) {
              message.warning(t("tokenImport.messages.decryptCancelled"));
              return;
            }
            importPayload = await decryptImportPayload(passphrase, parsedData);
          }

          const result = tokenStore.importTokens(importPayload);
          if (!result.success) {
            message.error(result.message);
            return;
          }

          const importedCount = Number(result.importedCount || 0);
          const sensitiveTokenCount = Number(result.sensitiveTokenCount || 0);
          const replacedExisting = Number(result.replacedExisting || 0);
          const hasSensitive = typeof result.containsSensitiveToken === "boolean"
            ? result.containsSensitiveToken
            : containsSensitiveTokenFields(importPayload);

          dialog.info({
            title: t("tokenImport.messages.importSummaryTitle"),
            content: t("tokenImport.messages.importSummaryContent", {
              importedCount,
              sensitiveTokenCount,
              replacedExisting,
              hasSensitive: hasSensitive ? t("tokenImport.messages.yes") : t("tokenImport.messages.no"),
            }),
            positiveText: t("tokenImport.common.confirm"),
          });

          message.success(
            t("tokenImport.messages.importSuccessWithCount", {
              count: importedCount,
            }),
          );
        } catch (error) {
          message.error(
            t("tokenImport.messages.importFailedWithReason", {
              error: error?.message || t("tokenImport.messages.fileFormatError"),
            }),
          );
        } finally {
          input.value = "";
        }
      }
    };
    input.click();
  };

  const cleanExpiredTokens = async () => {
    const count = await tokenStore.cleanExpiredTokens();
    message.success(t("tokenImport.messages.cleanedExpired", { count }));
  };

  const disconnectAll = () => {
    tokenStore.gameTokens.forEach((token) => {
      tokenStore.closeWebSocketConnection(token.id);
    });
    message.success(t("tokenImport.messages.allDisconnected"));
  };

  const clearAllTokens = () => {
    dialog.error({
      title: t("tokenImport.dialogs.clearAll.title"),
      content: t("tokenImport.dialogs.clearAll.content"),
      positiveText: t("tokenImport.dialogs.clearAll.confirm"),
      negativeText: t("tokenImport.common.cancel"),
      onPositiveClick: async () => {
        await tokenStore.clearAllTokens();
        await loadBinFiles();
        message.success(t("tokenImport.messages.allTokensCleared"));
      },
    });
  };

  const updateAllTokenInfo = async () => {
    if (tokenStore.gameTokens.length === 0) {
      message.warning(t("tokenImport.messages.noUpdatableTokens"));
      return;
    }

    dialog.warning({
      title: t("tokenImport.dialogs.updateAllInfo.title"),
      content: t("tokenImport.dialogs.updateAllInfo.content"),
      positiveText: t("tokenImport.dialogs.updateAllInfo.confirm"),
      negativeText: t("tokenImport.common.cancel"),
      onPositiveClick: async () => {
        try {
          let successCount = 0;
          let failCount = 0;
          const totalTokens = tokenStore.gameTokens.length;
          const loadingMessage = message.loading(
            t("tokenImport.messages.updateInfoProgress", {
              current: 0,
              total: totalTokens,
            }),
            { duration: 0 },
          );

          for (let i = 0; i < tokenStore.gameTokens.length; i++) {
            const token = tokenStore.gameTokens[i];
            loadingMessage.content = t("tokenImport.messages.updateInfoItemProgress", {
              current: i + 1,
              total: totalTokens,
              name: token.name,
            });

            try {
              await tokenStore.selectToken(token.id);
              await new Promise((resolve) => setTimeout(resolve, 1000));
              tokenStore.closeWebSocketConnection(token.id);
              successCount++;
              message.success(
                t("tokenImport.messages.updateInfoItemSuccess", {
                  name: token.name,
                }),
              );
            } catch (error) {
              console.error(`更新Token "${token.name}" 失败:`, error);
              failCount++;
              message.error(
                t("tokenImport.messages.updateInfoItemFailed", {
                  name: token.name,
                }),
              );
            }

            if (i < tokenStore.gameTokens.length - 1) {
              await new Promise((resolve) => setTimeout(resolve, 500));
            }
          }

          loadingMessage.destroy();

          if (failCount === 0) {
            message.success(
              t("tokenImport.messages.updateInfoAllSuccess", {
                count: successCount,
              }),
            );
          } else {
            message.warning(
              t("tokenImport.messages.updateInfoPartial", {
                success: successCount,
                fail: failCount,
              }),
            );
          }
        } catch (error) {
          message.error(
            t("tokenImport.messages.updateInfoError", {
              error: error.message,
            }),
          );
        }
      },
    });
  };

  const bulkOptions = computed(() => [
    { label: t("tokenImport.bulk.refreshAll"), key: "refreshAll" },
    { label: t("tokenImport.bulk.updateInfo"), key: "updateInfo" },
    { label: t("tokenImport.bulk.exportAll"), key: "export" },
    { label: t("tokenImport.bulk.importFile"), key: "import" },
    { label: t("tokenImport.bulk.cleanExpired"), key: "clean" },
    { label: t("tokenImport.bulk.disconnectAll"), key: "disconnect" },
    { label: t("tokenImport.bulk.clearAll"), key: "clear" },
  ]);

  const handleBulkAction = (key) => {
    switch (key) {
      case "refreshAll":
        refreshAllTokens();
        break;
      case "updateInfo":
        updateAllTokenInfo();
        break;
      case "export":
        exportTokens();
        break;
      case "import":
        importTokenFile();
        break;
      case "clean":
        cleanExpiredTokens();
        break;
      case "disconnect":
        disconnectAll();
        break;
      case "clear":
        clearAllTokens();
        break;
    }
  };

  return {
    bulkOptions,
    getSortIcon,
    handleBulkAction,
    handleDragOver,
    handleDragStart,
    handleDrop,
    sortConfig,
    sortedTokens,
    toggleSort,
  };
}
