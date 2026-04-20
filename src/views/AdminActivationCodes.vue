<template>
  <div v-if="canAccess" class="admin-activation-codes-page admin-surface-page">
    <div class="container">
      <div class="page-header">
        <div class="page-header__main">
          <h1>激活码管理</h1>
          <p>为 token 生成一次性激活码，管理绑定账号与有效期。</p>
        </div>

        <div class="activation-creator-shell">
          <div class="activation-creator-shell__head">
            <span class="activation-creator-shell__eyebrow">激活码控制台</span>
            <strong>生成激活码</strong>
          </div>

          <div class="activation-creator">
            <div class="activation-creator__field">
              <span class="activation-creator__label">生成数量</span>
              <n-input-number
                v-model:value="createCount"
                :max="100"
                :min="1"
              ></n-input-number>
            </div>
            <div class="activation-creator__field">
              <span class="activation-creator__label">有效时长</span>
              <n-select
                v-model:value="durationMonths"
                :options="durationOptions"
              ></n-select>
            </div>
            <div class="activation-creator__field">
              <span class="activation-creator__label">版本类型</span>
              <n-select
                v-model:value="featureScope"
                :options="featureScopeOptions"
              ></n-select>
            </div>
            <div class="activation-creator__field activation-creator__field--price">
              <span class="activation-creator__label">售价（元）</span>
              <n-input-number
                v-model:value="saleAmountYuan"
                :disabled="isOneDayDuration"
                :min="0"
                :precision="2"
                :step="1"
              ></n-input-number>
              <span class="activation-creator__hint">{{ saleAmountHint }}</span>
            </div>
            <div class="activation-creator__actions">
              <NButton
                class="activation-creator__button activation-creator__button--primary"
                type="primary"
                :loading="creating"
                @click="createCodes"
              >
                生成激活码
              </NButton>
              <NButton
                class="activation-creator__button activation-creator__button--warning"
                type="warning"
                :loading="loading"
                @click="unbindAllCodes"
              >
                清空全部绑定
              </NButton>
            </div>
          </div>
        </div>
      </div>

      <div class="page-overview">
        <div class="overview-card overview-card--total">
          <span class="overview-label">激活码总数</span>
          <strong class="overview-value">{{ codes.length }}</strong>
        </div>
        <div class="overview-card overview-card--available">
          <span class="overview-label">当前可用</span>
          <strong class="overview-value">{{ availableCount }}</strong>
        </div>
        <div class="overview-card overview-card--used">
          <span class="overview-label">已使用</span>
          <strong class="overview-value">{{ usedCount }}</strong>
        </div>
        <div class="overview-card overview-card--bound">
          <span class="overview-label">存在绑定</span>
          <strong class="overview-value">{{ boundCount }}</strong>
        </div>
      </div>

      <n-card v-if="!isMobile" embedded class="desktop-table-card">
        <div class="desktop-table-card__header">
          <h3>激活码列表</h3>
          <span>当前共 {{ codes.length }} 条</span>
        </div>
        <n-data-table
          class="activation-codes-table"
          :columns="columns"
          :data="codes"
          :loading="loading"
          :pagination="{ pageSize: 12 }"
          :scroll-x="1120"
        ></n-data-table>
      </n-card>

      <div v-else class="mobile-list">
        <n-card
          v-for="row in codes"
          :key="row.id"
          embedded
          class="mobile-code-card"
          size="small"
        >
          <div class="mobile-code-top">
            <div class="mobile-code-value">{{ row.code }}</div>
            <NTag class="mobile-code-status" size="small" :type="statusTag(row).type">
              {{ statusTag(row).text }}
            </NTag>
          </div>
          <div class="mobile-meta-grid">
            <div class="meta-row">
              <span class="meta-label">版本类型</span>
              <span>{{ getFeatureScopeLabel(row.featureScope) }}</span>
            </div>
            <div class="meta-row">
              <span class="meta-label">时长</span>
              <span>{{ formatDurationLabel(row.durationMonths) }}</span>
            </div>
            <div class="meta-row">
              <span class="meta-label">售价</span>
              <span>{{ formatSale(row.saleAmountCents, row.saleCurrency) }}</span>
            </div>
            <div class="meta-row meta-row--wide">
              <span class="meta-label">绑定信息</span>
              <span>{{ row.bindingRoleName || "-" }}</span>
            </div>
            <div class="meta-row meta-row--wide">
              <span class="meta-label">到期时间</span>
              <span>{{ formatTime(row.bindingExpiresAt) }}</span>
            </div>
          </div>
          <div class="mobile-actions">
            <NButton
              v-if="canUnbind(row)"
              tertiary
              size="small"
              type="warning"
              @click="unbindCode(row)"
            >
              解绑
            </NButton>
            <NButton tertiary size="small" type="error" @click="deleteCode(row)">删除</NButton>
            <NButton
              v-if="row.isActive && !row.usedAt"
              tertiary
              size="small"
              type="warning"
              @click="disableCode(row)"
            >
              禁用
            </NButton>
          </div>
        </n-card>
        <n-empty
          v-if="!loading && !codes.length"
          description="暂无激活码"
        ></n-empty>
      </div>

      <n-modal
        class="created-codes-modal"
        preset="card"
        title="一次性激活码"
        :mask-closable="false"
        :show="showCreatedCodesModal"
        @update:show="handleCreatedCodesModalUpdate"
      >
        <div class="created-codes-modal__body">
          <p class="created-codes-modal__hint">
            完整激活码只会在创建当次显示一次，关闭后列表里只保留打码值。
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
              复制
            </NButton>
            <NButton type="primary" @click="closeCreatedCodesModal">
              我已保存
            </NButton>
          </div>
        </template>
      </n-modal>
    </div>
  </div>
