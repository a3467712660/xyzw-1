<template>
  <div v-if="canAccess" class="admin-users-page">
    <div class="container">
      <div class="page-header">
        <div class="page-header__main">
          <h1>{{ t("adminUsers.title") }}</h1>
          <p>{{ t("adminUsers.subtitle") }}</p>
        </div>
        <div class="page-header__actions">
          <NTag
            v-if="sensitiveConfirmRemainingText"
            size="small"
            type="warning"
          >
            {{ sensitiveConfirmRemainingText }}
          </NTag>
          <NInput
            clearable
            class="page-header__search"
            v-model:value="searchKeyword"
            :placeholder="t('adminUsers.placeholders.searchUser')"
          ></NInput>
          <NButton
            class="page-header__action"
            :loading="loading"
            @click="fetchUsers"
          >
            {{ t("adminUsers.actions.refresh") }}
          </NButton>
        </div>
      </div>

      <div class="page-overview">
        <div class="overview-card">
          <span class="overview-label">{{
            t("adminUsers.overview.totalUsers")
          }}</span>
          <strong class="overview-value">{{ users.length }}</strong>
        </div>
        <div class="overview-card">
          <span class="overview-label">{{
            t("adminUsers.overview.adminCount")
          }}</span>
          <strong class="overview-value">{{ adminCount }}</strong>
        </div>
        <div class="overview-card">
          <span class="overview-label">{{
            t("adminUsers.overview.localRoleCache")
          }}</span>
          <strong class="overview-value">{{ currentLocalRoleCount }}</strong>
        </div>
      </div>

      <n-card class="desktop-only desktop-table-card">
        <div class="desktop-table-card__header">
          <div class="desktop-table-meta">
            <span class="desktop-table-count">
              {{
                t("adminUsers.fields.tableFilteredCount", {
                  count: filteredUsers.length,
                })
              }}
            </span>
            <span class="desktop-table-hint">{{
              t("adminUsers.fields.tableHint")
            }}</span>
          </div>
        </div>
        <n-data-table
          :columns="columns"
          :data="filteredUsers"
          :loading="loading"
          :pagination="{ pageSize: 10 }"
          :row-class-name="resolveDesktopRowClass"
        ></n-data-table>
      </n-card>

      <div class="mobile-only mobile-user-list">
        <n-spin :show="loading">
          <div v-if="filteredUsers.length" class="mobile-user-list__content">
            <n-card
              v-for="row in filteredUsers"
              :key="row.id"
              embedded
              class="mobile-user-card"
            >
              <div class="mobile-user-card__top">
                <div class="mobile-user-card__identity">
                  <div class="mobile-user-card__name-row">
                    <h3>{{ row.username }}</h3>
                    <span
                      v-if="row.isCurrentUser"
                      class="status-chip status-chip--current"
                    >
                      {{ t("adminUsers.status.currentUser") }}
                    </span>
                    <span
                      v-if="row.isAdmin"
                      class="status-chip status-chip--admin"
                    >
                      {{ t("adminUsers.status.admin") }}
                    </span>
                  </div>
                  <p>{{ row.email || t("adminUsers.common.noEmail") }}</p>
                </div>
              </div>

              <div class="mobile-user-card__stats">
                <div class="info-block">
                  <span class="info-label">{{
                    t("adminUsers.fields.roleCount")
                  }}</span>
                  <strong>{{ roleCountFor(row) }}</strong>
                </div>
                <div class="info-block">
                  <span class="info-label">{{
                    t("adminUsers.fields.inviteCount")
                  }}</span>
                  <strong>{{ row.inviteCount }}</strong>
                </div>
                <div class="info-block">
                  <span class="info-label">{{
                    t("adminUsers.fields.tokenBindLimit")
                  }}</span>
                  <strong>{{ row.tokenBindLimit }}</strong>
                </div>
                <div class="info-block">
                  <span class="info-label">{{
                    t("adminUsers.fields.refreshSecondVerify")
                  }}</span>
                  <strong>
                    {{
                      row.refreshSecondVerifyEnabled
                        ? t("adminUsers.common.enabled")
                        : t("adminUsers.common.disabled")
                    }}
                  </strong>
                </div>
                <div class="info-block info-block--wide">
                  <span class="info-label">{{
                    t("adminUsers.fields.createdAt")
                  }}</span>
                  <strong>{{ formatDate(row.createdAt) }}</strong>
                </div>
                <div class="info-block info-block--wide">
                  <span class="info-label">{{
                    t("adminUsers.fields.lastLoginAt")
                  }}</span>
                  <strong>{{ formatDateWithRelative(row.lastLoginAt) }}</strong>
                </div>
              </div>

              <div class="mobile-user-card__switch">
                <div>
                  <span class="info-label">{{
                    t("adminUsers.fields.adminPermission")
                  }}</span>
                  <p class="switch-hint">
                    {{
                      row.isCurrentUser
                        ? t("adminUsers.hints.currentUserAdminLocked")
                        : t("adminUsers.hints.switchDirectly")
                    }}
                  </p>
                </div>
                <NSwitch
                  :disabled="row.isCurrentUser"
                  :value="row.isAdmin"
                  @update:value="(value) => handleAdminToggle(row, value)"
                ></NSwitch>
              </div>

              <div class="mobile-user-card__scope">
                <div>
                  <span class="info-label">{{
                    t("adminUsers.fields.accountType")
                  }}</span>
                  <p class="switch-hint">
                    {{ t("adminUsers.hints.switchDirectly") }}
                  </p>
                </div>
                <NSelect
                  :consistent-menu-width="false"
                  :options="accountTypeOptions"
                  :value="accountTypeValueFor(row)"
                  @update:value="(value) => handleAccessScopeChange(row, value)"
                ></NSelect>
              </div>

              <div class="mobile-user-card__switch">
                <div>
                  <span class="info-label">{{
                    t("adminUsers.fields.refreshSecondVerify")
                  }}</span>
                  <p class="switch-hint">
                    {{ t("adminUsers.hints.refreshSecondVerifyRisk") }}
                  </p>
                </div>
                <NSwitch
                  :disabled="!!refreshSecondVerifyUpdating[row.id]"
                  :value="row.refreshSecondVerifyEnabled"
                  @update:value="
                    (value) => handleRefreshSecondVerifyChange(row, value)
                  "
                ></NSwitch>
              </div>

              <div class="mobile-user-card__actions">
                <NButton
                  block
                  tertiary
                  :disabled="!row.mfaEnabled"
                  @click="createMfaResetLink(row)"
                >
                  {{ t("adminUsers.actions.resetMfa") }}
                </NButton>
                <NButton block tertiary @click="createResetCode(row)">
                  {{ t("adminUsers.actions.createResetCode") }}
                </NButton>
                <NButton block tertiary @click="openPasswordModal(row)">
                  {{ t("adminUsers.actions.resetPassword") }}
                </NButton>
                <NButton block tertiary @click="updateTokenBindLimit(row)">
                  {{ t("adminUsers.actions.updateTokenBindLimit") }}
                </NButton>
                <NButton block tertiary @click="openTokenActivationModal(row)">
                  {{ t("adminUsers.actions.viewTokenExpiry") }}
                </NButton>
                <NButton
                  block
                  tertiary
                  type="error"
                  :disabled="row.isCurrentUser"
                  @click="openDeleteModal(row)"
                >
                  {{ t("adminUsers.actions.deleteUser") }}
                </NButton>
              </div>
            </n-card>
          </div>

          <n-empty
            v-else-if="!loading"
            class="mobile-empty"
            :description="t('adminUsers.empty')"
          ></n-empty>
        </n-spin>
      </div>
    </div>

    <n-modal
      class="password-modal"
      preset="card"
      v-model:show="passwordModalVisible"
      :bordered="false"
      :title="t('adminUsers.modals.resetPassword.title')"
    >
      <n-form>
        <n-form-item :label="t('adminUsers.fields.account')">
          <NInput disabled :value="selectedUser?.username || ''"></NInput>
        </n-form-item>
        <n-form-item :label="t('adminUsers.fields.newPassword')">
          <NInput
            show-password-on="click"
            type="password"
            v-model:value="newPassword"
            :placeholder="t('adminUsers.placeholders.newPassword')"
          ></NInput>
        </n-form-item>
        <n-form-item :label="t('adminUsers.fields.confirmPassword')">
          <NInput
            show-password-on="click"
            type="password"
            v-model:value="confirmPassword"
            :placeholder="t('adminUsers.placeholders.confirmPassword')"
          ></NInput>
        </n-form-item>
      </n-form>
      <template #action>
        <div class="modal-actions">
          <NButton @click="closePasswordModal">
            {{ t("adminUsers.actions.cancel") }}
          </NButton>
          <NButton
            type="primary"
            :loading="passwordSaving"
            @click="submitPasswordReset"
          >
            {{ t("adminUsers.actions.confirmReset") }}
          </NButton>
        </div>
      </template>
    </n-modal>

    <n-modal
      class="password-modal"
      preset="card"
      v-model:show="deleteModalVisible"
      :bordered="false"
      :title="t('adminUsers.modals.deleteUser.title')"
    >
      <n-form>
        <n-form-item :label="t('adminUsers.fields.targetAccount')">
          <NInput disabled :value="selectedUser?.username || ''"></NInput>
        </n-form-item>
        <n-form-item :label="t('adminUsers.fields.confirmUsername')">
          <NInput
            v-model:value="deleteConfirmText"
            :placeholder="t('adminUsers.placeholders.confirmUsername')"
          ></NInput>
        </n-form-item>
      </n-form>
      <template #action>
        <div class="modal-actions">
          <NButton @click="closeDeleteModal">
            {{ t("adminUsers.actions.cancel") }}
          </NButton>
          <NButton
            type="error"
            :loading="deleteSaving"
            @click="submitDeleteUser"
          >
            {{ t("adminUsers.actions.confirmDelete") }}
          </NButton>
        </div>
      </template>
    </n-modal>

    <n-modal
      class="password-modal"
      preset="card"
      v-model:show="resetCodeModalVisible"
      :bordered="false"
      :title="t('adminUsers.modals.resetCode.title')"
    >
      <n-form>
        <n-form-item :label="t('adminUsers.fields.account')">
          <NInput disabled :value="resetCodeInfo?.username || ''"></NInput>
        </n-form-item>
        <n-form-item :label="t('adminUsers.fields.shortCode')">
          <NInput disabled :value="resetCodeInfo?.shortCode || ''"></NInput>
        </n-form-item>
        <n-form-item :label="t('adminUsers.fields.expiresAt')">
          <NInput
            disabled
            :value="
              formatDate(resetCodeInfo?.expiresAt) ||
              t('adminUsers.common.dash')
            "
          ></NInput>
        </n-form-item>
      </n-form>
      <template #action>
        <div class="modal-actions">
          <NButton @click="resetCodeModalVisible = false">
            {{ t("adminUsers.actions.close") }}
          </NButton>
          <NButton type="primary" @click="copyResetCode">
            {{ t("adminUsers.actions.copyResetCode") }}
          </NButton>
        </div>
      </template>
    </n-modal>

    <n-modal
      class="token-activation-modal"
      preset="card"
      v-model:show="tokenActivationModalVisible"
      :bordered="false"
      :title="t('adminUsers.modals.tokenActivation.title')"
    >
      <n-spin :show="tokenActivationLoading">
        <n-space vertical :size="8">
          <div class="token-activation-summary">
            <span>
              {{ t("adminUsers.fields.account") }}:
              <strong>{{
                tokenActivationTarget?.username || t("adminUsers.common.dash")
              }}</strong>
            </span>
            <span>
              {{ t("adminUsers.fields.tokenActivationTotal") }}:
              <strong>{{ tokenActivationStats.total }}</strong>
            </span>
            <span>
              {{ t("adminUsers.fields.tokenActivationActive") }}:
              <strong>{{ tokenActivationStats.active }}</strong>
            </span>
            <span>
              {{ t("adminUsers.fields.tokenActivationExpired") }}:
              <strong>{{ tokenActivationStats.expired }}</strong>
            </span>
          </div>
          <n-data-table
            size="small"
            :columns="tokenActivationColumns"
            :data="tokenActivationItems"
            :pagination="{ pageSize: 8 }"
            :scroll-x="860"
          ></n-data-table>
        </n-space>
      </n-spin>
      <template #action>
        <div class="modal-actions">
          <NButton @click="closeTokenActivationModal">
            {{ t("adminUsers.actions.close") }}
          </NButton>
        </div>
      </template>
    </n-modal>

    <n-modal
      class="password-modal"
      preset="card"
      v-model:show="mfaResetLinkModalVisible"
      :bordered="false"
      :title="t('adminUsers.modals.mfaResetLink.title')"
    >
      <n-form>
        <n-form-item :label="t('adminUsers.fields.account')">
          <NInput disabled :value="mfaResetLinkInfo?.username || ''"></NInput>
        </n-form-item>
        <n-form-item :label="t('adminUsers.fields.mfaResetLink')">
          <NInput disabled :value="mfaResetLinkInfo?.resetUrl || ''"></NInput>
        </n-form-item>
        <n-form-item :label="t('adminUsers.fields.expiresAt')">
          <NInput
            disabled
            :value="
              formatDate(mfaResetLinkInfo?.expiresAt) ||
              t('adminUsers.common.dash')
            "
          ></NInput>
        </n-form-item>
      </n-form>
      <template #action>
        <div class="modal-actions">
          <NButton @click="mfaResetLinkModalVisible = false">
            {{ t("adminUsers.actions.close") }}
          </NButton>
          <NButton type="primary" @click="copyMfaResetLink">
            {{ t("adminUsers.actions.copyMfaResetLink") }}
          </NButton>
        </div>
      </template>
    </n-modal>
  </div>
