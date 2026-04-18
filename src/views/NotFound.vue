<template>
  <div class="public-support-page not-found-page">
    <div aria-hidden="true" class="public-support-page__backdrop"></div>

    <div class="public-support-container public-support-container--narrow">
      <div class="public-support-shell public-support-shell--single">
        <section class="public-support-panel not-found-page__panel">
          <div class="not-found-page__visual">
            <div class="not-found-page__code">404</div>
            <div class="not-found-page__icon">
              <n-icon size="56">
                <Search></Search>
              </n-icon>
            </div>
          </div>

          <span class="public-support-eyebrow">页面未找到</span>
          <h1 class="public-support-title">{{ t("notFound.title") }}</h1>
          <p class="public-support-description">{{ t("notFound.description") }}</p>

          <div class="public-support-meta-grid">
            <div class="public-support-meta-card">
              <span>请求路径</span>
              <strong>{{ currentPath }}</strong>
            </div>
            <div class="public-support-meta-card">
              <span>建议处理</span>
              <strong>返回上一页或首页</strong>
            </div>
          </div>

          <div class="public-support-note">
            <strong>可能原因：</strong>
            链接已失效、路径输入错误，或目标页面已经迁移。
          </div>

          <div class="public-support-actions not-found-page__actions">
            <n-button size="large" type="primary" @click="router.push('/')">
              {{ t("notFound.actions.home") }}
            </n-button>
            <n-button size="large" @click="handleBack">
              {{ t("notFound.actions.back") }}
            </n-button>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { Search } from "@vicons/ionicons5";

const route = useRoute();
const router = useRouter();
const { t } = useI18n();

const currentPath = computed(() => String(route.fullPath || "/"));

const handleBack = () => {
  if (window.history.length > 1) {
    router.back();
    return;
  }
  router.push("/");
};
</script>

<style scoped lang="scss">
.not-found-page.public-support-page {
  .public-support-panel {
    border-radius: 30px;
  }
}

.not-found-page__panel {
  text-align: center;
  justify-items: center;
}

.not-found-page__visual {
  position: relative;
  display: grid;
  place-items: center;
  width: 100%;
}

.not-found-page__code {
  font-size: clamp(96px, 16vw, 160px);
  font-weight: 800;
  line-height: 0.9;
  color: rgba(15, 107, 255, 0.12);
  letter-spacing: -0.06em;
}

.not-found-page__icon {
  position: absolute;
  display: grid;
  place-items: center;
  width: 88px;
  height: 88px;
  border-radius: 24px;
  background: var(--console-panel);
  border: 1px solid var(--surface-glass-border);
  color: var(--primary-color);
  box-shadow: var(--shadow-light);
}

.not-found-page__actions {
  justify-content: center;
}

@media (max-width: 640px) {
  .not-found-page__actions {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