</template>

<script setup>
import { computed, h, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { NButton, NInput, NTag, useDialog, useMessage } from "naive-ui/es";
import { useRouter } from "vue-router";
import api from "@/api";
import { useAuthStore } from "@/stores/auth";

const router = useRouter();
const message = useMessage();
const dialog = useDialog();
const authStore = useAuthStore();

const canAccess = computed(() => authStore.isAuthenticated && authStore.user?.isAdmin);
const loading = ref(false);
const creating = ref(false);
const createCount = ref(1);
const durationMonths = ref(1);
const featureScope = ref("full");
const saleAmountYuan = ref(0);
const codes = ref([]);
const isMobile = ref(false);
const MOBILE_BREAKPOINT = 768;
const sensitiveConfirmToken = ref("");
const sensitiveConfirmExpiresAt = ref(0);
const showCreatedCodesModal = ref(false);
const createdCodesPlaintext = ref([]);
const ONE_DAY_DURATION_MONTHS = 0;

const durationOptions = [
  { label: "1天", value: ONE_DAY_DURATION_MONTHS },
  { label: "1个月", value: 1 },
  { label: "1季度", value: 3 },
  { label: "半年", value: 6 },
  { label: "一年", value: 12 },
];
const ACTIVATION_SALE_PRICE_PRESETS = Object.freeze({
  task_control_only: Object.freeze({
    0: 0,
    1: 6,
    3: 16,
    6: 30,
    12: 58,
  }),
  full: Object.freeze({
    0: 0,
    1: 30,
    3: 85,
    6: 165,
    12: 300,
  }),
});
const featureScopeOptions = [
  { label: "全功能", value: "full" },
  { label: "普通版本", value: "task_control_only" },
];

const getFeatureScopeLabel = (value) =>
  String(value || "").trim() === "task_control_only" ? "普通版本" : "全功能";

const normalizeDurationValue = (value) =>
  Number(value) === ONE_DAY_DURATION_MONTHS ? ONE_DAY_DURATION_MONTHS : Number(value) || 1;

const formatDurationLabel = (value) => {
  const normalized = normalizeDurationValue(value);
  if (normalized === ONE_DAY_DURATION_MONTHS) {
    return "1天";
  }
  return `${Math.max(1, normalized)}个月`;
};

const formatYuan = (value) => {
  const amount = Number(value) || 0;
  if (Number.isInteger(amount)) {
    return `¥${amount}`;
  }
  return `¥${amount.toFixed(2)}`;
};

const getPresetSaleAmountYuan = (scope, months) => {
  const scopeKey = String(scope || "").trim() === "task_control_only" ? "task_control_only" : "full";
  const monthKey = normalizeDurationValue(months);
  return Number(ACTIVATION_SALE_PRICE_PRESETS[scopeKey]?.[monthKey] || 0);
};

const isOneDayDuration = computed(() => normalizeDurationValue(durationMonths.value) === ONE_DAY_DURATION_MONTHS);
const availableCount = computed(() => codes.value.filter((row) => row.isActive && !row.usedAt).length);
const usedCount = computed(() => codes.value.filter((row) => Boolean(row.usedAt)).length);
const boundCount = computed(() => codes.value.filter((row) => canUnbind(row)).length);
const presetPriceSummary = computed(() =>
  durationOptions
    .map((option) => `${formatDurationLabel(option.value)} ${formatYuan(getPresetSaleAmountYuan(featureScope.value, option.value))}`)
    .join(" / "));
const saleAmountHint = computed(() =>
  isOneDayDuration.value
    ? "1天激活码固定 ¥0"
    : `${getFeatureScopeLabel(featureScope.value)}：${presetPriceSummary.value}`);

const formatTime = (value) => {
  if (!value) return "-";
  return new Date(value).toLocaleString();
};

const formatSale = (amountCents, currency = "CNY") => {
  const amount = Math.max(0, Number(amountCents) || 0) / 100;
  return `¥${amount.toFixed(2)} ${String(currency || "CNY").trim() || "CNY"}`;
};

const statusTag = (row) => {
  if (row.usedAt) {
    return { type: "success", text: "已使用" };
  }
  if (!row.isActive) {
    return { type: "warning", text: "已禁用" };
  }
  return { type: "info", text: "可用" };
};

const canUnbind = (row) =>
  Boolean(
    row?.bindingId
    || row?.bindingTokenId
    || row?.bindingRoleId
    || row?.usedAt,
  );

const formatBindingAccount = (row) => {
  const roleName = String(row?.bindingRoleName || "").trim();
  const region = String(row?.bindingRegion || "").trim();
  const roleId = String(row?.bindingRoleId || row?.boundGameAccountId || "").trim();
  const sessId = String(row?.bindingSessId || row?.bindingSessionId || "").trim();
  if (!roleName && !region && !roleId) return "-";
  return [
    sessId || "无SessID",
    roleId || "-",
    region || "未知大区",
    roleName || "未命名角色",
  ].join(" / ");
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
      title: "安全确认",
      positiveText: "确认",
      negativeText: "取消",
      content: () =>
        h("div", { style: "display:flex;flex-direction:column;gap:12px;" }, [
          h(
            "div",
            { style: "line-height:1.6;" },
            mfaEnabled
              ? `执行“${actionLabel}”前，请输入认证器当前显示的 6 位动态验证码完成二次验证`
              : `执行“${actionLabel}”前，请输入当前管理员密码完成二次验证`,
          ),
          h(NInput, {
            type: mfaEnabled ? "text" : "password",
            showPasswordOn: mfaEnabled ? undefined : "click",
            value: mfaEnabled ? totpCode.value : password.value,
            maxlength: mfaEnabled ? 6 : undefined,
            placeholder: mfaEnabled ? "输入 6 位动态验证码" : "输入当前管理员密码",
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
            message.warning("请输入 6 位动态验证码");
            return false;
          }
          finish({ totpCode: normalized });
          return true;
        }
        const normalized = String(password.value || "").trim();
        if (!normalized) {
          message.warning("请输入当前管理员密码");
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
    message.warning("已取消二次验证");
    return "";
  }
  try {
    const res = await api.admin.confirmSensitiveAction(credential);
    if (!res?.success || !res?.data?.token) {
      message.error(res?.message || "二次验证失败");
      return "";
    }
    const expiresTs = new Date(res.data.expiresAt || "").getTime();
    sensitiveConfirmToken.value = String(res.data.token || "");
    sensitiveConfirmExpiresAt.value = Number.isFinite(expiresTs)
      ? expiresTs
      : Date.now() + 5 * 60 * 1000;
    message.success("二次验证通过（5分钟内有效）");
    return sensitiveConfirmToken.value;
  } catch (error) {
    message.error(error.message || "二次验证失败");
    return "";
  }
};

const disableCode = async (row) => {
  try {
    const confirmToken = await ensureSensitiveActionConfirmed("禁用激活码");
    if (!confirmToken) return;
    const res = await api.admin.disableActivationCode(row.id, confirmToken);
    if (!res?.success) {
      message.error(res?.message || "禁用失败");
      return;
    }
    message.success(res.message || "已禁用");
    await loadCodes();
  } catch (error) {
    if (Number(error?.status || 0) === 401 || Number(error?.status || 0) === 403) {
      clearSensitiveConfirmToken();
    }
    message.error(error.message || "禁用失败");
  }
};

const deleteCode = async (row) => {
  const ok = window.confirm(`确认删除激活码 ${row.code} 吗？`);
  if (!ok) return;
  try {
    const confirmToken = await ensureSensitiveActionConfirmed("删除激活码");
    if (!confirmToken) return;
    const res = await api.admin.deleteActivationCode(row.id, confirmToken);
    if (!res?.success) {
      message.error(res?.message || "删除失败");
      return;
    }
    message.success(res.message || "已删除");
    await loadCodes();
  } catch (error) {
    if (Number(error?.status || 0) === 401 || Number(error?.status || 0) === 403) {
      clearSensitiveConfirmToken();
    }
    message.error(error.message || "删除失败");
  }
};

const unbindCode = async (row) => {
  const ok = window.confirm(`确认解绑激活码 ${row.code} 的账号绑定吗？`);
  if (!ok) return;
  try {
    const confirmToken = await ensureSensitiveActionConfirmed("解绑激活码绑定");
    if (!confirmToken) return;
    const res = await api.admin.unbindActivationCode(row.id, confirmToken);
    if (!res?.success) {
      message.error(res?.message || "解绑失败");
      return;
    }
    message.success(res.message || "已解绑");
    if (Number(res?.data?.voidedConversions || 0) > 0) {
      message.info("相关返佣台账已同步作废");
    }
    await loadCodes();
  } catch (error) {
    if (Number(error?.status || 0) === 401 || Number(error?.status || 0) === 403) {
      clearSensitiveConfirmToken();
    }
    message.error(error.message || "解绑失败");
  }
};

const unbindAllCodes = async () => {
  const ok = window.confirm("确认清空全部账号的激活码绑定吗？该操作会重置所有已绑定状态。");
  if (!ok) return;
  try {
    const confirmToken = await ensureSensitiveActionConfirmed("清空全部激活码绑定");
    if (!confirmToken) return;
    const res = await api.admin.unbindAllActivationCodes(confirmToken);
    if (!res?.success) {
      message.error(res?.message || "清空失败");
      return;
    }
    const deletedBindings = Number(res?.data?.deletedBindings || 0);
    const resetCodes = Number(res?.data?.resetCodes || 0);
    const voidedConversions = Number(res?.data?.voidedConversions || 0);
    message.success(`已清空绑定：解绑记录 ${deletedBindings} 条，重置激活码 ${resetCodes} 条，作废返佣 ${voidedConversions} 条`);
    await loadCodes();
  } catch (error) {
    if (Number(error?.status || 0) === 401 || Number(error?.status || 0) === 403) {
      clearSensitiveConfirmToken();
    }
    message.error(error.message || "清空失败");
  }
};

const columns = computed(() => [
  {
    title: "激活码",
    key: "code",
    width: 220,
    render: (row) =>
      h("span", { class: "table-code-cell", title: row.code }, row.code),
  },
  {
    title: "状态",
    key: "status",
    width: 130,
    render: (row) => {
      const tag = statusTag(row);
      return h("div", { class: "table-stack-cell" }, [
        h(NTag, { size: "small", type: tag.type }, { default: () => tag.text }),
        h(
          "span",
          { class: "table-subtext-cell" },
          `${getFeatureScopeLabel(row.featureScope)} · ${formatDurationLabel(row.durationMonths)} · ${formatSale(row.saleAmountCents, row.saleCurrency)}`,
        ),
      ]);
    },
  },
  {
    title: "绑定信息",
    key: "bindingInfo",
    minWidth: 220,
    render: (row) => {
      const value = String(row.bindingRoleName || "").trim() || "-";
      return h("span", { class: "table-text-cell", title: value }, value);
    },
  },
  {
    title: "到期时间",
    key: "timeInfo",
    width: 180,
    render: (row) => {
      const expiresAt = formatTime(row.bindingExpiresAt);
      return h("span", { class: "table-text-cell", title: expiresAt }, expiresAt);
    },
  },
  {
    title: "操作",
    key: "actions",
    width: 220,
    render: (row) => {
      const buttons = [
        h(
          NButton,
          {
            size: "small",
            tertiary: true,
            type: "error",
            onClick: () => deleteCode(row),
          },
          { default: () => "删除" },
        ),
      ];
      if (canUnbind(row)) {
        buttons.push(
          h(
            NButton,
            {
              size: "small",
              tertiary: true,
              type: "warning",
              onClick: () => unbindCode(row),
            },
            { default: () => "解绑" },
          ),
        );
      }
      if (row.isActive && !row.usedAt) {
        buttons.push(
          h(
            NButton,
            {
              size: "small",
              tertiary: true,
              type: "warning",
              onClick: () => disableCode(row),
            },
            { default: () => "禁用" },
          ),
        );
      }
      return h("div", { class: "table-actions-cell" }, buttons);
    },
  },
]);

const updateMobileState = () => {
  isMobile.value = window.innerWidth < MOBILE_BREAKPOINT;
};

const loadCodes = async () => {
  if (!canAccess.value) {
    router.replace("/admin/dashboard");
    return;
  }
  loading.value = true;
  try {
    const res = await api.admin.listActivationCodes();
    if (!res?.success) {
      message.error(res?.message || "加载失败");
      return;
    }
    codes.value = Array.isArray(res.data) ? res.data : [];
  } catch (error) {
    message.error(error.message || "加载失败");
  } finally {
    loading.value = false;
  }
};

const createCodes = async () => {
  creating.value = true;
  try {
    const confirmToken = await ensureSensitiveActionConfirmed("生成激活码");
    if (!confirmToken) return;
    const res = await api.admin.createActivationCodes({
      count: Math.max(1, Math.min(100, Number(createCount.value) || 1)),
      featureScope: featureScope.value,
      durationMonths: normalizeDurationValue(durationMonths.value),
      saleAmountCents: isOneDayDuration.value
        ? 0
        : Math.max(0, Math.round((Number(saleAmountYuan.value) || 0) * 100)),
    }, confirmToken);
    if (!res?.success) {
      message.error(res?.message || "生成失败");
      return;
    }
    createdCodesPlaintext.value = (res.data || [])
      .map((item) => String(item?.code || "").trim())
      .filter(Boolean);
    showCreatedCodesModal.value = createdCodesPlaintext.value.length > 0;
    message.success(res.message || "生成成功");
    await loadCodes();
  } catch (error) {
    if (Number(error?.status || 0) === 401 || Number(error?.status || 0) === 403) {
      clearSensitiveConfirmToken();
    }
    message.error(error.message || "生成失败");
  } finally {
    creating.value = false;
  }
};

const copyCreatedCodes = async () => {
  const list = createdCodesPlaintext.value.join("\n");
  if (!list) {
    message.warning("暂无可复制的激活码");
    return;
  }
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(list);
      message.success("激活码已复制");
      return;
    }
  } catch {}

  try {
    const textarea = document.createElement("textarea");
    textarea.value = list;
    textarea.setAttribute("readonly", "readonly");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    document.body.removeChild(textarea);
    if (copied) {
      message.success("激活码已复制");
      return;
    }
  } catch {}

  message.error("复制失败，请手动复制");
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

watch(
  [featureScope, durationMonths],
  ([nextFeatureScope, nextDurationMonths]) => {
    saleAmountYuan.value = getPresetSaleAmountYuan(nextFeatureScope, nextDurationMonths);
  },
  { immediate: true },
);

onMounted(() => {
  updateMobileState();
  window.addEventListener("resize", updateMobileState);
  loadCodes();
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", updateMobileState);
});
</script>

<style scoped>
.admin-activation-codes-page {
  --activation-surface: rgba(255, 255, 255, 0.78);
  --activation-surface-strong: rgba(255, 255, 255, 0.92);
  --activation-border: rgba(37, 99, 235, 0.13);
  --activation-border-strong: rgba(37, 99, 235, 0.22);
  --activation-shadow: 0 18px 42px rgba(30, 64, 175, 0.1);
  --activation-shadow-soft: 0 10px 26px rgba(30, 64, 175, 0.08);
  --activation-blue-soft: rgba(219, 234, 254, 0.72);
  --activation-green-soft: rgba(220, 252, 231, 0.72);
  --activation-amber-soft: rgba(255, 247, 237, 0.82);
  --activation-rose-soft: rgba(255, 228, 230, 0.72);
  min-height: 100dvh;
  padding: 16px 0;
  animation: activation-page-fade-in 0.36s ease;
}

.admin-activation-codes-page.admin-surface-page .container,
.admin-activation-codes-page .container {
  display: grid;
  gap: 18px;
  max-width: 1320px;
  margin: 0 auto;
  padding: 0 16px;
}

.admin-activation-codes-page.admin-surface-page .page-header,
.admin-activation-codes-page .page-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(380px, 560px);
  align-items: stretch;
  gap: 18px;
  padding: clamp(20px, 2vw, 28px);
  border: 1px solid var(--activation-border);
  border-radius: 28px;
  background:
    radial-gradient(circle at 12% 0%, rgba(37, 99, 235, 0.14), transparent 34%),
    linear-gradient(180deg, rgba(239, 246, 255, 0.9), rgba(226, 238, 255, 0.64)),
    rgba(248, 251, 255, 0.8);
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.84) inset,
    var(--activation-shadow);
  backdrop-filter: blur(14px);
}

