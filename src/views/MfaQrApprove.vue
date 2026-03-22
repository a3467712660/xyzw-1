<template>
  <div class="mfa-qr-page">
    <div class="mfa-qr-card">
      <h1>{{ t("mfaQrApprove.title") }}</h1>
      <p class="desc">{{ t("mfaQrApprove.desc") }}</p>

      <n-alert v-if="!sessionId" type="error" :show-icon="false">
        {{ t("mfaQrApprove.invalidSession") }}
      </n-alert>
      <n-alert v-else-if="isDone" type="success" :show-icon="false">
        {{ t("mfaQrApprove.success") }}
      </n-alert>

      <n-form
        v-if="sessionId && !isDone"
        :aria-busy="isSubmitting ? 'true' : 'false'"
        :show-label="false"
      >
        <p
          aria-atomic="true"
          aria-live="polite"
          class="sr-only"
          role="status"
        >
          {{ isSubmitting ? t("mfaQrApprove.submit") : "" }}
        </p>
        <p
          ref="formErrorRef"
          aria-atomic="true"
          aria-live="assertive"
          class="sr-only"
          role="alert"
          tabindex="-1"
        >
          {{ formErrorMessage }}
        </p>
        <n-form-item>
          <n-input
            readonly
            :input-props="{ 'aria-label': 'MFA session id' }"
            :value="sessionId"
          ></n-input>
        </n-form-item>
        <n-form-item>
          <n-input
            v-model:value="verifyCode"
            :input-props="{
              'autocomplete': 'one-time-code',
              'inputmode': isRecoveryMode ? 'text' : 'numeric',
              'name': isRecoveryMode ? 'mfa-recovery-code' : 'mfa-totp-code',
              'aria-label': t(
                isRecoveryMode
                  ? 'login.mfa.recoveryPlaceholder'
                  : 'login.mfa.totpPlaceholder',
              ),
            }"
            :placeholder="
              t(
                isRecoveryMode
                  ? 'login.mfa.recoveryPlaceholder'
                  : 'login.mfa.totpPlaceholder',
              )
            "
            @keydown.enter="submitApprove"
          ></n-input>
        </n-form-item>
        <div class="actions">
          <n-button text type="primary" @click="toggleMode">
            {{
              t(
                isRecoveryMode
                  ? "login.mfa.useAuthenticator"
                  : "login.mfa.useRecoveryCode",
              )
            }}
          </n-button>
          <n-button
            type="primary"
            :aria-disabled="isSubmitting ? 'true' : 'false'"
            :loading="isSubmitting"
            @click="submitApprove"
          >
            {{ t("mfaQrApprove.submit") }}
          </n-button>
        </div>
      </n-form>

      <div class="back-actions">
        <n-button quaternary @click="router.push('/login')">
          {{ t("login.mfa.backToLogin") }}
        </n-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useMessage } from "naive-ui/es";
import { useI18n } from "vue-i18n";
import api from "@/api";

const route = useRoute();
const router = useRouter();
const message = useMessage();
const { t } = useI18n();

const verifyCode = ref("");
const isRecoveryMode = ref(false);
const isSubmitting = ref(false);
const isDone = ref(false);
const formErrorRef = ref(null);
const formErrorMessage = ref("");
const sessionId = computed(() => String(route.query.sid || "").trim());

const focusNamedInput = (name) => {
  if (typeof document === "undefined")
    return;
  const el = document.querySelector(`input[name="${name}"], textarea[name="${name}"]`);
  if (el && typeof el.focus === "function") {
    el.focus();
  }
};

const announceFormError = async (messageText, focusFieldName = "") => {
  formErrorMessage.value = String(messageText || "").trim();
  await nextTick();
  if (focusFieldName) {
    focusNamedInput(focusFieldName);
    return;
  }
  if (formErrorRef.value && typeof formErrorRef.value.focus === "function") {
    formErrorRef.value.focus();
  }
};

const toggleMode = () => {
  isRecoveryMode.value = !isRecoveryMode.value;
  verifyCode.value = "";
  nextTick(() => {
    focusNamedInput(isRecoveryMode.value ? "mfa-recovery-code" : "mfa-totp-code");
  });
};

const submitApprove = async () => {
  if (isSubmitting.value || !sessionId.value) {
    return;
  }
  const rawCode = String(verifyCode.value || "").trim();
  if (!rawCode) {
    await announceFormError(
      t("login.messages.mfaCodePrompt"),
      isRecoveryMode.value ? "mfa-recovery-code" : "mfa-totp-code",
    );
    message.warning(t("login.messages.mfaCodePrompt"));
    return;
  }
  try {
    isSubmitting.value = true;
    formErrorMessage.value = "";
    const res = await api.auth.approveMfaQr({
      sessionId: sessionId.value,
      ...(isRecoveryMode.value ? { recoveryCode: rawCode } : { totpCode: rawCode }),
    });
    if (!res?.success) {
      await announceFormError(
        res?.message || t("login.messages.mfaFailed"),
        isRecoveryMode.value ? "mfa-recovery-code" : "mfa-totp-code",
      );
      message.error(res?.message || t("login.messages.mfaFailed"));
      return;
    }
    formErrorMessage.value = "";
    isDone.value = true;
    message.success(res?.message || t("mfaQrApprove.success"));
  } catch (error) {
    await announceFormError(
      error.message || t("login.messages.mfaFailed"),
      isRecoveryMode.value ? "mfa-recovery-code" : "mfa-totp-code",
    );
    message.error(error.message || t("login.messages.mfaFailed"));
  } finally {
    isSubmitting.value = false;
  }
};

onMounted(() => {
  if (sessionId.value) {
    nextTick(() => {
      focusNamedInput("mfa-totp-code");
    });
  }
});
</script>

<style scoped lang="scss">
.mfa-qr-page {
  min-height: 100dvh;
  display: grid;
  place-items: center;
  padding: 24px;
}

.mfa-qr-card {
  width: min(440px, 100%);
  border-radius: 16px;
  border: 1px solid var(--border-light);
  background: var(--card-bg);
  box-shadow: var(--shadow-medium);
  padding: 20px;
  display: grid;
  gap: 12px;
}

.desc {
  color: var(--text-secondary);
}

.actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.back-actions {
  display: flex;
  justify-content: center;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
