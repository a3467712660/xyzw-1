<template>
  <div class="profile-page app-page">
    <section class="app-page__hero">
      <div class="app-page__hero-copy">
        <span class="app-page__eyebrow">个人设置</span>
        <h1 class="app-page__title">{{ t("profile.title") }}</h1>
        <p class="app-page__description">{{ t("profile.subtitle") }}</p>
        <div class="app-chip-row">
          <span class="app-inline-stat">
            <strong>{{ userInfo.username || authStore.user?.username || "未登录" }}</strong>
            当前账号
          </span>
          <span class="app-inline-stat">
            <strong>{{ getThemeModeLabel(preferences.theme) }}</strong>
            主题模式
          </span>
          <span class="app-inline-stat">
            <strong>{{ preferences.language }}</strong>
            当前语言
          </span>
        </div>
      </div>
    </section>

    <div class="app-page__summary">
      <article v-for="card in profileSummaryCards" :key="card.label" class="app-summary-card">
        <span class="app-summary-card__label">{{ card.label }}</span>
        <strong class="app-summary-card__value">{{ card.value }}</strong>
        <span class="app-summary-card__meta">{{ card.meta }}</span>
      </article>
    </div>

    <div class="container profile-page__content">
      <h2>{{ t("profile.sections.basic") }}</h2>
      <a-card>
        <a-form label-placement="left" label-width="80px" :model="userInfo">
          <a-form-item :label="t('profile.fields.username')">
            <a-input readonly v-model:value="userInfo.username"></a-input>
          </a-form-item>
          <a-form-item :label="t('profile.fields.accountDisplayId')">
            <a-input readonly v-model:value="userInfo.accountDisplayId"></a-input>
          </a-form-item>
          <a-form-item :label="t('profile.fields.email')">
            <a-input v-model:value="userInfo.email"></a-input>
          </a-form-item>
          <a-form-item :label="t('profile.fields.nickname')">
            <a-input
              v-model:value="userInfo.nickname"
              :placeholder="t('profile.placeholders.nickname')"
            ></a-input>
          </a-form-item>
          <a-form-item :label="t('profile.fields.phone')">
            <a-input
              v-model:value="userInfo.phone"
              :placeholder="t('profile.placeholders.phone')"
            ></a-input>
          </a-form-item>
        </a-form>

        <template #actions>
          <a-button
            type="primary"
            :loading="isProfileSaving"
            @click="saveProfile"
          >
            {{ t("profile.actions.saveProfile") }}
          </a-button>
        </template>
      </a-card>

      <h2>{{ t("profile.sections.password") }}</h2>
      <a-card>
        <a-form
          label-placement="left"
          label-width="100px"
          :model="passwordForm"
        >
          <a-form-item prop="currentPassword" :label="t('profile.fields.currentPassword')">
            <a-input
              type="password"
              v-model="passwordForm.currentPassword"
              :placeholder="t('profile.placeholders.currentPassword')"
            ></a-input>
          </a-form-item>
          <a-form-item prop="newPassword" :label="t('profile.fields.newPassword')">
            <a-input
              type="password"
              v-model="passwordForm.newPassword"
              :placeholder="t('profile.placeholders.newPassword')"
            ></a-input>
          </a-form-item>
          <a-form-item prop="confirmPassword" :label="t('profile.fields.confirmPassword')">
            <a-input
              type="password"
              v-model="passwordForm.confirmPassword"
              :placeholder="t('profile.placeholders.confirmPassword')"
            ></a-input>
          </a-form-item>
        </a-form>
        <template #actions>
          <a-button
            type="primary"
            :loading="isPasswordSaving"
            @click="changePassword"
          >
            {{ t("profile.actions.changePassword") }}
          </a-button>
        </template>
      </a-card>

      <h2>{{ t("profile.sections.preferences") }}</h2>
      <a-card>
        <a-form>
          <a-form-item :label="t('profile.fields.theme')">
            <n-select
              v-model:value="preferences.theme"
              :options="themeOptions"
              @update:value="
                (value) => {
                  updateTheme(value);
                  savePreferences();
                }
              "
            ></n-select>
            <template #extra>{{ t("profile.extra.theme") }}</template>
          </a-form-item>
          <a-form-item :label="t('profile.fields.language')">
            <n-select
              v-model:value="preferences.language"
              :options="languageOptions"
              @update:value="savePreferences"
            ></n-select>
            <template #extra>{{ t("profile.extra.language") }}</template>
          </a-form-item>
          <a-form-item :label="t('profile.fields.notifications')">
            <n-switch
              v-model:value="preferences.notifications"
              @update:value="savePreferences"
            ></n-switch>
            <template #extra>{{ t("profile.extra.notifications") }}</template>
          </a-form-item>
          <a-form-item :label="t('profile.fields.autoExecute')">
            <n-switch
              v-model:value="preferences.autoExecute"
              @update:value="savePreferences"
            ></n-switch>
            <template #extra>{{ t("profile.extra.autoExecute") }}</template>
          </a-form-item>
        </a-form>
      </a-card>

      <h2>{{ t("profile.sections.security") }}</h2>
      <a-card>
        <div class="security-items">
          <div class="security-item">
            <div class="security-info">
              <h3>{{ t("profile.security.twoFactor.title") }}</h3>
              <p>{{ t("profile.security.twoFactor.desc") }}</p>
            </div>
            <n-button @click="setupTwoFactor">
              {{ isTwoFactorEnabled ? t("profile.actions.reset") : t("profile.actions.setup") }}
            </n-button>
          </div>

          <div class="security-item">
            <div class="security-info">
              <h3>{{ t("profile.security.loginHistory.title") }}</h3>
              <p>{{ t("profile.security.loginHistory.desc") }}</p>
            </div>
            <n-button @click="viewLoginHistory"> {{ t("profile.actions.view") }} </n-button>
          </div>

          <div class="security-item">
            <div class="security-info">
              <h3>{{ t("profile.security.exportData.title") }}</h3>
              <p>{{ t("profile.security.exportData.desc") }}</p>
            </div>
            <n-button @click="exportData"> {{ t("profile.actions.export") }} </n-button>
          </div>

          <div class="security-item">
            <div class="security-info">
              <h3>{{ t("profile.security.refreshSecondVerify.title") }}</h3>
              <p>{{ t("profile.security.refreshSecondVerify.desc") }}</p>
            </div>
            <n-switch
              :loading="isRefreshSecondVerifySaving"
              :value="securityPreferences.refreshSecondVerifyEnabled"
              @update:value="updateRefreshSecondVerifyPreference"
            ></n-switch>
          </div>

          <div class="security-item">
            <div class="security-info">
              <h3>{{ t("profile.security.remoteBin.title") }}</h3>
              <p>{{ t("profile.security.remoteBin.desc") }}</p>
            </div>
            <n-switch
              :loading="isRemoteBinDownloadSaving"
              :value="securityPreferences.remoteBinDownloadEnabled"
              @update:value="updateRemoteBinDownloadPreference"
            ></n-switch>
          </div>

          <div class="security-item">
            <div class="security-info">
              <h3>{{ t("profile.security.safeMode.title") }}</h3>
              <p>{{ t("profile.security.safeMode.desc") }}</p>
            </div>
            <n-switch
              :value="safeModeEnabled"
              @update:value="updateSafeModePreference"
            ></n-switch>
          </div>

          <div class="security-item">
            <div class="security-info">
              <h3>{{ t("profile.security.logout.title") }}</h3>
              <p>{{ t("profile.security.logout.desc") }}</p>
            </div>
            <n-button type="warning" @click="logoutAccount"> {{ t("profile.actions.logout") }} </n-button>
          </div>

          <div class="security-item danger">
            <div class="security-info">
              <h3>{{ t("profile.security.deleteAccount.title") }}</h3>
              <p>{{ t("profile.security.deleteAccount.desc") }}</p>
            </div>
            <n-button type="error" @click="deleteAccount"> {{ t("profile.actions.delete") }} </n-button>
          </div>
        </div>
      </a-card>
    </div>

    <n-modal
      class="mfa-setup-modal"
      preset="card"
      v-model:show="isMfaSetupModalVisible"
      :auto-focus="false"
      :closable="!isMfaBusy"
      :mask-closable="!isMfaBusy"
      :title="t('profile.security.twoFactor.title')"
    >
      <div class="mfa-setup-content">
        <p class="mfa-desc">{{ t("profile.messages.twoFactorSetupInstruction") }}</p>

        <n-input
          show-password-on="click"
          type="password"
          v-model:value="mfaPassword"
          :disabled="mfaEnabledDone || isMfaBusy"
          :placeholder="t('profile.messages.twoFactorPasswordPrompt')"
        ></n-input>

        <n-space v-if="mfaSecret" vertical :size="10">
          <div class="mfa-qr-wrap">
            <img
              v-if="mfaQrDataUrl"
              class="mfa-qr-image"
              :alt="t('profile.messages.twoFactorQrAlt')"
              :src="mfaQrDataUrl"
            >
            <p class="mfa-qr-hint">{{ t("profile.messages.twoFactorQrHint") }}</p>
          </div>

          <n-input readonly :value="mfaSecret"></n-input>
          <n-button size="small" @click="copyMfaText(mfaSecret)">
            {{ t("profile.actions.copy") }} Secret
          </n-button>

          <n-input
            readonly
            type="textarea"
            :autosize="{ minRows: 2, maxRows: 4 }"
            :value="mfaOtpAuthUrl"
          ></n-input>
          <n-button size="small" @click="copyMfaText(mfaOtpAuthUrl)">
            {{ t("profile.actions.copy") }} otpauth
          </n-button>

          <n-input
            v-if="!mfaEnabledDone"
            v-model:value="mfaTotpCode"
            :disabled="isMfaBusy"
            :maxlength="6"
            :placeholder="t('profile.messages.twoFactorCodePrompt')"
          ></n-input>
        </n-space>

        <n-alert
          v-if="mfaRecoveryCodes.length > 0"
          type="warning"
          :show-icon="false"
        >
          <div>{{ t("profile.messages.twoFactorRecoveryCodes") }}</div>
          <pre class="mfa-recovery-codes">{{ mfaRecoveryCodes.join("\n") }}</pre>
        </n-alert>
      </div>

      <template #action>
        <n-space justify="end">
          <n-button :disabled="isMfaBusy" @click="closeMfaSetupModal">
            {{ t("profile.deleteDialog.cancel") }}
          </n-button>
          <n-button
            v-if="!mfaSecret"
            type="primary"
            :loading="isMfaSetupLoading"
            @click="initMfaSetup"
          >
            {{ t("profile.actions.setup") }}
          </n-button>
          <n-button
            v-else-if="!mfaEnabledDone"
            type="primary"
            :loading="isMfaEnableLoading"
            @click="confirmEnableMfa"
          >
            {{ t("profile.actions.confirm") }}
          </n-button>
          <n-button
            v-else
            type="primary"
            @click="closeMfaSetupModal"
          >
            {{ t("profile.actions.done") }}
          </n-button>
        </n-space>
      </template>
    </n-modal>
  </div>