.admin-activation-codes-page .page-header__main {
  display: grid;
  align-content: start;
  gap: 10px;
  min-width: 0;
}

.admin-activation-codes-page .page-header__main h1 {
  margin: 0;
  color: var(--text-primary);
  font-size: clamp(28px, 3vw, 38px);
  line-height: 1;
  letter-spacing: 0;
}

.admin-activation-codes-page .page-header__main p {
  max-width: 62ch;
  margin: 0;
  color: var(--text-secondary);
  line-height: 1.7;
}

.activation-creator-shell {
  display: grid;
  align-self: start;
  gap: 12px;
  min-width: 0;
  padding: 14px;
  border: 1px solid rgba(37, 99, 235, 0.12);
  border-radius: 22px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.76), rgba(219, 234, 254, 0.44)),
    rgba(255, 255, 255, 0.68);
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.84) inset,
    0 14px 30px rgba(30, 64, 175, 0.08);
}

.activation-creator-shell__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.activation-creator-shell__eyebrow {
  color: var(--primary-color);
  font-family: var(--font-family-mono);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
}

.activation-creator-shell__head strong {
  color: var(--text-primary);
  font-size: 14px;
}

.activation-creator {
  display: grid;
  grid-template-columns: minmax(84px, 0.75fr) repeat(2, minmax(120px, 1fr));
  align-items: end;
  gap: 10px;
}

