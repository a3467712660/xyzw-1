<template>
  <div class="register-page" :class="{ 'register-page--ready': isPageReady }">
    <div aria-hidden="true" class="register-bg">
      <span class="bg-bubble bubble-a"></span>
      <span class="bg-bubble bubble-b"></span>
      <span class="bg-lines"></span>
    </div>

    <div class="register-shell">
      <aside class="register-intro reveal-up">
        <p class="intro-kicker">ONBOARDING</p>
        <h1>{{ t("register.title") }}</h1>
        <p>{{ t("register.subtitle") }}</p>

        <div class="intro-points">
          <div class="point-item">
            <span class="point-dot"></span>
            <div>
              <strong>{{ t("register.points.fast.title") }}</strong>
              <p>{{ t("register.points.fast.desc") }}</p>
            </div>
          </div>
          <div class="point-item">
            <span class="point-dot"></span>
            <div>
              <strong>{{ t("register.points.invite.title") }}</strong>
              <p>{{ t("register.points.invite.desc") }}</p>
            </div>
          </div>
          <div class="point-item">
            <span class="point-dot"></span>
            <div>
              <strong>{{ t("register.points.ready.title") }}</strong>
              <p>{{ t("register.points.ready.desc") }}</p>
            </div>
          </div>
        </div>
      </aside>

      <section class="register-card reveal-up reveal-delay-2">
        <header class="card-header">
          <div class="brand">
            <img alt="XYZW" class="brand-logo" src="/icons/xiaoyugan.png">
            <h2>{{ t("register.cardTitle") }}</h2>
          </div>
          <p>{{ t("register.cardDesc") }}</p>
        </header>

        <n-form
          ref="registerFormRef"
          size="large"
          :aria-busy="authStore.isLoading ? 'true' : 'false'"
          :model="registerForm"
          :rules="registerRules"
          :show-label="false"
        >
          <p
            aria-atomic="true"
            aria-live="polite"
            class="sr-only"
            role="status"
          >
            {{ authStore.isLoading ? t("register.submit") : "" }}
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
          <n-form-item path="username">
            <n-input
              v-model:value="registerForm.username"
              :input-props="{
                'autocomplete': 'username',
                'name': 'username',
                'aria-label': t('register.usernamePlaceholder'),
              }"
              :placeholder="t('register.usernamePlaceholder')"
            >
              <template #prefix>
                <n-icon><PersonCircle></PersonCircle></n-icon>
              </template>
            </n-input>
          </n-form-item>

          <n-form-item path="email">
            <n-input
              v-model:value="registerForm.email"
              :input-props="{
                'autocomplete': 'email',
                'name': 'email',
                'aria-label': t('register.emailPlaceholder'),
              }"
              :placeholder="t('register.emailPlaceholder')"
            >
              <template #prefix>
                <n-icon><Mail></Mail></n-icon>
              </template>
            </n-input>
          </n-form-item>

          <n-form-item path="password">
            <n-input
              type="password"
              v-model:value="registerForm.password"
              :input-props="{
                'autocomplete': 'new-password',
                'name': 'password',
                'aria-label': t('register.passwordPlaceholder'),
              }"
              :placeholder="t('register.passwordPlaceholder')"
            >
              <template #prefix>
                <n-icon><LockClosed></LockClosed></n-icon>
              </template>
            </n-input>
          </n-form-item>

          <n-form-item path="inviteCode">
            <n-input
              v-model:value="registerForm.inviteCode"
              :input-props="{
                'autocomplete': 'one-time-code',
                'name': 'invite-code',
                'aria-label': t('register.inviteCodePlaceholder'),
              }"
              :placeholder="t('register.inviteCodePlaceholder')"
            >
              <template #prefix>
                <n-icon><Key></Key></n-icon>
              </template>
            </n-input>
          </n-form-item>

          <n-form-item path="confirmPassword">
            <n-input
              type="password"
              v-model:value="registerForm.confirmPassword"
              :input-props="{
                'autocomplete': 'new-password',
                'name': 'confirm-password',
                'aria-label': t('register.confirmPasswordPlaceholder'),
              }"
              :placeholder="t('register.confirmPasswordPlaceholder')"
              @keydown.enter="handleRegister"
            >
              <template #prefix>
                <n-icon><ShieldCheckmark></ShieldCheckmark></n-icon>
              </template>
            </n-input>
          </n-form-item>

          <div class="form-options">
            <n-checkbox v-model:checked="registerForm.agreeTerms">
              {{ t("register.agreePrefix") }}
              <n-button
                text
                type="primary"
                @click.stop="showTerms = true"
              >
                {{ t("register.termsTitle") }}
              </n-button>
              {{ t("register.and") }}
              <n-button
                text
                type="primary"
                @click.stop="showPrivacy = true"
              >
                {{ t("register.privacyTitle") }}
              </n-button>
            </n-checkbox>
          </div>

          <n-button
            block
            class="register-button"
            size="large"
            type="primary"
            :aria-disabled="!registerForm.agreeTerms || authStore.isLoading ? 'true' : 'false'"
            :disabled="!registerForm.agreeTerms"
            :loading="authStore.isLoading"
            @click="handleRegister"
          >
            {{ t("register.submit") }}
          </n-button>
        </n-form>

        <div class="login-prompt">
          <span>{{ t("register.hasAccount") }}</span>
          <n-button
            text
            type="primary"
            @click="router.push('/login')"
          >
            {{ t("register.loginNow") }}
          </n-button>
        </div>
      </section>
    </div>

    <n-modal
      preset="dialog"
      v-model:show="showTrialNotice"
      :title="t('register.trialNotice.title')"
    >
      <template #default>
        <p class="trial-notice-text">{{ t("register.trialNotice.desc") }}</p>
        <p class="trial-notice-text">
          {{ t("register.trialNotice.expiresAt") }}：{{ trialExpiresAtText || "-" }}
        </p>
      </template>
      <template #action>
        <n-button type="primary" @click="confirmTrialNotice">{{ t("register.trialNotice.confirm") }}</n-button>
      </template>
    </n-modal>

    <n-modal
      preset="card"
      style="max-width: 720px"
      v-model:show="showTerms"
      :title="t('register.termsTitle')"
    >
      <div class="policy-content">
        <p>{{ t("register.terms.items.1") }}</p>
        <p>{{ t("register.terms.items.2") }}</p>
        <p>{{ t("register.terms.items.3") }}</p>
        <p>{{ t("register.terms.items.4") }}</p>
      </div>
    </n-modal>

    <n-modal
      preset="card"
      style="max-width: 720px"
      v-model:show="showPrivacy"
      :title="t('register.privacyTitle')"
    >
      <div class="policy-content">
        <p>{{ t("register.privacy.items.1") }}</p>
        <p>{{ t("register.privacy.items.2") }}</p>
        <p>{{ t("register.privacy.items.3") }}</p>
        <p>{{ t("register.privacy.items.4") }}</p>
      </div>
    </n-modal>
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
  Mail,
  PersonCircle,
  ShieldCheckmark,
} from "@vicons/ionicons5";