</template>

<script setup>
import { computed, h, onMounted, reactive, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useDialog, useMessage } from "naive-ui/es";
import { useI18n } from "vue-i18n";
import { toDataURL as qrToDataURL } from "qrcode";
import { useAuthStore } from "@/stores/auth";
import api from "@/api";
import {
  REFRESH_SECOND_VERIFY_LOCAL_KEY,
  REFRESH_SECOND_VERIFY_PREF_KEY,
  REMOTE_BIN_DOWNLOAD_LOCAL_KEY,
  REMOTE_BIN_DOWNLOAD_PREF_KEY,
} from "@/constants/userPreferences";
import { setLocale } from "@/i18n";
import { safeModeEnabled as safeModePreference } from "@/services/token/tokenStorage";
import { useLocalTokenStore } from "@/stores/localTokenManager";
import { ensureUserSensitiveConfirmTokenByDialog } from "@/utils/userSensitiveConfirm";
import { useTheme } from "@/composables/useTheme";

const router = useRouter();
const route = useRoute();
const message = useMessage();
const dialog = useDialog();
const authStore = useAuthStore();
const localTokenStore = useLocalTokenStore();
const { t } = useI18n();
const { setThemeMode } = useTheme();
const isProfileSaving = ref(false);
const isPasswordSaving = ref(false);
const isRemoteBinDownloadSaving = ref(false);
const isRefreshSecondVerifySaving = ref(false);
const isMfaSetupModalVisible = ref(false);
const isMfaSetupLoading = ref(false);
const isMfaEnableLoading = ref(false);
const mfaPassword = ref("");
const mfaSecret = ref("");
const mfaOtpAuthUrl = ref("");
const mfaQrDataUrl = ref("");
const mfaTotpCode = ref("");
const mfaRecoveryCodes = ref([]);
const passwordPolicyHint
  = t("profile.validation.passwordPolicy");