</template>

<script setup>
import { computed, h, onMounted, onUnmounted, ref } from "vue";
import {
  NButton,
  NDropdown,
  NInput,
  NRadioButton,
  NRadioGroup,
  NSelect,
  NSwitch,
  NTag,
  useDialog,
  useMessage,
} from "naive-ui/es";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import api from "@/api";
import { useAuthStore } from "@/stores/auth";
import { gameTokens } from "@/stores/tokenStore";

const router = useRouter();
const message = useMessage();
const dialog = useDialog();
const authStore = useAuthStore();
const { locale, t } = useI18n();

const loading = ref(false);
const users = ref([]);
const searchKeyword = ref("");
const passwordModalVisible = ref(false);
const passwordSaving = ref(false);
const deleteModalVisible = ref(false);
const deleteSaving = ref(false);
const selectedUser = ref(null);
const newPassword = ref("");
const confirmPassword = ref("");
const deleteConfirmText = ref("");
const resetCodeModalVisible = ref(false);
const resetCodeInfo = ref(null);
const mfaResetLinkModalVisible = ref(false);
const mfaResetLinkInfo = ref(null);
const tokenActivationModalVisible = ref(false);
const tokenActivationLoading = ref(false);
const tokenActivationTarget = ref(null);
const tokenActivationItems = ref([]);
const refreshSecondVerifyUpdating = ref({});
const sensitiveConfirmToken = ref("");
const sensitiveConfirmExpiresAt = ref(0);
const sensitiveConfirmNowTs = ref(Date.now());
let autoRefreshTimer = null;
let sensitiveConfirmTicker = null;
const AUTO_REFRESH_INTERVAL = 30 * 1000;
const ACCESS_SCOPE_FULL = "full";
const ACCESS_SCOPE_TASK_CONTROL_ONLY = "task_control_only";
const resolvePasswordMinLength = (user) => (user?.mfaEnabled ? 8 : 12);
const passwordPolicyHint = computed(() =>
  t("adminUsers.validation.passwordPolicy"),
);
const canAccess = computed(
  () => authStore.isAuthenticated && authStore.user?.isAdmin,
);
const currentLocalRoleCount = computed(() => gameTokens.value.length);
const adminCount = computed(
  () => users.value.filter((user) => user.isAdmin).length,
);
const filteredUsers = computed(() => {
  const keyword = String(searchKeyword.value || "")
    .trim()
    .toLowerCase();
  if (!keyword) {
    return users.value;
  }
  return users.value.filter((row) => {
    const username = String(row?.username || "").toLowerCase();
    const email = String(row?.email || "").toLowerCase();
    return username.includes(keyword) || email.includes(keyword);
  });
});
const accountTypeOptions = computed(() => [
  { label: t("adminUsers.accountTypes.full"), value: ACCESS_SCOPE_FULL },
  {
    label: t("adminUsers.accountTypes.normal"),
    value: ACCESS_SCOPE_TASK_CONTROL_ONLY,
  },
]);

