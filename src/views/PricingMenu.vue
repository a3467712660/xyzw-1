<template>
  <div class="pricing-page">
    <div aria-hidden="true" class="pricing-page__bg">
      <span class="pricing-page__orb pricing-page__orb--a"></span>
      <span class="pricing-page__orb pricing-page__orb--b"></span>
    </div>

    <section class="pricing-page__hero">
      <div class="container pricing-page__hero-inner">
        <div class="pricing-page__hero-copy">
          <span class="pricing-page__eyebrow">{{ t("pricingPage.eyebrow") }}</span>
          <h1>{{ t("pricingPage.title") }}</h1>
          <p>{{ t("pricingPage.subtitle") }}</p>
        </div>

        <div class="pricing-page__hero-actions">
          <n-button ghost type="primary" @click="router.push('/')">
            {{ t("pricingPage.actions.backHome") }}
          </n-button>
          <n-button type="primary" @click="router.push('/register')">
            {{ t("pricingPage.actions.registerNow") }}
          </n-button>
        </div>
      </div>
    </section>

    <main class="pricing-page__content">
      <div class="container pricing-page__content-inner">
        <section class="pricing-section">
          <div class="pricing-grid">
            <article
              v-for="item in priceCards"
              :key="item.id"
              class="pricing-card"
            >
              <div class="pricing-card__header">
                <span class="pricing-card__badge">{{ item.badge }}</span>
                <h2>{{ item.title }}</h2>
              </div>
              <p class="pricing-card__desc">{{ item.description }}</p>
              <div class="pricing-card__price">
                <strong>{{ item.price }}</strong>
                <span>{{ item.unit }}</span>
              </div>
            </article>
          </div>
        </section>

        <section class="pricing-section">
          <div class="section-copy">
            <h2>{{ t("pricingPage.compare.title") }}</h2>
            <p>{{ t("pricingPage.compare.subtitle") }}</p>
          </div>

          <div class="compare-grid">
            <article class="compare-card">
              <h3>{{ t("pricingPage.compare.normal.title") }}</h3>
              <p>{{ t("pricingPage.compare.normal.description") }}</p>
            </article>
            <article class="compare-card compare-card--featured">
              <h3>{{ t("pricingPage.compare.full.title") }}</h3>
              <p>{{ t("pricingPage.compare.full.description") }}</p>
            </article>
          </div>
        </section>

        <section class="pricing-section">
          <div class="contact-card">
            <span class="contact-card__label">{{ t("pricingPage.contact.label") }}</span>
            <h2>{{ t("pricingPage.contact.title") }}</h2>
            <p>{{ t("pricingPage.contact.description") }}</p>
            <div class="contact-card__wechat">{{ t("pricingPage.contact.wechat") }}</div>
          </div>
        </section>
      </div>
    </main>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";

const router = useRouter();
const { t } = useI18n();

const priceCards = computed(() => [
  {
    id: "invite-normal",
    badge: t("pricingPage.cards.inviteNormal.badge"),
    title: t("pricingPage.cards.inviteNormal.title"),
    description: t("pricingPage.cards.inviteNormal.description"),
    price: t("pricingPage.cards.inviteNormal.price"),
    unit: t("pricingPage.cards.inviteNormal.unit"),
  },
  {
    id: "invite-full",
    badge: t("pricingPage.cards.inviteFull.badge"),
    title: t("pricingPage.cards.inviteFull.title"),
    description: t("pricingPage.cards.inviteFull.description"),
    price: t("pricingPage.cards.inviteFull.price"),
    unit: t("pricingPage.cards.inviteFull.unit"),
  },
  {
    id: "activation-normal",
    badge: t("pricingPage.cards.activationNormal.badge"),
    title: t("pricingPage.cards.activationNormal.title"),
    description: t("pricingPage.cards.activationNormal.description"),
    price: t("pricingPage.cards.activationNormal.price"),
    unit: t("pricingPage.cards.unit"),
  },
  {
    id: "activation-full",
    badge: t("pricingPage.cards.activationFull.badge"),
    title: t("pricingPage.cards.activationFull.title"),
    description: t("pricingPage.cards.activationFull.description"),
    price: t("pricingPage.cards.activationFull.price"),
    unit: t("pricingPage.cards.unit"),
  },
  {
    id: "token-limit",
    badge: t("pricingPage.cards.tokenLimit.badge"),
    title: t("pricingPage.cards.tokenLimit.title"),
    description: t("pricingPage.cards.tokenLimit.description"),
    price: t("pricingPage.cards.tokenLimit.price"),
    unit: t("pricingPage.cards.tokenLimit.unit"),
  },
  {
    id: "token-limit-full",
    badge: t("pricingPage.cards.tokenLimitFull.badge"),
    title: t("pricingPage.cards.tokenLimitFull.title"),
    description: t("pricingPage.cards.tokenLimitFull.description"),
    price: t("pricingPage.cards.tokenLimitFull.price"),
    unit: t("pricingPage.cards.tokenLimitFull.unit"),
  },
]);
</script>