const passwordMinLength = computed(() =>
  authStore.user?.mfaEnabled ? 8 : 12,
);

// 用户信息
const userInfo = reactive({
  username: "",
  accountDisplayId: "",
  email: "",
  nickname: "",
  phone: "",
  avatar: "",
});

// 密码表单
const passwordForm = reactive({
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
});

// 系统偏好
const preferences = reactive({
  theme: "auto",
  language: "zh-CN",
  notifications: true,
  autoExecute: false,
});
const securityPreferences = reactive({
  remoteBinDownloadEnabled: false,
  refreshSecondVerifyEnabled: true,
});
const safeModeEnabled = ref(Boolean(safeModePreference.value));
const isMfaBusy = computed(() => isMfaSetupLoading.value || isMfaEnableLoading.value);
const mfaEnabledDone = computed(() => mfaRecoveryCodes.value.length > 0);
const isTwoFactorEnabled = computed(() =>
  Boolean(authStore.userInfo?.mfaEnabled || authStore.user?.mfaEnabled),
);

// 选项数据
const themeOptions = ref([]);
const languageOptions = ref([]);

const refreshPreferenceOptions = () => {
  themeOptions.value = [
    { label: t("profile.themeOptions.auto"), value: "auto" },
    { label: t("profile.themeOptions.light"), value: "light" },
    { label: t("profile.themeOptions.dark"), value: "dark" },
  ];

  languageOptions.value = [
    { label: t("profile.languageOptions.zhCN"), value: "zh-CN" },
    { label: t("profile.languageOptions.en"), value: "en-US" },
  ];
};

const getThemeModeLabel = (mode) => {
  switch (mode) {
    case "dark":
      return t("profile.themeOptions.dark");
    case "light":
      return t("profile.themeOptions.light");
    default:
      return t("profile.themeOptions.auto");
  }
};

const profileSummaryCards = computed(() => [
  {
    label: "主题模式",
    value: getThemeModeLabel(preferences.theme),
    meta: "主题状态已经统一收口到全局主题管理",
  },
  {
    label: "通知",
    value: preferences.notifications ? "已开启" : "已关闭",
    meta: "保留原有用户偏好保存逻辑",
  },
  {
    label: "账号 ID",
    value: userInfo.accountDisplayId || "未生成",
    meta: "随机生成的展示账号编号",
  },
  {
    label: "二次验证",
    value: securityPreferences.refreshSecondVerifyEnabled ? "已开启" : "已关闭",
    meta: "刷新敏感操作仍需按原规则确认",
  },
  {
    label: "安全模式",
    value: safeModeEnabled.value ? "已开启" : "已关闭",
    meta: safeModeEnabled.value ? "本地凭证保护已启用" : "可按需开启本地保护",
  },
]);