const formatDate = (value) =>
  value
    ? new Date(value).toLocaleString(locale.value)
    : t("adminUsers.common.dash");

const tokenActivationStats = computed(() => {
  const total = tokenActivationItems.value.length;
  const active = tokenActivationItems.value.filter(
    (item) => item.active,
  ).length;
  return {
    total,
    active,
    expired: Math.max(0, total - active),
  };
});

const maskTokenId = (value) => {
  const raw = String(value || "").trim();
  if (!raw) {
    return t("adminUsers.common.dash");
  }
  if (raw.length <= 10) {
    return `${raw.slice(0, 2)}***${raw.slice(-2)}`;
  }
  return `${raw.slice(0, 6)}***${raw.slice(-4)}`;
};

const resolveDesktopRowClass = (row) => {
  if (row?.isCurrentUser) {
    return "desktop-row-current-user";
  }
  return "";
};

const formatRelativeTime = (value) => {
  if (!value) return t("adminUsers.common.dash");
  const targetTs = new Date(value).getTime();
  if (!Number.isFinite(targetTs)) return t("adminUsers.common.dash");

  const diffMs = Date.now() - targetTs;
  if (diffMs <= 60 * 1000) return t("adminUsers.relativeTime.justNow");

  const minutes = Math.floor(diffMs / (60 * 1000));
  if (minutes < 60)
    return t("adminUsers.relativeTime.minutesAgo", { count: minutes });

  const hours = Math.floor(diffMs / (60 * 60 * 1000));
  if (hours < 24)
    return t("adminUsers.relativeTime.hoursAgo", { count: hours });

  const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  if (days < 7) return t("adminUsers.relativeTime.daysAgo", { count: days });

  const weeks = Math.floor(days / 7);
  if (weeks < 5) return t("adminUsers.relativeTime.weeksAgo", { count: weeks });

  const months = Math.floor(days / 30);
  if (months < 12)
    return t("adminUsers.relativeTime.monthsAgo", { count: months });

  const years = Math.floor(days / 365);
  return t("adminUsers.relativeTime.yearsAgo", { count: years });
};

const formatDateWithRelative = (value) => {
  if (!value) return t("adminUsers.common.dash");
  return t("adminUsers.fields.dateWithRelative", {
    date: formatDate(value),
    relative: formatRelativeTime(value),
  });
};

const normalizeCount = (...values) => {
  for (const value of values) {
    const num = Number(value);
    if (Number.isFinite(num)) {
      return num;
    }
  }
  return 0;
};
const normalizeAccessScope = (value) =>
  String(value || "").trim() === ACCESS_SCOPE_TASK_CONTROL_ONLY
    ? ACCESS_SCOPE_TASK_CONTROL_ONLY
    : ACCESS_SCOPE_FULL;
const accountTypeValueFor = (row) => normalizeAccessScope(row?.accessScope);

const roleCountFor = (row) =>
  row.isCurrentUser
    ? currentLocalRoleCount.value
    : normalizeCount(
        row.roleCount,
        row.role_count,
        row.rolesCount,
        row.roles_count,
        row.roleNum,
      );

const tWithFallback = (key, fallback, params = undefined) => {
  const resolved = t(key, params);
  return resolved === key ? fallback : resolved;
};

const getCachedSensitiveToken = () => {
  if (
    sensitiveConfirmToken.value &&
    Number.isFinite(sensitiveConfirmExpiresAt.value) &&
    sensitiveConfirmExpiresAt.value > Date.now() + 3000
  ) {
    return sensitiveConfirmToken.value;
  }
  return "";
};

const clearSensitiveConfirmCache = () => {
  sensitiveConfirmToken.value = "";
  sensitiveConfirmExpiresAt.value = 0;
};

const setRefreshSecondVerifyUpdating = (userId, value) => {
  refreshSecondVerifyUpdating.value = {
    ...refreshSecondVerifyUpdating.value,
    [userId]: Boolean(value),
  };
};

