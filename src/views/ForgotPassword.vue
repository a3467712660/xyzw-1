<template>
  <div
    class="public-support-page support-recovery-page"
    :class="{ 'public-support-page--ready': isPageReady }"
  >
    <div aria-hidden="true" class="public-support-page__backdrop"></div>

    <div class="public-support-container">
      <div class="public-support-shell">
        <aside class="public-support-side public-support-reveal">
          <div class="public-support-brand">
            <img alt="XYZW" src="/icons/xiaoyugan.png">
            <div class="public-support-brand__meta">
              <span class="public-support-eyebrow">账号恢复</span>
              <strong>XYZW</strong>
              <span class="support-recovery-page__brand-sub">
                {{ t("homePage.brandSubtitle") }}
              </span>
            </div>
          </div>

          <div class="support-recovery-page__hero-copy">
            <h1 class="public-support-title">{{ t("forgotPassword.title") }}</h1>
            <p class="public-support-description">{{ t("forgotPassword.subtitle") }}</p>
          </div>

          <div class="public-support-step-list">
            <article
              v-for="(item, index) in recoverySteps"
              :key="item"
              class="public-support-step"
            >
              <span class="public-support-step__index">{{ index + 1 }}</span>
              <div class="public-support-step__content">{{ item }}</div>
            </article>
          </div>

          <div class="public-support-meta-grid">
            <div
              v-for="item in recoveryMeta"
              :key="item.label"
              class="public-support-meta-card"
            >
              <span>{{ item.label }}</span>
              <strong>{{ item.value }}</strong>
            </div>
          </div>
        </aside>

        <section class="public-support-panel public-support-reveal public-support-reveal--delay">
          <header class="support-recovery-page__panel-head">
            <div>
              <span class="public-support-eyebrow">短码重置</span>
              <h2 class="support-recovery-page__panel-title">
                {{ t("forgotPassword.cardTitle") }}
              </h2>
              <p class="public-support-description">
                {{ t("forgotPassword.cardDesc") }}
              </p>
            </div>
          </header>

          <div class="public-support-note">
            <strong>恢复提示：</strong>
            输入账号标识、短码和新密码后即可直接重置，处理完成后返回登录页。
          </div>

          <n-form
            ref="formRef"
            class="support-recovery-page__form"
            label-placement="top"
            size="large"
            :aria-busy="authStore.isLoading ? 'true' : 'false'"
            :model="form"
            :rules="rules"
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

            <n-form-item
              path="identity"
              :label="t('forgotPassword.placeholders.identity')"
            >
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

            <n-form-item
              path="shortCode"
              :label="t('forgotPassword.placeholders.shortCode')"
            >
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

            <div class="support-recovery-page__form-grid">
              <n-form-item
                path="newPassword"
                :label="t('forgotPassword.placeholders.newPassword')"
              >
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

              <n-form-item
                path="confirmPassword"
                :label="t('forgotPassword.placeholders.confirmPassword')"
              >
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
            </div>

            <div class="public-support-actions support-recovery-page__actions">
              <n-button
                block
                class="support-recovery-page__submit"
                size="large"
                type="primary"
                :aria-disabled="authStore.isLoading ? 'true' : 'false'"
                :loading="authStore.isLoading"
                @click="handleSubmit"
              >
                {{ t("forgotPassword.actions.submit") }}
              </n-button>
            </div>
          </n-form>

          <div class="support-recovery-page__footer">
            <n-button text type="primary" @click="router.push('/login')">
              {{ t("forgotPassword.actions.backToLogin") }}
            </n-button>
            <n-button text @click="router.push('/register')">
              {{ t("forgotPassword.actions.register") }}
            </n-button>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, reactive, ref } from "vue";
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

const recoverySteps = computed(() => [
  t("forgotPassword.steps.contactAdmin"),
  t("forgotPassword.steps.getCode"),
  t("forgotPassword.steps.reset"),
]);

const recoveryMeta = computed(() => [
  {
    label: "密码规则",
    value: "至少 12 位",
  },
  {
    label: "短码来源",
    value: "管理员提供",
  },
  {
    label: "完成后",
    value: "返回登录",
  },
]);

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
      await announceFormError(
        result.message || t("forgotPassword.messages.resetFailed"),
        "identity",
      );
      message.error(result.message || t("forgotPassword.messages.resetFailed"));
      return;
    }

    formErrorMessage.value = "";
    message.success(result.message || t("forgotPassword.messages.resetSuccess"));
    router.push("/login");
  } catch (error) {
    await announceFormError(
      t("forgotPassword.validation.identityRequired"),
      "identity",
    );
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
.support-recovery-page.public-support-page {
  .public-support-shell {
    gap: 18px;
  }

  .public-support-side,
  .public-support-panel {
    border-radius: 30px;
  }

  .support-recovery-page__panel-head {
    gap: 10px;
  }

  .support-recovery-page__footer {
    padding-top: 6px;
    border-top: 1px solid var(--console-divider);
  }
}

.support-recovery-page__brand-sub {
  color: var(--text-tertiary);
  font-size: 13px;
}

.support-recovery-page__hero-copy {
  display: grid;
  gap: 10px;
}

.support-recovery-page__panel-head {
  display: grid;
  gap: 8px;
}

.support-recovery-page__panel-title {
  margin: 0;
  color: var(--text-primary);
  font-size: clamp(26px, 2.6vw, 34px);
  line-height: 1.08;
}

.support-recovery-page__form {
  display: grid;
  gap: 6px;
}

.support-recovery-page__form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.support-recovery-page__actions {
  margin-top: 4px;
}

.support-recovery-page__submit {
  min-height: 48px;
}

.support-recovery-page__footer {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.support-recovery-page :deep(.n-form-item-label__text) {
  font-weight: 600;
  color: var(--text-primary);
}

.support-recovery-page :deep(.n-input .n-input-wrapper) {
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
  .support-recovery-page__form-grid {
    grid-template-columns: 1fr;
  }

  .support-recovery-page__footer {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