// 方法
const syncUserInfo = (profile) => {
  Object.assign(userInfo, {
    username: profile?.username || "",
    accountDisplayId: profile?.accountDisplayId || "",
    email: profile?.email || "",
    nickname: profile?.nickname || "",
    phone: profile?.phone || "",
    avatar: profile?.avatar || "",
  });
};

const loadProfile = async () => {
  const res = await api.user.getProfile();
  if (!res.success) {
    throw new Error(res.message || t("profile.messages.loadFailed"));
  }
  syncUserInfo(res.data);
};

const parseUserAgentShort = (uaRaw) => {
  const ua = String(uaRaw || "").toLowerCase();
  if (!ua)
    return "未知设备";

  let os = "未知系统";
  if (ua.includes("windows"))
    os = "Windows";
  else if (ua.includes("mac os x") || ua.includes("macintosh"))
    os = "macOS";
  else if (ua.includes("iphone") || ua.includes("ipad") || ua.includes("ios"))
    os = "iOS";
  else if (ua.includes("android"))
    os = "Android";
  else if (ua.includes("linux"))
    os = "Linux";

  let browser = "未知浏览器";
  if (ua.includes("edg/"))
    browser = "Edge";
  else if (ua.includes("firefox/"))
    browser = "Firefox";
  else if (ua.includes("chrome/") && !ua.includes("edg/"))
    browser = "Chrome";
  else if (ua.includes("safari/") && !ua.includes("chrome/"))
    browser = "Safari";

  return `${os} / ${browser}`;
};

const describeSecurityAction = (row) => {
  const eventType = String(row?.eventType || "");
  const reason = String(row?.detail?.reason || "");
  const method = String(row?.detail?.method || row?.detail?.loginMethod || "");

  if (eventType === "login_success") {
    const methodLabel = method === "password+mfa" ? "密码 + 二次验证" : "密码";
    return `登录成功（${methodLabel}）`;
  }

  if (eventType === "login_failed") {
    const reasonLabelMap = {
      invalid_credentials: "账号或密码错误",
      trial_expired: "账号试用已到期",
      mfa_required: "需要二次验证",
      mfa_challenge_invalid: "二次验证会话无效或已过期",
      mfa_verify_failed: "二次验证码错误",
      mfa_qr_verify_failed: "扫码验证失败",
    };
    const reasonLabel = reasonLabelMap[reason] || "登录被拒绝";
    return `登录失败（${reasonLabel}）`;
  }

  if (eventType === "mfa_enabled")
    return "已开启二次验证";
  if (eventType === "mfa_disabled")
    return "已关闭二次验证";

  if (eventType === "user_confirm_success") {
    const methodLabelMap = {
      password: "密码",
      totp: "二次验证码",
      recovery_code: "恢复码",
    };
    return `敏感操作验证通过（${methodLabelMap[method] || "凭证验证"}）`;
  }

  if (eventType === "user_confirm_failed") {
    const reasonLabelMap = {
      password_mismatch: "密码错误",
      mfa_totp_invalid: "二次验证码错误",
      mfa_recovery_invalid: "恢复码错误",
      credential_missing: "未提供验证信息",
      confirm_failed: "验证失败",
    };
    return `敏感操作验证失败（${reasonLabelMap[reason] || "验证失败"}）`;
  }

  if (eventType === "token_refresh_verify_toggle")
    return `刷新 Token 二次验证已${row?.detail?.value === false ? "关闭" : "开启"}`;
  if (eventType === "remote_download_toggle")
    return `远程下载 BIN 已${row?.detail?.value === false ? "关闭" : "开启"}`;
  if (eventType === "bin_upload")
    return "BIN 文件上传";
  if (eventType === "bin_download")
    return "BIN 文件下载";
  if (eventType === "bin_delete")
    return "BIN 文件删除";

  return "系统安全事件";
};

const describeSecurityResult = (row) => {
  const eventType = String(row?.eventType || "");
  const result = String(row?.detail?.result || "").toLowerCase();

  if (eventType === "login_success" || eventType === "user_confirm_success" || eventType === "mfa_enabled")
    return "成功";
  if (eventType === "login_failed" || eventType === "user_confirm_failed")
    return "失败";
  if (eventType === "mfa_disabled")
    return "已关闭";

  if (result) {
    const resultLabelMap = {
      success: "成功",
      error: "失败",
      required: "需要先完成二次确认",
      forbidden: "无权限",
      expired: "已过期",
      not_found: "未找到",
    };
    return resultLabelMap[result] || result;
  }

  return "已记录";
};

const formatSecurityHistoryEntry = (row, index) => {
  const ts = row?.createdAt ? new Date(row.createdAt).toLocaleString() : "未知时间";
  const action = describeSecurityAction(row);
  const result = describeSecurityResult(row);
  const ip = row?.ip ? String(row.ip) : "未知 IP";
  const device = parseUserAgentShort(row?.userAgent);
  return {
    title: `${index + 1}. ${action}`,
    ts,
    result,
    source: `${ip} | ${device}`,
  };
};