const promptAdminConfirmCredential = ({
  actionLabel = tWithFallback("adminUsers.actions.highRiskAction", "高危操作"),
} = {}) =>
  new Promise((resolve) => {
    const mfaEnabled = Boolean(authStore.user?.mfaEnabled);
    const mode = ref(mfaEnabled ? "totp" : "password");
    const password = ref("");
    const totpCode = ref("");
    const recoveryCode = ref("");
    let settled = false;

    const finish = (value) => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(value || null);
    };

    dialog.warning({
      title: tWithFallback(
        "adminUsers.dialogs.sensitiveConfirm.title",
        "高危操作二次确认",
      ),
      positiveText: tWithFallback(
        "adminUsers.dialogs.sensitiveConfirm.confirm",
        "确认",
      ),
      negativeText: tWithFallback("adminUsers.actions.cancel", "取消"),
      content: () =>
        h("div", { style: "display:flex;flex-direction:column;gap:12px;" }, [
          h(
            "div",
            { style: "line-height:1.5;" },
            tWithFallback(
              "adminUsers.messages.confirmPrompt",
              `执行“${actionLabel}”前，请输入当前管理员密码进行二次确认`,
              { action: actionLabel },
            ),
          ),
          ...(mfaEnabled
            ? [
                h(
                  NRadioGroup,
                  {
                    "value": mode.value,
                    "onUpdate:value": (value) => {
                      mode.value = String(value || "totp");
                    },
                  },
                  {
                    default: () => [
                      h(
                        NRadioButton,
                        { value: "totp" },
                        {
                          default: () =>
                            tWithFallback(
                              "adminUsers.messages.confirmMethodTotp",
                              "动态验证码（推荐）",
                            ),
                        },
                      ),
                      h(
                        NRadioButton,
                        { value: "recovery" },
                        {
                          default: () =>
                            tWithFallback(
                              "adminUsers.messages.confirmMethodRecovery",
                              "恢复码",
                            ),
                        },
                      ),
                    ],
                  },
                ),
                h(
                  "div",
                  { style: "font-size:12px;opacity:0.75;" },
                  tWithFallback(
                    "adminUsers.messages.confirmMfaPreferredHint",
                    "已开启 MFA：请使用动态验证码或恢复码完成确认。",
                  ),
                ),
              ]
            : []),
          mode.value === "totp"
            ? h(NInput, {
                "value": totpCode.value,
                "maxlength": 6,
                "placeholder": tWithFallback(
                  "adminUsers.placeholders.confirmTotpCode",
                  "输入 6 位动态验证码",
                ),
                "autofocus": true,
                "onUpdate:value": (value) => {
                  totpCode.value = String(value || "").replace(/\D/g, "");
                },
              })
            : null,
          mode.value === "recovery"
            ? h(NInput, {
                "value": recoveryCode.value,
                "maxlength": 64,
                "placeholder": tWithFallback(
                  "adminUsers.placeholders.confirmRecoveryCode",
                  "输入一次性恢复码",
                ),
                "autofocus": true,
                "onUpdate:value": (value) => {
                  recoveryCode.value = String(value || "").trim();
                },
              })
            : null,
          mode.value === "password"
            ? h(NInput, {
                "type": "password",
                "showPasswordOn": "click",
                "value": password.value,
                "placeholder": tWithFallback(
                  "adminUsers.placeholders.confirmCurrentPassword",
                  "输入当前管理员密码",
                ),
                "autofocus": true,
                "onUpdate:value": (value) => {
                  password.value = String(value || "");
                },
              })
            : null,
        ]),
      onPositiveClick: () => {
        const credential =
          mode.value === "totp"
            ? { totpCode: String(totpCode.value || "").replace(/\D/g, "") }
            : mode.value === "recovery"
              ? { recoveryCode: String(recoveryCode.value || "").trim() }
              : { password: String(password.value || "").trim() };
        if (
          !credential.password &&
          !credential.totpCode &&
          !credential.recoveryCode
        ) {
          message.warning(
            tWithFallback("adminUsers.messages.confirmFailed", "二次确认失败"),
          );
          return false;
        }
        finish(credential);
        return true;
      },
      onNegativeClick: () => finish(null),
      onClose: () => finish(null),
    });
  });

const sensitiveConfirmRemainingText = computed(() => {
  const expiresTs = Number(sensitiveConfirmExpiresAt.value) || 0;
  if (!sensitiveConfirmToken.value || !expiresTs) {
    return "";
  }
  const remainingMs = expiresTs - Number(sensitiveConfirmNowTs.value || 0);
  if (remainingMs <= 0) {
    return "";
  }
  const totalSeconds = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return t("adminUsers.messages.confirmRemaining", { minutes, seconds });
});

const startSensitiveConfirmTicker = () => {
  if (sensitiveConfirmTicker || typeof window === "undefined") {
    return;
  }
  sensitiveConfirmNowTs.value = Date.now();
  sensitiveConfirmTicker = window.setInterval(() => {
    sensitiveConfirmNowTs.value = Date.now();
    if (
      sensitiveConfirmToken.value &&
      sensitiveConfirmExpiresAt.value &&
      Number(sensitiveConfirmExpiresAt.value) <= Date.now()
    ) {
      clearSensitiveConfirmCache();
    }
  }, 1000);
};

const stopSensitiveConfirmTicker = () => {
  if (!sensitiveConfirmTicker || typeof window === "undefined") {
    return;
  }
  window.clearInterval(sensitiveConfirmTicker);
  sensitiveConfirmTicker = null;
};

const ensureSensitiveActionConfirmed = async (
  actionLabel = tWithFallback("adminUsers.actions.highRiskAction", "高危操作"),
  options = {},
) => {
  const cached = options.forcePrompt ? "" : getCachedSensitiveToken();
  if (cached) {
    return cached;
  }

  const credential = await promptAdminConfirmCredential({ actionLabel });
  if (!credential) {
    message.warning(
      tWithFallback("adminUsers.messages.confirmCancelled", "已取消二次确认"),
    );
    return "";
  }

  try {
    const res = await api.admin.confirmSensitiveAction(credential);
    if (!res.success || !res.data?.token) {
      message.error(
        res.message ||
          tWithFallback("adminUsers.messages.confirmFailed", "二次确认失败"),
      );
      return "";
    }
    const expiresTs = new Date(res.data.expiresAt || "").getTime();
    sensitiveConfirmToken.value = String(res.data.token || "");
    sensitiveConfirmExpiresAt.value = Number.isFinite(expiresTs)
      ? expiresTs
      : Date.now();
    message.success(
      tWithFallback("adminUsers.messages.confirmSuccess", "二次确认通过"),
    );
    return sensitiveConfirmToken.value;
  } catch (error) {
    clearSensitiveConfirmCache();
    message.error(
      error.message ||
        tWithFallback("adminUsers.messages.confirmFailed", "二次确认失败"),
    );
    return "";
  }
};

const shouldResetConfirmCache = (error) => {
  const code = String(error?.code || "");
  const msg = String(error?.message || "");
  return code.startsWith("ADMIN_CONFIRM_") || msg.includes("二次确认");
};

