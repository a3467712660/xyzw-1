<template>
  <div class="mfa-reset-page">
    <div class="mfa-reset-card">
      <h1>{{ t("mfaReset.title") }}</h1>
      <p class="mfa-reset-desc">{{ t("mfaReset.desc") }}</p>

      <n-alert v-if="status === 'invalid'" type="error" :show-icon="false">
        {{ resultMessage || t("mfaReset.invalid") }}
      </n-alert>
      <n-alert v-else-if="status === 'success'" type="success" :show-icon="false">
        {{ resultMessage || t("mfaReset.success") }}
      </n-alert>
      <n-alert v-else type="warning" :show-icon="false">
        {{ t("mfaReset.confirmHint") }}
      </n-alert>

      <div class="mfa-reset-actions">
        <n-button v-if="status === 'idle'" type="error" :loading="submitting" @click="submitReset">
          {{ t("mfaReset.confirm") }}
        </n-button>
        <n-button v-if="status !== 'idle'" type="primary" @click="router.push('/login')">
          {{ t("mfaReset.backLogin") }}
        </n-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from "vue";
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
.mfa-reset-page {
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.mfa-reset-card {
  width: min(100%, 460px);
  padding: 28px;
  border-radius: 24px;
  background: var(--surface-glass-strong, rgba(255, 255, 255, 0.92));
  border: 1px solid var(--surface-glass-border, rgba(148, 163, 184, 0.18));
  box-shadow: var(--shadow-light);
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.mfa-reset-card h1 {
  margin: 0;
  font-size: 28px;
  color: var(--text-primary);
}

.mfa-reset-desc {
  margin: 0;
  color: var(--text-secondary);
  line-height: 1.7;
}

.mfa-reset-actions {
  display: flex;
  justify-content: flex-end;
}
</style>