const renderSecurityHistoryContent = (rows) => {
  const containerStyle = {
    maxHeight: "60vh",
    overflow: "auto",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    paddingRight: "4px",
  };
  const itemStyle = {
    border: "1px solid var(--n-border-color, #e5e7eb)",
    borderRadius: "10px",
    padding: "10px 12px",
    background: "var(--n-color, #fff)",
  };
  const titleStyle = {
    fontWeight: "600",
    lineHeight: "1.4",
    marginBottom: "6px",
  };
  const metaStyle = {
    fontSize: "13px",
    lineHeight: "1.6",
    color: "var(--n-text-color-3, #666)",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  };
  const resultRowStyle = {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginTop: "2px",
    marginBottom: "2px",
  };
  const resultLabelStyle = {
    fontSize: "13px",
    lineHeight: "1.6",
    color: "var(--n-text-color-3, #666)",
  };
  const resultTagBaseStyle = {
    fontSize: "12px",
    lineHeight: "18px",
    padding: "0 8px",
    borderRadius: "999px",
    border: "1px solid transparent",
    fontWeight: "600",
  };
  const getResultTagStyle = (resultText) => {
    const text = String(resultText || "");
    if (text === "成功") {
      return {
        ...resultTagBaseStyle,
        color: "#166534",
        background: "#dcfce7",
        borderColor: "#86efac",
      };
    }
    if (text === "失败") {
      return {
        ...resultTagBaseStyle,
        color: "#991b1b",
        background: "#fee2e2",
        borderColor: "#fca5a5",
      };
    }
    return {
      ...resultTagBaseStyle,
      color: "#1e3a8a",
      background: "#dbeafe",
      borderColor: "#93c5fd",
    };
  };

  return h(
    "div",
    { style: containerStyle },
    rows.map((row, index) => {
      const entry = formatSecurityHistoryEntry(row, index);
      return h("div", { style: itemStyle }, [
        h("div", { style: titleStyle }, entry.title),
        h("div", { style: metaStyle }, `时间：${entry.ts}`),
        h("div", { style: resultRowStyle }, [
          h("span", { style: resultLabelStyle }, "结果："),
          h("span", { style: getResultTagStyle(entry.result) }, entry.result),
        ]),
        h("div", { style: metaStyle }, `来源：${entry.source}`),
      ]);
    }),
  );
};

const saveProfile = async () => {
  if (isProfileSaving.value)
    return;

  try {
    isProfileSaving.value = true;
    const res = await api.user.updateProfile({
      email: userInfo.email,
      nickname: userInfo.nickname,
      phone: userInfo.phone,
    });
    if (!res.success) {
      message.error(res.message || t("profile.messages.saveFailed"));
      return;
    }
    syncUserInfo(res.data);
    await authStore.fetchUserInfo();
    message.success(res.message || t("profile.messages.saveSuccess"));
  } catch (error) {
    message.error(error.message || t("profile.messages.saveFailed"));
  } finally {
    isProfileSaving.value = false;
  }
};

const changePassword = async () => {
  if (isPasswordSaving.value)
    return;
  const currentPassword = String(passwordForm.currentPassword || "").trim();
  const newPassword = String(passwordForm.newPassword || "").trim();
  const confirmPassword = String(passwordForm.confirmPassword || "").trim();

  if (!currentPassword) {
    message.error(t("profile.validation.currentPasswordRequired"));
    return;
  }
  if (!newPassword) {
    message.error(t("profile.validation.newPasswordRequired"));
    return;
  }
  if (newPassword.length < passwordMinLength.value) {
    message.error(passwordPolicyHint);
    return;
  }
  if (newPassword !== confirmPassword) {
    message.error(t("profile.validation.passwordMismatch"));
    return;
  }

  try {
    isPasswordSaving.value = true;
    const res = await api.user.changePassword({
      currentPassword,
      newPassword,
    });
    if (!res.success) {
      message.error(res.message || t("profile.messages.passwordChangeFailed"));
      return;
    }
    await authStore.logout();
    message.success(res.message || t("profile.messages.passwordChangeSuccess"));

    // 清空表单
    Object.keys(passwordForm).forEach((key) => {
      passwordForm[key] = "";
    });
    await router.push("/login");
  } catch (error) {
    message.error(error.message || t("profile.messages.passwordChangeFailed"));
  } finally {
    isPasswordSaving.value = false;
  }
};

const savePreferences = async () => {
  // 保存偏好设置
  localStorage.setItem("userPreferences", JSON.stringify(preferences));
  await setLocale(preferences.language);
  refreshPreferenceOptions();
  message.success(t("profile.messages.preferencesSaved"));
};

const loadSecurityPreferences = async () => {
  if (!authStore.isAuthenticated) {
    securityPreferences.remoteBinDownloadEnabled = false;
    securityPreferences.refreshSecondVerifyEnabled = true;
    return;
  }

  try {
    const [remoteRes, refreshRes] = await Promise.all([
      api.user.getPreference(REMOTE_BIN_DOWNLOAD_PREF_KEY),
      api.user.getPreference(REFRESH_SECOND_VERIFY_PREF_KEY),
    ]);
    const remoteEnabled = !!remoteRes?.data?.value;
    const refreshEnabled = refreshRes?.data?.value == null
      ? true
      : !!refreshRes?.data?.value;
    securityPreferences.remoteBinDownloadEnabled = remoteEnabled;
    securityPreferences.refreshSecondVerifyEnabled = refreshEnabled;
    localStorage.setItem(
      REMOTE_BIN_DOWNLOAD_LOCAL_KEY,
      remoteEnabled ? "true" : "false",
    );
    localStorage.setItem(
      REFRESH_SECOND_VERIFY_LOCAL_KEY,
      refreshEnabled ? "true" : "false",
    );
  } catch {
    const localValue = localStorage.getItem(REMOTE_BIN_DOWNLOAD_LOCAL_KEY);
    securityPreferences.remoteBinDownloadEnabled = localValue === "true";
    const localRefreshVerify = localStorage.getItem(REFRESH_SECOND_VERIFY_LOCAL_KEY);
    securityPreferences.refreshSecondVerifyEnabled = localRefreshVerify == null
      ? true
      : localRefreshVerify === "true";
  }
};

