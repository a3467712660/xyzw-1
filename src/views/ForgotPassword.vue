<template>
  <div class="forgot-page" :class="{ 'forgot-page--ready': isPageReady }">
    <div aria-hidden="true" class="forgot-bg">
      <span class="bg-orb orb-a"></span>
      <span class="bg-orb orb-b"></span>
      <span class="bg-orb orb-c"></span>
      <span class="grid-mask"></span>
    </div>

    <div class="forgot-shell">
      <aside class="forgot-aside reveal-up">
        <div class="aside-brand">
          <img alt="XYZW" class="aside-logo" src="/icons/xiaoyugan.png">
          <div>
            <p class="aside-kicker">XYZW</p>
            <span class="aside-brand__sub">{{ t("homePage.brandSubtitle") }}</span>
          </div>
        </div>
        <h1>{{ t("forgotPassword.title") }}</h1>
        <p class="aside-desc">{{ t("forgotPassword.subtitle") }}</p>

        <div class="steps">
          <article class="step-item">
            <span>1</span>
            <p>{{ t("forgotPassword.steps.contactAdmin") }}</p>
          </article>
          <article class="step-item">
            <span>2</span>
            <p>{{ t("forgotPassword.steps.getCode") }}</p>
          </article>
          <article class="step-item">
            <span>3</span>
            <p>{{ t("forgotPassword.steps.reset") }}</p>
          </article>
        </div>
      </aside>

      <section class="forgot-card reveal-up reveal-delay-2">
        <header class="card-header">
          <h2>{{ t("forgotPassword.cardTitle") }}</h2>
          <p>{{ t("forgotPassword.cardDesc") }}</p>
        </header>

        <n-form
          ref="formRef"
          size="large"
          :aria-busy="authStore.isLoading ? 'true' : 'false'"
          :model="form"
          :rules="rules"
          :show-label="false"
        >
          <p
            aria-atomic="true"
            aria-live="polite"
            class="sr-only"
            role="status"
          >
            {{ authStore.isLoading ? t("forgotPassword.actions.submit") : "" }}
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
          <n-form-item path="identity">
            <n-input
              v-model:value="form.identity"
              :input-props="{
                'autocomplete': 'username',
                'name': 'identity',
                'aria-label': t('forgotPassword.placeholders.identity'),
              }"
              :placeholder="t('forgotPassword.placeholders.identity')"
            >
              <template #prefix>
                <n-icon><PersonCircle></PersonCircle></n-icon>
              </template>
            </n-input>
          </n-form-item>

          <n-form-item path="shortCode">
            <n-input
              v-model:value="form.shortCode"
              :input-props="{
                'autocomplete': 'one-time-code',
                'inputmode': 'text',
                'name': 'short-code',
                'aria-label': t('forgotPassword.placeholders.shortCode'),
              }"
              :placeholder="t('forgotPassword.placeholders.shortCode')"
            >
              <template #prefix>
                <n-icon><Key></Key></n-icon>
              </template>
            </n-input>
          </n-form-item>

          <n-form-item path="newPassword">
            <n-input
              type="password"
              v-model:value="form.newPassword"
              :input-props="{
                'autocomplete': 'new-password',
                'name': 'new-password',
                'aria-label': t('forgotPassword.placeholders.newPassword'),
              }"
              :placeholder="t('forgotPassword.placeholders.newPassword')"
            >
              <template #prefix>
                <n-icon><LockClosed></LockClosed></n-icon>
              </template>
            </n-input>
          </n-form-item>

          <n-form-item path="confirmPassword">
            <n-input
              type="password"
              v-model:value="form.confirmPassword"
              :input-props="{
                'autocomplete': 'new-password',
                'name': 'confirm-password',
                'aria-label': t('forgotPassword.placeholders.confirmPassword'),
              }"
              :placeholder="t('forgotPassword.placeholders.confirmPassword')"
              @keydown.enter="handleSubmit"
            >
              <template #prefix>
                <n-icon><ShieldCheckmark></ShieldCheckmark></n-icon>
              </template>
            </n-input>
          </n-form-item>

          <n-button
            block
            class="submit-btn"
            size="large"
            type="primary"
            :aria-disabled="authStore.isLoading ? 'true' : 'false'"
            :loading="authStore.isLoading"
            @click="handleSubmit"
          >
            {{ t("forgotPassword.actions.submit") }}
          </n-button>
        </n-form>

        <div class="actions">
          <n-button
            text
            type="primary"
            @click="router.push('/login')"
          >
            {{ t("forgotPassword.actions.backToLogin") }}
          </n-button>
          <n-button text @click="router.push('/register')">
            {{ t("forgotPassword.actions.register") }}
          </n-button>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { nextTick, onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { useMessage } from "naive-ui/es";
import { useI18n } from "vue-i18n";
import { useAuthStore } from "@/stores/auth";
import {
  Key,
  LockClosed,
  PersonCircle,
  ShieldCheckmark,
} from "@vicons/ionicons5";

const router = useRouter();
const message = useMessage();
const authStore = useAuthStore();
const { t } = useI18n();
const formRef = ref(null);
const isPageReady = ref(false);
const formErrorRef = ref(null);
const formErrorMessage = ref("");
const passwordPolicyHint = () => t("forgotPassword.validation.passwordPolicy");

const form = reactive({
  identity: "",
  shortCode: "",
  newPassword: "",
  confirmPassword: "",
});

const rules = {
  identity: [
    {
      required: true,
      message: t("forgotPassword.validation.identityRequired"),
      trigger: ["blur", "input"],
    },
  ],
  shortCode: [
    {
      required: true,
      message: t("forgotPassword.validation.shortCodeRequired"),
      trigger: ["blur", "input"],
    },
  ],
  newPassword: [
    {
      required: true,
      message: t("forgotPassword.validation.newPasswordRequired"),
      trigger: ["blur", "input"],
    },
    {
      validator: (rule, value) =>
        String(value || "").length >= 12,
      message: passwordPolicyHint,
      trigger: ["blur", "input"],
    },
  ],
  confirmPassword: [
    {
      required: true,
      message: t("forgotPassword.validation.confirmPasswordRequired"),
      trigger: ["blur", "input"],
    },
    {
      validator: (rule, value) => value === form.newPassword,
      message: t("forgotPassword.validation.passwordMismatch"),
      trigger: ["blur", "input"],
    },
  ],
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

const handleSubmit = async () => {
  if (!formRef.value)
    return;

  try {
    await formRef.value.validate();
    formErrorMessage.value = "";
    const result = await authStore.resetPasswordWithShortCode({
      identity: form.identity.trim(),
      shortCode: form.shortCode.trim().toUpperCase(),
      newPassword: form.newPassword,
    });

    if (!result.success) {
      await announceFormError(result.message || t("forgotPassword.messages.resetFailed"), "identity");
      message.error(result.message || t("forgotPassword.messages.resetFailed"));
      return;
    }

    formErrorMessage.value = "";
    message.success(result.message || t("forgotPassword.messages.resetSuccess"));
    router.push("/login");
  } catch (error) {
    await announceFormError(t("forgotPassword.validation.identityRequired"), "identity");
    console.error("Forgot password validation failed:", error);
  }
};

onMounted(() => {
  requestAnimationFrame(() => {
    isPageReady.value = true;
  });
});
</script>

<style scoped lang="scss">
.forgot-page {
  min-height: 100dvh;
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.forgot-bg {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
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

.bg-orb {
  position: absolute;
  border-radius: 999px;
  filter: blur(72px);
}

.orb-a {
  width: 36vw;
  height: 36vw;
  min-width: 260px;
  min-height: 260px;
  left: -10vw;
  top: -10vh;
  background: radial-gradient(
    circle,
    rgba(15, 107, 255, 0.24),
    transparent 72%
  );
}

.orb-b {
  width: 34vw;
  height: 34vw;
  min-width: 220px;
  min-height: 220px;
  right: -8vw;
  bottom: -10vh;
  background: radial-gradient(circle, rgba(0, 163, 137, 0.2), transparent 72%);
}

.orb-c {
  width: 28vw;
  height: 28vw;
  min-width: 200px;
  min-height: 200px;
  right: 20vw;
  top: 14vh;
  background: radial-gradient(circle, rgba(14, 116, 144, 0.16), transparent 74%);
}

.grid-mask {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(rgba(15, 107, 255, 0.06) 1px, transparent 1px),
    linear-gradient(90deg, rgba(15, 107, 255, 0.06) 1px, transparent 1px);
  background-size: 44px 44px;
  opacity: 0.26;
  mask-image: radial-gradient(circle at center, black 30%, transparent 86%);
}

.forgot-shell {
  width: min(1080px, 100%);
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18px;
  position: relative;
  z-index: 2;
}

.reveal-up {
  opacity: 0;
  transform: translateY(18px);
}

.forgot-page--ready .reveal-up {
  animation: forgot-reveal-up 0.7s cubic-bezier(0.2, 0.7, 0.1, 1) forwards;
}

.forgot-page--ready .reveal-delay-2 {
  animation-delay: 0.14s;
}

.forgot-aside,
.forgot-card {
  background: rgba(255, 255, 255, 0.82);
  border: 1px solid var(--border-light);
  border-radius: 24px;
  backdrop-filter: blur(16px);
  box-shadow: var(--shadow-medium);
}

[data-theme="dark"] .forgot-aside,
[data-theme="dark"] .forgot-card {
  background: rgba(8, 22, 41, 0.8);
}

.forgot-aside {
  padding: 28px;
}

.aside-brand {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;
}

.aside-logo {
  width: 38px;
  height: 38px;
  border-radius: 12px;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.12);
}

.aside-brand__sub {
  display: block;
  margin-top: 2px;
  color: var(--text-tertiary);
  font-size: 13px;
}

.aside-kicker {
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--primary-color);
  margin-bottom: 0;
}

.forgot-aside h1 {
  font-size: 30px;
  line-height: 1.1;
  margin-bottom: 10px;
}

.aside-desc {
  color: var(--text-secondary);
  line-height: 1.7;
  margin-bottom: 18px;
}

.steps {
  display: grid;
  gap: 10px;
}

.step-item {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 10px;
  align-items: start;
  border: 1px solid var(--border-light);
  border-radius: 14px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.68);
}

[data-theme="dark"] .step-item {
  background: rgba(7, 21, 39, 0.72);
}

.step-item span {
  width: 24px;
  height: 24px;
  display: grid;
  place-items: center;
  border-radius: 999px;
  color: #fff;
  font-size: 13px;
  background: linear-gradient(
    135deg,
    var(--primary-color),
    var(--secondary-color)
  );
}

.step-item p {
  color: var(--text-secondary);
  font-size: 14px;
  line-height: 1.5;
}

.forgot-card {
  padding: 28px;
}

.card-header {
  margin-bottom: 16px;
}

.card-header h2 {
  font-size: 28px;
  margin-bottom: 6px;
}

.card-header p {
  color: var(--text-secondary);
}

.submit-btn {
  margin-top: 4px;
}

.actions {
  margin-top: 14px;
  display: flex;
  justify-content: center;
  gap: 8px;
}

@keyframes forgot-reveal-up {
  from {
    opacity: 0;
    transform: translateY(16px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 960px) {
  .forgot-shell {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 680px) {
  .forgot-page {
    padding: 12px;
  }

  .forgot-aside,
  .forgot-card {
    padding: 18px;
    border-radius: 16px;
  }

  .forgot-aside h1,
  .card-header h2 {
    font-size: 24px;
  }
}
</style>
