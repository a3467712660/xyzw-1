<template>
  <a-card>
    <template #extra>
      <div class="header-actions">
        <n-button size="small" @click="refreshTokens">
          <template #icon>
            <NIcon>
              <Refresh></Refresh>
            </NIcon>
          </template>
          <span class="btn-text">{{ t("tokenManager.actions.refresh") }}</span>
        </n-button>
        <n-button size="small" type="warning" @click="exportTokens">
          <template #icon>
            <i class="i-mdi:download"></i>
          </template>
          <span class="btn-text">{{ t("tokenManager.actions.export") }}</span>
        </n-button>
        <n-upload
          accept=".json,.enc,.json.enc"
          :show-file-list="false"
          @change="importTokens"
        >
          <n-button size="small" type="info">
            <template #icon>
              <NIcon>
                <CloudUpload></CloudUpload>
              </NIcon>
            </template>
            <span class="btn-text">{{ t("tokenManager.actions.import") }}</span>
          </n-button>
        </n-upload>
      </div>
    </template>
    <template #default>
      <!-- 用户Token -->
      <div class="token-section">
        <h4>{{ t("tokenManager.userToken.title") }}</h4>
        <div v-if="localTokenStore.userToken" class="token-item">
          <div class="token-info">
            <span class="token-label">{{
              t("tokenManager.labels.token")
            }}</span>
            <span class="token-value">{{
              maskToken(localTokenStore.userToken)
            }}</span>
          </div>
          <n-button size="tiny" type="error" @click="clearUserToken">
            {{ t("tokenManager.actions.clear") }}
          </n-button>
        </div>
        <div v-else class="empty-token">
          <span>{{ t("tokenManager.userToken.empty") }}</span>
        </div>
      </div>
      <!-- 游戏Token列表 -->
      <div class="token-section">
        <h4>
          {{
            t("tokenManager.gameTokens.title", {
              count: Object.keys(localTokenStore.gameTokens).length,
            })
          }}
        </h4>
        <div class="game-tokens-list">
          <div
            v-for="(tokenData, roleId) in localTokenStore.gameTokens"
            :key="roleId"
            class="game-token-item"
          >
            <div class="token-header">
              <div class="role-info">
                <span class="role-name">{{ tokenData.roleName }}</span>
                <span class="role-server">{{ tokenData.server }}</span>
              </div>
              <div class="token-actions">
                <n-button
                  size="tiny"
                  :type="
                    getWSStatus(roleId) === 'connected' ? 'success' : 'default'
                  "
                  @click="toggleWebSocket(roleId, tokenData)"
                >
                  {{
                    getWSStatus(roleId) === "connected"
                      ? t("tokenManager.actions.disconnectWs")
                      : t("tokenManager.actions.connectWs")
                  }}
                </n-button>

                <n-dropdown
                  trigger="click"
                  :options="getTokenMenuOptions(tokenData)"
                  @select="handleTokenAction($event, roleId, tokenData)"
                >
                  <n-button size="tiny" type="tertiary">
                    <template #icon>
                      <NIcon>
                        <EllipsisHorizontal></EllipsisHorizontal>
                      </NIcon>
                    </template>
                  </n-button>
                </n-dropdown>
              </div>
            </div>

            <div class="token-details">
              <div class="detail-item">
                <span class="detail-label">{{
                  t("tokenManager.labels.token")
                }}</span>
                <span class="detail-value">{{
                  maskToken(tokenData.token)
                }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">{{
                  t("tokenManager.labels.wsUrl")
                }}</span>
                <span class="detail-value">{{
                  maskedWsUrl(tokenData)
                }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">{{
                  t("tokenManager.labels.createdAt")
                }}</span>
                <span class="detail-value">{{
                  formatTime(tokenData.createdAt)
                }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">{{
                  t("tokenManager.labels.lastUsed")
                }}</span>
                <span class="detail-value">{{
                  formatTime(tokenData.lastUsed)
                }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">{{
                  t("tokenManager.labels.connectionStatus")
                }}</span>
                <n-tag
                  size="small"
                  :type="getWSStatusType(getWSStatus(roleId))"
                >
                  {{ getWSStatusText(getWSStatus(roleId)) }}
                </n-tag>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
    <!-- 批量操作 -->
    <template #actions>
      <n-button type="warning" @click="cleanExpiredTokens">
        {{ t("tokenManager.actions.cleanExpired") }}
      </n-button>
      <n-button type="error" @click="clearAllTokens">
        {{ t("tokenManager.actions.clearAll") }}
      </n-button>
    </template>
  </a-card>