const updateRemoteBinDownloadPreference = async (value) => {
  if (isRemoteBinDownloadSaving.value)
    return;

  const targetValue = !!value;
  const prevValue = securityPreferences.remoteBinDownloadEnabled;
  securityPreferences.remoteBinDownloadEnabled = targetValue;

  try {
    const confirmToken = await ensureUserSensitiveConfirmTokenByDialog({
      dialog,
      message,
      title: t("profile.dialogs.sensitiveConfirm.title"),
      prompt: t("profile.messages.sensitiveConfirmPrompt"),
      placeholder: t("profile.placeholders.currentPassword"),
      positiveText: t("profile.actions.confirm"),
      negativeText: t("profile.deleteDialog.cancel"),
      emptyCredentialMessage: t("profile.validation.currentPasswordRequired"),
      cancelledMessage: t("profile.messages.sensitiveConfirmCancelled"),
      failedMessage: t("profile.messages.sensitiveConfirmFailed"),
      successMessage: t("profile.messages.sensitiveConfirmSuccess"),
      mfaEnabled: Boolean(authStore.user?.mfaEnabled),
      preferMfa: true,
      methodLabelTotp: t("profile.messages.sensitiveConfirmMethodTotp"),
      methodLabelRecovery: t("profile.messages.sensitiveConfirmMethodRecovery"),
      methodLabelPassword: t("profile.messages.sensitiveConfirmMethodPassword"),
      totpPlaceholder: t("profile.messages.sensitiveConfirmTotpPlaceholder"),
      recoveryPlaceholder: t("profile.messages.sensitiveConfirmRecoveryPlaceholder"),
      mfaHint: t("profile.messages.sensitiveConfirmMfaHint"),
    });
    if (!confirmToken) {
      securityPreferences.remoteBinDownloadEnabled = prevValue;
      return;
    }

    isRemoteBinDownloadSaving.value = true;
    await api.user.setPreference(REMOTE_BIN_DOWNLOAD_PREF_KEY, targetValue, {
      confirmToken,
    });
    localStorage.setItem(
      REMOTE_BIN_DOWNLOAD_LOCAL_KEY,
      targetValue ? "true" : "false",
    );
    message.success(
      targetValue
        ? t("profile.messages.remoteBinEnabled")
        : t("profile.messages.remoteBinDisabled"),
    );
  } catch (error) {
    securityPreferences.remoteBinDownloadEnabled = prevValue;
    message.error(error.message || t("profile.messages.remoteBinSaveFailed"));
  } finally {
    isRemoteBinDownloadSaving.value = false;
  }
};

const updateRefreshSecondVerifyPreference = async (value) => {
  if (isRefreshSecondVerifySaving.value)
    return;

  const targetValue = !!value;
  const prevValue = securityPreferences.refreshSecondVerifyEnabled;
  securityPreferences.refreshSecondVerifyEnabled = targetValue;

  try {
    let confirmToken = "";
    if (targetValue) {
      confirmToken = await ensureUserSensitiveConfirmTokenByDialog({
        dialog,
        message,
        title: t("profile.dialogs.sensitiveConfirm.title"),
        prompt: t("profile.messages.sensitiveConfirmPrompt"),
        placeholder: t("profile.placeholders.currentPassword"),
        positiveText: t("profile.actions.confirm"),
        negativeText: t("profile.deleteDialog.cancel"),
        emptyCredentialMessage: t("profile.validation.currentPasswordRequired"),
        cancelledMessage: t("profile.messages.sensitiveConfirmCancelled"),
        failedMessage: t("profile.messages.sensitiveConfirmFailed"),
        successMessage: t("profile.messages.sensitiveConfirmSuccess"),
        mfaEnabled: Boolean(authStore.user?.mfaEnabled),
        preferMfa: true,
        methodLabelTotp: t("profile.messages.sensitiveConfirmMethodTotp"),
        methodLabelRecovery: t("profile.messages.sensitiveConfirmMethodRecovery"),
        methodLabelPassword: t("profile.messages.sensitiveConfirmMethodPassword"),
        totpPlaceholder: t("profile.messages.sensitiveConfirmTotpPlaceholder"),
        recoveryPlaceholder: t("profile.messages.sensitiveConfirmRecoveryPlaceholder"),
        mfaHint: t("profile.messages.sensitiveConfirmMfaHint"),
      });
      if (!confirmToken) {
        securityPreferences.refreshSecondVerifyEnabled = prevValue;
        return;
      }
    }

    isRefreshSecondVerifySaving.value = true;
    await api.user.setPreference(REFRESH_SECOND_VERIFY_PREF_KEY, targetValue, {
      confirmToken,
    });
    localStorage.setItem(
      REFRESH_SECOND_VERIFY_LOCAL_KEY,
      targetValue ? "true" : "false",
    );
    message.success(
      targetValue
        ? t("profile.messages.refreshSecondVerifyEnabled")
        : t("profile.messages.refreshSecondVerifyDisabled"),
    );
  } catch (error) {
    securityPreferences.refreshSecondVerifyEnabled = prevValue;
    message.error(error.message || t("profile.messages.refreshSecondVerifySaveFailed"));
  } finally {
    isRefreshSecondVerifySaving.value = false;
  }
};

