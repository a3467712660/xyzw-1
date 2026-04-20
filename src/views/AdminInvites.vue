<template>
  <div v-if="canAccess" class="admin-invites-page admin-surface-page">
    <div class="container">
      <div class="page-header">
        <div class="page-header__main">
          <h1>{{ t("adminInvitesPage.title") }}</h1>
          <p>{{ t("adminInvitesPage.subtitle") }}</p>
        </div>

        <div class="invite-creator-shell">
          <div class="invite-creator-shell__head">
            <span class="invite-creator-shell__eyebrow">{{ t("adminInvitesPage.title") }}</span>
            <strong>{{ t("adminInvitesPage.actions.generate") }}</strong>
          </div>

          <div class="invite-creator">
            <div class="invite-creator__field">
              <span class="invite-creator__label">{{ t("adminInvitesPage.creator.count") }}</span>
              <n-input-number v-model:value="createCount" :max="20" :min="1"></n-input-number>
            </div>
            <div class="invite-creator__field">
              <span class="invite-creator__label">{{ t("adminInvitesPage.creator.type") }}</span>
              <n-select
                v-model:value="inviteType"
                :consistent-menu-width="false"
                :options="inviteTypeOptions"
              ></n-select>
            </div>
            <div class="invite-creator__field invite-creator__field--limit">
              <span class="invite-creator__label">{{ t("adminInvitesPage.creator.bindTokenLimit") }}</span>
              <n-input-number
                v-model:value="bindTokenLimit"
                :max="999"
                :min="1"
                :precision="0"
              ></n-input-number>
            </div>
            <NButton
              class="invite-creator__button"
              type="primary"
              :loading="creating"
              @click="createCodes"
            >
              {{ t("adminInvitesPage.actions.generate") }}
            </NButton>
          </div>
        </div>
      </div>

      <div class="page-overview">
        <div class="overview-card">
          <span class="overview-label">{{ t("adminInvitesPage.overview.total") }}</span>
          <strong class="overview-value">{{ codes.length }}</strong>
        </div>
        <div class="overview-card">
          <span class="overview-label">{{ t("adminInvitesPage.overview.available") }}</span>
          <strong class="overview-value">{{ availableCount }}</strong>
        </div>
        <div class="overview-card">
          <span class="overview-label">{{ t("adminInvitesPage.overview.used") }}</span>
          <strong class="overview-value">{{ usedCount }}</strong>
        </div>
      </div>

      <div class="status-list">
        <div
          v-for="item in statusSummary"
          :key="item.key"
          class="status-list__item"
          :class="`status-list__item--${item.key}`"
        >
          <div class="status-list__meta">
            <span class="status-list__dot"></span>
            <span class="status-list__label">{{ item.label }}</span>
          </div>
          <strong class="status-list__count">{{ item.count }}</strong>
        </div>
      </div>

      <n-card embedded class="desktop-only desktop-table-card">
        <div class="desktop-table-card__header">
          <h3>{{ t("adminInvitesPage.list.title") }}</h3>
          <span>{{ t("adminInvitesPage.list.count", { count: sortedCodes.length }) }}</span>
        </div>
        <n-data-table
          class="admin-invites-table"
          :columns="columns"
          :data="sortedCodes"
          :loading="loading"
          :pagination="{ pageSize: 12 }"
          :scroll-x="1480"
        ></n-data-table>
      </n-card>

      <div class="mobile-only mobile-invite-list">
        <n-spin :show="loading">
          <div v-if="sortedCodes.length" class="mobile-invite-list__content">
            <n-card
              v-for="row in sortedCodes"
              :key="row.id"
              embedded
              class="mobile-invite-card"
            >
              <div class="mobile-invite-card__header">
                <div class="mobile-invite-card__code">
                  <span class="info-label">{{ t("adminInvitesPage.fields.code") }}</span>
                  <strong>{{ row.code }}</strong>
                </div>
                <span
                  class="status-chip"
                  :class="`status-chip--${getInviteStatus(row).kind}`"
                  :style="getInviteStatusStyle(getInviteStatus(row).kind)"
                >
                  {{ getInviteStatus(row).label }}
                </span>
              </div>

              <div class="mobile-invite-card__meta">
                <div class="info-block">
                  <span class="info-label">{{ t("adminInvitesPage.fields.createdBy") }}</span>
                  <strong>{{ row.createdBy || t("adminInvitesPage.common.dash") }}</strong>
                </div>
                <div class="info-block">
                  <span class="info-label">{{ t("adminInvitesPage.fields.usedBy") }}</span>
                  <strong>{{ row.usedBy || t("adminInvitesPage.common.dash") }}</strong>
                </div>
                <div class="info-block">
                  <span class="info-label">{{ t("adminInvitesPage.fields.type") }}</span>
                  <strong>{{ getInviteKindLabel(row) }}</strong>
                </div>
                <div class="info-block">
                  <span class="info-label">{{ t("adminInvitesPage.fields.bindTokenLimit") }}</span>
                  <strong>{{ getBindTokenLimitLabel(row) }}</strong>
                </div>
                <div class="info-block info-block--wide">
                  <span class="info-label">{{ t("adminInvitesPage.fields.createdAt") }}</span>
                  <strong>{{ formatDate(row.createdAt) }}</strong>
                </div>
                <div class="info-block info-block--wide">
                  <span class="info-label">{{ t("adminInvitesPage.fields.autoDisableAt") }}</span>
                  <strong>{{ formatAutoDisableDate(row) }}</strong>
                </div>
              </div>

              <div class="mobile-invite-card__actions">
                <NButton
                  v-if="row.isActive && !row.usedAt"
                  block
                  tertiary
                  type="warning"
                  @click="disableCode(row)"
                >
                  {{ t("adminInvitesPage.actions.disableCode") }}
                </NButton>
              </div>
            </n-card>
          </div>

          <n-empty
            v-else-if="!loading"
            class="mobile-empty"
            :description="t('adminInvitesPage.empty')"
          ></n-empty>
        </n-spin>
      </div>

      <n-modal
        class="created-codes-modal"
        preset="card"
        :mask-closable="false"
        :show="showCreatedCodesModal"
        :title="t('adminInvitesPage.createdModal.title')"
        @update:show="handleCreatedCodesModalUpdate"
      >
        <div class="created-codes-modal__body">
          <p class="created-codes-modal__hint">
            {{ t("adminInvitesPage.createdModal.hint") }}
          </p>
          <div class="created-codes-modal__list">
            <code
              v-for="code in createdCodesPlaintext"
              :key="code"
              class="created-codes-modal__item"
            >{{ code }}</code>
          </div>
        </div>
        <template #footer>
          <div class="created-codes-modal__actions">
            <NButton tertiary @click="copyCreatedCodes">
              {{ t("adminInvitesPage.createdModal.copy") }}
            </NButton>
            <NButton type="primary" @click="closeCreatedCodesModal">
              {{ t("adminInvitesPage.createdModal.close") }}
            </NButton>
          </div>
        </template>
      </n-modal>
    </div>
  </div>
