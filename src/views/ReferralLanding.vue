<template>
  <div class="referral-landing-page public-brand-page public-brand-page--centered">
    <div aria-hidden="true" class="public-brand-bg">
      <span class="public-brand-orb public-brand-orb--a"></span>
      <span class="public-brand-orb public-brand-orb--b"></span>
      <span class="public-brand-orb public-brand-orb--c"></span>
      <span class="public-brand-grid"></span>
    </div>

    <div class="referral-landing-card public-brand-glass-card public-brand-status-card public-brand-stack">
      <span class="public-brand-status-chip">{{ statusLabel }}</span>
      <h1>{{ t("referralLanding.title") }}</h1>
      <p>{{ statusText }}</p>
      <p class="referral-landing-note">{{ statusNote }}</p>
      <n-spin :show="loading"></n-spin>
      <n-button secondary type="primary" @click="router.replace('/register')">
        前往注册页
      </n-button>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import { useMessage } from "naive-ui/es";
import { useI18n } from "vue-i18n";
import { useRoute, useRouter } from "vue-router";
import api from "@/api";

const REFERRAL_CODE_STORAGE_KEY = "xyzw_referral_code";
const REFERRAL_AT_STORAGE_KEY = "xyzw_referral_at";

const route = useRoute();
const router = useRouter();
const message = useMessage();
const { t } = useI18n();

const loading = ref(false);
const statusLabel = computed(() => (loading.value ? "邀请码识别中" : "准备跳转"));
const statusText = computed(() =>
  loading.value ? t("referralLanding.loading") : t("referralLanding.redirecting"),
);
const statusNote = computed(() => {
  const code = String(route.params.code || "").trim();
  if (!code) {
    return "未检测到推荐码，页面会直接返回注册页。";
  }
  return "正在校验推荐关系并写入本地缓存；如果邀请码失效，也会自动回到注册页。";
});

const clearStoredReferral = () => {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(REFERRAL_CODE_STORAGE_KEY);
  window.localStorage.removeItem(REFERRAL_AT_STORAGE_KEY);
};

const persistReferral = (referralCode) => {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(REFERRAL_CODE_STORAGE_KEY, String(referralCode || "").trim());
  window.localStorage.setItem(REFERRAL_AT_STORAGE_KEY, new Date().toISOString());
};

const handleResolve = async () => {
  const code = String(route.params.code || "").trim();
  if (!code) {
    clearStoredReferral();
    router.replace("/register");
    return;
  }

  loading.value = true;
  try {
    const res = await api.publicReferral.resolve(code);
    if (!res?.success || !res?.data?.referralCode) {
      clearStoredReferral();
      message.warning(t("referralLanding.invalid"));
      router.replace("/register");
      return;
    }

    const attachRes = await api.publicReferral.attach(res.data.referralCode);
    if (!attachRes?.success || !attachRes?.data?.referralCode) {
      clearStoredReferral();
      message.warning(attachRes?.message || t("referralLanding.invalid"));
      router.replace("/register");
      return;
    }

    persistReferral(attachRes.data.referralCode);
    router.replace(res.data.registerPath || `/register?ref=${encodeURIComponent(attachRes.data.referralCode)}`);
  } catch (error) {
    clearStoredReferral();
    message.warning(error?.message || t("referralLanding.invalid"));
    router.replace("/register");
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  handleResolve();
});
</script>

<style scoped lang="scss">
.referral-landing-page {
  width: 100%;
}

.referral-landing-card {
  width: min(560px, 100%);
}

.referral-landing-card h1,
.referral-landing-card p {
  margin: 0;
}

.referral-landing-card p {
  color: var(--text-secondary);
}

.referral-landing-note {
  font-size: 14px;
  line-height: 1.65;
}
</style>