.activation-creator__field {
  display: grid;
  gap: 6px;
  min-width: 0;
}

.activation-creator__field--price,
.activation-creator__actions {
  grid-column: 1 / -1;
}

.activation-creator__label {
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 700;
}

.activation-creator__hint {
  display: block;
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.55;
  overflow-wrap: anywhere;
}

.activation-creator :deep(.n-input-number),
.activation-creator :deep(.n-base-selection) {
  width: 100%;
}

.activation-creator__actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.activation-creator__button {
  min-height: 42px;
  border-radius: 14px;
}

.activation-creator__button--primary {
  box-shadow: 0 10px 22px rgba(37, 99, 235, 0.24);
}

.activation-creator__button--warning {
  box-shadow: 0 10px 22px rgba(249, 115, 22, 0.16);
}

.admin-activation-codes-page.admin-surface-page .page-overview,
.admin-activation-codes-page .page-overview {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}

.overview-card {
  position: relative;
  min-height: 112px;
  overflow: hidden;
  padding: 16px 18px;
  border: 1px solid var(--activation-border);
  border-radius: 20px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.78), rgba(239, 246, 255, 0.54)),
    var(--activation-surface);
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.78) inset,
    var(--activation-shadow-soft);
}

.overview-card::after {
  content: "";
  position: absolute;
  inset: 0 auto 0 0;
  width: 4px;
  background: linear-gradient(180deg, var(--primary-color), rgba(20, 184, 166, 0.72));
}