</template>

<script setup>
import { computed, h, onMounted, ref } from "vue";
import { NButton, NInput, useDialog, useMessage } from "naive-ui/es";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import api from "@/api";
import { useAuthStore } from "@/stores/auth";

const message = useMessage();
const dialog = useDialog();
const { locale, t } = useI18n();
const router = useRouter();
const authStore = useAuthStore();

const loading = ref(false);
const creating = ref(false);
const createCount = ref(1);
const inviteType = ref("normal");
const bindTokenLimit = ref(1);
const sensitiveConfirmToken = ref("");
const sensitiveConfirmExpiresAt = ref(0);
const showCreatedCodesModal = ref(false);
const createdCodesPlaintext = ref([]);
const inviteTypeOptions = [
  { label: t("adminInvitesPage.types.normal"), value: "normal" },
  { label: t("adminInvitesPage.types.temporary"), value: "temporary" },
];
const codes = ref([]);
const canAccess = computed(
  () => authStore.isAuthenticated && authStore.user?.isAdmin,
);

const availableCount = computed(
  () => codes.value.filter((row) => row.isActive && !row.usedAt).length,
);
const usedCount = computed(
  () => codes.value.filter((row) => row.usedAt).length,
);
const sortedCodes = computed(() =>
  [...codes.value].sort((a, b) => {
    const aUnused = !a.usedAt;
    const bUnused = !b.usedAt;
    if (aUnused !== bUnused) {
      return aUnused ? -1 : 1;
    }

    const aCreatedAt = new Date(a.createdAt || 0).getTime();
    const bCreatedAt = new Date(b.createdAt || 0).getTime();
    return bCreatedAt - aCreatedAt;
  }),
);
const disabledCount = computed(
  () => codes.value.filter((row) => !row.isActive && !row.usedAt).length,
);
const statusSummary = computed(() => [
  { key: "active", label: t("adminInvitesPage.status.active"), count: availableCount.value },
  { key: "used", label: t("adminInvitesPage.status.used"), count: usedCount.value },
  { key: "disabled", label: t("adminInvitesPage.status.disabled"), count: disabledCount.value },
]);

const formatDate = (value) =>
  value ? new Date(value).toLocaleString(locale.value) : t("adminInvitesPage.common.dash");

const formatAutoDisableDate = (row) =>
  row.isActive && !row.usedAt ? formatDate(row.autoDisableAt) : t("adminInvitesPage.common.dash");

const getInviteKindLabel = (row) =>
  row.isTemporary ? t("adminInvitesPage.types.shortTemporary") : t("adminInvitesPage.types.shortNormal");
const getInviteTypeLabel = (row) => getInviteKindLabel(row);
const getBindTokenLimitLabel = (row) =>
  `${Math.max(1, Number(row.bindAccountLimit) || 1)}`;

const getInviteStatus = (row) => {
  if (row.usedAt) {
    return { label: t("adminInvitesPage.status.used"), kind: "used" };
  }
  if (
    !row.isActive
    && !row.usedAt
  && row.autoDisableAt
  && new Date(row.autoDisableAt).getTime() <= Date.now()
  ) {
    return { label: t("adminInvitesPage.status.autoExpired"), kind: "disabled" };
  }
  if (!row.isActive) {
    return { label: t("adminInvitesPage.status.disabled"), kind: "disabled" };
  }
  return { label: t("adminInvitesPage.status.available"), kind: "active" };
};