const fetchUsers = async () => {
  if (loading.value) {
    return;
  }
  loading.value = true;
  try {
    const res = await api.admin.listUsers();
    if (!res.success) {
      message.error(res.message || t("adminUsers.messages.loadFailed"));
      return;
    }
    users.value = (res.data || []).map((row) => ({
      ...row,
      accessScope: normalizeAccessScope(row.accessScope),
      roleCount: normalizeCount(
        row.roleCount,
        row.role_count,
        row.rolesCount,
        row.roles_count,
        row.roleNum,
      ),
      inviteCount: normalizeCount(
        row.inviteCount,
        row.invite_count,
        row.invitesCount,
        row.invites_count,
      ),
      tokenBindLimit: Math.max(
        1,
        Math.min(
          999,
          normalizeCount(row.tokenBindLimit, row.token_bind_limit, 999),
        ),
      ),
      refreshSecondVerifyEnabled: row.refreshSecondVerifyEnabled !== false,
    }));
  } catch (error) {
    message.error(error.message || t("adminUsers.messages.loadFailed"));
  } finally {
    loading.value = false;
  }
};

const handleAccessScopeChange = async (row, value) => {
  const nextScope = normalizeAccessScope(value);
  const previous = normalizeAccessScope(row?.accessScope);
  if (nextScope === previous) {
    return;
  }
  row.accessScope = nextScope;

  try {
    const confirmToken = await ensureSensitiveActionConfirmed(
      t("adminUsers.actions.updateAccountType"),
    );
    if (!confirmToken) {
      row.accessScope = previous;
      return;
    }
    const res = await api.admin.updateUserAccessScope(
      row.id,
      nextScope,
      confirmToken,
    );
    if (!res.success) {
      row.accessScope = previous;
      message.error(
        res.message || t("adminUsers.messages.updateAccountTypeFailed"),
      );
      return;
    }
    message.success(
      res.message || t("adminUsers.messages.updateAccountTypeSuccess"),
    );
    if (row.isCurrentUser) {
      await authStore.fetchUserInfo();
    }
  } catch (error) {
    row.accessScope = previous;
    if (shouldResetConfirmCache(error)) {
      clearSensitiveConfirmCache();
    }
    message.error(
      error.message || t("adminUsers.messages.updateAccountTypeFailed"),
    );
  }
};

const handleVisibilityChange = () => {
  if (typeof document === "undefined") {
    return;
  }
  if (document.visibilityState === "visible") {
    fetchUsers();
  }
};

const startAutoRefresh = () => {
  if (typeof window === "undefined" || autoRefreshTimer) {
    return;
  }
  autoRefreshTimer = window.setInterval(() => {
    if (
      typeof document !== "undefined" &&
      document.visibilityState !== "visible"
    ) {
      return;
    }
    fetchUsers();
  }, AUTO_REFRESH_INTERVAL);
};

const stopAutoRefresh = () => {
  if (typeof window === "undefined" || !autoRefreshTimer) {
    return;
  }
  window.clearInterval(autoRefreshTimer);
  autoRefreshTimer = null;
};

const handleAdminToggle = async (row, value) => {
  const previous = row.isAdmin;
  row.isAdmin = value;

  try {
    const confirmToken = await ensureSensitiveActionConfirmed(
      t("adminUsers.actions.updateAdmin"),
    );
    if (!confirmToken) {
      row.isAdmin = previous;
      return;
    }
    const res = await api.admin.updateUserAdmin(row.id, value, confirmToken);
    if (!res.success) {
      row.isAdmin = previous;
      message.error(res.message || t("adminUsers.messages.updateAdminFailed"));
      return;
    }
    message.success(res.message || t("adminUsers.messages.updateAdminSuccess"));
    if (row.isCurrentUser && !value) {
      await authStore.fetchUserInfo();
    }
  } catch (error) {
    row.isAdmin = previous;
    if (shouldResetConfirmCache(error)) {
      clearSensitiveConfirmCache();
    }
    message.error(error.message || t("adminUsers.messages.updateAdminFailed"));
  }
};

const updateTokenBindLimit = async (row) => {
  const current = Math.max(
    1,
    Math.min(999, Number(row?.tokenBindLimit) || 999),
  );
  const input = window.prompt(
    t("adminUsers.messages.tokenLimitPrompt", {
      username: row?.username || "",
      current,
    }),
    String(current),
  );
  if (input === null) {
    return;
  }

  const next = Number(input);
  if (!Number.isInteger(next) || next < 1 || next > 999) {
    message.error(t("adminUsers.validation.tokenBindLimit"));
    return;
  }

  try {
    const confirmToken = await ensureSensitiveActionConfirmed(
      t("adminUsers.actions.updateTokenBindLimit"),
    );
    if (!confirmToken) {
      return;
    }
    const res = await api.admin.updateUserTokenBindLimit(
      row.id,
      next,
      confirmToken,
    );
    if (!res.success) {
      message.error(
        res.message || t("adminUsers.messages.updateTokenBindLimitFailed"),
      );
      return;
    }
    row.tokenBindLimit = next;
    message.success(
      res.message || t("adminUsers.messages.updateTokenBindLimitSuccess"),
    );
  } catch (error) {
    if (shouldResetConfirmCache(error)) {
      clearSensitiveConfirmCache();
    }
    message.error(
      error.message || t("adminUsers.messages.updateTokenBindLimitFailed"),
    );
  }
};

const handleRefreshSecondVerifyChange = async (row, value) => {
  if (refreshSecondVerifyUpdating.value[row.id]) {
    return;
  }
  const nextValue = value !== false;
  const previous = row.refreshSecondVerifyEnabled !== false;
  if (nextValue === previous) {
    return;
  }

  try {
    setRefreshSecondVerifyUpdating(row.id, true);
    const confirmToken = await ensureSensitiveActionConfirmed(
      nextValue
        ? tWithFallback(
            "adminUsers.actions.enableRefreshSecondVerify",
            "开启刷新二次验证",
          )
        : tWithFallback(
            "adminUsers.actions.disableRefreshSecondVerify",
            "关闭刷新二次验证",
          ),
    );
    if (!confirmToken) {
      return;
    }
    const res = await api.admin.updateUserRefreshSecondVerify(
      row.id,
      nextValue,
      confirmToken,
    );
    if (!res.success) {
      message.error(
        res.message || t("adminUsers.messages.updateRefreshSecondVerifyFailed"),
      );
      return;
    }
    row.refreshSecondVerifyEnabled = nextValue;
    message.success(
      nextValue
        ? t("adminUsers.messages.updateRefreshSecondVerifyEnabled")
        : t("adminUsers.messages.updateRefreshSecondVerifyDisabled"),
    );
  } catch (error) {
    if (shouldResetConfirmCache(error)) {
      clearSensitiveConfirmCache();
    }
    message.error(
      error.message || t("adminUsers.messages.updateRefreshSecondVerifyFailed"),
    );
  } finally {
    setRefreshSecondVerifyUpdating(row.id, false);
  }
};

const openPasswordModal = (row) => {
  selectedUser.value = row;
  newPassword.value = "";
  confirmPassword.value = "";
  passwordModalVisible.value = true;
};

const closePasswordModal = () => {
  passwordModalVisible.value = false;
  selectedUser.value = null;
  newPassword.value = "";
  confirmPassword.value = "";
};

const openDeleteModal = (row) => {
  selectedUser.value = row;
  deleteConfirmText.value = "";
  deleteModalVisible.value = true;
};