.overview-card--available {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.76), rgba(220, 252, 231, 0.56)),
    var(--activation-green-soft);
}

.overview-card--used {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.76), rgba(219, 234, 254, 0.56)),
    var(--activation-blue-soft);
}

.overview-card--bound {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.76), rgba(255, 247, 237, 0.58)),
    var(--activation-amber-soft);
}

.overview-label,
.desktop-table-card__header span,
.meta-label,
.table-subtext-cell {
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

.admin-activation-codes-page.admin-surface-page .desktop-table-card,
.desktop-table-card {
  overflow: hidden;
  border: 1px solid var(--activation-border);
  border-radius: 24px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.78), rgba(248, 251, 255, 0.74)),
    var(--activation-surface-strong);
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.78) inset,
    var(--activation-shadow);
}

.desktop-table-card :deep(.n-card__content) {
  padding: 18px;
}

.admin-activation-codes-page.admin-surface-page .desktop-table-card__header,
.desktop-table-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 14px;
  margin-bottom: 14px;
  border-bottom: 1px solid rgba(37, 99, 235, 0.12);
}

.desktop-table-card__header h3 {
  margin: 0;
  color: var(--text-primary);
  font-size: 18px;
  font-weight: 800;
}

.activation-codes-table :deep(.n-data-table-wrapper) {
  border: 1px solid rgba(37, 99, 235, 0.1);
  border-radius: 18px;
  overflow: hidden;
}