const getInviteStatusStyle = (kind) => {
  const baseStyle = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    verticalAlign: "middle",
    minHeight: "32px",
    height: "32px",
    minWidth: "88px",
    padding: "0 16px",
    border: "1px solid transparent",
    borderRadius: "999px",
    boxSizing: "border-box",
    fontSize: "14px",
    fontWeight: "700",
    letterSpacing: "0.4px",
    lineHeight: "1",
    whiteSpace: "nowrap",
    boxShadow:
      "inset 0 1px 0 rgba(255,255,255,.45), 0 1px 2px rgba(15,23,42,.08)",
  };

  if (kind === "active") {
    return {
      ...baseStyle,
      background: "linear-gradient(180deg, #ccefd8 0%, #b8e3c7 100%)",
      borderColor: "#a7dbba",
      color: "#267a4a",
    };
  }
  if (kind === "used") {
    return {
      ...baseStyle,
      background: "linear-gradient(180deg, #f5d3e8 0%, #eec1df 100%)",
      borderColor: "#e5b0d2",
      color: "#8f3f78",
    };
  }
  return {
    ...baseStyle,
    background: "linear-gradient(180deg, #dfd3f5 0%, #cfbfea 100%)",
    borderColor: "#c3b0e3",
    color: "#5a4289",
  };
};

const copyText = async (text) => {
  if (!text)
    return false;

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {}

  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "readonly");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const success = document.execCommand("copy");
    document.body.removeChild(textarea);
    return success;
  } catch {
    return false;
  }
};

const getCachedSensitiveConfirmToken = () => {
  if (
    sensitiveConfirmToken.value
    && Number.isFinite(sensitiveConfirmExpiresAt.value)
    && sensitiveConfirmExpiresAt.value > Date.now() + 3000
  ) {
    return sensitiveConfirmToken.value;
  }
  return "";
};

const clearSensitiveConfirmToken = () => {
  sensitiveConfirmToken.value = "";
  sensitiveConfirmExpiresAt.value = 0;
};

const promptSensitiveCredential = ({ actionLabel = "高危操作" } = {}) =>
  new Promise((resolve) => {
    const mfaEnabled = Boolean(authStore.user?.mfaEnabled);
    const password = ref("");
    const totpCode = ref("");
    let settled = false;

    const finish = (value) => {
      if (settled) return;
      settled = true;
      resolve(value || null);
    };

    dialog.warning({
      title: t("adminInvitesPage.dialogs.sensitiveConfirm.title"),
      positiveText: t("adminInvitesPage.dialogs.sensitiveConfirm.confirm"),
      negativeText: t("adminInvitesPage.dialogs.sensitiveConfirm.cancel"),
      content: () =>
        h("div", { style: "display:flex;flex-direction:column;gap:12px;" }, [
          h(
            "div",
            { style: "line-height:1.6;" },
            mfaEnabled
              ? t("adminInvitesPage.messages.confirmMfaPrompt", { action: actionLabel })
              : t("adminInvitesPage.messages.confirmPrompt", { action: actionLabel }),
          ),
          h(NInput, {
            type: mfaEnabled ? "text" : "password",
            showPasswordOn: mfaEnabled ? undefined : "click",
            value: mfaEnabled ? totpCode.value : password.value,
            maxlength: mfaEnabled ? 6 : undefined,
            placeholder: mfaEnabled
              ? t("adminInvitesPage.messages.confirmTotpPrompt")
              : t("adminInvitesPage.messages.confirmPasswordRequired"),
            autofocus: true,
            onUpdateValue: (value) => {
              if (mfaEnabled) {
                totpCode.value = String(value || "").replace(/\D/g, "");
                return;
              }
              password.value = String(value || "");
            },
          }),
        ]),
      onPositiveClick: () => {
        if (mfaEnabled) {
          const normalized = String(totpCode.value || "").replace(/\D/g, "");
          if (!normalized) {
            message.warning(t("adminInvitesPage.messages.confirmTotpRequired"));
            return false;
          }
          finish({ totpCode: normalized });
          return true;
        }
        const normalized = String(password.value || "").trim();
        if (!normalized) {
          message.warning(t("adminInvitesPage.messages.confirmPasswordRequired"));
          return false;
        }
        finish({ password: normalized });
        return true;
      },
      onNegativeClick: () => finish(null),
      onClose: () => finish(null),
    });
  });

const ensureSensitiveActionConfirmed = async (actionLabel = "高危操作") => {
  const cached = getCachedSensitiveConfirmToken();
  if (cached) return cached;

  const credential = await promptSensitiveCredential({ actionLabel });
  if (!credential) {
    message.warning(t("adminInvitesPage.messages.confirmCancelled"));
    return "";
  }

  try {
    const res = await api.admin.confirmSensitiveAction(credential);
    if (!res?.success || !res?.data?.token) {
      message.error(res?.message || t("adminInvitesPage.messages.confirmFailed"));
      return "";
    }
    const expiresTs = new Date(res.data.expiresAt || "").getTime();
    sensitiveConfirmToken.value = String(res.data.token || "");
    sensitiveConfirmExpiresAt.value = Number.isFinite(expiresTs)
      ? expiresTs
      : Date.now() + 5 * 60 * 1000;
    message.success(t("adminInvitesPage.messages.confirmPassed"));
    return sensitiveConfirmToken.value;
  } catch (error) {
    message.error(error.message || t("adminInvitesPage.messages.confirmFailed"));
    return "";
  }
};

const fetchCodes = async () => {
  loading.value = true;
  try {
    const res = await api.admin.listInviteCodes();
    if (res.success) {
      codes.value = res.data || [];
    } else {
      message.error(res.message || t("adminInvitesPage.messages.loadFailed"));
    }
  } catch (error) {
    message.error(error.message || t("adminInvitesPage.messages.loadFailed"));
  } finally {
    loading.value = false;
  }
};