<style scoped lang="scss">
.pricing-page {
  position: relative;
  min-height: 100dvh;
  color: var(--text-primary);
  overflow: clip;
}

.pricing-page__bg {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
}

.pricing-page__orb {
  position: absolute;
  border-radius: 999px;
  filter: blur(60px);
  opacity: 0.65;
}

.pricing-page__orb--a {
  width: 32vw;
  height: 32vw;
  min-width: 240px;
  min-height: 240px;
  left: -8vw;
  top: 10vh;
  background: radial-gradient(circle, rgba(15, 107, 255, 0.3), transparent 72%);
}

.pricing-page__orb--b {
  width: 28vw;
  height: 28vw;
  min-width: 220px;
  min-height: 220px;
  right: -6vw;
  top: 18vh;
  background: radial-gradient(circle, rgba(0, 163, 137, 0.26), transparent 72%);
}

.pricing-page__hero,
.pricing-card,
.compare-card,
.contact-card {
  position: relative;
  z-index: 1;
  background: var(--surface-glass-strong);
  border: 1px solid var(--surface-glass-border);
  box-shadow: var(--shadow-light);
  backdrop-filter: blur(12px);
}

.pricing-page__hero {
  padding: 32px 0;
  border-radius: 0 0 28px 28px;
}

.pricing-page__hero-inner {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  align-items: flex-start;
}

.pricing-page__hero-copy {
  display: grid;
  gap: 12px;
  max-width: 720px;
}

.pricing-page__eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--primary-color);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.pricing-page__eyebrow::before {
  content: "";
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: linear-gradient(140deg, var(--primary-color), var(--secondary-color));
}

.pricing-page__hero-copy h1 {
  margin: 0;
  font-size: clamp(30px, 4vw, 44px);
  line-height: 1.06;
}

.pricing-page__hero-copy p {
  margin: 0;
  max-width: 62ch;
  color: var(--text-secondary);
  line-height: 1.7;
}

.pricing-page__hero-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.pricing-page__content {
  position: relative;
  z-index: 1;
  padding: 28px 0 48px;
}

.pricing-page__content-inner {
  display: grid;
  gap: 24px;
}

.pricing-section {
  display: grid;
  gap: 16px;
}

.pricing-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
}

.pricing-card {
  border-radius: 22px;
  padding: 22px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  height: 100%;
}

.pricing-card__header {
  display: grid;
  gap: 10px;
}

.pricing-card__badge {
  display: inline-flex;
  width: fit-content;
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(15, 107, 255, 0.1);
  color: var(--primary-color);
  font-size: 12px;
  font-weight: 700;
}

.pricing-card h2 {
  margin: 0;
  font-size: 20px;
}

.pricing-card__desc {
  margin: 0;
  color: var(--text-secondary);
  line-height: 1.65;
}

.pricing-card__price {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-top: auto;
  padding-top: 8px;
}

.pricing-card__price strong {
  font-size: clamp(28px, 3.2vw, 36px);
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.pricing-card__price span {
  color: var(--text-tertiary);
}

.section-copy {
  display: grid;
  gap: 8px;
}

.section-copy h2 {
  margin: 0;
  font-size: 28px;
}

.section-copy p {
  margin: 0;
  color: var(--text-secondary);
  line-height: 1.7;
}

.compare-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.compare-card,
.contact-card {
  border-radius: 22px;
  padding: 22px;
}

.compare-card h3,
.contact-card h2 {
  margin: 0 0 10px;
}

.compare-card p,
.contact-card p {
  margin: 0;
  color: var(--text-secondary);
  line-height: 1.7;
}

.compare-card--featured {
  border-color: rgba(15, 107, 255, 0.24);
  box-shadow: 0 18px 34px rgba(15, 107, 255, 0.08);
}

.contact-card {
  display: grid;
  gap: 12px;
}

.contact-card__label {
  color: var(--primary-color);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.contact-card__wechat {
  display: inline-flex;
  width: fit-content;
  padding: 10px 14px;
  border-radius: 999px;
  background: rgba(0, 163, 137, 0.12);
  color: var(--secondary-color);
  font-weight: 700;
}

@media (max-width: 959px) {
  .pricing-page__hero-inner {
    flex-direction: column;
  }

  .compare-grid {
    grid-template-columns: 1fr;
  }
}
</style>