const closeDeleteModal = () => {
  deleteModalVisible.value = false;
  selectedUser.value = null;
  deleteConfirmText.value = "";
};

const submitPasswordReset = async () => {
  if (!selectedUser.value) {
    return;
  }
  if (
    String(newPassword.value || "").length <
    resolvePasswordMinLength(selectedUser.value)
  ) {
    message.error(passwordPolicyHint.value);
    return;
  }
  if (newPassword.value !== confirmPassword.value) {
    message.error(t("adminUsers.validation.passwordMismatch"));
    return;
  }

  passwordSaving.value = true;
  try {
    const confirmToken = await ensureSensitiveActionConfirmed(
      t("adminUsers.actions.resetPassword"),
    );
    if (!confirmToken) {
      return;
    }
    const res = await api.admin.resetUserPassword(
      selectedUser.value.id,
      newPassword.value,
      confirmToken,
    );
    if (!res.success) {
      message.error(
        res.message || t("adminUsers.messages.resetPasswordFailed"),
      );
      return;
    }
    message.success(
      res.message || t("adminUsers.messages.resetPasswordSuccess"),
    );
    closePasswordModal();
    fetchUsers();
  } catch (error) {
    if (shouldResetConfirmCache(error)) {
      clearSensitiveConfirmCache();
    }
    message.error(
      error.message || t("adminUsers.messages.resetPasswordFailed"),
    );
  } finally {
    passwordSaving.value = false;
  }
};

const submitDeleteUser = async () => {
  if (!selectedUser.value) {
    return;
  }
  if (deleteConfirmText.value !== selectedUser.value.username) {
    message.error(t("adminUsers.validation.deleteConfirmMismatch"));
    return;
  }

  deleteSaving.value = true;
  try {
    const confirmToken = await ensureSensitiveActionConfirmed(
      t("adminUsers.actions.deleteUser"),
    );
    if (!confirmToken) {
      return;
    }
    const res = await api.admin.deleteUser(selectedUser.value.id, confirmToken);
    if (!res.success) {
      message.error(res.message || t("adminUsers.messages.deleteFailed"));
      return;
    }
    message.success(res.message || t("adminUsers.messages.deleteSuccess"));
    closeDeleteModal();
    fetchUsers();
  } catch (error) {
    if (shouldResetConfirmCache(error)) {
      clearSensitiveConfirmCache();
    }
    message.error(error.message || t("adminUsers.messages.deleteFailed"));
  } finally {
    deleteSaving.value = false;
  }
};

const createResetCode = async (row) => {
  try {
    const confirmToken = await ensureSensitiveActionConfirmed(
      t("adminUsers.actions.createResetCode"),
    );
    if (!confirmToken) {
      return;
    }
    const res = await api.admin.createUserResetCode(row.id, 15, confirmToken);
    if (!res.success) {
      message.error(
        res.message || t("adminUsers.messages.createResetCodeFailed"),
      );
      return;
    }
    resetCodeInfo.value = res.data || null;
    resetCodeModalVisible.value = true;
    message.success(
      res.message || t("adminUsers.messages.createResetCodeSuccess"),
    );
  } catch (error) {
    if (shouldResetConfirmCache(error)) {
      clearSensitiveConfirmCache();
    }
    message.error(
      error.message || t("adminUsers.messages.createResetCodeFailed"),
    );
  }
};

const copyResetCode = async () => {
  const code = resetCodeInfo.value?.shortCode;
  if (!code) {
    message.error(t("adminUsers.messages.noResetCodeToCopy"));
    return;
  }
  try {
    await navigator.clipboard.writeText(code);
    message.success(t("adminUsers.messages.resetCodeCopied"));
  } catch {
    message.error(t("adminUsers.messages.copyFailed"));
  }
};

const createMfaResetLink = async (row) => {
  try {
    const confirmToken = await ensureSensitiveActionConfirmed(
      t("adminUsers.actions.resetMfa"),
    );
    if (!confirmToken) {
      return;
    }
    const res = await api.admin.createUserMfaResetLink(row.id, confirmToken);
    if (!res.success) {
      message.error(
        res.message || t("adminUsers.messages.createMfaResetLinkFailed"),
      );
      return;
    }
    mfaResetLinkInfo.value = res.data || null;
    mfaResetLinkModalVisible.value = true;
    message.success(
      res.message || t("adminUsers.messages.createMfaResetLinkSuccess"),
    );
  } catch (error) {
    if (shouldResetConfirmCache(error)) {
      clearSensitiveConfirmCache();
    }
    message.error(
      error.message || t("adminUsers.messages.createMfaResetLinkFailed"),
    );
  }
};

const copyMfaResetLink = async () => {
  const link = String(mfaResetLinkInfo.value?.resetUrl || "").trim();
  if (!link) {
    message.warning(t("adminUsers.messages.noMfaResetLink"));
    return;
  }
  try {
    await navigator.clipboard.writeText(link);
    message.success(t("adminUsers.messages.copyMfaResetLinkSuccess"));
  } catch {
    message.error(t("adminUsers.messages.copyFailed"));
  }
};
const activationStatusTag = (row) => {
  if (row.active) {
    return {
      type: "success",
      text: t("adminUsers.status.tokenActive"),
    };
  }
  return {
    type: "warning",
    text: t("adminUsers.status.tokenExpired"),
  };
};
const tokenActivationColumns = computed(() => [
  {
    title: t("adminUsers.fields.tokenId"),
    key: "tokenId",
    minWidth: 220,
    render: (row) => maskTokenId(row.tokenId),
  },
  {
    title: t("adminUsers.fields.roleName"),
    key: "roleName",
    minWidth: 140,
    render: (row) => String(row.roleName || t("adminUsers.common.dash")),
  },
  {
    title: t("adminUsers.fields.roleId"),
    key: "roleId",
    width: 120,
    render: (row) =>
      String(row.roleId || row.gameAccountId || t("adminUsers.common.dash")),
  },
  {
    title: t("adminUsers.fields.tokenActivationStatus"),
    key: "active",
    width: 110,
    render: (row) => {
      const status = activationStatusTag(row);
      return h(
        NTag,
        {
          size: "small",
          type: status.type,
        },
        { default: () => status.text },
      );
    },
  },
  {
    title: t("adminUsers.fields.boundAt"),
    key: "boundAt",
    width: 170,
    render: (row) => formatDate(row.boundAt),
  },
  {
    title: t("adminUsers.fields.expiresAt"),
    key: "expiresAt",
    width: 170,
    render: (row) => formatDate(row.expiresAt),
  },
]);
const closeTokenActivationModal = () => {
  tokenActivationModalVisible.value = false;
  tokenActivationTarget.value = null;
  tokenActivationItems.value = [];
};
const openTokenActivationModal = async (row) => {
  tokenActivationTarget.value = row;
  tokenActivationItems.value = [];
  tokenActivationModalVisible.value = true;
  tokenActivationLoading.value = true;
  try {
    const res = await api.admin.listUserTokenActivations(row.id);
    if (!res.success) {
      message.error(
        res.message || t("adminUsers.messages.loadTokenActivationsFailed"),
      );
      return;
    }
    const list = Array.isArray(res.data?.items) ? res.data.items : [];
    tokenActivationItems.value = list.map((item) => ({
      ...item,
      active: Boolean(item.active),
    }));
  } catch (error) {
    message.error(
      error.message || t("adminUsers.messages.loadTokenActivationsFailed"),
    );
  } finally {
    tokenActivationLoading.value = false;
  }
};
const handleActionSelect = (key, row) => {
  const actionKey = String(key || "");
  if (actionKey === "tokenLimit") {
    updateTokenBindLimit(row);
    return;
  }
  if (actionKey === "shortCode") {
    createResetCode(row);
    return;
  }
  if (actionKey === "mfaReset") {
    createMfaResetLink(row);
    return;
  }
  if (actionKey === "resetPassword") {
    openPasswordModal(row);
    return;
  }
  if (actionKey === "tokenActivation") {
    openTokenActivationModal(row);
    return;
  }
  if (actionKey === "deleteUser" && !row.isCurrentUser) {
    openDeleteModal(row);
  }
};
const getActionOptions = (row) => [
  { label: t("adminUsers.actions.updateTokenBindLimit"), key: "tokenLimit" },
  { label: t("adminUsers.actions.viewTokenExpiry"), key: "tokenActivation" },
  {
    label: t("adminUsers.actions.resetMfa"),
    key: "mfaReset",
    disabled: !row.mfaEnabled,
  },
  { label: t("adminUsers.actions.shortCode"), key: "shortCode" },
  { label: t("adminUsers.actions.resetPassword"), key: "resetPassword" },
  {
    label: t("adminUsers.actions.deleteUser"),
    key: "deleteUser",
    disabled: row.isCurrentUser,
  },
];

