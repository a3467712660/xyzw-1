<template>
  <div class="home-page public-brand-page" :class="{ 'home-page--ready': isPageReady }">
    <div aria-hidden="true" class="home-bg public-brand-bg">
      <span class="bg-orb orb-a public-brand-orb public-brand-orb--a"></span>
      <span class="bg-orb orb-b public-brand-orb public-brand-orb--b"></span>
      <span class="bg-orb orb-c public-brand-orb public-brand-orb--c"></span>
      <span class="grid-mask public-brand-grid"></span>
    </div>

    <nav class="navbar">
      <div class="container nav-content">
        <div class="nav-brand" @click="router.push('/')">
          <img alt="XYZW" class="brand-logo" src="/icons/xiaoyugan.png">
          <div class="brand-copy">
            <strong>XYZW</strong>
            <span>{{ t("homePage.brandSubtitle") }}</span>
          </div>
        </div>

        <div class="mobile-menu-button">
          <n-button text @click="isMobileMenuOpen = true">
            <n-icon>
              <Menu></Menu>
            </n-icon>
          </n-button>
        </div>

        <div class="nav-actions">
          <template v-if="!authStore.isAuthenticated">
            <n-button quaternary type="primary" @click="router.push('/android-app')">
              {{ t("homePage.nav.androidApp") }}
            </n-button>
            <n-button quaternary type="primary" @click="router.push('/pricing')">
              {{ t("homePage.nav.pricing") }}
            </n-button>
            <n-button ghost type="primary" @click="router.push('/login')">
              {{ t("homePage.actions.login") }}
            </n-button>
            <n-button type="primary" @click="router.push('/register')">
              {{ t("homePage.actions.registerNow") }}
            </n-button>
          </template>
          <template v-else>
            <n-button quaternary type="primary" @click="router.push('/android-app')">
              {{ t("homePage.nav.androidApp") }}
            </n-button>
            <n-button type="primary" @click="router.push('/admin/dashboard')">
              {{ t("homePage.actions.enterDashboard") }}
            </n-button>
          </template>
        </div>
      </div>
    </nav>

    <n-drawer
      placement="left"
      style="width: 280px"
      v-model:show="isMobileMenuOpen"
    >
      <div class="drawer-menu">
        <template v-if="!authStore.isAuthenticated">
          <button class="drawer-item drawer-item--button" type="button" @click="closeDrawerAndScrollTop">
            <n-icon><Ribbon></Ribbon></n-icon>
            <span>{{ t("homePage.nav.home") }}</span>
          </button>
          <button class="drawer-item drawer-item--button" type="button" @click="closeDrawerAndScrollToFeatures">
            <n-icon><Cube></Cube></n-icon>
            <span>{{ t("homePage.nav.features") }}</span>
          </button>
          <button class="drawer-item drawer-item--button" type="button" @click="closeDrawerAndScrollToSecurity">
            <n-icon><LockClosed></LockClosed></n-icon>
            <span>{{ t("homePage.nav.security") }}</span>
          </button>
          <router-link
            class="drawer-item"
            to="/android-app"
            @click="isMobileMenuOpen = false"
          >
            <n-icon><LogoAndroid></LogoAndroid></n-icon>
            <span>{{ t("homePage.nav.androidApp") }}</span>
          </router-link>
          <router-link
            class="drawer-item"
            to="/pricing"
            @click="isMobileMenuOpen = false"
          >
            <n-icon><Pricetag></Pricetag></n-icon>
            <span>{{ t("homePage.nav.pricing") }}</span>
          </router-link>
          <router-link
            class="drawer-item"
            to="/changelog"
            @click="isMobileMenuOpen = false"
          >
            <n-icon><DocumentText></DocumentText></n-icon>
            <span>{{ t("homePage.nav.changelog") }}</span>
          </router-link>
          <n-button
            block
            type="primary"
            @click="
              router.push('/login');
              isMobileMenuOpen = false;
            "
          >
            {{ t("homePage.actions.login") }}
          </n-button>
          <n-button
            block
            ghost
            type="primary"
            @click="
              router.push('/register');
              isMobileMenuOpen = false;
            "
          >
            {{ t("homePage.actions.registerNow") }}
          </n-button>
        </template>
        <template v-else>
          <router-link
            class="drawer-item"
            to="/"
            @click="isMobileMenuOpen = false"
          >
            <n-icon><Ribbon></Ribbon></n-icon>
            <span>{{ t("homePage.nav.home") }}</span>
          </router-link>
          <router-link
            class="drawer-item"
            to="/admin/dashboard"
            @click="isMobileMenuOpen = false"
          >
            <n-icon><Speedometer></Speedometer></n-icon>
            <span>{{ t("homePage.nav.dashboard") }}</span>
          </router-link>
          <router-link
            class="drawer-item"
            to="/admin/game-features"
            @click="isMobileMenuOpen = false"
          >
            <n-icon><Cube></Cube></n-icon>
            <span>{{ t("homePage.nav.features") }}</span>
          </router-link>
          <router-link
            class="drawer-item"
            to="/tokens"
            @click="isMobileMenuOpen = false"
          >
            <n-icon><PersonCircle></PersonCircle></n-icon>
            <span>{{ t("homePage.nav.tokens") }}</span>
          </router-link>
          <router-link
            class="drawer-item"
            to="/android-app"
            @click="isMobileMenuOpen = false"
          >
            <n-icon><LogoAndroid></LogoAndroid></n-icon>
            <span>{{ t("homePage.nav.androidApp") }}</span>
          </router-link>
          <router-link
            class="drawer-item"
            to="/changelog"
            @click="isMobileMenuOpen = false"
          >
            <n-icon><DocumentText></DocumentText></n-icon>
            <span>{{ t("homePage.nav.changelog") }}</span>
          </router-link>
        </template>
      </div>
    </n-drawer>

    <main
      class="main-content"
      :class="{
        'main-content--with-trial': authStore.isAuthenticated && hasTrialExpiry,
      }"
    >
      <section
        v-if="authStore.isAuthenticated && hasTrialExpiry"
        class="trial-banner-wrap"
      >
        <div class="container">
          <div
            class="trial-banner"
            :class="{ 'trial-banner--expired': isTrialExpired }"
          >
            <div class="trial-banner__item">
              <span class="trial-banner__label">{{ t("homePage.trial.expiry") }}</span>
              <strong class="trial-banner__value">{{
                trialExpiresAtText
              }}</strong>
            </div>
            <div class="trial-banner__item">
              <span class="trial-banner__label">{{ t("homePage.trial.countdown") }}</span>
              <strong class="trial-banner__value">{{
                trialCountdownText
              }}</strong>
            </div>
          </div>
        </div>
      </section>

      <section class="hero-section">
        <div class="container hero-shell">
          <div class="hero-text reveal-up">
            <h1 class="hero-title">{{ t("homePage.hero.title") }}</h1>
            <p class="hero-subtitle">
              {{ t("homePage.hero.subtitle") }}
            </p>
            <div class="hero-actions">
              <n-button
                class="hero-button"
                size="large"
                type="primary"
                @click="
                  router.push(
                    authStore.isAuthenticated
                      ? '/admin/dashboard'
                      : '/register',
                  )
                "
              >
                {{
                  authStore.isAuthenticated
                    ? t("homePage.actions.enterDashboard")
                    : t("homePage.actions.registerNow")
                }}
              </n-button>
              <n-button
                ghost
                size="large"
                type="primary"
                @click="scrollToFeatures"
              >
                {{ t("homePage.actions.viewCapabilities") }}
              </n-button>
            </div>
            <div class="hero-trust-strip">
              <div
                v-for="item in trustPoints"
                :key="item.id"
                class="trust-pill"
              >
                <n-icon>
                  <component :is="item.icon"></component>
                </n-icon>
                <span>{{ item.label }}</span>
              </div>
            </div>
            <div class="hero-download-card public-brand-soft-card">
              <div class="hero-download-card__icon">
                <n-icon>
                  <LogoAndroid></LogoAndroid>
                </n-icon>
              </div>
              <div class="hero-download-card__copy">
                <span>{{ t("homePage.hero.androidAppKicker") }}</span>
                <strong>{{ t("homePage.hero.androidAppTitle") }}</strong>
                <p>{{ t("homePage.hero.androidAppDescription") }}</p>
              </div>
              <n-button
                quaternary
                class="hero-download-card__action"
                type="primary"
                @click="router.push('/android-app')"
              >
                {{ t("homePage.actions.downloadAndroidApp") }}
              </n-button>
            </div>
          </div>

          <div class="hero-panel reveal-up reveal-delay-2">
            <div class="mockup-window public-brand-glass-card">
              <div class="mockup-topbar">
                <div class="mockup-dots">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
                <div class="mockup-pill">{{ t("homePage.panel.liveSync") }}</div>
              </div>
              <div class="mockup-body">
                <aside class="mockup-sidebar">
                  <div class="mockup-brand">
                    <img alt="XYZW" src="/icons/xiaoyugan.png">
                    <strong>XYZW</strong>
                  </div>
                  <div class="mockup-nav">
                    <div
                      v-for="card in featureCards"
                      :key="card.id"
                      class="mockup-nav__item"
                    >
                      <div class="mockup-nav__icon">
                        <component :is="card.icon"></component>
                      </div>
                      <div>
                        <strong>{{ card.title }}</strong>
                        <span>{{ card.description }}</span>
                      </div>
                    </div>
                  </div>
                </aside>

                <div class="mockup-main">
                  <div class="mockup-summary">
                    <div class="mockup-summary__copy">
                      <span>{{ t("homePage.panel.title") }}</span>
                      <strong>{{ t("homePage.mockup.title") }}</strong>
                      <p>{{ t("homePage.mockup.subtitle") }}</p>
                    </div>
                    <div class="mockup-summary__badge">{{ t("homePage.mockup.badge") }}</div>
                  </div>

                  <div class="mockup-highlights">
                    <article
                      v-for="item in mockupHighlights"
                      :key="item.id"
                      class="mockup-highlight"
                    >
                      <span>{{ item.kicker }}</span>
                      <strong>{{ item.title }}</strong>
                      <p>{{ item.description }}</p>
                    </article>
                  </div>

                  <div class="mockup-activity">
                    <div class="mockup-section-title">{{ t("homePage.mockup.activityTitle") }}</div>
                    <div
                      v-for="item in workflowSteps"
                      :key="item.id"
                      class="mockup-activity__item"
                    >
                      <span class="mockup-activity__step">{{ item.step }}</span>
                      <div>
                        <strong>{{ item.title }}</strong>
                        <p>{{ item.description }}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="workflow-section">
        <div class="container">
          <div class="section-header">
            <h2 class="section-title">{{ t("homePage.workflow.sectionTitle") }}</h2>
            <p class="section-subtitle">
              {{ t("homePage.workflow.sectionSubtitle") }}
            </p>
          </div>

          <div class="workflow-grid">
            <article
              v-for="item in workflowSteps"
              :key="item.id"
              class="workflow-card public-brand-soft-card"
            >
              <span class="workflow-card__step">{{ item.step }}</span>
              <h3>{{ item.title }}</h3>
              <p>{{ item.description }}</p>
            </article>
          </div>
        </div>
      </section>

      <section ref="securitySection" class="security-section">
        <div class="container security-shell">
          <div class="security-layout">
            <div class="security-grid">
              <article
                v-for="item in securityCards"
                :key="item.id"
                class="security-card public-brand-soft-card"
              >
                <div class="security-card__icon">
                  <component :is="item.icon"></component>
                </div>
                <div class="security-card__copy">
                  <h3>{{ item.title }}</h3>
                  <p>{{ item.description }}</p>
                </div>
              </article>
            </div>
          </div>
        </div>
      </section>

      <section ref="featuresSection" class="features-section">
        <div class="container">
          <div class="section-header">
            <h2 class="section-title">{{ t("homePage.sections.featuresTitle") }}</h2>
            <p class="section-subtitle">
              {{ t("homePage.sections.featuresSubtitle") }}
            </p>
          </div>

          <div class="features-grid">
            <article
              v-for="feature in features"
              :key="feature.id"
              class="feature-item public-brand-soft-card"
            >
              <div class="feature-icon">
                <component :is="feature.icon"></component>
              </div>
              <h3 class="feature-title">{{ feature.title }}</h3>
              <p class="feature-description">{{ feature.description }}</p>
            </article>
          </div>
        </div>
      </section>
    </main>

    <footer class="footer">
      <div class="container footer-content">
        <div class="footer-brand">
          <img alt="XYZW" class="footer-logo" src="/icons/xiaoyugan.png">
          <span>{{ t("homePage.footer.brand") }}</span>
        </div>
        <div class="footer-links">
          <router-link
            class="footer-link"
            to="/android-app"
          >
            {{ t("homePage.nav.androidApp") }}
          </router-link>
          <router-link
            class="footer-link"
            to="/changelog"
          >
            {{ t("homePage.nav.changelog") }}
          </router-link>
        </div>
      </div>
      <div class="container footer-bottom">
        <span>© 2026 XYZW. All rights reserved.</span>
        <span v-if="buildFingerprint" class="footer-build">{{ buildFingerprint }}</span>
      </div>
    </footer>
  </div>
