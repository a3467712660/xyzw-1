<template>
  <div class="not-found-page">
    <div class="container">
      <div class="error-content">
        <div class="error-visual">
          <div class="error-number">404</div>
          <div class="error-icon">
            <n-icon size="120">
              <Search></Search>
            </n-icon>
          </div>
        </div>

        <div class="error-text">
          <h1>{{ t("notFound.title") }}</h1>
          <p>{{ t("notFound.description") }}</p>
        </div>

        <div class="error-actions">
          <n-button size="large" type="primary" @click="router.push('/')">
            {{ t("notFound.actions.home") }}
          </n-button>
          <n-button size="large" @click="router.back()">
            {{ t("notFound.actions.back") }}
          </n-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { Search } from "@vicons/ionicons5";

const router = useRouter();
const { t } = useI18n();
</script>

<style scoped lang="scss">
.not-found-page {
  min-height: 100vh;
  background:
    radial-gradient(
      circle at 14% 16%,
      rgba(15, 107, 255, 0.28),
      transparent 34%
    ),
    radial-gradient(circle at 86% 82%, rgba(0, 163, 137, 0.3), transparent 36%),
    linear-gradient(135deg, #0f4fc2 0%, #0f6bff 52%, #00a389 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-lg);
}

/* 深色主题下背景 */
[data-theme="dark"] .not-found-page {
  background: linear-gradient(135deg, #0f172a 0%, #1f2937 100%);
}

.error-content {
  text-align: center;
  color: white;
  max-width: 600px;
}

.error-visual {
  position: relative;
  margin-bottom: var(--spacing-xl);
}

.error-number {
  font-size: 12rem;
  font-weight: var(--font-weight-bold);
  opacity: 0.1;
  line-height: 1;
}

.error-icon {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  opacity: 0.6;
}

.error-text {
  margin-bottom: var(--spacing-2xl);

  h1 {
    font-size: var(--font-size-3xl);
    font-weight: var(--font-weight-bold);
    margin-bottom: var(--spacing-md);
  }

  p {
    font-size: var(--font-size-lg);
    opacity: 0.9;
    margin: 0;
  }
}

.error-actions {
  display: flex;
  gap: var(--spacing-md);
  justify-content: center;
}

@media (max-width: 640px) {
  .error-number {
    font-size: 8rem;
  }

  .error-actions {
    flex-direction: column;
    align-items: center;
  }
}
</style>
