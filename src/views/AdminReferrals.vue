<template>
  <div v-if="canAccess" class="admin-referrals-page admin-surface-page">
    <div class="container admin-referrals-page__container">
      <div class="page-header">
        <div class="page-header__main">
          <h1>{{ t("adminReferralsPage.title") }}</h1>
          <p>{{ t("adminReferralsPage.subtitle") }}</p>
        </div>
        <div class="page-header__actions">
          <span class="page-header__eyebrow">Referral Ops</span>
          <NButton class="page-header__button" type="primary" :loading="loading" @click="refreshAll">
            {{ t("adminReferralsPage.actions.refresh") }}
          </NButton>
        </div>
      </div>

      <div class="page-overview">
        <div class="overview-card overview-card--attribution">
          <span class="overview-label">归因记录</span>
          <strong class="overview-value">{{ attributions.length }}</strong>
        </div>
        <div class="overview-card overview-card--conversion">
          <span class="overview-label">返佣记录</span>
          <strong class="overview-value">{{ conversions.length }}</strong>
        </div>
        <div class="overview-card overview-card--pending">
          <span class="overview-label">待结算</span>
          <strong class="overview-value">{{ pendingConversionCount }}</strong>
        </div>
        <div class="overview-card overview-card--paid">
          <span class="overview-label">已打款</span>
          <strong class="overview-value">{{ paidConversionCount }}</strong>
        </div>
      </div>

      <n-card embedded class="list-card">
        <div class="list-card__head">
          <h2>{{ t("adminReferralsPage.attributions.title") }}</h2>
          <span>{{ t("adminReferralsPage.attributions.count", { count: attributions.length }) }}</span>
        </div>
        <n-data-table
          class="referral-table desktop-table"
          :columns="attributionColumns"
          :data="attributions"
          :loading="loading"
          :pagination="{ pageSize: 8 }"
          :scroll-x="940"
        ></n-data-table>
        <div class="mobile-card-list">
          <div
            v-for="row in attributions"
            :key="row.id || `${row.referrerUsername}-${row.referredUsername}-${row.registeredAt}`"
            class="mobile-referral-card"
          >
            <div class="mobile-referral-card__head">
              <div>
                <span class="mobile-referral-card__label">{{ t("adminReferralsPage.columns.referrer") }}</span>
                <strong>{{ row.referrerUsername || "-" }}</strong>
              </div>
              <div>
                <span class="mobile-referral-card__label">{{ t("adminReferralsPage.columns.referred") }}</span>
                <strong>{{ row.referredUsername || "-" }}</strong>
              </div>
            </div>
            <div class="mobile-referral-card__grid">
              <div class="mobile-referral-card__meta">
                <span>{{ t("adminReferralsPage.columns.referralCode") }}</span>
                <strong>{{ row.referralCodeSnapshot || "-" }}</strong>
              </div>
              <div class="mobile-referral-card__meta">
                <span>{{ t("adminReferralsPage.columns.inviteCode") }}</span>
                <strong>{{ row.inviteCodeMask || "-" }}</strong>
              </div>
              <div class="mobile-referral-card__meta mobile-referral-card__meta--wide">
                <span>{{ t("adminReferralsPage.columns.registeredAt") }}</span>
                <strong>{{ formatTime(row.registeredAt) }}</strong>
              </div>
            </div>
          </div>
          <n-empty v-if="!loading && !attributions.length" description="暂无归因记录"></n-empty>
        </div>
      </n-card>

      <n-card embedded class="list-card">
        <div class="list-card__head">
          <h2>{{ t("adminReferralsPage.conversions.title") }}</h2>
          <span>{{ t("adminReferralsPage.conversions.count", { count: conversions.length }) }}</span>
        </div>
        <n-data-table
          class="referral-table desktop-table"
          :columns="conversionColumns"
          :data="conversions"
          :loading="loading"
          :pagination="{ pageSize: 10 }"
          :scroll-x="1680"
        ></n-data-table>
        <div class="mobile-card-list">
          <div
            v-for="row in conversions"
            :key="row.id"
            class="mobile-referral-card mobile-referral-card--conversion"
          >
            <div class="mobile-referral-card__topline">
              <div class="mobile-referral-card__route">
                <strong>{{ row.referrerUsername || "-" }}</strong>
                <span>→</span>
                <strong>{{ row.referredUsername || "-" }}</strong>
              </div>
              <NTag size="small" :type="rewardStatusTagType(row.rewardStatus)">
                {{ t(`referralCenter.rewardStatus.${row.rewardStatus}`) }}
              </NTag>
            </div>
            <div class="mobile-referral-card__grid">
              <div class="mobile-referral-card__meta">
                <span>{{ t("adminReferralsPage.columns.type") }}</span>
                <strong>{{ t(`referralCenter.conversionTypes.${row.conversionType}`) }}</strong>
              </div>
              <div class="mobile-referral-card__meta">
                <span>{{ t("adminReferralsPage.columns.gross") }}</span>
                <strong>{{ formatAmount(row.grossAmountCents) }}</strong>
              </div>
              <div class="mobile-referral-card__meta">
                <span>{{ t("adminReferralsPage.columns.reward") }}</span>
                <strong>{{ formatAmount(row.rewardAmountCents) }}</strong>
              </div>
              <div class="mobile-referral-card__meta">
                <span>{{ t("adminReferralsPage.columns.settlementChannel") }}</span>
                <strong>{{ row.settlementChannel ? settlementChannelLabel(row.settlementChannel) : "-" }}</strong>
              </div>
              <div class="mobile-referral-card__meta mobile-referral-card__meta--wide">
                <span>{{ t("adminReferralsPage.columns.settlementRef") }}</span>
                <strong>{{ row.settlementRef || "-" }}</strong>
              </div>
              <div class="mobile-referral-card__meta mobile-referral-card__meta--wide">
                <span>{{ t("adminReferralsPage.columns.settledAt") }}</span>
                <strong>{{ formatTime(row.settledAt) }}</strong>
              </div>
              <div class="mobile-referral-card__meta mobile-referral-card__meta--wide">
                <span>{{ t("adminReferralsPage.columns.note") }}</span>
                <strong>{{ row.note || "-" }}</strong>
              </div>
            </div>
            <div v-if="row.rewardStatus === 'pending'" class="mobile-referral-card__actions">
              <NButton tertiary size="small" type="primary" @click="markPaid(row)">
                {{ t("adminReferralsPage.actions.markPaid") }}
              </NButton>
              <NButton tertiary size="small" type="error" @click="rejectConversion(row)">
                {{ t("adminReferralsPage.actions.reject") }}
              </NButton>
            </div>
          </div>
          <n-empty v-if="!loading && !conversions.length" description="暂无返佣记录"></n-empty>
        </div>
      </n-card>
    </div>
  </div>
