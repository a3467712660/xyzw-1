<template>
  <div class="public-support-page mfa-reset-page">
    <div aria-hidden="true" class="public-support-page__backdrop"></div>

    <div class="public-support-container public-support-container--narrow">
      <button class="public-support-back" type="button" @click="router.push('/login')">
        返回登录
      </button>

      <div class="public-support-shell public-support-shell--single">
        <section class="public-support-panel">
          <span class="public-support-eyebrow">二次验证恢复</span>
          <h1 class="public-support-title">{{ t("mfaReset.title") }}</h1>
          <p class="public-support-description">{{ t("mfaReset.desc") }}</p>

          <div class="public-support-meta-grid">
            <div class="public-support-meta-card">
              <span>当前状态</span>
              <strong>{{ statusLabel }}</strong>
            </div>
            <div class="public-support-meta-card">
              <span>处理方式</span>
              <strong>链接确认</strong>
            </div>
            <div class="public-support-meta-card">
              <span>完成后</span>
              <strong>重新登录</strong>
            </div>
          </div>

          <n-alert v-if="status === 'invalid'" type="error" :show-icon="false">
            {{ resultMessage || t("mfaReset.invalid") }}
          </n-alert>
          <n-alert v-else-if="status === 'success'" type="success" :show-icon="false">
            {{ resultMessage || t("mfaReset.success") }}
          </n-alert>
          <n-alert v-else type="warning" :show-icon="false">
            {{ t("mfaReset.confirmHint") }}
          </n-alert>

          <div class="public-support-note">
            <strong>后续说明：</strong>
            {{ statusGuide }}
          </div>

          <div class="public-support-actions mfa-reset-page__actions">
            <n-button
              v-if="status === 'idle'"
              type="error"
              :loading="submitting"
              @click="submitReset"
            >
              {{ t("mfaReset.confirm") }}
            </n-button>
            <n-button
              v-if="status !== 'idle'"
              type="primary"
              @click="router.push('/login')"
            >
              {{ t("mfaReset.backLogin") }}
            </n-button>
            <n-button
              v-if="status === 'invalid'"
              secondary
              @click="router.push('/login')"
            >
              返回登录
            </n-button>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import { useMessage } from "naive-ui/es";
import { useI18n } from "vue-i18n";
import { useRoute, useRouter } from "vue-router";
import api from "@/api";
import {
  buildRouteWithoutSecret,
  readRouteSecret,
} from "@/utils/routeSecretFragment";

const route = useRoute();
const router = useRouter();
const message = useMessage();
const { t } = useI18n();

const submitting = ref(false);
const status = ref("idle");
const resultMessage = ref("");
const token = ref(readRouteSecret(route, "token").value);
const tokenSource = ref(readRouteSecret(route, "token").source);

const statusLabel = computed(() => {
  if (status.value === "success") {
    return "已完成";
  }
  if (status.value === "invalid") {
    return "链接失效";
  }
  return "待确认";
});

const statusGuide = computed(() => {
  if (status.value === "success") {
    return "二次验证已被重置，请回到登录页重新绑定新的验证方式。";
  }
  if (status.value === "invalid") {
    return "这个链接已经失效或不完整，需要管理员重新生成有效的重置链接。";
  }
  return "确认后会立即重置当前账户的二次验证设置，建议随后重新绑定新的验证器。";
});

if (!token.value) {
  status.value = "invalid";
  resultMessage.value = t("mfaReset.invalid");
}

const cleanupSecretFromUrl = async () => {
  if (!tokenSource.value) {
    return;
  }
  await router.replace(buildRouteWithoutSecret(route, "token"));
};

const submitReset = async () => {
  if (!token.value || submitting.value) {
    return;
  }
  try {
    submitting.value = true;
    const res = await api.auth.resetMfaByLink({ token: token.value });
    if (!res.success) {
      status.value = "invalid";
      resultMessage.value = res.message || t("mfaReset.invalid");
      return;
    }
    status.value = "success";
    resultMessage.value = res.message || t("mfaReset.success");
    message.success(resultMessage.value);
  } catch (error) {
    status.value = "invalid";
    resultMessage.value = error.message || t("mfaReset.invalid");
    message.error(resultMessage.value);
  } finally {
    submitting.value = false;
  }
};

onMounted(() => {
  cleanupSecretFromUrl();
});
</script>

<style scoped lang="scss">
.mfa-reset-page__actions {
  justify-content: flex-end;
}

@media (max-width: 640px) {
  .mfa-reset-page__actions {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