</template>

<script setup>
import { h, ref } from "vue";
import { useI18n } from "vue-i18n";
import {
  NCheckbox,
  NIcon,
  NInput,
  NRadio,
  NRadioGroup,
  useDialog,
  useMessage,
} from "naive-ui/es";
import { useLocalTokenStore } from "@/stores/localTokenManager";
import { useGameRolesStore } from "@/stores/gameRoles";
import { fetchTokenPayloadFromUrl } from "@/services/tokenImport/tokenRemoteSource";
import { triggerBlobDownload } from "@/utils/download";
import {
  maskToken,
  sanitizeErrorForDisplay,
  sanitizeSourceUrlForDisplay,
  sanitizeWsUrl,
} from "@/utils/securitySanitizer";
import {
  confirmAndCopyFullToken as confirmAndCopySensitiveToken,
  copyMaskedToken,
} from "@/utils/sensitiveCopy";
import {
  CloudUpload,
  CopyOutline,
  Create,
  EllipsisHorizontal,
  Refresh,
  SyncCircle,
  TrashBin,
} from "@vicons/ionicons5";

const message = useMessage();
const dialog = useDialog();
const { locale, t } = useI18n();
const localTokenStore = useLocalTokenStore();
const gameRolesStore = useGameRolesStore();
const MAX_IMPORT_FILE_SIZE = 1024 * 1024;
const EXPORT_CONFIRM_KEYWORD = "EXPORT";
const ENCRYPTED_FORMAT = "xyzw-token-export-encrypted";
const ENCRYPTION_ITERATIONS = 250000;
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

// 方法
const maskedWsUrl = (tokenData) =>
  sanitizeWsUrl(tokenData?.wsUrl)
  || String(tokenData?.wsUrlDisplay || "").trim();
const maskedSourceUrl = (tokenData) =>
  sanitizeSourceUrlForDisplay(tokenData?.sourceUrl)
  || String(tokenData?.sourceUrlDisplay || "").trim();

const formatTime = (timestamp) => {
  const localeTag = locale.value === "zh-CN" ? "zh-CN" : "en-US";
  return new Date(timestamp).toLocaleString(localeTag);
};

const getWSStatus = (roleId) => {
  return localTokenStore.getWebSocketStatus(roleId);
};

const getWSStatusType = (status) => {
  switch (status) {
    case "connected":
      return "success";
    case "error":
      return "error";
    case "connecting":
      return "warning";
    default:
      return "default";
  }
};

const getWSStatusText = (status) => {
  switch (status) {
    case "connected":
      return t("tokenManager.wsStatus.connected");
    case "error":
      return t("tokenManager.wsStatus.error");
    case "connecting":
      return t("tokenManager.wsStatus.connecting");
    default:
      return t("tokenManager.wsStatus.disconnected");
  }
};