const disableCode = async (row) => {
  try {
    const confirmToken = await ensureSensitiveActionConfirmed(
      t("adminInvitesPage.messages.disableAction"),
    );
    if (!confirmToken) return;
    const res = await api.admin.disableInviteCode(row.id, confirmToken);
    if (!res.success) {
      message.error(res.message || t("adminInvitesPage.messages.disableFailed"));
      return;
    }
    message.success(t("adminInvitesPage.messages.disabled"));
    fetchCodes();
  } catch (error) {
    if (Number(error?.status || 0) === 401 || Number(error?.status || 0) === 403) {
      clearSensitiveConfirmToken();
    }
    message.error(error.message || t("adminInvitesPage.messages.disableFailed"));
  }
};

const createCodes = async () => {
  creating.value = true;
  try {
    const confirmToken = await ensureSensitiveActionConfirmed(
      t("adminInvitesPage.messages.createAction"),
    );
    if (!confirmToken) return;
    const res = await api.admin.createInviteCodesWithConfirm({
      count: createCount.value,
      isTemporary: inviteType.value === "temporary",
      bindAccountLimit: Math.max(1, Math.min(999, Number(bindTokenLimit.value) || 1)),
    }, confirmToken);
    if (!res.success) {
      message.error(res.message || t("adminInvitesPage.messages.createFailed"));
      return;
    }

    const createdCodes = (res.data || [])
      .map((item) => String(item?.code || "").trim())
      .filter(Boolean);
    const list = createdCodes.join("\n");
    const copied = await copyText(list);
    createdCodesPlaintext.value = createdCodes;
    showCreatedCodesModal.value = createdCodes.length > 0;

    if (copied) {
      message.success(t("adminInvitesPage.messages.createdAndCopied", { count: res.data?.length || 0 }));
    } else {
      message.success(t("adminInvitesPage.messages.created", { count: res.data?.length || 0 }));
      message.warning(t("adminInvitesPage.messages.autoCopyFailed"));
    }

    fetchCodes();
  } catch (error) {
    if (Number(error?.status || 0) === 401 || Number(error?.status || 0) === 403) {
      clearSensitiveConfirmToken();
    }
    message.error(error.message || t("adminInvitesPage.messages.createFailed"));
  } finally {
    creating.value = false;
  }
};

const closeCreatedCodesModal = () => {
  showCreatedCodesModal.value = false;
  createdCodesPlaintext.value = [];
};

const handleCreatedCodesModalUpdate = (show) => {
  if (show) {
    showCreatedCodesModal.value = true;
    return;
  }
  closeCreatedCodesModal();
};

const copyCreatedCodes = async () => {
  if (!createdCodesPlaintext.value.length) {
    message.warning(t("adminInvitesPage.messages.copyFailed"));
    return;
  }
  const copied = await copyText(createdCodesPlaintext.value.join("\n"));
  if (copied) {
    message.success(t("adminInvitesPage.messages.codeCopied"));
    return;
  }
  message.error(t("adminInvitesPage.messages.copyFailed"));
};

const columns = computed(() => [
  {
    title: t("adminInvitesPage.columns.code"),
    key: "code",
    minWidth: 220,
    render: (row) => h("strong", { class: "name-cell", title: row.code }, row.code),
  },
  {
    title: t("adminInvitesPage.columns.type"),
    key: "isTemporary",
    width: 180,
    render: (row) => h("div", { class: "type-cell" }, [
      h("div", { class: "type-cell__main" }, getInviteTypeLabel(row)),
    ]),
  },
  {
    title: t("adminInvitesPage.columns.bindTokenLimit"),
    key: "bindTokenLimit",
    width: 110,
    render: (row) => getBindTokenLimitLabel(row),
  },
  {
    title: t("adminInvitesPage.columns.status"),
    key: "status",
    width: 100,
    align: "center",
    titleAlign: "center",
    render: (row) => {
      const status = getInviteStatus(row);
      return h(
        "div",
        {
          style: {
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            width: "100%",
          },
        },
        [
          h(
            "span",
            {
              class: ["status-chip", `status-chip--${status.kind}`],
              style: getInviteStatusStyle(status.kind),
            },
            status.label,
          ),
        ],
      );
    },
  },
  {
    title: t("adminInvitesPage.columns.createdBy"),
    key: "createdBy",
    width: 170,
    render: (row) => {
      const value = row.createdBy || t("adminInvitesPage.common.dash");
      return h("span", { class: "name-cell", title: value }, value);
    },
  },
  {
    title: t("adminInvitesPage.columns.usedBy"),
    key: "usedBy",
    width: 170,
    render: (row) => {
      const value = row.usedBy || t("adminInvitesPage.common.dash");
      return h("span", { class: "name-cell", title: value }, value);
    },
  },
  {
    title: t("adminInvitesPage.columns.createdAt"),
    key: "createdAt",
    width: 180,
    render: (row) => formatDate(row.createdAt),
  },
  {
    title: t("adminInvitesPage.columns.autoDisableAt"),
    key: "autoDisableAt",
    width: 180,
    render: (row) => formatAutoDisableDate(row),
  },
  {
    title: t("adminInvitesPage.columns.actions"),
    key: "actions",
    width: 110,
    render: (row) =>
      row.isActive && !row.usedAt
        ? h(
            NButton,
            {
              size: "small",
              tertiary: true,
              type: "warning",
              onClick: () => disableCode(row),
            },
            { default: () => t("adminInvitesPage.actions.disable") },
          )
        : t("adminInvitesPage.common.dash"),
  },
]);

onMounted(async () => {
  await authStore.initAuth();
  if (!canAccess.value) {
    router.replace("/admin/dashboard");
    return;
  }
  fetchCodes();
});
</script>

