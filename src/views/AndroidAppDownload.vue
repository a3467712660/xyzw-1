<template>
  <div class="android-app-page public-brand-page">
    <div aria-hidden="true" class="android-app-page__bg public-brand-bg">
      <span class="android-app-page__orb android-app-page__orb--a public-brand-orb public-brand-orb--a"></span>
      <span class="android-app-page__orb android-app-page__orb--b public-brand-orb public-brand-orb--b"></span>
      <span class="public-brand-grid"></span>
    </div>

    <main class="android-app-page__main">
      <section class="android-app-page__hero public-brand-glass-card">
        <div class="container android-app-page__hero-inner">
          <div class="android-app-page__copy">
            <span class="android-app-page__eyebrow">
              <n-icon>
                <LogoAndroid></LogoAndroid>
              </n-icon>
              {{ t("androidAppPage.eyebrow") }}
            </span>
            <h1>{{ t("androidAppPage.title") }}</h1>
            <p class="android-app-page__subtitle">
              {{ t("androidAppPage.subtitle") }}
            </p>

            <div
              class="android-app-page__status"
              :class="{ 'android-app-page__status--pending': !downloadConfig.isConfigured }"
            >
              <n-icon>
                <component :is="downloadConfig.isConfigured ? DownloadOutline : ShieldCheckmark"></component>
              </n-icon>
              <span>
                {{
                  downloadConfig.isConfigured
                    ? t("androidAppPage.status.ready")
                    : t("androidAppPage.status.pending")
                }}
              </span>
            </div>

            <div class="android-app-page__actions">
              <n-button
                class="android-app-page__download-button"
                size="large"
                type="primary"
                :disabled="!downloadConfig.isConfigured"
                @click="handleDownload"
              >
                <template #icon>
                  <n-icon>
                    <DownloadOutline></DownloadOutline>
                  </n-icon>
                </template>
                {{ t("androidAppPage.actions.download") }}
              </n-button>
              <n-button
                ghost
                size="large"
                type="primary"
                @click="router.push('/')"
              >
                {{ t("androidAppPage.actions.backHome") }}
              </n-button>
            </div>

            <p class="android-app-page__meta">
              {{
                downloadConfig.isConfigured
                  ? t("androidAppPage.status.readyHint", { url: downloadConfig.downloadUrl })
                  : t("androidAppPage.status.unavailableHint")
              }}
            </p>
          </div>

          <div class="android-app-page__panel public-brand-soft-card">
            <div class="android-app-page__panel-head">
              <strong>{{ t("androidAppPage.panel.title") }}</strong>
              <span>{{ t("androidAppPage.panel.badge") }}</span>
            </div>

            <div class="android-app-page__feature-list">
              <article
                v-for="item in featureCards"
                :key="item.id"
                class="android-app-page__feature-item"
              >
                <div class="android-app-page__feature-icon">
                  <component :is="item.icon"></component>
                </div>
                <div>
                  <strong>{{ item.title }}</strong>
                  <p>{{ item.description }}</p>
                </div>
              </article>
            </div>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>

<script setup>
import { computed, markRaw } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { getAndroidAppDownloadConfig } from "@/utils/androidAppDownload";
import {
  DownloadOutline,
  Flash,
  LogoAndroid,
  PhonePortraitOutline,
  ShieldCheckmark,
} from "@vicons/ionicons5";

const router = useRouter();
const { t } = useI18n();

const downloadConfig = computed(() => getAndroidAppDownloadConfig(import.meta.env));
const featureCards = computed(() => [
  {
    id: "native",
    icon: markRaw(PhonePortraitOutline),
    title: t("androidAppPage.features.native.title"),
    description: t("androidAppPage.features.native.description"),
  },
  {
    id: "session",
    icon: markRaw(ShieldCheckmark),
    title: t("androidAppPage.features.session.title"),
    description: t("androidAppPage.features.session.description"),
  },
  {
    id: "sync",
    icon: markRaw(Flash),
    title: t("androidAppPage.features.sync.title"),
    description: t("androidAppPage.features.sync.description"),
  },
]);

const handleDownload = () => {
  if (!downloadConfig.value.isConfigured || typeof window === "undefined") {
    return;
  }

  if (downloadConfig.value.isExternal) {
    window.open(downloadConfig.value.downloadUrl, "_blank", "noopener,noreferrer");
    return;
  }

  window.location.assign(downloadConfig.value.downloadUrl);
};
</script>