const updateSafeModePreference = async (value) => {
  const targetValue = !!value;
  safeModeEnabled.value = targetValue;
  safeModePreference.value = targetValue;

  try {
    await localTokenStore.initTokenManager();
    message.success(
      targetValue
        ? t("profile.messages.safeModeEnabled")
        : t("profile.messages.safeModeDisabled"),
    );
  } catch (error) {
    message.error(error.message || t("profile.messages.safeModeSaveFailed"));
  }
};

const updateTheme = (theme) => {
  preferences.theme = theme;
  setThemeMode(theme);
};

const resetMfaSetupState = () => {
  mfaPassword.value = "";
  mfaSecret.value = "";
  mfaOtpAuthUrl.value = "";
  mfaQrDataUrl.value = "";
  mfaTotpCode.value = "";
  mfaRecoveryCodes.value = [];
  isMfaSetupLoading.value = false;
  isMfaEnableLoading.value = false;
};

const closeMfaSetupModal = () => {
  if (isMfaBusy.value) return;
  isMfaSetupModalVisible.value = false;
  resetMfaSetupState();
};

const copyMfaText = async (value) => {
  const text = String(value || "").trim();
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    message.success(t("profile.messages.copySuccess"));
  } catch {
    message.error(t("profile.messages.copyFailed"));
  }
};

const initMfaSetup = async () => {
  if (isMfaSetupLoading.value) return;
  const password = String(mfaPassword.value || "").trim();
  if (!password) {
    message.warning(t("profile.messages.twoFactorPasswordPrompt"));
    return;
  }
  try {
    isMfaSetupLoading.value = true;
    const setupRes = await api.auth.setupMfa({ password });
    if (!setupRes?.success || !setupRes?.data?.secret) {
      message.error(setupRes?.message || t("profile.messages.twoFactorSetupFailed"));
      return;
    }
    mfaSecret.value = String(setupRes.data.secret || "");
    mfaOtpAuthUrl.value = String(setupRes.data.otpauthUrl || "");
    if (mfaOtpAuthUrl.value) {
      try {
        mfaQrDataUrl.value = await qrToDataURL(mfaOtpAuthUrl.value, {
          margin: 1,
          width: 220,
        });
      } catch {
        mfaQrDataUrl.value = "";
        message.warning(t("profile.messages.twoFactorQrGenerateFailed"));
      }
    }
    message.success(t("profile.messages.twoFactorSetupReady"));
  } catch (error) {
    message.error(error.message || t("profile.messages.twoFactorSetupFailed"));
  } finally {
    isMfaSetupLoading.value = false;
  }
};

const confirmEnableMfa = async () => {
  if (isMfaEnableLoading.value) return;
  const code = String(mfaTotpCode.value || "").replace(/\D/g, "");
  if (!/^\d{6}$/.test(code)) {
    message.warning(t("profile.messages.twoFactorCodePrompt"));
    return;
  }
  try {
    isMfaEnableLoading.value = true;
    const enableRes = await api.auth.enableMfa({
      password: String(mfaPassword.value || "").trim(),
      secret: String(mfaSecret.value || "").trim(),
      totpCode: code,
    });
    if (!enableRes?.success) {
      message.error(enableRes?.message || t("profile.messages.twoFactorEnableFailed"));
      return;
    }
    mfaRecoveryCodes.value = Array.isArray(enableRes?.data?.recoveryCodes)
      ? enableRes.data.recoveryCodes
      : [];
    await authStore.fetchUserInfo();
    message.success(t("profile.messages.twoFactorEnabled"));
  } catch (error) {
    message.error(error.message || t("profile.messages.twoFactorEnableFailed"));
  } finally {
    isMfaEnableLoading.value = false;
  }
};

const setupTwoFactor = () => {
  resetMfaSetupState();
  isMfaSetupModalVisible.value = true;
  if (isTwoFactorEnabled.value) {
    message.info(t("profile.messages.twoFactorResetReady"));
  }
};

const viewLoginHistory = async () => {
  try {
    const res = await api.user.getSecurityEvents({
      limit: 20,
    });
    const rows = Array.isArray(res?.data) ? res.data : [];
    const isEmpty = rows.length === 0;

    dialog.info({
      title: t("profile.security.loginHistory.title"),
      content: isEmpty ? t("profile.messages.loginHistoryPending") : () => renderSecurityHistoryContent(rows),
      positiveText: t("profile.actions.view"),
    });
  } catch (error) {
    message.error(error.message || t("profile.messages.loadFailed"));
  }
};

const exportData = () => {
  message.info(t("profile.messages.exportPending"));
};

const logoutAccount = async () => {
  await authStore.logout();
  message.success(t("profile.messages.logoutSuccess"));
  router.push("/login");
};