</template>

<script setup>
import { computed, markRaw, nextTick, onMounted, onUnmounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import {
  Cube,
  DocumentText,
  Flash,
  Key,
  LockClosed,
  LogoAndroid,
  Menu,
  PersonCircle,
  Pricetag,
  Ribbon,
  Server,
  Settings,
  ShieldCheckmark,
  Speedometer,
} from "@vicons/ionicons5";

const router = useRouter();
const authStore = useAuthStore();
const { locale, t } = useI18n();
const featuresSection = ref(null);
const securitySection = ref(null);
const isMobileMenuOpen = ref(false);
const nowTs = ref(Date.now());
const isPageReady = ref(false);
let countdownTimer = null;
const buildFingerprint = computed(() => {
  const appVersion = String(import.meta.env.VITE_APP_VERSION || "").trim();
  const gitSha = String(import.meta.env.VITE_BUILD_GIT_SHA || "").trim();
  const buildId = String(import.meta.env.VITE_BUILD_ID || "").trim();
  const buildTime = String(import.meta.env.VITE_BUILD_TIME || "").trim();
  const shortSha = gitSha ? gitSha.slice(0, 8) : "";
  const buildTimeTs = buildTime ? new Date(buildTime).getTime() : Number.NaN;
  const parts = [
    appVersion ? `v${appVersion}` : "",
    shortSha ? `sha ${shortSha}` : "",
    buildId ? `build ${buildId}` : "",
    Number.isFinite(buildTimeTs) ? new Date(buildTimeTs).toLocaleString(locale.value) : "",
  ].filter(Boolean);
  return parts.join(" · ");
});

const trialExpiresAtTs = computed(() => {
  const value = authStore.user?.trialExpiresAt;
  const ts = value ? new Date(value).getTime() : Number.NaN;
  return Number.isFinite(ts) ? ts : Number.NaN;
});
const hasTrialExpiry = computed(() => Number.isFinite(trialExpiresAtTs.value));
const isTrialExpired = computed(
  () => hasTrialExpiry.value && trialExpiresAtTs.value <= nowTs.value,
);
const trialExpiresAtText = computed(() =>
  hasTrialExpiry.value
    ? new Date(trialExpiresAtTs.value).toLocaleString(locale.value)
    : t("homePage.common.dash"),
);
const trialCountdownText = computed(() => {
  if (!hasTrialExpiry.value)
    return t("homePage.common.dash");
  const diff = trialExpiresAtTs.value - nowTs.value;
  if (diff <= 0)
    return t("homePage.trial.expired");

  const day = 24 * 60 * 60 * 1000;
  const hour = 60 * 60 * 1000;
  const minute = 60 * 1000;
  const days = Math.floor(diff / day);
  const hours = Math.floor((diff % day) / hour);
  const minutes = Math.floor((diff % hour) / minute);
  const seconds = Math.floor((diff % minute) / 1000);
  return t("homePage.trial.countdownValue", {
    days,
    hours,
    minutes,
    seconds,
  });
});

const featureCards = computed(() => [
  {
    id: 1,
    icon: markRaw(PersonCircle),
    title: t("homePage.cards.roleHub.title"),
    description: t("homePage.cards.roleHub.description"),
  },
  {
    id: 2,
    icon: markRaw(Flash),
    title: t("homePage.cards.smartTasks.title"),
    description: t("homePage.cards.smartTasks.description"),
  },
  {
    id: 3,
    icon: markRaw(Ribbon),
    title: t("homePage.cards.snapshots.title"),
    description: t("homePage.cards.snapshots.description"),
  },
]);

const workflowSteps = computed(() => [
  {
    id: 1,
    step: "01",
    title: t("homePage.workflow.import.title"),
    description: t("homePage.workflow.import.description"),
  },
  {
    id: 2,
    step: "02",
    title: t("homePage.workflow.activate.title"),
    description: t("homePage.workflow.activate.description"),
  },
  {
    id: 3,
    step: "03",
    title: t("homePage.workflow.execute.title"),
    description: t("homePage.workflow.execute.description"),
  },
]);

const features = computed(() => [
  {
    id: 1,
    icon: markRaw(PersonCircle),
    title: t("homePage.features.roleManagement.title"),
    description: t("homePage.features.roleManagement.description"),
  },
  {
    id: 2,
    icon: markRaw(Cube),
    title: t("homePage.features.taskAutomation.title"),
    description: t("homePage.features.taskAutomation.description"),
  },
  {
    id: 3,
    icon: markRaw(Ribbon),
    title: t("homePage.features.analytics.title"),
    description: t("homePage.features.analytics.description"),
  },
  {
    id: 4,
    icon: markRaw(Settings),
    title: t("homePage.features.personalization.title"),
    description: t("homePage.features.personalization.description"),
  },
]);

const trustPoints = computed(() => [
  { id: 1, icon: markRaw(ShieldCheckmark), label: t("homePage.trust.sessionIsolation") },
  { id: 2, icon: markRaw(LockClosed), label: t("homePage.trust.mfaStepUp") },
  { id: 3, icon: markRaw(Key), label: t("homePage.trust.secretSplit") },
]);

const securityCards = computed(() => [
  {
    id: 1,
    icon: markRaw(LockClosed),
    title: t("homePage.security.items.mfa.title"),
    description: t("homePage.security.items.mfa.description"),
  },
  {
    id: 2,
    icon: markRaw(Key),
    title: t("homePage.security.items.codes.title"),
    description: t("homePage.security.items.codes.description"),
  },
  {
    id: 3,
    icon: markRaw(Server),
    title: t("homePage.security.items.runtime.title"),
    description: t("homePage.security.items.runtime.description"),
  },
  {
    id: 4,
    icon: markRaw(ShieldCheckmark),
    title: t("homePage.security.items.csp.title"),
    description: t("homePage.security.items.csp.description"),
  },
]);

const mockupHighlights = computed(() => [
  {
    id: 1,
    kicker: t("homePage.mockup.items.stepUp.kicker"),
    title: t("homePage.mockup.items.stepUp.title"),
    description: t("homePage.mockup.items.stepUp.description"),
  },
  {
    id: 2,
    kicker: t("homePage.mockup.items.codes.kicker"),
    title: t("homePage.mockup.items.codes.title"),
    description: t("homePage.mockup.items.codes.description"),
  },
  {
    id: 3,
    kicker: t("homePage.mockup.items.audit.kicker"),
    title: t("homePage.mockup.items.audit.title"),
    description: t("homePage.mockup.items.audit.description"),
  },
]);

const scrollToFeatures = () => {
  if (featuresSection.value) {
    featuresSection.value.scrollIntoView({ behavior: "smooth" });
  }
};

const scrollToSecurity = () => {
  if (securitySection.value) {
    securitySection.value.scrollIntoView({ behavior: "smooth" });
  }
};

const closeDrawerAndScrollTop = () => {
  isMobileMenuOpen.value = false;
  window.scrollTo({ top: 0, behavior: "smooth" });
};

const closeDrawerAndScrollToFeatures = () => {
  isMobileMenuOpen.value = false;
  scrollToFeatures();
};

const closeDrawerAndScrollToSecurity = () => {
  isMobileMenuOpen.value = false;
  scrollToSecurity();
};

onMounted(async () => {
  authStore.initAuth();
  countdownTimer = setInterval(() => {
    nowTs.value = Date.now();
  }, 1000);
  await nextTick();
  requestAnimationFrame(() => {
    setTimeout(() => {
      isPageReady.value = true;
    }, 60);
  });
});

onUnmounted(() => {
  if (countdownTimer) {
    clearInterval(countdownTimer);
    countdownTimer = null;
  }
});
</script>

<style scoped lang="scss">
.home-page {
  min-height: 100dvh;
  color: var(--text-primary);
  position: relative;
  overflow: clip;
  isolation: isolate;
}

.home-page--ready {
  animation: home-shell-in 0.58s cubic-bezier(0.2, 0.7, 0.1, 1) both;
}

[data-theme="dark"] .home-page--ready {
  animation: home-shell-in-dark 0.72s cubic-bezier(0.18, 0.72, 0.08, 1) both;
}

.home-bg {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 0;
}

.bg-orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(72px);
  opacity: 0.76;
}