<style scoped lang="scss">
.android-app-page {
  min-height: 100dvh;
  position: relative;
  overflow: clip;
}

.android-app-page__bg {
  position: fixed;
  inset: 0;
  pointer-events: none;
}

.android-app-page__orb--a {
  left: -8vw;
  top: 6vh;
}

.android-app-page__orb--b {
  right: -8vw;
  top: -4vh;
}

.android-app-page__main {
  position: relative;
  z-index: 1;
  padding: 48px 0 64px;
}

.android-app-page__hero {
  margin: 0 auto;
  width: min(1180px, calc(100% - 32px));
}

.android-app-page__hero-inner {
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(320px, 0.95fr);
  gap: 28px;
  align-items: stretch;
  padding: 40px 0;
}

.android-app-page__copy {
  display: grid;
  align-content: center;
  gap: 16px;
  min-width: 0;
}

.android-app-page__eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  width: fit-content;
  padding: 8px 14px;
  border-radius: 999px;
  border: 1px solid rgba(15, 107, 255, 0.18);
  background: rgba(255, 255, 255, 0.72);
  color: var(--primary-color);
  font-size: 13px;
  font-weight: 600;
}

[data-theme="dark"] .android-app-page__eyebrow {
  background: rgba(9, 22, 40, 0.76);
}

.android-app-page__eyebrow :deep(svg) {
  width: 16px;
  height: 16px;
}

.android-app-page h1 {
  margin: 0;
  font-size: clamp(2rem, 4vw, 3.4rem);
  line-height: 1;
  letter-spacing: -0.03em;
}

.android-app-page__subtitle {
  margin: 0;
  max-width: 640px;
  color: var(--text-secondary);
  line-height: 1.72;
}

.android-app-page__status {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  width: fit-content;
  padding: 10px 14px;
  border-radius: 999px;
  background: rgba(15, 107, 255, 0.12);
  border: 1px solid rgba(15, 107, 255, 0.18);
  color: var(--primary-color);
  font-weight: 600;
}

.android-app-page__status--pending {
  background: rgba(148, 163, 184, 0.14);
  border-color: rgba(148, 163, 184, 0.22);
  color: var(--text-secondary);
}

.android-app-page__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.android-app-page__download-button {
  min-width: 220px;
}

.android-app-page__meta {
  margin: 0;
  color: var(--text-secondary);
  font-size: 14px;
  line-height: 1.65;
  word-break: break-word;
}

.android-app-page__panel {
  display: grid;
  gap: 18px;
  align-content: start;
  padding: 24px;
}

.android-app-page__panel-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 14px;
}

.android-app-page__panel-head strong {
  font-size: 18px;
}

.android-app-page__panel-head span {
  padding: 8px 12px;
  border-radius: 999px;
  background: rgba(15, 107, 255, 0.1);
  color: var(--primary-color);
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

.android-app-page__feature-list {
  display: grid;
  gap: 12px;
}

.android-app-page__feature-item {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 14px;
  align-items: start;
  padding: 16px;
  border-radius: 18px;
  border: 1px solid rgba(15, 107, 255, 0.14);
  background: rgba(255, 255, 255, 0.66);
}

[data-theme="dark"] .android-app-page__feature-item {
  background: rgba(8, 19, 34, 0.72);
}

.android-app-page__feature-icon {
  width: 46px;
  height: 46px;
  display: grid;
  place-items: center;
  border-radius: 14px;
  color: #fff;
  background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
}

.android-app-page__feature-icon :deep(svg) {
  width: 22px;
  height: 22px;
}

.android-app-page__feature-item strong {
  display: block;
  margin-bottom: 6px;
  font-size: 15px;
}

.android-app-page__feature-item p {
  margin: 0;
  color: var(--text-secondary);
  line-height: 1.65;
  font-size: 14px;
}

@media (max-width: 960px) {
  .android-app-page__hero-inner {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 680px) {
  .android-app-page__main {
    padding: 20px 0 40px;
  }

  .android-app-page__hero {
    width: min(100%, calc(100% - 20px));
  }

  .android-app-page__hero-inner {
    gap: 18px;
    padding: 22px 0;
  }

  .android-app-page__actions {
    flex-direction: column;
  }

  .android-app-page__download-button,
  .android-app-page__actions :deep(.n-button) {
    width: 100%;
  }

  .android-app-page__panel {
    padding: 18px;
  }

  .android-app-page__panel-head {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
