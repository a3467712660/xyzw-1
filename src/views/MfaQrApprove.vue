<template>
  <div class="public-support-page mfa-qr-page">
    <div aria-hidden="true" class="public-support-page__backdrop"></div>

    <div class="public-support-container public-support-container--narrow">
      <button class="public-support-back" type="button" @click="router.push('/login')">
        返回登录
      </button>

      <div class="public-support-shell public-support-shell--single">
        <section class="public-support-panel">
          <span class="public-support-eyebrow">扫码确认</span>
          <h1 class="public-support-title">{{ t("mfaQrApprove.title") }}</h1>
          <p class="public-support-description">{{ t("mfaQrApprove.desc") }}</p>

          <div class="public-support-meta-grid">
            <div class="public-support-meta-card">
              <span>会话状态</span>
              <strong>{{ sessionId ? "已加载" : "无效" }}</strong>
            </div>
            <div class="public-support-meta-card">
              <span>验证方式</span>
              <strong>{{ isRecoveryMode ? "恢复码" : "动态验证码" }}</strong>
            </div>
            <div class="public-support-meta-card">
              <span>当前结果</span>
              <strong>{{ isDone ? "已通过" : "待确认" }}</strong>
            </div>
          </div>

          <n-alert v-if="!sessionId" type="error" :show-icon="false">
            {{ t("mfaQrApprove.invalidSession") }}
          </n-alert>
          <n-alert v-else-if="isDone" type="success" :show-icon="false">
            {{ t("mfaQrApprove.success") }}
          </n-alert>
          <n-alert v-else type="info" :show-icon="false">
            使用当前验证器或恢复码完成本次扫码确认。
          </n-alert>

          <n-form
            v-if="sessionId && !isDone"
            class="mfa-qr-page__form"
            label-placement="top"
            :aria-busy="isSubmitting ? 'true' : 'false'"
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

            <n-form-item label="MFA Session">
              <n-input
                readonly
                :input-props="{ 'aria-label': 'MFA session id' }"
                :value="sessionId"
              ></n-input>
            </n-form-item>

            <n-form-item
              :label="
                t(
                  isRecoveryMode
                    ? 'login.mfa.recoveryPlaceholder'
                    : 'login.mfa.totpPlaceholder',
                )
              "
            >
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

            <div class="public-support-note">
              <strong>模式切换：</strong>
              {{ isRecoveryMode
                ? "当前使用恢复码确认。如果找不到验证器，可继续沿用这一方式。"
                : "当前使用 6 位动态验证码确认。若验证器不可用，可切换到恢复码。" }}
            </div>

            <div class="public-support-actions mfa-qr-page__actions">
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

          <div class="public-support-actions mfa-qr-page__footer">
            <n-button quaternary @click="router.push('/login')">
              {{ t("login.mfa.backToLogin") }}
            </n-button>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup>
import { nextTick, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useMessage } from "naive-ui/es";
import { useI18n } from "vue-i18n";
import api from "@/api";
import {
  buildRouteWithoutSecret,
  readRouteSecret,
} from "@/utils/routeSecretFragment";

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
const sessionId = ref(readRouteSecret(route, "sid").value);
const sessionIdSource = ref(readRouteSecret(route, "sid").source);

const cleanupSecretFromUrl = async () => {
  if (!sessionIdSource.value) {
    return;
  }
  await router.replace(buildRouteWithoutSecret(route, "sid"));
};

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
    focusNamedInput(
      isRecoveryMode.value ? "mfa-recovery-code" : "mfa-totp-code",
    );
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
  cleanupSecretFromUrl();
  if (sessionId.value) {
    nextTick(() => {
      focusNamedInput("mfa-totp-code");
    });
  }
});
</script>

<style scoped lang="scss">
.mfa-qr-page.public-support-page {
  .public-support-panel {
    border-radius: 30px;
  }

  .public-support-meta-grid {
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  }
}

.mfa-qr-page__form {
  display: grid;
  gap: 8px;
}

.mfa-qr-page__actions {
  justify-content: space-between;
}

.mfa-qr-page__footer {
  justify-content: center;
}

.mfa-qr-page :deep(.n-form-item-label__text) {
  font-weight: 600;
  color: var(--text-primary);
}

.mfa-qr-page :deep(.n-input .n-input-wrapper) {
  min-height: 46px;
  border-radius: 14px;
  background: var(--console-panel);
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

@media (max-width: 640px) {
  .mfa-qr-page__actions {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