const router = useRouter();
const message = useMessage();
const authStore = useAuthStore();
const { t } = useI18n();
const registerFormRef = ref(null);
const showTerms = ref(false);
const showPrivacy = ref(false);
const showTrialNotice = ref(false);
const trialExpiresAtText = ref("");
const isPageReady = ref(false);
const formErrorRef = ref(null);
const formErrorMessage = ref("");
const passwordPolicyHint
  = t("register.validation.passwordPolicy");

const registerForm = reactive({
  username: "",
  email: "",
  password: "",
  inviteCode: "",
  confirmPassword: "",
  agreeTerms: false,
});

const registerRules = {
  username: [
    {
      required: true,
      message: t("register.validation.usernameRequired"),
      trigger: ["input", "blur"],
    },
    {
      min: 3,
      max: 20,
      message: t("register.validation.usernameLength"),
      trigger: ["input", "blur"],
    },
  ],
  email: [
    {
      required: true,
      message: t("register.validation.emailRequired"),
      trigger: ["input", "blur"],
    },
    {
      type: "email",
      message: t("register.validation.emailInvalid"),
      trigger: ["input", "blur"],
    },
  ],
  password: [
    {
      required: true,
      message: t("register.validation.passwordRequired"),
      trigger: ["input", "blur"],
    },
    {
      validator: (rule, value) =>
        String(value || "").length >= 12,
      message: passwordPolicyHint,
      trigger: ["input", "blur"],
    },
  ],
  inviteCode: [
    {
      required: true,
      message: t("register.validation.inviteRequired"),
      trigger: ["input", "blur"],
    },
  ],
  confirmPassword: [
    {
      required: true,
      message: t("register.validation.confirmPasswordRequired"),
      trigger: ["input", "blur"],
    },
    {
      validator: (rule, value) => {
        return value === registerForm.password;
      },
      message: t("register.validation.passwordMismatch"),
      trigger: ["input", "blur"],
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

const handleRegister = async () => {
  if (!registerFormRef.value)
    return;

  try {
    await registerFormRef.value.validate();
    formErrorMessage.value = "";

    if (!registerForm.agreeTerms) {
      await announceFormError(t("register.messages.agreeRequired"));
      message.warning(t("register.messages.agreeRequired"));
      return;
    }

    const result = await authStore.register({
      username: registerForm.username,
      email: registerForm.email,
      password: registerForm.password,
      inviteCode: registerForm.inviteCode,
    });

    if (result.success) {
      if (result.data?.isTemporaryInvite && result.data?.trialExpiresAt) {
        trialExpiresAtText.value = new Date(
          result.data.trialExpiresAt,
        ).toLocaleString();
        showTrialNotice.value = true;
      } else {
        formErrorMessage.value = "";
        message.success(t("register.messages.successLogin"));
        router.push("/login");
      }
    } else {
      await announceFormError(result.message, "username");
      message.error(result.message);
    }
  } catch (error) {
    await announceFormError(t("register.validation.usernameRequired"), "username");
    console.error("Registration validation failed:", error);
  }
};

const confirmTrialNotice = () => {
  showTrialNotice.value = false;
  formErrorMessage.value = "";
  message.success(t("register.messages.successTrial"));
  router.push("/login");
};

onMounted(() => {
  requestAnimationFrame(() => {
    isPageReady.value = true;
  });
});
</script>

<style scoped lang="scss">
.register-page {
  min-height: 100dvh;
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.register-bg {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.bg-bubble {
  position: absolute;
  border-radius: 50%;
  filter: blur(58px);
}

.bubble-a {
  width: 34vw;
  height: 34vw;
  min-width: 240px;
  min-height: 240px;
  left: -8vw;
  bottom: -10vh;
  background: radial-gradient(
    circle,
    rgba(15, 107, 255, 0.34),
    transparent 72%
  );
}

.bubble-b {
  width: 32vw;
  height: 32vw;
  min-width: 220px;
  min-height: 220px;
  right: -9vw;
  top: -8vh;
  background: radial-gradient(circle, rgba(0, 163, 137, 0.32), transparent 72%);
}

.bg-lines {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(rgba(15, 107, 255, 0.08) 1px, transparent 1px),
    linear-gradient(90deg, rgba(15, 107, 255, 0.08) 1px, transparent 1px);
  background-size: 44px 44px;
  opacity: 0.28;
  mask-image: radial-gradient(circle at center, black 30%, transparent 90%);
}

.register-shell {
  position: relative;
  z-index: 2;
  width: min(1120px, 100%);
  display: grid;
  grid-template-columns: 0.95fr 1.05fr;
  gap: 18px;
}

.policy-content {
  display: grid;
  gap: 12px;
  line-height: 1.75;
  color: var(--text-secondary);
}

.policy-content p {
  margin: 0;
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

.reveal-up {
  opacity: 0;
  transform: translateY(18px);
}

.register-page--ready .reveal-up {
  animation: register-reveal-up 0.72s cubic-bezier(0.2, 0.7, 0.1, 1) forwards;
}

.register-page--ready .reveal-delay-2 {
  animation-delay: 0.14s;
}

.register-intro,
.register-card {
  border: 1px solid var(--border-light);
  border-radius: 20px;
  box-shadow: var(--shadow-medium);
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(14px);
}

[data-theme="dark"] .register-intro,
[data-theme="dark"] .register-card {
  background: rgba(8, 22, 41, 0.78);
}

.register-intro {
  padding: 26px;
}

.intro-kicker {
  letter-spacing: 0.13em;
  color: var(--primary-color);
  font-size: 12px;
  margin-bottom: 8px;
}

.register-intro h1 {
  font-size: 30px;
  line-height: 1.1;
  margin-bottom: 10px;
}

.register-intro > p {
  color: var(--text-secondary);
  line-height: 1.7;
  margin-bottom: 16px;
}

.intro-points {
  display: grid;
  gap: 10px;
}

.point-item {
  border: 1px solid var(--border-light);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.66);
  padding: 12px;
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 10px;
  opacity: 0;
  transform: translateY(10px);
}

[data-theme="dark"] .point-item {
  background: rgba(7, 21, 39, 0.7);
}

.register-page--ready .point-item {
  animation: register-reveal-up 0.56s ease forwards;
}

.register-page--ready .point-item:nth-child(1) {
  animation-delay: 0.24s;
}

.register-page--ready .point-item:nth-child(2) {
  animation-delay: 0.32s;
}

.register-page--ready .point-item:nth-child(3) {
  animation-delay: 0.4s;
}

.point-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  margin-top: 8px;
  background: linear-gradient(
    135deg,
    var(--primary-color),
    var(--secondary-color)
  );
}

.point-item strong {
  display: block;
  margin-bottom: 3px;
  font-size: 15px;
}

.point-item p {
  font-size: 13px;
  color: var(--text-secondary);
}

.register-card {
  padding: 26px;
}

.card-header {
  margin-bottom: 16px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
}

.brand-logo {
  width: 38px;
  height: 38px;
  border-radius: 11px;
}

.card-header h2 {
  font-size: 28px;
}

.card-header p {
  color: var(--text-secondary);
}

.form-options {
  margin: 4px 0 12px;
}

.register-button {
  margin-top: 2px;
  transition:
    transform 0.18s ease,
    box-shadow 0.18s ease;
}

.register-button:hover {
  transform: translateY(-1px);
  box-shadow: 0 14px 24px rgba(15, 107, 255, 0.28);
}

.login-prompt {
  margin-top: 14px;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 6px;
  color: var(--text-secondary);
}

.login-prompt--muted {
  margin-top: 4px;
  color: var(--text-tertiary);
}

.trial-notice-text {
  margin-bottom: 6px;
  color: var(--text-secondary);
}

@keyframes register-reveal-up {
  from {
    opacity: 0;
    transform: translateY(16px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 980px) {
  .register-shell {
    grid-template-columns: 1fr;
  }

  .register-intro {
    order: 2;
  }
}

@media (max-width: 680px) {
  .register-page {
    padding: 12px;
  }

  .register-intro,
  .register-card {
    border-radius: 16px;
    padding: 18px;
  }

  .register-intro h1,
  .card-header h2 {
    font-size: 24px;
  }
}
</style>