.orb-a {
  width: 34vw;
  height: 34vw;
  min-width: 260px;
  min-height: 260px;
  left: -8vw;
  top: 10vh;
  background: radial-gradient(
    circle,
    rgba(15, 107, 255, 0.36),
    transparent 72%
  );
  animation: orb-float-a 20s ease-in-out infinite alternate;
}

.orb-b {
  width: 30vw;
  height: 30vw;
  min-width: 220px;
  min-height: 220px;
  right: -6vw;
  top: -2vh;
  background: radial-gradient(circle, rgba(0, 163, 137, 0.32), transparent 72%);
  animation: orb-float-b 24s ease-in-out infinite alternate;
}

.orb-c {
  width: 28vw;
  height: 28vw;
  min-width: 200px;
  min-height: 200px;
  left: 36%;
  bottom: -18vh;
  background: radial-gradient(
    circle,
    rgba(51, 102, 255, 0.24),
    transparent 74%
  );
  animation: orb-float-c 26s ease-in-out infinite;
}

.grid-mask {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(to right, rgba(15, 107, 255, 0.07) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(15, 107, 255, 0.07) 1px, transparent 1px);
  background-size: 48px 48px;
  mask-image: linear-gradient(to bottom, rgba(0, 0, 0, 0.36), transparent 78%);
}