</template>

<script setup>
import { computed, h, onMounted, ref } from "vue";
import { NButton, NInput, NSelect, NTag, useDialog, useMessage } from "naive-ui/es";
import { useI18n } from "vue-i18n";
import { useAuthStore } from "@/stores/auth";
import api from "@/api";

const message = useMessage();
const dialog = useDialog();
const authStore = useAuthStore();
const { locale, t } = useI18n();

const loading = ref(false);
const attributions = ref([]);
const conversions = ref([]);
const sensitiveConfirmToken = ref("");
const sensitiveConfirmExpiresAt = ref(0);
const canAccess = computed(
  () => authStore.isAuthenticated && Boolean(authStore.user?.isAdmin),
);
const settlementChannelOptions = computed(() => ([
  { label: t("adminReferralsPage.channels.wechatManual"), value: "wechat_manual" },
  { label: t("adminReferralsPage.channels.bank"), value: "bank" },
  { label: t("adminReferralsPage.channels.other"), value: "other" },
]));
const pendingConversionCount = computed(() =>
  conversions.value.filter((row) => row.rewardStatus === "pending").length,
);
const paidConversionCount = computed(() =>
  conversions.value.filter((row) => row.rewardStatus === "paid").length,
);

const formatTime = (value) =>
  value ? new Date(value).toLocaleString(locale.value === "en" ? "en-US" : "zh-CN") : "-";