.activation-codes-table :deep(.n-data-table-th) {
  background: linear-gradient(180deg, rgba(239, 246, 255, 0.96), rgba(226, 238, 255, 0.84));
  color: #1e293b;
  font-weight: 800;
  white-space: normal;
}

.activation-codes-table :deep(.n-data-table-td) {
  background: rgba(255, 255, 255, 0.68);
  vertical-align: middle;
  white-space: normal;
}

.activation-codes-table :deep(.n-data-table-tr:hover .n-data-table-td) {
  background: rgba(226, 232, 240, 0.28);
}

.table-stack-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.table-code-cell,
.table-text-cell {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  color: var(--text-primary);
  text-overflow: ellipsis;
  vertical-align: middle;
  white-space: nowrap;
}

.table-code-cell {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.table-subtext-cell {
  overflow: hidden;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.table-actions-cell {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.table-actions-cell :deep(.n-button) {
  min-height: 32px;
  border-radius: 10px;
}

.mobile-list {
  display: grid;
  gap: 12px;
}

.admin-activation-codes-page.admin-surface-page .mobile-code-card,
.mobile-code-card {
  overflow: hidden;
  border: 1px solid var(--activation-border);
  border-radius: 22px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.78), rgba(239, 246, 255, 0.52)),
    var(--activation-surface);
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.78) inset,
    0 12px 28px rgba(30, 64, 175, 0.08);
}