<style scoped lang="scss">
.admin-invites-page.admin-surface-page {
  .container {
    max-width: 1260px;
    padding: 0 16px;
    display: grid;
    gap: 16px;
  }

  .page-header {
    margin-bottom: 0;
    padding: clamp(20px, 2vw, 28px);
    border-radius: 28px;
    background:
      linear-gradient(135deg, rgba(15, 107, 255, 0.1), transparent 74%),
      var(--surface-glass-strong);
  }

  .invite-creator {
    gap: 12px;
  }

  .invite-creator__field {
    gap: 6px;
  }

  .page-overview {
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 12px;
    margin-bottom: 0;
  }

  .overview-card {
    padding: 16px 18px;
    border-radius: 20px;
  }

  .status-list {
    margin-bottom: 0;
  }

  .desktop-table-card {
    border-radius: 24px;
  }

  .desktop-table-card__header {
    padding-bottom: 14px;
    margin-bottom: 14px;
    border-bottom: 1px solid var(--console-divider);
  }

  .mobile-invite-card {
    border-radius: 22px;
  }
}

.admin-invites-page {
  min-height: 100dvh;
  padding: 16px 0;
  animation: admin-invite-fade-in 0.38s ease;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 14px;
}

.admin-invites-page {
  --invite-surface: rgba(255, 255, 255, 0.78);
  --invite-surface-strong: rgba(255, 255, 255, 0.92);
  --invite-border: rgba(37, 99, 235, 0.13);
  --invite-border-strong: rgba(37, 99, 235, 0.22);
  --invite-shadow: 0 18px 42px rgba(30, 64, 175, 0.1);
  --invite-shadow-soft: 0 10px 26px rgba(30, 64, 175, 0.08);
  --invite-blue-soft: rgba(219, 234, 254, 0.72);
  --invite-green-soft: rgba(220, 252, 231, 0.72);
  --invite-amber-soft: rgba(255, 247, 237, 0.78);
}

.admin-invites-page .container {
  max-width: 1320px;
  gap: 18px;
}

.admin-invites-page .page-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(320px, 500px);
  align-items: stretch;
  gap: 18px;
  margin-bottom: 0;
  border-color: var(--invite-border);
  background:
    radial-gradient(circle at 12% 0%, rgba(37, 99, 235, 0.14), transparent 34%),
    linear-gradient(180deg, rgba(239, 246, 255, 0.9), rgba(226, 238, 255, 0.64)),
    rgba(248, 251, 255, 0.8);
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.84) inset,
    var(--invite-shadow);
}

.admin-invites-page .page-header__main {
  display: grid;
  align-content: start;
  gap: 10px;
  min-width: 0;
}

.admin-invites-page .page-header__main h1 {
  font-size: clamp(28px, 3vw, 38px);
  line-height: 1;
  letter-spacing: -0.02em;
}

.admin-invites-page .page-header__main p {
  max-width: 62ch;
  margin: 0;
  color: var(--text-secondary);
  line-height: 1.7;
}

.invite-creator-shell {
  display: grid;
  align-self: start;
  gap: 12px;
  padding: 14px;
  border: 1px solid rgba(37, 99, 235, 0.12);
  border-radius: 22px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.74), rgba(219, 234, 254, 0.44)),
    rgba(255, 255, 255, 0.66);
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.84) inset,
    0 14px 30px rgba(30, 64, 175, 0.08);
}

.invite-creator-shell__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.invite-creator-shell__eyebrow {
  color: var(--primary-color);
  font-family: var(--font-family-mono);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.invite-creator-shell__head strong {
  color: var(--text-primary);
  font-size: 14px;
}

.admin-invites-page .invite-creator {
  display: grid;
  grid-template-columns: minmax(76px, 0.65fr) minmax(120px, 1fr) minmax(96px, 0.7fr) minmax(116px, auto);
  align-items: end;
  gap: 10px;
}

.admin-invites-page .invite-creator__field {
  min-width: 0;
}

.admin-invites-page .invite-creator__label {
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 700;
}

.admin-invites-page .invite-creator :deep(.n-input-number),
.admin-invites-page .invite-creator :deep(.n-base-selection) {
  width: 100%;
}

.admin-invites-page .invite-creator__button {
  min-height: 42px;
  border-radius: 14px;
  box-shadow: 0 10px 22px rgba(37, 99, 235, 0.24);
}

.admin-invites-page .page-overview {
  gap: 14px;
}

.admin-invites-page .overview-card {
  position: relative;
  overflow: hidden;
  min-height: 112px;
  border-color: var(--invite-border);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.78), rgba(239, 246, 255, 0.54)),
    var(--invite-surface);
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.78) inset,
    var(--invite-shadow-soft);
}

.admin-invites-page .overview-card::after {
  content: "";
  position: absolute;
  inset: 0 auto 0 0;
  width: 4px;
  background: linear-gradient(180deg, var(--primary-color), rgba(20, 184, 166, 0.72));
}

.admin-invites-page .overview-label,
.admin-invites-page .status-list__label,
.admin-invites-page .desktop-table-card__header span,
.admin-invites-page .info-label {
  color: var(--text-secondary);
  font-weight: 700;
}

.admin-invites-page .overview-value {
  font-size: clamp(24px, 2.5vw, 34px);
}

.admin-invites-page .status-list {
  gap: 12px;
}

.admin-invites-page .status-list__item {
  min-height: 56px;
  border-color: var(--invite-border);
  border-radius: 18px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.74), rgba(239, 246, 255, 0.44)),
    var(--invite-surface);
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.76) inset,
    0 10px 24px rgba(30, 64, 175, 0.07);
}