.navbar,
.main-content,
.footer {
  position: relative;
  z-index: 2;
}

.navbar {
  position: sticky;
  top: 0;
  backdrop-filter: blur(18px);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.18), transparent 100%),
    rgba(248, 251, 255, 0.76);
  border-bottom: 1px solid var(--console-divider);
}

[data-theme="dark"] .navbar {
  background:
    linear-gradient(180deg, rgba(96, 165, 250, 0.04), transparent 100%),
    rgba(7, 20, 38, 0.78);
}

.nav-content {
  min-height: 76px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-md);
}

.nav-brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
}

.brand-logo {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  box-shadow: var(--shadow-light);
}

.brand-copy {
  display: flex;
  flex-direction: column;
  line-height: 1.05;
}

.brand-copy strong {
  letter-spacing: 0.06em;
  font-size: 15px;
}

.brand-copy span {
  color: var(--text-secondary);
  font-size: 13px;
}

.nav-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.mobile-menu-button {
  display: none;
}

.drawer-menu {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: var(--spacing-md);
}

.drawer-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 10px;
  color: var(--text-secondary);
  border: 1px solid transparent;
}

.drawer-item--button {
  background: none;
  font: inherit;
  text-align: left;
  border: 1px solid transparent;
  cursor: pointer;
}