const formatAmount = (amountCents) => {
  const amount = Math.max(0, Number(amountCents) || 0) / 100;
  return new Intl.NumberFormat(locale.value === "en" ? "en-US" : "zh-CN", {
    style: "currency",
    currency: "CNY",
    minimumFractionDigits: 2,
  }).format(amount);
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

const promptSensitiveCredential = ({ actionLabel = "" } = {}) =>
  new Promise((resolve) => {
    const mfaEnabled = Boolean(authStore.user?.mfaEnabled);
    const password = ref("");
    const totpCode = ref("");
    let settled = false;

    const finish = (value) => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(value || null);
    };

    dialog.warning({
      title: t("adminReferralsPage.confirm.title"),
      positiveText: t("adminReferralsPage.confirm.confirm"),
      negativeText: t("adminReferralsPage.confirm.cancel"),
      content: () =>
        h("div", { style: "display:flex;flex-direction:column;gap:12px;" }, [
          h(
            "div",
            { style: "line-height:1.6;" },
            mfaEnabled
              ? t("adminReferralsPage.confirm.mfaPrompt", { action: actionLabel })
              : t("adminReferralsPage.confirm.passwordPrompt", { action: actionLabel }),
          ),
          h(NInput, {
            type: mfaEnabled ? "text" : "password",
            value: mfaEnabled ? totpCode.value : password.value,
            placeholder: mfaEnabled
              ? t("adminReferralsPage.confirm.totpPlaceholder")
              : t("adminReferralsPage.confirm.passwordPlaceholder"),
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
            message.warning(t("adminReferralsPage.messages.confirmTotpRequired"));
            return false;
          }
          finish({ totpCode: normalized });
          return true;
        }
        const normalized = String(password.value || "").trim();
        if (!normalized) {
          message.warning(t("adminReferralsPage.messages.confirmPasswordRequired"));
          return false;
        }
        finish({ password: normalized });
        return true;
      },
      onNegativeClick: () => finish(null),
      onClose: () => finish(null),
    });
  });

const ensureSensitiveActionConfirmed = async (actionLabel) => {
  const cached = getCachedSensitiveConfirmToken();
  if (cached) {
    return cached;
  }

  const credential = await promptSensitiveCredential({ actionLabel });
  if (!credential) {
    message.warning(t("adminReferralsPage.messages.confirmCancelled"));
    return "";
  }

  try {
    const res = await api.admin.confirmSensitiveAction(credential);
    if (!res?.success || !res?.data?.token) {
      message.error(res?.message || t("adminReferralsPage.messages.confirmFailed"));
      return "";
    }
    sensitiveConfirmToken.value = String(res.data.token || "");
    sensitiveConfirmExpiresAt.value = new Date(res.data.expiresAt || "").getTime();
    message.success(t("adminReferralsPage.messages.confirmPassed"));
    return sensitiveConfirmToken.value;
  } catch (error) {
    message.error(error?.message || t("adminReferralsPage.messages.confirmFailed"));
    return "";
  }
};

const refreshAll = async () => {
  loading.value = true;
  try {
    const [attrRes, convRes] = await Promise.all([
      api.admin.listReferralAttributions(),
      api.admin.listReferralConversions(),
    ]);
    attributions.value = Array.isArray(attrRes?.data) ? attrRes.data : [];
    conversions.value = Array.isArray(convRes?.data) ? convRes.data : [];
  } catch (error) {
    message.error(error?.message || t("adminReferralsPage.messages.loadFailed"));
  } finally {
    loading.value = false;
  }
};

const promptNote = ({ title, placeholder, required = false }) =>
  new Promise((resolve) => {
    const note = ref("");
    let settled = false;

    const finish = (value) => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(value);
    };

    dialog.info({
      title,
      positiveText: t("adminReferralsPage.confirm.confirm"),
      negativeText: t("adminReferralsPage.confirm.cancel"),
      content: () =>
        h(NInput, {
          type: "textarea",
          rows: 4,
          value: note.value,
          placeholder,
          onUpdateValue: (value) => {
            note.value = String(value || "");
          },
        }),
      onPositiveClick: () => {
        const normalized = String(note.value || "").trim();
        if (required && !normalized) {
          message.warning(t("adminReferralsPage.messages.rejectNoteRequired"));
          return false;
        }
        finish(normalized);
        return true;
      },
      onNegativeClick: () => finish(null),
      onClose: () => finish(null),
    });
  });

const settlementChannelLabel = (value) =>
  t(`adminReferralsPage.channelLabels.${String(value || "").trim() || "other"}`);
const isSettlementRefRequired = (channel) =>
  ["wechat_manual", "bank"].includes(String(channel || "").trim());