.admin-invites-page .status-list__dot {
  width: 9px;
  height: 9px;
  box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.08);
}

.admin-invites-page .status-list__item--active {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.76), rgba(220, 252, 231, 0.56)),
    var(--invite-green-soft);
}

.admin-invites-page .status-list__item--used {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.76), rgba(219, 234, 254, 0.56)),
    var(--invite-blue-soft);
}

.admin-invites-page .status-list__item--disabled {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.76), rgba(255, 247, 237, 0.58)),
    var(--invite-amber-soft);
}

.admin-invites-page .desktop-table-card {
  overflow: hidden;
  border-color: var(--invite-border);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.78), rgba(248, 251, 255, 0.74)),
    var(--invite-surface-strong);
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.78) inset,
    var(--invite-shadow);
}

.admin-invites-page .desktop-table-card :deep(.n-card__content) {
  padding: 18px;
}

.admin-invites-page .desktop-table-card__header h3 {
  font-size: 18px;
  font-weight: 800;
}

.admin-invites-page .admin-invites-table :deep(.n-data-table-wrapper) {
  border: 1px solid rgba(37, 99, 235, 0.1);
  border-radius: 18px;
  overflow: hidden;
}

.admin-invites-page .admin-invites-table :deep(.n-data-table-th) {
  background: linear-gradient(180deg, rgba(239, 246, 255, 0.96), rgba(226, 238, 255, 0.84));
  color: #1e293b;
}

.admin-invites-page .admin-invites-table :deep(.n-data-table-td) {
  background: rgba(255, 255, 255, 0.68);
}

.admin-invites-page .code-cell strong,
.admin-invites-page .name-cell {
  color: var(--text-primary);
}

.admin-invites-page .mobile-invite-list__content {
  gap: 12px;
}

.admin-invites-page .mobile-invite-card {
  overflow: hidden;
  border-color: var(--invite-border);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.78), rgba(239, 246, 255, 0.52)),
    var(--invite-surface);
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.78) inset,
    0 12px 28px rgba(30, 64, 175, 0.08);
}

.admin-invites-page .mobile-invite-card__code strong {
  font-family: var(--font-family-mono);
  letter-spacing: 0.02em;
}

.admin-invites-page .info-block {
  border: 1px solid rgba(37, 99, 235, 0.1);
  background: rgba(255, 255, 255, 0.62);
}

.admin-invites-page.admin-surface-page .page-header {
  background:
    radial-gradient(circle at 12% 0%, rgba(37, 99, 235, 0.14), transparent 34%),
    linear-gradient(180deg, rgba(239, 246, 255, 0.9), rgba(226, 238, 255, 0.64)),
    rgba(248, 251, 255, 0.8);
}

.admin-invites-page.admin-surface-page .overview-card,
.admin-invites-page.admin-surface-page .status-list__item,
.admin-invites-page.admin-surface-page .desktop-table-card,
.admin-invites-page.admin-surface-page .mobile-invite-card {
  border-color: var(--invite-border);
}

:global([data-theme="dark"]) .admin-invites-page {
  --invite-surface: rgba(15, 23, 42, 0.78);
  --invite-surface-strong: rgba(15, 23, 42, 0.9);
  --invite-border: rgba(96, 165, 250, 0.2);
  --invite-border-strong: rgba(96, 165, 250, 0.3);
  --invite-shadow: 0 18px 42px rgba(0, 0, 0, 0.28);
  --invite-shadow-soft: 0 10px 26px rgba(0, 0, 0, 0.2);
}

:global([data-theme="dark"]) .admin-invites-page.admin-surface-page .page-header,
:global([data-theme="dark"]) .admin-invites-page .invite-creator-shell,
:global([data-theme="dark"]) .admin-invites-page.admin-surface-page .overview-card,
:global([data-theme="dark"]) .admin-invites-page.admin-surface-page .status-list__item,
:global([data-theme="dark"]) .admin-invites-page.admin-surface-page .desktop-table-card,
:global([data-theme="dark"]) .admin-invites-page.admin-surface-page .mobile-invite-card {
  background:
    linear-gradient(180deg, rgba(30, 41, 59, 0.72), rgba(15, 23, 42, 0.84)),
    var(--invite-surface);
}

:global([data-theme="dark"]) .admin-invites-page .admin-invites-table :deep(.n-data-table-th) {
  background: linear-gradient(180deg, rgba(30, 41, 59, 0.95), rgba(15, 23, 42, 0.9));
  color: #e2e8f0;
}

:global([data-theme="dark"]) .admin-invites-page .admin-invites-table :deep(.n-data-table-td) {
  background: rgba(15, 23, 42, 0.58);
}

:global([data-theme="dark"]) .admin-invites-page .info-block {
  background: rgba(15, 23, 42, 0.58);
  border-color: rgba(96, 165, 250, 0.16);
}

.created-codes-modal {
  max-width: 640px;
}

.created-codes-modal__body {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.created-codes-modal__hint {
  margin: 0;
  color: var(--text-secondary);
  line-height: 1.6;
}

.created-codes-modal__list {
  display: grid;
  gap: 10px;
  max-height: 360px;
  overflow: auto;
  padding: 14px;
  border: 1px solid var(--surface-glass-border);
  border-radius: var(--border-radius-lg);
  background: rgba(15, 23, 42, 0.04);
}

.created-codes-modal__item {
  display: block;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: 14px;
  font-weight: 700;
  line-height: 1.6;
  word-break: break-all;
}

.created-codes-modal__actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 10px;
  margin-bottom: 10px;
  padding: var(--spacing-lg);
  border: 1px solid var(--surface-glass-border);
  border-radius: var(--border-radius-xl);
  background: var(--surface-glass);
  box-shadow: var(--shadow-light);
  backdrop-filter: blur(12px);
}