const deleteAccount = () => {
  dialog.warning({
    title: t("profile.deleteDialog.title"),
    content: t("profile.deleteDialog.content"),
    positiveText: t("profile.deleteDialog.confirm"),
    negativeText: t("profile.deleteDialog.cancel"),
    onPositiveClick: () => {
      message.error(t("profile.messages.deletePending"));
    },
  });
};

// 生命周期
onMounted(async () => {
  if (route.query?.adminMfaRequired === "1") {
    message.info("请先在此完成 MFA 绑定，再访问管理中心");
  }
  refreshPreferenceOptions();
  if (authStore.userInfo) {
    syncUserInfo(authStore.userInfo);
  }
  try {
    await loadProfile();
  } catch (error) {
    message.error(error.message || t("profile.messages.loadFailed"));
  }
  await loadSecurityPreferences();
  safeModeEnabled.value = Boolean(safeModePreference.value);

  const savedPreferences = localStorage.getItem("userPreferences");
  if (savedPreferences) {
    try {
      Object.assign(preferences, JSON.parse(savedPreferences));
      await setLocale(preferences.language);
      refreshPreferenceOptions();
    } catch (error) {
      console.error("解析用户偏好失败:", error);
    }
  }
});
</script>

<style scoped lang="scss">
.profile-page {
  min-height: 100dvh;
  background: transparent;
  padding: var(--spacing-xl) 0;
  padding-bottom: calc(var(--spacing-md) + env(safe-area-inset-bottom));
  animation: profile-fade-in 0.42s ease;
}

.container {
  max-width: 920px;
  margin: 0 auto;
  padding: 0 var(--spacing-lg);
  width: 100%;
}

.profile-page__content {
  width: 100%;
}

.page-header {
  text-align: center;
  margin-bottom: var(--spacing-xl);
  background: var(--surface-glass);
  border: 1px solid var(--surface-glass-border);
  border-radius: var(--border-radius-xl);
  box-shadow: var(--shadow-light);
  backdrop-filter: blur(10px);
  padding: var(--spacing-xl);

  h1 {
    font-size: var(--font-size-3xl);
    font-weight: var(--font-weight-bold);
    color: var(--text-primary);
    margin-bottom: var(--spacing-sm);
  }

  p {
    color: var(--text-secondary);
    font-size: var(--font-size-lg);
    margin: 0;
  }
}

[data-theme="dark"] .page-header {
  background: rgba(18, 32, 58, 0.72);
}

h2 {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
  margin: var(--spacing-lg) 0 var(--spacing-md);
  padding-left: var(--spacing-sm);
  border-left: 3px solid var(--primary-color);
  letter-spacing: 0.01em;
}

.profile-section {
  margin-bottom: var(--spacing-2xl);
}

:deep(.arco-card) {
  border-radius: var(--border-radius-large);
  border: 1px solid var(--surface-glass-border);
  box-shadow: var(--shadow-light);
  background: var(--surface-glass-strong);
  backdrop-filter: blur(10px);
  margin-bottom: var(--spacing-lg);
}

:deep(.arco-card .arco-card-body) {
  padding: var(--spacing-lg);
}

:deep(.arco-card .arco-card-actions) {
  border-top: 1px solid var(--border-light);
  background: transparent;
}

:deep(.arco-form-item) {
  margin-bottom: var(--spacing-md);
}

.security-items {
  display: flex;
  gap: var(--spacing-lg);
  flex-direction: column;

  .security-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-lg);
    border: 1px solid var(--border-light);
    border-radius: var(--border-radius-medium);
    transition: all var(--transition-fast);
    background: var(--bg-elevated);

    &:hover {
      box-shadow: var(--shadow-light);
      border-color: rgba(15, 107, 255, 0.28);
      transform: translateY(-1px);
    }

    &.danger {
      border-color: var(--error-color);
      background: rgba(208, 48, 80, 0.05);
    }

    .security-info {
      flex: 1;

      h3 {
        font-size: var(--font-size-md);
        font-weight: var(--font-weight-medium);
        color: var(--text-primary);
        margin-bottom: var(--spacing-xs);
      }

      p {
        color: var(--text-secondary);
        font-size: var(--font-size-sm);
        margin: 0;
      }
    }
  }
}

.mfa-setup-modal {
  max-width: 640px;
}

.mfa-setup-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.mfa-desc {
  margin: 0;
  color: var(--text-secondary);
}

.mfa-recovery-codes {
  margin: 8px 0 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  white-space: pre-wrap;
  word-break: break-word;
}

.mfa-qr-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.mfa-qr-image {
  width: 220px;
  height: 220px;
  border-radius: 8px;
  border: 1px solid var(--border-light);
  background: #fff;
}

.mfa-qr-hint {
  margin: 0;
  color: var(--text-secondary);
  text-align: center;
  font-size: var(--font-size-sm);
}

@media (max-width: 768px) {
  .profile-page :deep(.n-button),
  .profile-page :deep(.arco-btn) {
    min-height: 40px;
    padding-left: 12px;
    padding-right: 12px;
  }

  .container {
    padding: 0 var(--spacing-md);
  }

  .page-header {
    padding: var(--spacing-lg);
  }

  .info-card {
    padding: var(--spacing-lg);
  }

  .preference-item,
  .security-item {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--spacing-md);
  }

  .preference-item .n-select,
  .preference-item .n-switch {
    width: 100%;
  }
}

@keyframes profile-fade-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