// 获取Token菜单选项
const getTokenMenuOptions = (tokenData) => {
  const options = [
    {
      label: t("tokenManager.menu.edit"),
      key: "edit",
      icon: () => h(NIcon, null, { default: () => h(Create) }),
    },
    {
      label: t("tokenManager.menu.copyToken"),
      key: "copy",
      icon: () => h(NIcon, null, { default: () => h(CopyOutline) }),
    },
    {
      label: t("tokenManager.menu.copyFullToken"),
      key: "copy-full",
      icon: () => h(NIcon, null, { default: () => h(CopyOutline) }),
    },
  ];

  // 如果是URL获取的Token，显示刷新选项
  if (tokenData.importMethod === "url" && tokenData.sourceUrl) {
    options.unshift({
      label: t("tokenManager.menu.refreshFromUrl"),
      key: "refresh-url",
      icon: () => h(NIcon, null, { default: () => h(SyncCircle) }),
    });
  } else {
    // 手动添加的Token显示重新生成选项
    options.unshift({
      label: t("tokenManager.menu.refreshToken"),
      key: "refresh",
      icon: () => h(NIcon, null, { default: () => h(Refresh) }),
    });
  }

  options.push(
    { type: "divider" },
    {
      label: t("tokenManager.menu.delete"),
      key: "delete",
      icon: () => h(NIcon, null, { default: () => h(TrashBin) }),
    },
  );

  return options;
};

const isEncryptedExportPayload = (payload) => {
  return Boolean(
    payload &&
    typeof payload === "object" &&
    payload.format === ENCRYPTED_FORMAT &&
    payload.ciphertext,
  );
};

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