.page-header__main h1 {
  margin: 0;
}

.page-header__main p {
  margin: 4px 0 0;
  color: var(--text-secondary);
}

.invite-creator {
  display: flex;
  align-items: flex-end;
  gap: 8px;
}

.invite-creator--second-line {
  margin-top: 8px;
}

.invite-creator__field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 120px;
}

.invite-creator__label {
  font-size: 12px;
  color: var(--text-tertiary);
}

.invite-creator__button {
  flex-shrink: 0;
}

.page-overview {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 8px;
}

.overview-card {
  padding: 10px 12px;
  border: 1px solid var(--surface-glass-border);
  border-radius: 12px;
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
  margin-top: 4px;
  font-size: 20px;
  line-height: 1;
  color: var(--text-primary);
  font-family: var(--font-family-mono);
  font-variant-numeric: tabular-nums;
}

.desktop-only {
  display: block;
}

.desktop-table-card {
  border-radius: 16px;
  border: 1px solid var(--surface-glass-border);
  background: var(--surface-glass-strong);
  backdrop-filter: blur(12px);
}

.desktop-table-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.desktop-table-card__header h3 {
  margin: 0;
  font-size: 15px;
  color: var(--text-primary);
}

.desktop-table-card__header span {
  font-size: 12px;
  color: var(--text-tertiary);
}

.mobile-only {
  display: none;
}

.code-cell {
  display: flex;
  align-items: center;
  gap: 6px;
}

.code-cell strong {
  word-break: break-all;
  color: #0f172a;
}

.type-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
  line-height: 1.2;
}

.type-cell__main {
  font-weight: 600;
  color: var(--text-primary);
}

.type-cell__sub {
  font-size: 12px;
  color: var(--text-secondary);
}

.name-cell {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.admin-invites-table :deep(.n-data-table-th) {
  background: rgba(241, 245, 249, 0.9);
  color: #334155;
  font-weight: 700;
  border-bottom: 1px solid rgba(148, 163, 184, 0.24);
}

.admin-invites-table :deep(.n-data-table-td) {
  border-bottom: 1px solid rgba(148, 163, 184, 0.16);
  padding-top: 8px;
  padding-bottom: 8px;
}

.admin-invites-table :deep(.n-data-table-tr:hover .n-data-table-td) {
  background: rgba(226, 232, 240, 0.28);
}

.admin-invites-table :deep(.n-data-table-td .n-button) {
  border-radius: 8px;
}

.status-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 32px;
  min-width: 88px;
  padding: 0 16px;
  border: 1px solid transparent;
  border-radius: 999px;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.4px;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.45),
    0 1px 2px rgba(15, 23, 42, 0.08);
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease;
}