.drawer-item.router-link-active {
  background: rgba(15, 107, 255, 0.12);
  border-color: rgba(15, 107, 255, 0.2);
  color: var(--primary-color);
}

.drawer-actions {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.main-content {
  padding-bottom: 40px;
}

.trial-banner-wrap {
  padding-top: 18px;
}

.trial-banner {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--spacing-md);
  border: 1px solid rgba(15, 107, 255, 0.2);
  border-radius: 20px;
  padding: var(--spacing-md);
  background:
    linear-gradient(135deg, rgba(15, 107, 255, 0.16), rgba(20, 184, 166, 0.08)),
    var(--surface-glass-strong);
  backdrop-filter: blur(14px);
  box-shadow: var(--shadow-light);
}

[data-theme="dark"] .trial-banner {
  background:
    linear-gradient(135deg, rgba(15, 107, 255, 0.16), rgba(0, 163, 137, 0.1)),
    rgba(9, 21, 41, 0.7);
}

.trial-banner--expired {
  border-color: rgba(220, 38, 38, 0.34);
}

.trial-banner__item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.trial-banner__label {
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
}

.trial-banner__value {
  font-weight: var(--font-weight-semibold);
}

.hero-section {
  padding: 56px 0 34px;
}

.hero-shell {
  display: grid;
  grid-template-columns: 0.9fr 1.1fr;
  gap: 32px;
  align-items: stretch;
}

.hero-text {
  padding: 24px 6px;
}

.reveal-up {
  opacity: 0;
  transform: translateY(18px);
}

.home-page--ready .reveal-up {
  animation: reveal-up 0.72s cubic-bezier(0.2, 0.7, 0.1, 1) forwards;
}

.home-page--ready .reveal-delay-2 {
  animation-delay: 0.16s;
}

.hero-title {
  font-size: clamp(2rem, 4.2vw, 3.8rem);
  line-height: 0.98;
  margin: 0 0 14px;
  letter-spacing: -0.02em;
  color: var(--text-primary);
}

.hero-subtitle {
  max-width: 560px;
  color: var(--text-secondary);
  line-height: 1.7;
  margin-bottom: 24px;
}

.hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 18px;
}

.hero-button {
  min-width: 160px;
}

.hero-trust-strip {
  margin-top: 10px;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.hero-download-card {
  margin-top: 18px;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 14px;
  align-items: center;
  padding: 16px 18px;
  border-radius: 22px;
}

.hero-download-card__icon {
  width: 48px;
  height: 48px;
  display: grid;
  place-items: center;
  border-radius: 16px;
  color: #fff;
  background: linear-gradient(135deg, rgba(15, 107, 255, 1), rgba(14, 165, 233, 0.92));
  box-shadow: 0 16px 30px rgba(15, 107, 255, 0.24);
}

.hero-download-card__icon :deep(svg) {
  width: 24px;
  height: 24px;
}

.hero-download-card__copy {
  min-width: 0;
}

.hero-download-card__copy span {
  display: inline-flex;
  margin-bottom: 4px;
  color: var(--primary-color);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.hero-download-card__copy strong {
  display: block;
  font-size: 17px;
  margin-bottom: 6px;
}

.hero-download-card__copy p {
  margin: 0;
  color: var(--text-secondary);
  line-height: 1.65;
  font-size: 14px;
}

.hero-download-card__action {
  min-width: 164px;
}

.trust-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-radius: 999px;
  background: rgba(5, 16, 31, 0.88);
  color: rgba(248, 250, 252, 0.94);
  border: 1px solid rgba(96, 165, 250, 0.24);
  box-shadow: 0 14px 30px rgba(7, 17, 34, 0.22);
  font-family: var(--font-family-mono);
}

.trust-pill :deep(svg) {
  width: 15px;
  height: 15px;
}

.hero-panel {
  padding: 20px;
  border-radius: 24px;
  border: 1px solid rgba(15, 107, 255, 0.16);
  background: linear-gradient(
    165deg,
    rgba(255, 255, 255, 0.9),
    rgba(239, 246, 255, 0.82)
  );
  box-shadow:
    var(--shadow-medium),
    inset 0 1px 0 rgba(255, 255, 255, 0.24);
  backdrop-filter: blur(16px);
  min-width: 0;
}

[data-theme="dark"] .hero-panel {
  background: linear-gradient(
    165deg,
    rgba(8, 19, 36, 0.92),
    rgba(9, 24, 44, 0.84)
  );
}

.mockup-window {
  display: grid;
  gap: 14px;
}

.mockup-topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.mockup-dots {
  display: inline-flex;
  gap: 8px;
}

.mockup-dots span {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.45);
}

.mockup-dots span:nth-child(1) {
  background: rgba(248, 113, 113, 0.76);
}

.mockup-dots span:nth-child(2) {
  background: rgba(251, 191, 36, 0.76);
}

.mockup-dots span:nth-child(3) {
  background: rgba(52, 211, 153, 0.76);
}

.mockup-pill {
  padding: 7px 11px;
  border-radius: 999px;
  background: rgba(15, 107, 255, 0.1);
  color: var(--primary-color);
  font-size: 12px;
  font-weight: 600;
}

.mockup-body {
  display: grid;
  grid-template-columns: 210px minmax(0, 1fr);
  gap: 16px;
  min-height: 390px;
}

.mockup-sidebar {
  display: grid;
  align-content: start;
  gap: 14px;
  padding: 16px;
  border-radius: 18px;
  border: 1px solid rgba(15, 107, 255, 0.12);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.14), transparent 18%),
    var(--console-panel);
}

[data-theme="dark"] .mockup-sidebar {
  background: rgba(10, 22, 40, 0.72);
}

.mockup-brand {
  display: inline-flex;
  gap: 12px;
  align-items: center;
}

.mockup-brand img {
  width: 38px;
  height: 38px;
  border-radius: 12px;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.12);
}

.mockup-brand strong {
  font-size: 15px;
}

.mockup-nav {
  display: grid;
  gap: 10px;
}

.mockup-nav__item {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 10px;
  align-items: start;
  padding: 12px;
  border-radius: 14px;
  border: 1px solid rgba(148, 163, 184, 0.12);
  background: rgba(255, 255, 255, 0.66);
}

[data-theme="dark"] .mockup-nav__item {
  background: rgba(8, 19, 34, 0.78);
}

.mockup-nav__icon {
  width: 36px;
  height: 36px;
  display: grid;
  place-items: center;
  border-radius: 12px;
  color: #fff;
  background: linear-gradient(
    135deg,
    var(--primary-color),
    var(--secondary-color)
  );
}

.mockup-nav__icon :deep(svg) {
  width: 18px;
  height: 18px;
}

.mockup-nav__item strong,
.mockup-activity__item strong {
  display: block;
  font-size: 14px;
  margin-bottom: 4px;
}

.mockup-nav__item span,
.mockup-activity__item p {
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.6;
}

.mockup-main {
  display: grid;
  align-content: start;
  gap: 16px;
  padding: 18px;
  border-radius: 18px;
  border: 1px solid rgba(148, 163, 184, 0.14);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.74), rgba(244, 248, 255, 0.78)),
    radial-gradient(circle at top right, rgba(15, 107, 255, 0.08), transparent 34%);
}