const promptMarkPaidPayload = () =>
  new Promise((resolve) => {
    const form = ref({
      channel: "wechat_manual",
      settlementRef: "",
      note: "",
    });
    let settled = false;

    const finish = (value) => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(value);
    };

    dialog.info({
      title: t("adminReferralsPage.actions.markPaid"),
      positiveText: t("adminReferralsPage.confirm.confirm"),
      negativeText: t("adminReferralsPage.confirm.cancel"),
      content: () =>
        h("div", { style: "display:flex;flex-direction:column;gap:12px;" }, [
          h("label", { style: "font-weight:600;" }, t("adminReferralsPage.fields.channel")),
          h(NSelect, {
            value: form.value.channel,
            options: settlementChannelOptions.value,
            onUpdateValue: (value) => {
              form.value.channel = String(value || "wechat_manual");
            },
          }),
          h("label", { style: "font-weight:600;" }, t("adminReferralsPage.fields.settlementRef")),
          h(NInput, {
            value: form.value.settlementRef,
            placeholder: t("adminReferralsPage.messages.settlementRefPlaceholder"),
            onUpdateValue: (value) => {
              form.value.settlementRef = String(value || "");
            },
          }),
          h("label", { style: "font-weight:600;" }, t("adminReferralsPage.fields.note")),
          h(NInput, {
            type: "textarea",
            rows: 4,
            value: form.value.note,
            placeholder: t("adminReferralsPage.messages.optionalNote"),
            onUpdateValue: (value) => {
              form.value.note = String(value || "");
            },
          }),
        ]),
      onPositiveClick: () => {
        const channel = String(form.value.channel || "").trim();
        if (!channel) {
          message.warning(t("adminReferralsPage.messages.channelRequired"));
          return false;
        }
        const settlementRef = String(form.value.settlementRef || "").trim();
        if (isSettlementRefRequired(channel) && !settlementRef) {
          message.warning(t("adminReferralsPage.messages.settlementRefRequired"));
          return false;
        }
        finish({
          channel,
          settlementRef,
          note: String(form.value.note || "").trim(),
        });
        return true;
      },
      onNegativeClick: () => finish(null),
      onClose: () => finish(null),
    });
  });

const markPaid = async (row) => {
  const confirmToken = await ensureSensitiveActionConfirmed(t("adminReferralsPage.actions.markPaid"));
  if (!confirmToken) {
    return;
  }
  const payload = await promptMarkPaidPayload();
  if (!payload) {
    return;
  }
  try {
    const res = await api.admin.markReferralConversionPaid(row.id, payload, confirmToken);
    if (!res?.success) {
      message.error(res?.message || t("adminReferralsPage.messages.markPaidFailed"));
      return;
    }
    message.success(t("adminReferralsPage.messages.markPaidSuccess"));
    await refreshAll();
  } catch (error) {
    clearSensitiveConfirmToken();
    message.error(error?.message || t("adminReferralsPage.messages.markPaidFailed"));
  }
};

const rejectConversion = async (row) => {
  const confirmToken = await ensureSensitiveActionConfirmed(t("adminReferralsPage.actions.reject"));
  if (!confirmToken) {
    return;
  }
  const note = await promptNote({
    title: t("adminReferralsPage.actions.reject"),
    placeholder: t("adminReferralsPage.messages.rejectNotePlaceholder"),
    required: true,
  });
  if (note === null) {
    return;
  }
  try {
    const res = await api.admin.rejectReferralConversion(row.id, { note }, confirmToken);
    if (!res?.success) {
      message.error(res?.message || t("adminReferralsPage.messages.rejectFailed"));
      return;
    }
    message.success(t("adminReferralsPage.messages.rejectSuccess"));
    await refreshAll();
  } catch (error) {
    clearSensitiveConfirmToken();
    message.error(error?.message || t("adminReferralsPage.messages.rejectFailed"));
  }
};

const attributionColumns = computed(() => [
  {
    title: t("adminReferralsPage.columns.referrer"),
    key: "referrerUsername",
    render: (row) => row.referrerUsername || "-",
  },
  {
    title: t("adminReferralsPage.columns.referred"),
    key: "referredUsername",
    render: (row) => row.referredUsername || "-",
  },
  {
    title: t("adminReferralsPage.columns.referralCode"),
    key: "referralCodeSnapshot",
  },
  {
    title: t("adminReferralsPage.columns.inviteCode"),
    key: "inviteCodeMask",
    render: (row) => row.inviteCodeMask || "-",
  },
  {
    title: t("adminReferralsPage.columns.registeredAt"),
    key: "registeredAt",
    render: (row) => formatTime(row.registeredAt),
  },
]);