const encryptExportPayload = async (passphrase, payload) => {
  if (!crypto?.subtle) {
    throw new Error(t("tokenManager.messages.webCryptoUnsupported"));
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

const decryptImportPayload = async (passphrase, encryptedPayload) => {
  if (!crypto?.subtle) {
    throw new Error(t("tokenManager.messages.webCryptoUnsupported"));
  }
  const salt = base64ToUint8Array(encryptedPayload?.kdf?.salt || "");
  const iv = base64ToUint8Array(encryptedPayload?.cipher?.iv || "");
  const ciphertext = base64ToUint8Array(encryptedPayload?.ciphertext || "");
  const iterations = Number(
    encryptedPayload?.kdf?.iterations || ENCRYPTION_ITERATIONS,
  );
  if (!salt.length || !iv.length || !ciphertext.length) {
    throw new Error(t("tokenManager.messages.decryptFormatInvalid"));
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
      if (settled) return;
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
            type: "password",
            showPasswordOn: "click",
            value: passphrase.value,
            placeholder,
            autofocus: true,
            "onUpdate:value": (value) => {
              passphrase.value = String(value || "");
            },
          }),
        ]),
      onPositiveClick: () => {
        const normalized = String(passphrase.value || "").trim();
        if (normalized.length < 8) {
          message.warning(t("tokenManager.messages.passphraseTooShort"));
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

// 处理Token菜单操作
const handleTokenAction = (action, roleId, tokenData) => {
  switch (action) {
    case "edit":
      editToken(roleId, tokenData);
      break;
    case "copy":
      copyTokenMasked(tokenData.token);
      break;
    case "copy-full":
      confirmAndCopyFullToken(tokenData.token);
      break;
    case "refresh":
      regenerateToken(roleId);
      break;
    case "refresh-url":
      refreshTokenFromUrl(roleId, tokenData);
      break;
    case "delete":
      removeToken(roleId);
      break;
  }
};

const refreshTokens = () => {
  localTokenStore.initTokenManager();
  message.success(t("tokenManager.messages.tokensRefreshed"));
};

const clearUserToken = () => {
  dialog.warning({
    title: t("tokenManager.dialogs.clearUserToken.title"),
    content: t("tokenManager.dialogs.clearUserToken.content"),
    positiveText: t("tokenManager.common.confirm"),
    negativeText: t("tokenManager.common.cancel"),
    onPositiveClick: () => {
      localTokenStore.clearUserToken();
      message.success(t("tokenManager.messages.userTokenCleared"));
    },
  });
};

const toggleWebSocket = (roleId, tokenData) => {
  const status = getWSStatus(roleId);

  if (status === "connected") {
    localTokenStore.closeWebSocketConnection(roleId);
    message.info(t("tokenManager.messages.wsDisconnected"));
  } else {
    try {
      localTokenStore.createWebSocketConnection(
        roleId,
        tokenData.token,
        tokenData.wsUrl,
      );
      message.success(t("tokenManager.messages.wsConnecting"));
    } catch (error) {
      message.error(t("tokenManager.messages.wsConnectFailed"));
    }
  }
};

const regenerateToken = (roleId) => {
  const oldTokenData = localTokenStore.getGameToken(roleId);
  if (!oldTokenData) {
    message.error(t("tokenManager.messages.tokenNotFound"));
    return;
  }

  // 检查是否有源URL可以重新获取
  if (!oldTokenData.sourceUrl) {
    message.warning(t("tokenManager.messages.sourceUrlMissing"));
    return;
  }

  dialog.info({
    title: t("tokenManager.dialogs.regenerateToken.title"),
    content: t("tokenManager.dialogs.regenerateToken.content"),
    positiveText: t("tokenManager.common.confirm"),
    negativeText: t("tokenManager.common.cancel"),
    onPositiveClick: async () => {
      try {
        // 显示加载状态
        const loadingMsg = message.loading(
          t("tokenManager.messages.regeneratingToken"),
          {
            duration: 0,
          },
        );

        const data = await fetchTokenPayloadFromUrl(oldTokenData.sourceUrl, {
          trustedOnly: true,
          useProxy: true,
        });

        // 更新token
        localTokenStore.updateGameToken(roleId, {
          token: data.token,
          server: data.server || oldTokenData.server,
          regeneratedAt: new Date().toISOString(),
          lastRefreshed: new Date().toISOString(),
        });

        // 如果当前token有连接，需要重新连接
        if (localTokenStore.getWebSocketStatus(roleId) === "connected") {
          localTokenStore.closeWebSocketConnection(roleId);
          setTimeout(() => {
            localTokenStore.createWebSocketConnection(
              roleId,
              data.token,
              oldTokenData.wsUrl,
            );
          }, 500);
        }

        loadingMsg.destroy();
        message.success(t("tokenManager.messages.tokenRegenerated"));
      } catch (error) {
        console.error("重新获取Token失败:", sanitizeErrorForDisplay(error));
        message.error(
          sanitizeErrorForDisplay(error) ||
            t("tokenManager.messages.tokenRegenerateFailed"),
        );
      }
    },
  });
};

const removeToken = (roleId) => {
  dialog.warning({
    title: t("tokenManager.dialogs.deleteToken.title"),
    content: t("tokenManager.dialogs.deleteToken.content"),
    positiveText: t("tokenManager.dialogs.deleteToken.confirm"),
    negativeText: t("tokenManager.common.cancel"),
    onPositiveClick: () => {
      localTokenStore.removeGameToken(roleId);
      message.success(t("tokenManager.messages.tokenDeleted"));
    },
  });
};

// 编辑Token（暂时显示提示信息，后续可以实现编辑功能）
const editToken = (roleId, tokenData) => {
  message.info(t("tokenManager.messages.editPending"));
};

const copyTokenMasked = async (token) => {
  await copyMaskedToken({
    token,
    message,
    successMessage: t("tokenManager.messages.tokenCopiedMasked"),
    failureMessage: t("tokenManager.messages.clipboardCopyFailed"),
  });
};

const confirmAndCopyFullToken = (token) => {
  confirmAndCopySensitiveToken({
    token,
    dialog,
    message,
    title: t("tokenManager.dialogs.copyFullToken.title"),
    content: t("tokenManager.dialogs.copyFullToken.content"),
    placeholder: t("tokenManager.dialogs.copyFullToken.placeholder"),
    positiveText: t("tokenManager.common.confirm"),
    negativeText: t("tokenManager.common.cancel"),
    successMessage: t("tokenManager.messages.tokenCopiedFull"),
    failureMessage: t("tokenManager.messages.clipboardCopyFailed"),
    missingConfirmMessage: t("tokenManager.messages.copyFullConfirmMissing"),
  });
};

// 从URL刷新Token
const refreshTokenFromUrl = async (roleId, tokenData) => {
  if (!tokenData.sourceUrl) {
    message.warning(t("tokenManager.messages.sourceUrlMissingShort"));
    return;
  }

  dialog.info({
    title: t("tokenManager.dialogs.refreshFromUrl.title"),
    content: t("tokenManager.dialogs.refreshFromUrl.content", {
      sourceUrl: maskedSourceUrl(tokenData),
    }),
    positiveText: t("tokenManager.common.confirm"),
    negativeText: t("tokenManager.common.cancel"),
    onPositiveClick: async () => {
      try {
        const loadingMsg = message.loading(
          t("tokenManager.messages.fetchingFromUrl"),
          {
            duration: 0,
          },
        );

        const data = await fetchTokenPayloadFromUrl(tokenData.sourceUrl, {
          useProxy: true,
          trustedOnly: true,
        });

        // 更新Token
        localTokenStore.updateGameToken(roleId, {
          token: data.token,
          lastUsed: new Date().toISOString(),
        });

        loadingMsg.destroy();
        message.success(t("tokenManager.messages.tokenRefreshSuccess"));
      } catch (error) {
        console.error("URL刷新Token失败:", sanitizeErrorForDisplay(error));
        message.error(
          t("tokenManager.messages.refreshFailedWithReason", {
            error: sanitizeErrorForDisplay(error),
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

  dialog.warning({
    title: t("tokenManager.exportWizard.title"),
    positiveText: t("tokenManager.exportWizard.confirm"),
    negativeText: t("tokenManager.common.cancel"),
    content: () =>
      h("div", { style: "display:flex;flex-direction:column;gap:12px;" }, [
        h(
          "div",
          { style: "line-height:1.5;" },
          t("tokenManager.exportWizard.description"),
        ),
        h(
          NRadioGroup,
          {
            value: selectedMode.value,
            "onUpdate:value": (value) => {
              selectedMode.value = String(value || "metadata");
            },
          },
          {
            default: () => [
              h(
                "div",
                { style: "display:flex;flex-direction:column;gap:8px;" },
                [
                  h(
                    NRadio,
                    { value: "metadata" },
                    {
                      default: () =>
                        t("tokenManager.exportWizard.modes.metadata"),
                    },
                  ),
                  h(
                    NRadio,
                    { value: "encrypted" },
                    {
                      default: () =>
                        t("tokenManager.exportWizard.modes.encrypted"),
                    },
                  ),
                  h(
                    NRadio,
                    { value: "plaintext" },
                    {
                      default: () =>
                        t("tokenManager.exportWizard.modes.plaintext"),
                    },
                  ),
                ],
              ),
            ],
          },
        ),
        selectedMode.value === "plaintext"
          ? h("div", { style: "display:flex;flex-direction:column;gap:8px;" }, [
              h(
                "div",
                { style: "color:#d03050;line-height:1.5;" },
                t("tokenManager.exportWizard.plaintextWarning"),
              ),
              h(
                NCheckbox,
                {
                  checked: plaintextRiskAccepted.value,
                  "onUpdate:checked": (checked) => {
                    plaintextRiskAccepted.value = Boolean(checked);
                  },
                },
                {
                  default: () => t("tokenManager.exportWizard.riskAcknowledge"),
                },
              ),
              h(NInput, {
                value: exportKeyword.value,
                placeholder: t("tokenManager.exportWizard.keywordPlaceholder"),
                "onUpdate:value": (value) => {
                  exportKeyword.value = String(value || "");
                },
              }),
            ])
          : null,
        selectedMode.value === "encrypted"
          ? h(NInput, {
              type: "password",
              showPasswordOn: "click",
              value: encryptPassphrase.value,
              placeholder: t("tokenManager.exportWizard.passphrasePlaceholder"),
              "onUpdate:value": (value) => {
                encryptPassphrase.value = String(value || "");
              },
            })
          : null,
      ]),
    onPositiveClick: async () => {
      if (selectedMode.value === "plaintext") {
        const keyword = String(exportKeyword.value || "").trim();
        if (
          !plaintextRiskAccepted.value ||
          keyword !== EXPORT_CONFIRM_KEYWORD
        ) {
          message.warning(
            t("tokenManager.messages.exportPlaintextConfirmMissing"),
          );
          return false;
        }
      }

      if (selectedMode.value === "encrypted") {
        if (!crypto?.subtle) {
          message.error(t("tokenManager.messages.webCryptoUnsupported"));
          return false;
        }
        if (String(encryptPassphrase.value || "").trim().length < 8) {
          message.warning(t("tokenManager.messages.passphraseTooShort"));
          return false;
        }
      }

      try {
        if (selectedMode.value === "encrypted") {
          const rawPayload = localTokenStore.exportTokens({ mode: "full" });
          const encryptedPayload = await encryptExportPayload(
            String(encryptPassphrase.value || "").trim(),
            rawPayload,
          );
          const dataBlob = new Blob(
            [JSON.stringify(encryptedPayload, null, 2)],
            {
              type: "application/json",
            },
          );
          triggerBlobDownload({
            blob: dataBlob,
            fileName: `tokens_backup_${new Date().toISOString().split("T")[0]}.json.enc`,
            appendToBody: false,
          });
          message.success(t("tokenManager.messages.tokensExportedEncrypted"));
          return true;
        }

        const tokenData = localTokenStore.exportTokens({
          mode: selectedMode.value === "plaintext" ? "full" : "metadata",
        });
        const dataStr = JSON.stringify(tokenData, null, 2);
        const dataBlob = new Blob([dataStr], { type: "application/json" });
        triggerBlobDownload({
          blob: dataBlob,
          fileName: `tokens_backup_${new Date().toISOString().split("T")[0]}.json`,
          appendToBody: false,
        });

        if (selectedMode.value === "plaintext") {
          message.success(t("tokenManager.messages.tokensExportedPlaintext"));
        } else {
          message.success(t("tokenManager.messages.tokensExportedMetadata"));
        }
        return true;
      } catch (error) {
        message.error(
          t("tokenManager.messages.exportFailedWithReason", {
            error: error.message,
          }),
        );
        return false;
      }
    },
  });
};

const importTokens = async ({ file }) => {
  const rawFile = file?.file;
  if (!rawFile) {
    message.error(t("tokenManager.messages.importFormatError"));
    return;
  }

  if (rawFile.size > MAX_IMPORT_FILE_SIZE) {
    message.error(
      t("tokenManager.messages.importFileTooLarge", {
        maxSizeMb: 1,
      }),
    );
    return;
  }

  try {
    const fileText = await rawFile.text();
    const parsedData = JSON.parse(fileText);

    let importPayload = parsedData;
    if (isEncryptedExportPayload(parsedData)) {
      const passphrase = await requestPassphraseByDialog({
        title: t("tokenManager.importWizard.decryptTitle"),
        prompt: t("tokenManager.importWizard.decryptPrompt"),
        placeholder: t("tokenManager.importWizard.decryptPlaceholder"),
        positiveText: t("tokenManager.common.confirm"),
        negativeText: t("tokenManager.common.cancel"),
      });
      if (!passphrase) {
        message.warning(t("tokenManager.messages.decryptCancelled"));
        return;
      }
      importPayload = await decryptImportPayload(passphrase, parsedData);
    }

    const result = localTokenStore.importTokens(importPayload);
    if (result.success) {
      message.success(
        t("tokenManager.messages.importSuccessWithCount", {
          count: result.importedCount || 0,
        }),
      );
      gameRolesStore.fetchGameRoles();
      return;
    }
    message.error(result.message);
  } catch (error) {
    message.error(
      t("tokenManager.messages.importFailedWithReason", {
        error: error.message || t("tokenManager.messages.importFormatError"),
      }),
    );
  }
};

const cleanExpiredTokens = () => {
  dialog.info({
    title: t("tokenManager.dialogs.cleanExpired.title"),
    content: t("tokenManager.dialogs.cleanExpired.content"),
    positiveText: t("tokenManager.common.confirm"),
    negativeText: t("tokenManager.common.cancel"),
    onPositiveClick: () => {
      const cleanedCount = localTokenStore.cleanExpiredTokens();
      message.success(
        t("tokenManager.messages.cleanedExpired", {
          count: cleanedCount,
        }),
      );
    },
  });
};

const clearAllTokens = () => {
  dialog.error({
    title: t("tokenManager.dialogs.clearAll.title"),
    content: t("tokenManager.dialogs.clearAll.content"),
    positiveText: t("tokenManager.dialogs.clearAll.confirm"),
    negativeText: t("tokenManager.common.cancel"),
    onPositiveClick: () => {
      localTokenStore.clearAllGameTokens();
      message.success(t("tokenManager.messages.allTokensCleared"));
    },
  });
};
</script>

<style scoped lang="scss">
.token-manager {
  background: white;
  border-radius: var(--border-radius-large);
  padding: var(--spacing-lg);
  margin: var(--spacing-lg) 0;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-lg);

  h3 {
    margin: 0;
    color: var(--text-primary);
    font-size: var(--font-size-lg);
  }
}

.header-actions {
  display: flex;
  gap: var(--spacing-sm);
  align-items: center;
  flex-wrap: wrap;
}

.token-section {
  margin-bottom: var(--spacing-lg);

  h4 {
    margin: 0 0 var(--spacing-md) 0;
    color: var(--text-primary);
    font-size: var(--font-size-md);
  }
}

.game-tokens-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.token-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-md);
  background: var(--bg-elevated);
  border: 1px solid var(--border-light);
  box-shadow: var(--shadow-light);
  border-radius: var(--border-radius-medium);
}

.token-info {
  display: flex;
  gap: var(--spacing-md);
}

.token-label {
  color: var(--text-secondary);
  font-weight: var(--font-weight-medium);
}

.token-value {
  font-family: monospace;
  color: var(--text-primary);
}

.empty-token {
  padding: var(--spacing-md);
  text-align: center;
  color: var(--text-secondary);
  background: var(--bg-elevated);
  border: 1px dashed var(--border-medium);
  border-radius: var(--border-radius-medium);
}

.game-tokens-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.game-token-item {
  border: 1px solid var(--border-light);
  border-radius: var(--border-radius-medium);
  padding: var(--spacing-md);
  background: var(--bg-elevated);
  box-shadow: var(--shadow-light);
  transition: all var(--transition-fast);

  &:hover {
    border-color: rgba(15, 107, 255, 0.26);
    transform: translateY(-1px);
  }
}

.token-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-md);
}

.role-info {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.role-name {
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
}

.role-server {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}

.token-actions {
  display: flex;
  gap: var(--spacing-xs);
}

.token-details {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--spacing-sm);
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--border-radius-small);
  background: var(--bg-secondary);
  border: 1px solid var(--border-light);
}

.detail-label {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}

.detail-value {
  font-size: var(--font-size-sm);
  color: var(--text-primary);
  font-family: monospace;
  word-break: break-all;
}

.bulk-actions {
  display: flex;
  gap: var(--spacing-md);
  justify-content: center;
  padding-top: var(--spacing-lg);
  border-top: 1px solid var(--border-light);
}

@media (max-width: 768px) {
  .header-actions {
    justify-content: flex-start;
  }

  .btn-text {
    display: none;
  }

  .header {
    flex-direction: column;
    gap: var(--spacing-md);
    align-items: stretch;
  }

  .token-item {
    flex-direction: column;
    gap: var(--spacing-md);
    align-items: stretch;
  }

  .token-header {
    flex-direction: column;
    gap: var(--spacing-sm);
    align-items: stretch;
  }

  .token-details {
    grid-template-columns: 1fr;
  }

  .bulk-actions {
    flex-direction: column;
  }
}
</style>