[data-theme="dark"] .mockup-main {
  background:
    linear-gradient(180deg, rgba(10, 22, 40, 0.82), rgba(9, 20, 36, 0.82)),
    radial-gradient(circle at top right, rgba(59, 130, 246, 0.14), transparent 38%);
}

.mockup-summary {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
}

.mockup-summary__copy span {
  display: inline-flex;
  margin-bottom: 6px;
  color: var(--text-tertiary);
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.mockup-summary__copy strong {
  display: block;
  font-size: 24px;
  line-height: 1.15;
  margin-bottom: 8px;
}

.mockup-summary__copy p {
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.7;
}

.mockup-summary__badge {
  padding: 8px 12px;
  border-radius: 999px;
  background: rgba(15, 107, 255, 0.1);
  color: var(--primary-color);
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}

.mockup-highlights {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.mockup-highlight {
  padding: 16px;
  border-radius: 16px;
  border: 1px solid rgba(148, 163, 184, 0.12);
  background: rgba(255, 255, 255, 0.72);
  min-width: 0;
}

.mockup-highlight:nth-child(3) {
  grid-column: 1 / -1;
}

[data-theme="dark"] .mockup-highlight {
  background: rgba(8, 19, 34, 0.76);
}

.mockup-highlight span {
  display: block;
  color: var(--text-tertiary);
  font-size: 12px;
  margin-bottom: 8px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.mockup-highlight strong {
  display: block;
  font-size: 17px;
  line-height: 1.35;
  margin-bottom: 8px;
}

.mockup-highlight p {
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.65;
}

.mockup-section-title {
  margin-bottom: 10px;
  color: var(--text-tertiary);
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.mockup-activity {
  padding: 16px;
  border-radius: 16px;
  border: 1px solid rgba(148, 163, 184, 0.12);
  background: rgba(255, 255, 255, 0.68);
}

[data-theme="dark"] .mockup-activity {
  background: rgba(8, 19, 34, 0.76);
}

@media (max-width: 1240px) {
  .hero-shell {
    grid-template-columns: 0.96fr 1.04fr;
    gap: 24px;
  }

  .mockup-body {
    grid-template-columns: 188px minmax(0, 1fr);
  }
}

.mockup-activity__item {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 12px;
  align-items: start;
}

.mockup-activity__item + .mockup-activity__item {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid rgba(148, 163, 184, 0.12);
}

.mockup-activity__step {
  width: 34px;
  height: 34px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  background: rgba(15, 107, 255, 0.1);
  color: var(--primary-color);
}

.workflow-section {
  padding: 8px 0 36px;
}

.workflow-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

.workflow-card {
  padding: 22px;
  border-radius: 20px;
  border: 1px solid var(--border-light);
  background: rgba(255, 255, 255, 0.82);
  box-shadow: 0 12px 24px rgba(15, 23, 42, 0.05);
}

[data-theme="dark"] .workflow-card {
  background: rgba(9, 22, 40, 0.74);
}

.workflow-card__step {
  display: inline-grid;
  place-items: center;
  width: 40px;
  height: 40px;
  margin-bottom: 14px;
  border-radius: 14px;
  background: rgba(15, 107, 255, 0.1);
  color: var(--primary-color);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.workflow-card h3 {
  margin-bottom: 8px;
  font-size: 17px;
}

.workflow-card p {
  color: var(--text-secondary);
  line-height: 1.7;
  font-size: 14px;
}

.security-section {
  padding: 10px 0 34px;
}

.section-header--left {
  text-align: left;
  max-width: 760px;
}

.section-kicker {
  display: inline-flex;
  align-items: center;
  margin-bottom: 10px;
  color: #0e7490;
  font-size: 13px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.security-shell {
  padding: 0;
  background: transparent;
  border: 0;
  box-shadow: none;
}

.security-layout {
  display: block;
  margin-top: 0;
}

.security-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.security-card {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 14px;
  padding: 22px;
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.86);
  border: 1px solid rgba(15, 23, 42, 0.07);
  box-shadow:
    0 10px 24px rgba(15, 23, 42, 0.05),
    inset 0 1px 0 rgba(255, 255, 255, 0.5);
  backdrop-filter: blur(8px);
}

[data-theme="dark"] .security-card {
  background: rgba(9, 22, 40, 0.78);
  border-color: rgba(148, 163, 184, 0.12);
  box-shadow:
    0 12px 26px rgba(0, 0, 0, 0.22),
    inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.security-card__icon {
  width: 44px;
  height: 44px;
  border-radius: 14px;
  display: grid;
  place-items: center;
  background: linear-gradient(135deg, #0f766e, #0f6bff);
  color: #fff;
}

.security-card__icon :deep(svg) {
  width: 21px;
  height: 21px;
}

.security-card__copy h3 {
  margin-bottom: 6px;
  font-size: 16px;
}

.security-card__copy p {
  color: var(--text-secondary);
  line-height: 1.7;
  font-size: 14px;
}

.features-section {
  padding: 28px 0 56px;
}

.section-header {
  text-align: center;
  margin-bottom: 24px;
}

.section-title {
  margin-bottom: 10px;
  font-size: clamp(1.7rem, 2.6vw, 2.4rem);
}

.section-subtitle {
  color: var(--text-secondary);
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.feature-item {
  border: 1px solid var(--border-light);
  border-radius: 16px;
  padding: 18px;
  background: rgba(255, 255, 255, 0.78);
  backdrop-filter: blur(8px);
  transition:
    transform 0.22s ease,
    box-shadow 0.22s ease,
    border-color 0.22s ease;
  opacity: 0;
  transform: translateY(16px);
}

[data-theme="dark"] .feature-item {
  background: rgba(9, 22, 40, 0.72);
}

.feature-item:hover {
  transform: translateY(-3px);
  border-color: rgba(15, 107, 255, 0.28);
  box-shadow: 0 18px 28px rgba(15, 107, 255, 0.14);
}

.home-page--ready .feature-item {
  animation: reveal-up 0.56s ease forwards;
}

.home-page--ready .feature-item:nth-child(1) {
  animation-delay: 0.14s;
}

.home-page--ready .feature-item:nth-child(2) {
  animation-delay: 0.22s;
}

.home-page--ready .feature-item:nth-child(3) {
  animation-delay: 0.3s;
}

.home-page--ready .feature-item:nth-child(4) {
  animation-delay: 0.38s;
}

.hero-actions :deep(.n-button) {
  transition:
    transform 0.18s ease,
    box-shadow 0.18s ease;
}

.hero-actions :deep(.n-button:hover) {
  transform: translateY(-1px);
}

.hero-actions :deep(.n-button--primary-type:hover) {
  box-shadow: 0 14px 26px rgba(15, 107, 255, 0.3);
}

.feature-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  color: #fff;
  margin-bottom: 12px;
  background: linear-gradient(
    135deg,
    var(--primary-color),
    var(--secondary-color)
  );
}

.feature-icon :deep(svg) {
  width: 22px;
  height: 22px;
}

.feature-title {
  margin-bottom: 8px;
  font-size: 17px;
}

.feature-description {
  color: var(--text-secondary);
  line-height: 1.65;
  font-size: 14px;
}

.footer {
  border-top: 1px solid var(--border-light);
  background: rgba(4, 16, 32, 0.9);
  color: rgba(244, 247, 255, 0.9);
  padding: 22px 0;
}

.footer-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
}

.footer-brand {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.footer-logo {
  width: 22px;
  height: 22px;
}

.footer-links {
  display: flex;
  gap: 16px;
}

.footer-link {
  color: rgba(244, 247, 255, 0.76);
}

.footer-bottom {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 10px 20px;
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.14);
  color: rgba(244, 247, 255, 0.64);
  font-size: 13px;
}

.footer-build {
  color: rgba(244, 247, 255, 0.54);
  font-variant-numeric: tabular-nums;
}

@keyframes orb-float-a {
  from {
    transform: translate3d(0, 0, 0);
  }
  to {
    transform: translate3d(6vw, -4vh, 0);
  }
}

@keyframes orb-float-b {
  from {
    transform: translate3d(0, 0, 0);
  }
  to {
    transform: translate3d(-7vw, 5vh, 0);
  }
}

@keyframes orb-float-c {
  0% {
    transform: translate3d(0, 0, 0);
  }
  50% {
    transform: translate3d(-5vw, -3vh, 0);
  }
  100% {
    transform: translate3d(5vw, 4vh, 0);
  }
}

@keyframes reveal-up {
  from {
    opacity: 0;
    transform: translateY(16px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes home-shell-in {
  from {
    opacity: 0;
    transform: translate3d(0, 22px, 0) scale(0.996);
    filter: blur(2px);
  }
  to {
    opacity: 1;
    transform: translate3d(0, 0, 0) scale(1);
    filter: blur(0);
  }
}

@keyframes home-shell-in-dark {
  from {
    opacity: 0;
    transform: translate3d(0, 28px, 0) scale(0.986);
    filter: blur(5px);
  }
  to {
    opacity: 1;
    transform: translate3d(0, 0, 0) scale(1);
    filter: blur(0);
  }
}

@media (max-width: 960px) {
  .hero-shell {
    grid-template-columns: 1fr;
  }

  .mockup-body,
  .workflow-grid {
    grid-template-columns: 1fr;
  }

  .mockup-highlight:nth-child(3) {
    grid-column: auto;
  }

  .features-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .security-grid {
    grid-template-columns: 1fr;
  }

  .nav-actions {
    display: none;
  }

  .mobile-menu-button {
    display: inline-flex;
  }
}

@media (max-width: 680px) {
  .trial-banner {
    grid-template-columns: 1fr;
  }

  .hero-section {
    padding-top: 30px;
  }

  .hero-panel {
    padding: 14px;
  }

  .hero-actions {
    flex-direction: column;
  }

  .hero-download-card {
    grid-template-columns: 1fr;
  }

  .hero-download-card__action {
    width: 100%;
  }

  .security-shell {
    padding: 0;
  }

  .hero-button,
  .hero-actions :deep(.n-button) {
    width: 100%;
  }

  .features-grid {
    grid-template-columns: 1fr;
  }

  .mockup-highlights {
    grid-template-columns: 1fr;
  }

  .mockup-summary {
    flex-direction: column;
  }

  .footer-content,
  .footer-bottom,
  .footer-links {
    flex-direction: column;
    align-items: flex-start;
  }
}

@media (prefers-reduced-motion: reduce) {
  :global(html:not([data-motion="force"])) .home-page--ready {
    animation: none;
  }
}
</style>