const columns = computed(() => [
  {
    title: t("adminUsers.columns.account"),
    key: "username",
    minWidth: 220,
    ellipsis: { tooltip: true },
    render: (row) =>
      h("div", { class: "account-cell" }, [
        h("div", { class: "account-name-row" }, [
          h("div", { class: "account-name" }, row.username),
          row.isCurrentUser
            ? h(
                "span",
                { class: "status-chip status-chip--current" },
                t("adminUsers.status.currentUser"),
              )
            : null,
          row.isAdmin
            ? h(
                "span",
                { class: "status-chip status-chip--admin" },
                t("adminUsers.status.admin"),
              )
            : null,
        ]),
        h(
          "div",
          { class: "account-meta" },
          row.email || t("adminUsers.common.noEmail"),
        ),
      ]),
  },
  {
    title: t("adminUsers.columns.roleCount"),
    key: "roleCount",
    width: 76,
    render: (row) => roleCountFor(row),
  },
  {
    title: t("adminUsers.columns.inviteCount"),
    key: "inviteCount",
    width: 76,
  },
  {
    title: t("adminUsers.columns.accountType"),
    key: "accessScope",
    width: 150,
    render: (row) =>
      h(NSelect, {
        size: "small",
        consistentMenuWidth: false,
        options: accountTypeOptions.value,
        value: accountTypeValueFor(row),
        onUpdateValue: (value) => handleAccessScopeChange(row, value),
      }),
  },
  {
    title: t("adminUsers.columns.tokenBindLimit"),
    key: "tokenBindLimit",
    width: 86,
  },
  {
    title: t("adminUsers.columns.refreshSecondVerify"),
    key: "refreshSecondVerifyEnabled",
    width: 120,
    render: (row) =>
      h(NSwitch, {
        disabled: !!refreshSecondVerifyUpdating.value[row.id],
        value: row.refreshSecondVerifyEnabled !== false,
        onUpdateValue: (value) => handleRefreshSecondVerifyChange(row, value),
      }),
  },
  {
    title: t("adminUsers.columns.admin"),
    key: "isAdmin",
    width: 84,
    render: (row) =>
      h(NSwitch, {
        value: row.isAdmin,
        disabled: row.isCurrentUser,
        onUpdateValue: (value) => handleAdminToggle(row, value),
      }),
  },
  {
    title: t("adminUsers.columns.timeSummary"),
    key: "timeSummary",
    minWidth: 220,
    render: (row) =>
      h("div", { class: "time-summary-cell" }, [
        h("div", { class: "time-summary-item" }, [
          h(
            "span",
            { class: "time-summary-label" },
            t("adminUsers.fields.createdAt"),
          ),
          h("span", { class: "time-summary-value" }, formatDate(row.createdAt)),
        ]),
        h("div", { class: "time-summary-item" }, [
          h(
            "span",
            { class: "time-summary-label" },
            t("adminUsers.fields.lastLoginAt"),
          ),
          h(
            "span",
            { class: "time-summary-value" },
            formatDateWithRelative(row.lastLoginAt),
          ),
        ]),
      ]),
  },
  {
    title: t("adminUsers.columns.actions"),
    key: "actions",
    width: 96,
    render: (row) =>
      h(
        NDropdown,
        {
          trigger: "click",
          options: getActionOptions(row),
          onSelect: (key) => handleActionSelect(key, row),
        },
        {
          default: () =>
            h(
              NButton,
              {
                size: "small",
                tertiary: true,
                class: "actions-dropdown-trigger",
              },
              { default: () => t("adminUsers.actions.more") },
            ),
        },
      ),
  },
]);

onMounted(async () => {
  await authStore.initAuth();
  if (!canAccess.value) {
    router.replace("/admin/dashboard");
    return;
  }
  startSensitiveConfirmTicker();
  fetchUsers();
  startAutoRefresh();
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", handleVisibilityChange);
  }
});

onUnmounted(() => {
  stopSensitiveConfirmTicker();
  stopAutoRefresh();
  if (typeof document !== "undefined") {
    document.removeEventListener("visibilitychange", handleVisibilityChange);
  }
});
</script>

<style scoped lang="scss">
.admin-users-page {
  min-height: 100dvh;
  padding: 24px 0;
  animation: admin-users-fade-in 0.38s ease;
}

.container {
  max-width: 1440px;
  margin: 0 auto;
  padding: 0 16px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 16px;
  padding: var(--spacing-lg);
  border: 1px solid var(--surface-glass-border);
  border-radius: var(--border-radius-xl);
  background: var(--surface-glass);
  backdrop-filter: blur(12px);
  box-shadow: var(--shadow-light);
}

.page-header__main h1 {
  margin: 0;
  color: var(--text-primary);
}

.page-header__main p {
  margin: 4px 0 0;
  color: var(--text-secondary);
}

.page-header__action {
  flex-shrink: 0;
}

.page-header__actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 10px;
}

.page-header__search {
  width: 320px;
}

.page-overview {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.overview-card {
  padding: 14px 16px;
  border: 1px solid var(--surface-glass-border);
  border-radius: 14px;
  background: var(--surface-glass-strong);
  backdrop-filter: blur(10px);
  box-shadow: var(--shadow-light);
}

.overview-label {
  display: block;
  font-size: 13px;
  color: var(--text-secondary);
}

.overview-value {
  display: block;
  margin-top: 6px;
  font-size: 24px;
  line-height: 1;
  color: var(--text-primary);
  font-family: var(--font-family-mono);
  font-variant-numeric: tabular-nums;
}

.desktop-table-card {
  border-radius: 16px;
}

.desktop-table-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.desktop-table-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 12px;
}