.mobile-code-card :deep(.n-card__content) {
  display: grid;
  gap: 12px;
  padding: 14px;
}

.mobile-code-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.mobile-code-value {
  min-width: 0;
  color: var(--text-primary);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.02em;
  overflow-wrap: anywhere;
}

.mobile-code-status {
  flex: 0 0 auto;
}

.mobile-meta-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.meta-row {
  display: grid;
  gap: 4px;
  min-width: 0;
  min-height: 58px;
  padding: 10px;
  border: 1px solid rgba(37, 99, 235, 0.1);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.62);
  color: var(--text-primary);
  font-size: 12px;
  overflow-wrap: anywhere;
}

.meta-row--wide {
  grid-column: 1 / -1;
}

.meta-label {
  font-size: 11px;
}

.mobile-actions {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.mobile-actions :deep(.n-button) {
  min-height: 36px;
  border-radius: 10px;
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
  border: 1px solid var(--activation-border);
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

:global([data-theme="dark"]) .admin-activation-codes-page {
  --activation-surface: rgba(15, 23, 42, 0.78);
  --activation-surface-strong: rgba(15, 23, 42, 0.9);
  --activation-border: rgba(96, 165, 250, 0.2);
  --activation-border-strong: rgba(96, 165, 250, 0.3);
  --activation-shadow: 0 18px 42px rgba(0, 0, 0, 0.28);
  --activation-shadow-soft: 0 10px 26px rgba(0, 0, 0, 0.2);
}

:global([data-theme="dark"]) .admin-activation-codes-page.admin-surface-page .page-header,
:global([data-theme="dark"]) .admin-activation-codes-page .activation-creator-shell,
:global([data-theme="dark"]) .admin-activation-codes-page .overview-card,
:global([data-theme="dark"]) .admin-activation-codes-page .desktop-table-card,
:global([data-theme="dark"]) .admin-activation-codes-page .mobile-code-card {
  background:
    linear-gradient(180deg, rgba(30, 41, 59, 0.72), rgba(15, 23, 42, 0.84)),
    var(--activation-surface);
}

:global([data-theme="dark"]) .admin-activation-codes-page .activation-codes-table :deep(.n-data-table-th) {
  background: linear-gradient(180deg, rgba(30, 41, 59, 0.95), rgba(15, 23, 42, 0.9));
  color: #e2e8f0;
}

:global([data-theme="dark"]) .admin-activation-codes-page .activation-codes-table :deep(.n-data-table-td) {
  background: rgba(15, 23, 42, 0.58);
}

:global([data-theme="dark"]) .admin-activation-codes-page .meta-row {
  background: rgba(15, 23, 42, 0.58);
  border-color: rgba(96, 165, 250, 0.16);
}

:global([data-theme="dark"]) .admin-activation-codes-page .created-codes-modal__list {
  background: rgba(15, 23, 42, 0.58);
}

@keyframes activation-page-fade-in {
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
  .admin-activation-codes-page {
    animation: none;
  }
}

@media (max-width: 900px) {
  .admin-activation-codes-page.admin-surface-page .page-overview,
  .admin-activation-codes-page .page-overview {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 768px) {
  .admin-activation-codes-page {
    padding: 10px 0 16px;
  }

  .admin-activation-codes-page.admin-surface-page .container,
  .admin-activation-codes-page .container {
    padding: 0 10px;
  }

  .admin-activation-codes-page.admin-surface-page .page-header,
  .admin-activation-codes-page .page-header {
    grid-template-columns: minmax(0, 1fr);
    gap: 12px;
    padding: 16px;
    border-radius: 22px;
  }

  .admin-activation-codes-page .page-header__main h1 {
    font-size: 22px;
    line-height: 1.15;
  }

  .admin-activation-codes-page .page-header__main p {
    max-width: 100%;
    font-size: 12px;
    line-height: 1.55;
  }

  .activation-creator-shell {
    width: 100%;
    max-width: none;
    padding: 12px;
    border-radius: 18px;
  }

  .activation-creator-shell__head {
    align-items: flex-start;
    flex-direction: column;
    gap: 2px;
  }

  .activation-creator {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: stretch;
    gap: 8px;
  }

  .activation-creator__field--price {
    grid-column: 1 / -1;
  }

  .activation-creator__actions {
    grid-column: 1 / -1;
    gap: 8px;
  }

  .activation-creator__button {
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

  .mobile-list {
    gap: 10px;
  }

  .mobile-code-card {
    border-radius: 14px;
  }

  .mobile-code-card :deep(.n-card__content) {
    padding: 10px;
  }

  .mobile-code-top {
    flex-direction: column;
    gap: 8px;
  }

  .mobile-meta-grid {
    gap: 8px;
  }

  .meta-row {
    min-height: 54px;
    padding: 8px 10px;
    border-radius: 10px;
  }
}

@media (max-width: 420px) {
  .admin-activation-codes-page.admin-surface-page .container,
  .admin-activation-codes-page .container {
    padding: 0 8px;
  }

  .activation-creator,
  .activation-creator__actions,
  .admin-activation-codes-page.admin-surface-page .page-overview,
  .admin-activation-codes-page .page-overview,
  .mobile-meta-grid,
  .mobile-actions {
    grid-template-columns: 1fr;
  }

  .admin-activation-codes-page .page-header__main h1 {
    font-size: 20px;
  }
}
</style>