const rewardStatusTagType = (status) => {
  switch (status) {
    case "paid":
      return "success";
    case "pending":
      return "warning";
    case "rejected":
      return "error";
    case "void":
      return "default";
    default:
      return "info";
  }
};

const conversionColumns = computed(() => [
  {
    title: t("adminReferralsPage.columns.referrer"),
    key: "referrerUsername",
    render: (row) => row.referrerUsername || "-",
  },
  {
    title: t("adminReferralsPage.columns.referred"),
    key: "referredUsername",
    render: (row) => row.referredUsername || "-",
  },
  {
    title: t("adminReferralsPage.columns.type"),
    key: "conversionType",
    render: (row) => t(`referralCenter.conversionTypes.${row.conversionType}`),
  },
  {
    title: t("adminReferralsPage.columns.gross"),
    key: "grossAmountCents",
    render: (row) => formatAmount(row.grossAmountCents),
  },
  {
    title: t("adminReferralsPage.columns.reward"),
    key: "rewardAmountCents",
    render: (row) => formatAmount(row.rewardAmountCents),
  },
  {
    title: t("adminReferralsPage.columns.status"),
    key: "rewardStatus",
    render: (row) =>
      h(NTag, { size: "small", type: rewardStatusTagType(row.rewardStatus) }, {
        default: () => t(`referralCenter.rewardStatus.${row.rewardStatus}`),
      }),
  },
  {
    title: t("adminReferralsPage.columns.settlementChannel"),
    key: "settlementChannel",
    render: (row) => row.settlementChannel ? settlementChannelLabel(row.settlementChannel) : "-",
  },
  {
    title: t("adminReferralsPage.columns.settlementRef"),
    key: "settlementRef",
    render: (row) => row.settlementRef || "-",
  },
  {
    title: t("adminReferralsPage.columns.settledAt"),
    key: "settledAt",
    render: (row) => formatTime(row.settledAt),
  },
  {
    title: t("adminReferralsPage.columns.note"),
    key: "note",
    render: (row) => row.note || "-",
  },
  {
    title: t("adminReferralsPage.columns.actions"),
    key: "actions",
    width: 220,
    render: (row) => {
      if (row.rewardStatus !== "pending") {
        return "-";
      }
      return h("div", { class: "table-actions" }, [
        h(
          NButton,
          {
            size: "small",
            tertiary: true,
            type: "primary",
            onClick: () => markPaid(row),
          },
          { default: () => t("adminReferralsPage.actions.markPaid") },
        ),
        h(
          NButton,
          {
            size: "small",
            tertiary: true,
            type: "error",
            onClick: () => rejectConversion(row),
          },
          { default: () => t("adminReferralsPage.actions.reject") },
        ),
      ]);
    },
  },
]);

onMounted(() => {
  refreshAll();
});
</script>

<style scoped lang="scss">
.admin-referrals-page {
  --referral-surface: rgba(255, 255, 255, 0.78);
  --referral-surface-strong: rgba(255, 255, 255, 0.92);
  --referral-border: rgba(37, 99, 235, 0.13);
  --referral-shadow: 0 18px 42px rgba(30, 64, 175, 0.1);
  --referral-shadow-soft: 0 10px 26px rgba(30, 64, 175, 0.08);
  --referral-blue-soft: rgba(219, 234, 254, 0.72);
  --referral-green-soft: rgba(220, 252, 231, 0.72);
  --referral-amber-soft: rgba(255, 247, 237, 0.82);
  --referral-rose-soft: rgba(255, 228, 230, 0.72);
  min-height: 100dvh;
  padding: 16px 0;
  animation: referral-page-fade-in 0.36s ease;
}

.admin-referrals-page.admin-surface-page .admin-referrals-page__container,
.admin-referrals-page__container {
  display: grid;
  gap: 18px;
  max-width: 1320px;
  margin: 0 auto;
  padding: 0 16px;
}

.admin-referrals-page.admin-surface-page .page-header,
.page-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(180px, auto);
  align-items: stretch;
  gap: 18px;
  padding: clamp(20px, 2vw, 28px);
  border: 1px solid var(--referral-border);
  border-radius: 28px;
  background:
    radial-gradient(circle at 12% 0%, rgba(37, 99, 235, 0.14), transparent 34%),
    linear-gradient(180deg, rgba(239, 246, 255, 0.9), rgba(226, 238, 255, 0.64)),
    rgba(248, 251, 255, 0.8);
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.84) inset,
    var(--referral-shadow);
  backdrop-filter: blur(14px);
}

