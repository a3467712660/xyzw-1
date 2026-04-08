<template>
  <div class="refine-password-panel gwb2-mini-card__stack">
    <div class="gwb2-mini-card__section-title">{{ title }}</div>
    <div class="gwb2-mini-card__list password-section">
      <div v-if="!isPasswordValidated" class="password-info">
        <span class="password-label">{{ label }}</span>
        <n-input
          size="small"
          type="password"
          :placeholder="placeholder"
          :value="password"
          @update:value="$emit('update-password', $event)"
        ></n-input>
        <n-button
          size="small"
          type="primary"
          :loading="isVerifying"
          @click="$emit('verify')"
        >
          {{ verifyText }}
        </n-button>
        <span v-if="passwordError" class="password-error">{{ passwordError }}</span>
      </div>
      <div v-else class="password-validated">
        <n-tag size="small" type="success">{{ validatedText }}</n-tag>
        <n-button
          size="small"
          type="warning"
          @click="$emit('reset')"
        >
          {{ resetText }}
        </n-button>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  isPasswordValidated: {
    type: Boolean,
    default: false,
  },
  isVerifying: {
    type: Boolean,
    default: false,
  },
  label: {
    type: String,
    default: "二级密码",
  },
  password: {
    type: String,
    default: "",
  },
  passwordError: {
    type: String,
    default: "",
  },
  placeholder: {
    type: String,
    default: "请输入二级密码",
  },
  resetText: {
    type: String,
    default: "重新验证",
  },
  title: {
    type: String,
    default: "密码验证",
  },
  validatedText: {
    type: String,
    default: "密码已验证",
  },
  verifyText: {
    type: String,
    default: "验证",
  },
});

defineEmits([
  "reset",
  "update-password",
  "verify",
]);
</script>

<style scoped lang="scss">
.password-section {
  gap: var(--spacing-sm);
}

.password-info,
.password-validated {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  flex-wrap: wrap;
}

.password-label {
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
}

.password-error {
  color: var(--color-error);
  font-size: var(--font-size-xs);
}

.password-validated {
  justify-content: space-between;
}

@media (max-width: 959px) {
  .password-info,
  .password-validated {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