.desktop-table-count {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.desktop-table-hint {
  font-size: 12px;
  color: var(--text-tertiary);
}

.account-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.account-name-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.account-name {
  font-weight: 600;
  color: #1f2937;
}

.account-meta {
  font-size: 12px;
  color: #6b7280;
  word-break: break-all;
}

.time-summary-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.time-summary-item {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}

.time-summary-label {
  color: var(--text-tertiary);
}

.time-summary-value {
  color: var(--text-primary);
}

.actions-cell {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.actions-cell :deep(.n-button) {
  min-width: 96px;
}

.actions-dropdown-trigger {
  min-width: 72px;
}

.password-modal {
  width: min(92vw, 460px);
}

.token-activation-modal {
  width: min(96vw, 920px);
}

.token-activation-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 16px;
  font-size: 13px;
  color: var(--text-secondary);
}

.token-activation-summary strong {
  color: var(--text-primary);
}

.desktop-only {
  display: block;
}

:deep(.desktop-only.n-card .n-card__content) {
  overflow-x: hidden;
}

:deep(.desktop-only .n-data-table .desktop-row-current-user > td) {
  background: rgba(15, 107, 255, 0.05);
}

.mobile-only {
  display: none;
}

.mobile-user-list__content {
  display: grid;
  gap: 12px;
}

.mobile-user-card {
  border-radius: 18px;
  border: 1px solid var(--surface-glass-border);
  background: var(--surface-glass-strong);
  transition: all var(--transition-fast);
}

.mobile-user-card:hover {
  border-color: rgba(15, 107, 255, 0.28);
  box-shadow: var(--shadow-light);
}

.mobile-user-card__top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.mobile-user-card__identity h3 {
  margin: 0;
  font-size: 18px;
  color: var(--text-primary);
}

.mobile-user-card__identity p {
  margin: 6px 0 0;
  font-size: 13px;
  color: var(--text-secondary);
  word-break: break-all;
}

.mobile-user-card__name-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.mobile-user-card__stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 16px;
}

.mobile-user-card__switch {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  margin-top: 16px;
  padding: 12px 14px;
  border-radius: 14px;
  background: var(--bg-tertiary);
}

.mobile-user-card__scope {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 170px;
  align-items: center;
  gap: 12px;
  margin-top: 10px;
  padding: 12px 14px;
  border-radius: 14px;
  background: var(--bg-tertiary);
}

.mobile-user-card__actions {
  display: grid;
  gap: 10px;
  margin-top: 16px;
}

.info-block {
  padding: 12px;
  border-radius: 14px;
  background: var(--bg-tertiary);
}

.info-block--wide {
  grid-column: 1 / -1;
}

.info-label {
  display: block;
  font-size: 12px;
  color: var(--text-tertiary);
}

.info-block strong,
.mobile-user-card__switch strong {
  display: block;
  margin-top: 6px;
  color: var(--text-primary);
}

.switch-hint {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--text-tertiary);
}

.status-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 24px;
  padding: 0 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
}

.status-chip--current {
  background: rgba(14, 165, 233, 0.12);
  color: #0369a1;
}

.status-chip--admin {
  background: rgba(16, 185, 129, 0.12);
  color: #047857;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.mobile-empty {
  padding: 24px 0;
}

:deep(.desktop-only.n-card) {
  border: 1px solid var(--surface-glass-border);
  background: var(--surface-glass-strong);
  backdrop-filter: blur(12px);
}

[data-theme="dark"] .overview-card {
  background: rgba(15, 23, 42, 0.72);
  border-color: rgba(148, 163, 184, 0.22);
}

[data-theme="dark"] .overview-value,
[data-theme="dark"] .mobile-user-card__identity h3,
[data-theme="dark"] .info-block strong {
  color: #e2e8f0;
}

[data-theme="dark"] .mobile-user-card__switch,
[data-theme="dark"] .mobile-user-card__scope,
[data-theme="dark"] .info-block {
  background: rgba(15, 23, 42, 0.78);
}

@keyframes admin-users-fade-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 768px) {
  .admin-users-page {
    padding: 10px 0 16px;
  }

  .container {
    padding: 0 10px;
  }

  .page-header {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
    margin-bottom: 10px;
  }

  .page-header__main h1 {
    font-size: 20px;
    line-height: 1.2;
  }

  .page-header__main p {
    margin-top: 2px;
    font-size: 12px;
  }

  .page-header__action {
    width: 100%;
    min-height: 34px;
  }

  .page-header__actions {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
  }

  .page-header__search {
    width: 100%;
  }

  .page-overview {
    grid-template-columns: 1fr;
    gap: 8px;
    margin-bottom: 10px;
  }

  .overview-card {
    padding: 10px 12px;
    border-radius: 10px;
  }

  .overview-label {
    font-size: 12px;
  }

  .overview-value {
    margin-top: 4px;
    font-size: 18px;
  }

  .desktop-only {
    display: none;
  }

  .mobile-only {
    display: block;
  }

  .mobile-user-list__content {
    gap: 8px;
  }

  .mobile-user-card {
    border-radius: 12px;
  }

  .mobile-user-card :deep(.n-card__content) {
    padding: 10px;
  }

  .mobile-user-card__identity h3 {
    font-size: 15px;
  }

  .mobile-user-card__identity p {
    margin-top: 4px;
    font-size: 12px;
  }

  .mobile-user-card__name-row {
    gap: 6px;
  }

  .mobile-user-card__stats {
    gap: 8px;
    margin-top: 10px;
  }

  .mobile-user-card__switch {
    gap: 8px;
    margin-top: 10px;
    padding: 8px 10px;
    border-radius: 10px;
  }

  .mobile-user-card__scope {
    grid-template-columns: 1fr;
    gap: 8px;
    margin-top: 8px;
    padding: 8px 10px;
    border-radius: 10px;
  }

  .mobile-user-card__actions {
    gap: 8px;
    margin-top: 10px;
  }

  .info-block {
    padding: 8px 10px;
    border-radius: 10px;
  }

  .info-label {
    font-size: 11px;
  }

  .info-block strong,
  .mobile-user-card__switch strong {
    margin-top: 3px;
    font-size: 13px;
    line-height: 1.2;
  }

  .switch-hint {
    margin-top: 2px;
    font-size: 11px;
  }

  .status-chip {
    min-height: 20px;
    padding: 0 7px;
    font-size: 11px;
  }

  .mobile-user-card__actions :deep(.n-button),
  .page-header__action :deep(.n-button) {
    min-height: 34px;
    font-size: 13px;
  }

  .modal-actions {
    display: grid;
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .modal-actions :deep(.n-button) {
    min-height: 34px;
  }
}

@media (max-width: 420px) {
  .container {
    padding: 0 8px;
  }

  .page-header__main h1 {
    font-size: 18px;
  }
}
</style>