.page-header__main {
  display: grid;
  align-content: start;
  gap: 10px;
  min-width: 0;
}

.page-header h1,
.list-card h2 {
  margin: 0;
  color: var(--text-primary);
}

.page-header h1 {
  font-size: clamp(28px, 3vw, 38px);
  line-height: 1;
  letter-spacing: 0;
}

.page-header p {
  max-width: 64ch;
  margin: 0;
  color: var(--text-secondary);
  line-height: 1.7;
}

.page-header__actions {
  display: grid;
  align-content: start;
  justify-items: end;
  gap: 10px;
  min-width: 0;
}

.page-header__eyebrow {
  color: var(--primary-color);
  font-family: var(--font-family-mono);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
}

.page-header__button {
  min-height: 42px;
  min-width: 132px;
  border-radius: 14px;
  box-shadow: 0 10px 22px rgba(37, 99, 235, 0.24);
}

.page-overview {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}

.overview-card {
  position: relative;
  min-height: 112px;
  overflow: hidden;
  padding: 16px 18px;
  border: 1px solid var(--referral-border);
  border-radius: 20px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.78), rgba(239, 246, 255, 0.54)),
    var(--referral-surface);
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.78) inset,
    var(--referral-shadow-soft);
}

.overview-card::after {
  content: "";
  position: absolute;
  inset: 0 auto 0 0;
  width: 4px;
  background: linear-gradient(180deg, var(--primary-color), rgba(20, 184, 166, 0.72));
}

.overview-card--conversion {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.76), rgba(219, 234, 254, 0.56)),
    var(--referral-blue-soft);
}

.overview-card--pending {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.76), rgba(255, 247, 237, 0.58)),
    var(--referral-amber-soft);
}

.overview-card--paid {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.76), rgba(220, 252, 231, 0.56)),
    var(--referral-green-soft);
}

.overview-label,
.list-card__head span,
.mobile-referral-card__label,
.mobile-referral-card__meta span {
  color: var(--text-secondary);
  font-weight: 700;
}

.overview-value {
  display: block;
  margin-top: 8px;
  color: var(--text-primary);
  font-family: var(--font-family-mono);
  font-size: clamp(24px, 2.5vw, 34px);
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.admin-referrals-page.admin-surface-page .list-card,
.list-card {
  display: grid;
  gap: 16px;
  overflow: hidden;
  border: 1px solid var(--referral-border);
  border-radius: 24px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.78), rgba(248, 251, 255, 0.74)),
    var(--referral-surface-strong);
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.78) inset,
    var(--referral-shadow);
}

.list-card :deep(.n-card__content) {
  display: grid;
  gap: 16px;
  padding: 18px;
}

.list-card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 14px;
  border-bottom: 1px solid rgba(37, 99, 235, 0.12);
}

.list-card h2 {
  font-size: 18px;
  font-weight: 800;
}

.referral-table :deep(.n-data-table-wrapper) {
  border: 1px solid rgba(37, 99, 235, 0.1);
  border-radius: 18px;
  overflow: hidden;
}

.referral-table :deep(.n-data-table-th) {
  background: linear-gradient(180deg, rgba(239, 246, 255, 0.96), rgba(226, 238, 255, 0.84));
  color: #1e293b;
  font-weight: 800;
  white-space: normal;
}

.referral-table :deep(.n-data-table-td) {
  background: rgba(255, 255, 255, 0.68);
  vertical-align: middle;
  white-space: normal;
}

.referral-table :deep(.n-data-table-tr:hover .n-data-table-td) {
  background: rgba(226, 232, 240, 0.28);
}

.table-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.table-actions :deep(.n-button) {
  min-height: 32px;
  border-radius: 10px;
}

.mobile-card-list {
  display: none;
}

.mobile-referral-card {
  display: grid;
  gap: 12px;
  padding: 14px;
  border: 1px solid var(--referral-border);
  border-radius: 18px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.78), rgba(239, 246, 255, 0.52)),
    var(--referral-surface);
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.78) inset,
    0 12px 28px rgba(30, 64, 175, 0.08);
}