.status-chip--active {
  background: linear-gradient(180deg, #ccefd8 0%, #b8e3c7 100%);
  color: #267a4a;
  border-color: #a7dbba;
}

.status-chip--used {
  background: linear-gradient(180deg, #f5d3e8 0%, #eec1df 100%);
  color: #8f3f78;
  border-color: #e5b0d2;
}

.status-chip--disabled {
  background: linear-gradient(180deg, #dfd3f5 0%, #cfbfea 100%);
  color: #5a4289;
  border-color: #c3b0e3;
}

.status-list {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 10px;
}

.status-list__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 12px;
  border: 1px solid var(--surface-glass-border);
  background: var(--surface-glass-strong);
  box-shadow: var(--shadow-light);
}

.status-list__meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-list__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.status-list__label {
  font-size: 12px;
  color: var(--text-secondary);
}

.status-list__count {
  font-size: 16px;
  line-height: 1;
  color: var(--text-primary);
  font-family: var(--font-family-mono);
  font-variant-numeric: tabular-nums;
}

.status-list__item--active .status-list__dot {
  background: #10b981;
}

.status-list__item--used .status-list__dot,
.status-list__item--disabled .status-list__dot {
  background: #ef4444;
}

.mobile-invite-list__content {
  display: grid;
  gap: 8px;
}

.mobile-invite-card {
  border-radius: 14px;
  border: 1px solid var(--surface-glass-border);
  background: var(--surface-glass-strong);
}

.mobile-invite-card__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.mobile-invite-card__code strong {
  display: block;
  margin-top: 6px;
  font-size: 18px;
  color: var(--text-primary);
  word-break: break-all;
}

.mobile-invite-card__meta {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-top: 10px;
}

.mobile-invite-card__actions {
  display: grid;
  gap: 8px;
  margin-top: 10px;
}

.info-block {
  padding: 10px;
  border-radius: 12px;
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

.info-block strong {
  display: block;
  margin-top: 4px;
  color: var(--text-primary);
  word-break: break-word;
}

.mobile-empty {
  padding: 16px 0;
}

[data-theme="dark"] .overview-card {
  background: rgba(15, 23, 42, 0.72);
  border-color: rgba(148, 163, 184, 0.22);
}

[data-theme="dark"] .desktop-table-card {
  background: rgba(15, 23, 42, 0.82);
  border-color: rgba(148, 163, 184, 0.24);
}

[data-theme="dark"] .desktop-table-card__header h3 {
  color: #e2e8f0;
}

[data-theme="dark"] .desktop-table-card__header span {
  color: #94a3b8;
}

[data-theme="dark"] .admin-invites-table :deep(.n-data-table-th) {
  background: rgba(30, 41, 59, 0.88);
  color: #cbd5e1;
  border-bottom-color: rgba(148, 163, 184, 0.2);
}

[data-theme="dark"] .admin-invites-table :deep(.n-data-table-td) {
  border-bottom-color: rgba(148, 163, 184, 0.15);
}

[data-theme="dark"]
  .admin-invites-table
  :deep(.n-data-table-tr:hover .n-data-table-td) {
  background: rgba(51, 65, 85, 0.35);
}

[data-theme="dark"] .status-list__item {
  background: rgba(15, 23, 42, 0.72);
  border-color: rgba(148, 163, 184, 0.22);
}

[data-theme="dark"] .status-list__label,
[data-theme="dark"] .status-list__count {
  color: #e2e8f0;
}

[data-theme="dark"] .overview-value,
[data-theme="dark"] .mobile-invite-card__code strong,
[data-theme="dark"] .info-block strong {
  color: #e2e8f0;
}

[data-theme="dark"] .info-block {
  background: rgba(15, 23, 42, 0.78);
}

@keyframes admin-invite-fade-in {
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
  .admin-invites-page {
    padding: 10px 0 16px;
  }

  .admin-invites-page.admin-surface-page .container,
  .admin-invites-page .container {
    padding: 0 10px;
  }

  .admin-invites-page.admin-surface-page .page-header,
  .admin-invites-page .page-header {
    grid-template-columns: minmax(0, 1fr);
    align-items: stretch;
    gap: 12px;
    margin-bottom: 10px;
    padding: 16px;
    border-radius: 22px;
  }

  .admin-invites-page .page-header__main {
    max-width: 100%;
  }

  .admin-invites-page .page-header__main h1 {
    font-size: 22px;
    line-height: 1.15;
    letter-spacing: 0;
    white-space: normal;
    word-break: keep-all;
    overflow-wrap: normal;
  }

  .admin-invites-page .page-header__main p {
    max-width: 100%;
    margin-top: 2px;
    font-size: 12px;
    line-height: 1.55;
  }

  .admin-invites-page .invite-creator-shell {
    width: 100%;
    min-width: 0;
    max-width: none;
    gap: 10px;
    padding: 12px;
    border-radius: 18px;
  }

  .admin-invites-page .invite-creator-shell__head {
    align-items: flex-start;
    flex-direction: column;
    gap: 2px;
  }

  .admin-invites-page .invite-creator {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: stretch;
    gap: 8px;
  }

  .admin-invites-page .invite-creator__field {
    min-width: 0;
    gap: 4px;
  }

  .admin-invites-page .invite-creator__label {
    font-size: 11px;
  }

  .admin-invites-page .invite-creator__button {
    grid-column: 1 / -1;
    width: 100%;
    min-height: 38px;
  }

  .admin-invites-page .page-overview {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
    margin-bottom: 10px;
  }

  .admin-invites-page .status-list {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
    margin-bottom: 10px;
  }

  .admin-invites-page .overview-card {
    min-height: 86px;
    padding: 12px;
    border-radius: 16px;
  }

  .admin-invites-page .status-list__item {
    align-items: flex-start;
    flex-direction: column;
    min-height: 50px;
    border-radius: 14px;
    padding: 8px 10px;
  }

  .admin-invites-page .status-list__label {
    font-size: 12px;
  }

  .admin-invites-page .status-list__count {
    font-size: 16px;
  }

  .admin-invites-page .overview-label {
    font-size: 12px;
  }

  .admin-invites-page .overview-value {
    margin-top: 4px;
    font-size: 22px;
  }

  .desktop-only {
    display: none;
  }

  .mobile-only {
    display: block;
  }

  .admin-invites-page .mobile-invite-list__content {
    gap: 8px;
  }

  .admin-invites-page .mobile-invite-card {
    border-radius: 12px;
  }

  .admin-invites-page .mobile-invite-card :deep(.n-card__content) {
    padding: 10px;
  }

  .admin-invites-page .mobile-invite-card__header {
    flex-direction: column;
    gap: 6px;
  }

  .admin-invites-page .mobile-invite-card__code strong {
    margin-top: 4px;
    font-size: 15px;
  }

  .admin-invites-page .mobile-invite-card__meta {
    margin-top: 10px;
    gap: 8px;
  }

  .admin-invites-page .mobile-invite-card__actions {
    margin-top: 10px;
    gap: 8px;
  }

  .admin-invites-page .info-block {
    padding: 8px 10px;
    border-radius: 10px;
  }

  .admin-invites-page .info-label {
    font-size: 11px;
  }

  .admin-invites-page .info-block strong {
    margin-top: 3px;
    font-size: 13px;
    line-height: 1.2;
  }

  @media (max-width: 420px) {
    .admin-invites-page .invite-creator,
    .admin-invites-page .page-overview,
    .admin-invites-page .status-list,
    .admin-invites-page .mobile-invite-card__meta {
      grid-template-columns: 1fr;
    }
  }

  .admin-invites-page .status-chip {
    min-height: 28px;
    min-width: 78px;
    padding: 0 12px;
    font-size: 13px;
  }

  .admin-invites-page .mobile-invite-card__actions :deep(.n-button),
  .admin-invites-page .invite-creator__button :deep(.n-button) {
    min-height: 34px;
    font-size: 13px;
  }
}

@media (max-width: 420px) {
  .admin-invites-page .container {
    padding: 0 8px;
  }

  .admin-invites-page .page-header__main h1 {
    font-size: 20px;
  }
}
</style>