.mobile-referral-card__head,
.mobile-referral-card__topline {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.mobile-referral-card__head > div {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.mobile-referral-card__route {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: 6px;
  color: var(--text-primary);
  overflow-wrap: anywhere;
}

.mobile-referral-card__label,
.mobile-referral-card__meta span {
  font-size: 11px;
}

.mobile-referral-card strong {
  min-width: 0;
  color: var(--text-primary);
  overflow-wrap: anywhere;
}

.mobile-referral-card__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.mobile-referral-card__meta {
  display: grid;
  gap: 4px;
  min-height: 58px;
  padding: 10px;
  border: 1px solid rgba(37, 99, 235, 0.1);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.62);
  font-size: 12px;
}

.mobile-referral-card__meta--wide {
  grid-column: 1 / -1;
}

.mobile-referral-card__actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.mobile-referral-card__actions :deep(.n-button) {
  min-height: 36px;
  border-radius: 10px;
}

:global([data-theme="dark"]) .admin-referrals-page {
  --referral-surface: rgba(15, 23, 42, 0.78);
  --referral-surface-strong: rgba(15, 23, 42, 0.9);
  --referral-border: rgba(96, 165, 250, 0.2);
  --referral-shadow: 0 18px 42px rgba(0, 0, 0, 0.28);
  --referral-shadow-soft: 0 10px 26px rgba(0, 0, 0, 0.2);
}

:global([data-theme="dark"]) .admin-referrals-page.admin-surface-page .page-header,
:global([data-theme="dark"]) .admin-referrals-page .overview-card,
:global([data-theme="dark"]) .admin-referrals-page .list-card,
:global([data-theme="dark"]) .admin-referrals-page .mobile-referral-card {
  background:
    linear-gradient(180deg, rgba(30, 41, 59, 0.72), rgba(15, 23, 42, 0.84)),
    var(--referral-surface);
}

:global([data-theme="dark"]) .admin-referrals-page .referral-table :deep(.n-data-table-th) {
  background: linear-gradient(180deg, rgba(30, 41, 59, 0.95), rgba(15, 23, 42, 0.9));
  color: #e2e8f0;
}

:global([data-theme="dark"]) .admin-referrals-page .referral-table :deep(.n-data-table-td) {
  background: rgba(15, 23, 42, 0.58);
}

:global([data-theme="dark"]) .admin-referrals-page .mobile-referral-card__meta {
  background: rgba(15, 23, 42, 0.58);
  border-color: rgba(96, 165, 250, 0.16);
}

@keyframes referral-page-fade-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .admin-referrals-page {
    animation: none;
  }
}

@media (max-width: 900px) {
  .page-overview {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 768px) {
  .admin-referrals-page {
    padding: 10px 0 16px;
  }

  .admin-referrals-page.admin-surface-page .admin-referrals-page__container,
  .admin-referrals-page__container {
    padding: 0 10px;
  }

  .admin-referrals-page.admin-surface-page .page-header,
  .page-header {
    grid-template-columns: minmax(0, 1fr);
    gap: 12px;
    padding: 16px;
    border-radius: 22px;
  }

  .page-header h1 {
    font-size: 22px;
    line-height: 1.15;
  }

  .page-header p {
    max-width: 100%;
    font-size: 12px;
    line-height: 1.55;
  }

  .page-header__actions {
    justify-items: stretch;
  }

  .page-header__button {
    width: 100%;
    min-height: 38px;
  }

  .overview-card {
    min-height: 90px;
    padding: 12px;
    border-radius: 16px;
  }

  .overview-value {
    margin-top: 6px;
    font-size: 22px;
  }

  .list-card {
    border-radius: 18px;
  }

  .list-card :deep(.n-card__content) {
    padding: 12px;
  }

  .list-card__head {
    flex-direction: column;
    gap: 4px;
    padding-bottom: 10px;
  }

  .desktop-table {
    display: none;
  }

  .mobile-card-list {
    display: grid;
    gap: 10px;
  }
}

@media (max-width: 420px) {
  .admin-referrals-page.admin-surface-page .admin-referrals-page__container,
  .admin-referrals-page__container {
    padding: 0 8px;
  }

  .page-overview,
  .mobile-referral-card__grid,
  .mobile-referral-card__actions,
  .mobile-referral-card__head,
  .mobile-referral-card__topline {
    grid-template-columns: 1fr;
  }

  .page-overview,
  .mobile-referral-card__head,
  .mobile-referral-card__topline {
    display: grid;
  }

  .page-header h1 {
    font-size: 20px;
  }
}
</style>
