<template>
  <div class="pricing-page public-brand-page">
    <div aria-hidden="true" class="pricing-page__bg public-brand-bg">
      <span class="pricing-page__orb pricing-page__orb--a public-brand-orb public-brand-orb--a"></span>
      <span class="pricing-page__orb pricing-page__orb--b public-brand-orb public-brand-orb--b"></span>
      <span class="public-brand-grid"></span>
    </div>

    <section class="pricing-page__hero public-brand-glass-card">
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
          <div class="pricing-duration-panel public-brand-soft-card">
            <div class="pricing-duration-panel__copy">
              <span class="pricing-duration-panel__eyebrow">{{ t("pricingPage.durationPicker.label") }}</span>
              <h2>{{ t("pricingPage.durationPicker.title") }}</h2>
              <p>{{ t("pricingPage.durationPicker.description") }}</p>
            </div>

            <div class="pricing-duration-options" role="tablist" :aria-label="t('pricingPage.durationPicker.label')">
              <button
                v-for="option in durationOptions"
                :key="option.key"
                class="pricing-duration-option"
                role="tab"
                type="button"
                :aria-selected="option.key === selectedDurationKey"
                :class="{ 'pricing-duration-option--active': option.key === selectedDurationKey }"
                @click="selectedDurationKey = option.key"
              >
                <strong>{{ option.shortLabel }}</strong>
                <span>{{ option.label }}</span>
              </button>
            </div>
          </div>

          <div class="pricing-grid">
            <article
              v-for="item in priceCards"
              :key="item.id"
              class="pricing-card public-brand-glass-card"
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
              <p v-if="item.meta" class="pricing-card__meta">{{ item.meta }}</p>
            </article>
          </div>
        </section>

        <section class="pricing-section">
          <div class="section-copy">
            <h2>{{ t("pricingPage.compare.title") }}</h2>
            <p>{{ t("pricingPage.compare.subtitle") }}</p>
          </div>

          <div class="compare-grid">
            <article class="compare-card public-brand-soft-card">
              <h3>{{ t("pricingPage.compare.normal.title") }}</h3>
              <p>{{ t("pricingPage.compare.normal.description") }}</p>
            </article>
            <article class="compare-card compare-card--featured public-brand-soft-card">
              <h3>{{ t("pricingPage.compare.full.title") }}</h3>
              <p>{{ t("pricingPage.compare.full.description") }}</p>
            </article>
          </div>
        </section>

        <section class="pricing-section">
          <div class="contact-card public-brand-glass-card">
            <span class="contact-card__label">{{ t("pricingPage.contact.label") }}</span>
            <h2>{{ t("pricingPage.contact.title") }}</h2>
            <p>{{ t("pricingPage.contact.description") }}</p>

            <div v-if="contactLoading" class="contact-card__state">
              正在加载联系入口...
            </div>

            <div v-else-if="contacts.length" class="contact-list">
              <button
                v-for="item in contacts"
                :key="item.id"
                class="contact-list__item"
                type="button"
                @click="openContact(item.slug)"
              >
                <strong>{{ item.title }}</strong>
                <span>{{ item.subtitle || contactTypeLabelMap[item.contactType] || "点击查看联系入口" }}</span>
              </button>
            </div>

            <div v-else class="contact-card__state">
              {{ contactError || "当前暂无可用的联系入口，请稍后再试。" }}
            </div>

            <div class="contact-card__meta">
              <span>{{ refreshStatusText }}</span>
            </div>
          </div>
        </section>
      </div>
    </main>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useMessage } from "naive-ui/es";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import api from "@/api";

const router = useRouter();
const { t, locale } = useI18n();
const message = useMessage();
const contacts = ref([]);
const contactLoading = ref(false);
const contactError = ref("");
const isUsingSse = ref(false);
const selectedDurationKey = ref("month");
let contactEventSource = null;
let contactPollTimer = null;

const contactTypeLabelMap = {
  landing_qr: "二维码落地页",
  wecom_kf_link: "企业微信客服链接",
  external_url: "外部链接",
};

const refreshStatusText = computed(() => {
  if (isUsingSse.value) {
    return "联系人列表会自动刷新";
  }
  return "当前使用 30 秒轮询刷新联系人";
});

const durationOptions = computed(() => ([
  {
    key: "month",
    months: 1,
    shortLabel: t("pricingPage.durationPicker.shortMonth"),
    label: t("pricingPage.durationPicker.month"),
  },
  {
    key: "quarter",
    months: 3,
    shortLabel: t("pricingPage.durationPicker.shortQuarter"),
    label: t("pricingPage.durationPicker.quarter"),
  },
  {
    key: "halfYear",
    months: 6,
    shortLabel: t("pricingPage.durationPicker.shortHalfYear"),
    label: t("pricingPage.durationPicker.halfYear"),
  },
  {
    key: "year",
    months: 12,
    shortLabel: t("pricingPage.durationPicker.shortYear"),
    label: t("pricingPage.durationPicker.year"),
  },
]));

const currentDuration = computed(() =>
  durationOptions.value.find((option) => option.key === selectedDurationKey.value) || durationOptions.value[0]);

const durationPricedCards = {
  inviteNormal: {
    1: 8,
    3: 18,
    6: 32,
    12: 60,
  },
  inviteFull: {
    1: 32,
    3: 87,
    6: 167,
    12: 302,
  },
  activationNormal: {
    1: 6,
    3: 16,
    6: 30,
    12: 58,
  },
  activationFull: {
    1: 30,
    3: 85,
    6: 165,
    12: 300,
  },
};

const formatPrice = (amount) => {
  const value = Math.max(0, Number(amount) || 0);
  if (locale.value === "zh-CN") {
    return `${value}元`;
  }
  return `${value} yuan`;
};

const priceCards = computed(() => [
  {
    id: "invite-normal",
    badge: t("pricingPage.cards.inviteNormal.badge"),
    title: t("pricingPage.cards.inviteNormal.title"),
    description: t("pricingPage.cards.inviteNormal.description"),
    price: formatPrice(durationPricedCards.inviteNormal[currentDuration.value.months]),
    unit: currentDuration.value.label,
    meta: t("pricingPage.durationPicker.current", { label: currentDuration.value.label }),
  },
  {
    id: "invite-full",
    badge: t("pricingPage.cards.inviteFull.badge"),
    title: t("pricingPage.cards.inviteFull.title"),
    description: t("pricingPage.cards.inviteFull.description"),
    price: formatPrice(durationPricedCards.inviteFull[currentDuration.value.months]),
    unit: currentDuration.value.label,
    meta: t("pricingPage.durationPicker.current", { label: currentDuration.value.label }),
  },
  {
    id: "activation-normal",
    badge: t("pricingPage.cards.activationNormal.badge"),
    title: t("pricingPage.cards.activationNormal.title"),
    description: t("pricingPage.cards.activationNormal.description"),
    price: formatPrice(durationPricedCards.activationNormal[currentDuration.value.months]),
    unit: currentDuration.value.label,
    meta: t("pricingPage.durationPicker.current", { label: currentDuration.value.label }),
  },
  {
    id: "activation-full",
    badge: t("pricingPage.cards.activationFull.badge"),
    title: t("pricingPage.cards.activationFull.title"),
    description: t("pricingPage.cards.activationFull.description"),
    price: formatPrice(durationPricedCards.activationFull[currentDuration.value.months]),
    unit: currentDuration.value.label,
    meta: t("pricingPage.durationPicker.current", { label: currentDuration.value.label }),
  },
  {
    id: "token-limit",
    badge: t("pricingPage.cards.tokenLimit.badge"),
    title: t("pricingPage.cards.tokenLimit.title"),
    description: t("pricingPage.cards.tokenLimit.description"),
    price: t("pricingPage.cards.tokenLimit.price"),
    unit: t("pricingPage.cards.tokenLimit.unit"),
    meta: "",
  },
  {
    id: "token-limit-full",
    badge: t("pricingPage.cards.tokenLimitFull.badge"),
    title: t("pricingPage.cards.tokenLimitFull.title"),
    description: t("pricingPage.cards.tokenLimitFull.description"),
    price: t("pricingPage.cards.tokenLimitFull.price"),
    unit: t("pricingPage.cards.tokenLimitFull.unit"),
    meta: "",
  },
]);

const fetchContacts = async ({ silent = false } = {}) => {
  if (!silent) {
    contactLoading.value = true;
  }
  if (!silent) {
    contactError.value = "";
  }
  try {
    const res = await api.publicWechat.list();
    if (!res?.success) {
      if (!silent) {
        contactError.value = res?.message || "联系入口加载失败";
      }
      return;
    }
    contacts.value = Array.isArray(res.data) ? res.data : [];
    if (!silent) {
      contactError.value = "";
    }
  } catch (error) {
    if (!silent) {
      contactError.value = error?.message || "联系入口加载失败";
      message.error(contactError.value);
    }
  } finally {
    if (!silent) {
      contactLoading.value = false;
    }
  }
};

const stopPolling = () => {
  if (contactPollTimer) {
    window.clearInterval(contactPollTimer);
    contactPollTimer = null;
  }
};

const startPolling = () => {
  if (typeof window === "undefined" || contactPollTimer) {
    return;
  }
  isUsingSse.value = false;
  contactPollTimer = window.setInterval(() => {
    fetchContacts({ silent: true });
  }, 30000);
};

const stopEventSource = () => {
  if (contactEventSource) {
    contactEventSource.close();
    contactEventSource = null;
  }
  isUsingSse.value = false;
};

const startEventSource = () => {
  if (typeof window === "undefined" || !("EventSource" in window)) {
    startPolling();
    return;
  }

  stopEventSource();
  contactEventSource = new window.EventSource("/api/v1/public/wechat-contacts/stream");
  contactEventSource.onopen = () => {
    isUsingSse.value = true;
    stopPolling();
  };
  contactEventSource.onerror = () => {
    stopEventSource();
    startPolling();
  };
  contactEventSource.addEventListener("contacts_changed", () => {
    fetchContacts({ silent: true });
  });
};

const openContact = (slug) => {
  router.push(`/wx/${slug}`);
};

onMounted(async () => {
  await fetchContacts();
  startEventSource();
  if (!("EventSource" in window)) {
    startPolling();
  }
});

onUnmounted(() => {
  stopEventSource();
  stopPolling();
});
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

.pricing-duration-panel {
  display: flex;
  justify-content: space-between;
  gap: 18px;
  align-items: flex-end;
  padding: 18px 20px;
  border-radius: 24px;
  border: 1px solid var(--surface-glass-border);
  background:
    linear-gradient(135deg, rgba(15, 107, 255, 0.12), rgba(0, 163, 137, 0.08)),
    var(--surface-glass-strong);
  box-shadow: var(--shadow-light);
  backdrop-filter: blur(12px);
}

.pricing-duration-panel__copy {
  display: grid;
  gap: 6px;
  max-width: 480px;
}

.pricing-duration-panel__eyebrow {
  color: var(--primary-color);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.pricing-duration-panel__copy h2 {
  margin: 0;
  font-size: 24px;
}

.pricing-duration-panel__copy p {
  margin: 0;
  color: var(--text-secondary);
  line-height: 1.7;
}

.pricing-duration-options {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 10px;
}

.pricing-duration-option {
  min-width: 108px;
  border: 1px solid rgba(15, 107, 255, 0.14);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.48);
  padding: 12px 14px;
  display: grid;
  gap: 4px;
  text-align: left;
  color: var(--text-secondary);
  cursor: pointer;
  transition:
    transform 0.18s ease,
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    background 0.18s ease,
    color 0.18s ease;
}

.pricing-duration-option strong {
  font-size: 16px;
  color: var(--text-primary);
}

.pricing-duration-option span {
  font-size: 13px;
}

.pricing-duration-option:hover {
  transform: translateY(-2px);
  border-color: rgba(15, 107, 255, 0.3);
  box-shadow: 0 16px 28px rgba(15, 107, 255, 0.08);
}

.pricing-duration-option--active {
  background: linear-gradient(135deg, rgba(15, 107, 255, 0.16), rgba(0, 163, 137, 0.12));
  border-color: rgba(15, 107, 255, 0.3);
  color: var(--primary-color);
  box-shadow: 0 18px 32px rgba(15, 107, 255, 0.12);
}

.pricing-duration-option--active strong {
  color: var(--primary-color);
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

.pricing-card__meta {
  margin: 0;
  font-size: 12px;
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

.contact-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
}

.contact-list__item {
  border: 1px solid rgba(15, 107, 255, 0.14);
  background: rgba(255, 255, 255, 0.5);
  border-radius: 18px;
  padding: 16px;
  display: grid;
  gap: 8px;
  text-align: left;
  cursor: pointer;
  transition:
    transform 0.18s ease,
    border-color 0.18s ease,
    box-shadow 0.18s ease;
}

.contact-list__item:hover {
  transform: translateY(-2px);
  border-color: rgba(15, 107, 255, 0.28);
  box-shadow: 0 16px 28px rgba(15, 107, 255, 0.08);
}

.contact-list__item strong {
  font-size: 16px;
}

.contact-list__item span {
  color: var(--text-secondary);
  line-height: 1.6;
}

.contact-card__state {
  display: inline-flex;
  width: fit-content;
  padding: 10px 14px;
  border-radius: 999px;
  background: rgba(0, 163, 137, 0.12);
  color: var(--secondary-color);
  font-weight: 700;
}

.contact-card__meta {
  color: var(--text-tertiary);
  font-size: 13px;
}

@media (max-width: 959px) {
  .pricing-page__hero-inner {
    flex-direction: column;
  }

  .pricing-duration-panel {
    flex-direction: column;
    align-items: stretch;
  }

  .pricing-duration-options {
    justify-content: flex-start;
  }

  .compare-grid {
    grid-template-columns: 1fr;
  }
}

@media (min-width: 960px) {
  .pricing-page {
    background:
      radial-gradient(circle at 12% 18%, rgba(37, 99, 235, 0.1), transparent 30%),
      radial-gradient(circle at 88% 16%, rgba(8, 145, 178, 0.08), transparent 28%),
      linear-gradient(180deg, rgba(248, 251, 255, 0.98), rgba(237, 244, 252, 0.94));
  }

  .pricing-page__hero {
    width: min(1180px, calc(100% - 48px));
    margin: 48px auto 0;
    padding: 42px;
    border-radius: 38px;
    background:
      linear-gradient(145deg, rgba(255, 255, 255, 0.94), rgba(255, 255, 255, 0.72)),
      radial-gradient(circle at 82% 18%, rgba(37, 99, 235, 0.16), transparent 34%);
    box-shadow:
      0 34px 90px rgba(15, 23, 42, 0.13),
      inset 0 1px 0 rgba(255, 255, 255, 0.78);
    overflow: hidden;
  }

  .pricing-page__hero::before {
    content: "";
    position: absolute;
    inset: 0;
    pointer-events: none;
    background:
      linear-gradient(90deg, rgba(37, 99, 235, 0.045) 1px, transparent 1px),
      linear-gradient(180deg, rgba(37, 99, 235, 0.045) 1px, transparent 1px);
    background-size: 34px 34px;
    mask-image: linear-gradient(90deg, transparent, #000 24%, #000 76%, transparent);
  }

  .pricing-page__hero-inner {
    position: relative;
    z-index: 1;
    align-items: center;
  }

  .pricing-page__hero-copy h1 {
    max-width: 12ch;
    font-size: clamp(3.2rem, 5vw, 5.8rem);
    line-height: 0.94;
    letter-spacing: -0.065em;
  }

  .pricing-page__hero-copy p {
    font-size: 17px;
    line-height: 1.86;
  }

  .pricing-page__hero-actions :deep(.n-button) {
    min-height: 48px;
    min-width: 132px;
    border-radius: 16px;
  }

  .pricing-page__content {
    padding: 34px 0 76px;
  }

  .pricing-page__content-inner {
    gap: 30px;
  }

  .pricing-duration-panel,
  .pricing-card,
  .compare-card,
  .contact-card {
    border-color: rgba(37, 99, 235, 0.12);
    background:
      linear-gradient(145deg, rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 0.66)),
      rgba(255, 255, 255, 0.76);
    box-shadow:
      0 22px 54px rgba(15, 23, 42, 0.1),
      inset 0 1px 0 rgba(255, 255, 255, 0.72);
    backdrop-filter: blur(18px);
    -webkit-backdrop-filter: blur(18px);
  }

  .pricing-duration-panel {
    padding: 24px 26px;
    border-radius: 30px;
  }

  .pricing-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 18px;
  }

  .pricing-card {
    min-height: 248px;
    border-radius: 28px;
    transition:
      transform 180ms ease,
      border-color 180ms ease,
      box-shadow 180ms ease;
  }

  .pricing-card:hover {
    transform: translateY(-6px);
    border-color: rgba(37, 99, 235, 0.24);
    box-shadow: 0 26px 58px rgba(37, 99, 235, 0.13);
  }

  .pricing-card__badge {
    background: rgba(37, 99, 235, 0.1);
    color: #2563eb;
    font-weight: 800;
  }

  .pricing-card__price strong {
    color: #0f172a;
    letter-spacing: -0.045em;
  }

  .compare-card,
  .contact-card {
    border-radius: 28px;
    padding: 28px;
  }

  .contact-list__item {
    background: rgba(255, 255, 255, 0.78);
  }

  [data-theme="dark"] .pricing-page__hero,
  [data-theme="dark"] .pricing-duration-panel,
  [data-theme="dark"] .pricing-card,
  [data-theme="dark"] .compare-card,
  [data-theme="dark"] .contact-card,
  [data-theme="dark"] .contact-list__item {
    background: rgba(8, 22, 41, 0.78);
    border-color: rgba(148, 163, 184, 0.18);
  }

  [data-theme="dark"] .pricing-card__price strong {
    color: #f8fafc;
  }
}

/* Public refactor v2 */
@media (min-width: 960px) {
  .pricing-page {
    background:
      radial-gradient(circle at 12% 18%, rgba(37, 99, 235, 0.12), transparent 30%),
      radial-gradient(circle at 88% 16%, rgba(8, 145, 178, 0.1), transparent 28%),
      linear-gradient(180deg, #edf5ff 0%, #f8fafc 52%, #f2eee7 100%);
  }

  .pricing-page__hero {
    width: min(1160px, calc(100% - 56px));
    margin-top: 44px;
    padding: 44px;
    border-radius: 30px;
    background:
      linear-gradient(115deg, rgba(255, 253, 248, 0.98) 0%, rgba(255, 255, 255, 0.94) 58%, rgba(239, 246, 255, 0.98) 100%);
    border: 1px solid #d8e2ef;
    box-shadow:
      0 28px 70px rgba(15, 23, 42, 0.12),
      inset 0 1px 0 rgba(255, 255, 255, 0.92);
  }

  .pricing-page__hero-copy h1 {
    max-width: 10ch;
    color: #101828;
    font-size: clamp(3.15rem, 4.8vw, 5.55rem);
    line-height: 0.94;
    letter-spacing: -0.075em;
  }

  .pricing-page__hero-copy p {
    color: #475569;
    font-size: 17px;
    line-height: 1.84;
  }

  .pricing-page__content {
    padding: 32px 0 76px;
  }

  .pricing-page__content-inner {
    gap: 26px;
  }

  .pricing-duration-panel,
  .pricing-card,
  .compare-card,
  .contact-card {
    border: 1px solid #d8e2ef;
    background: rgba(255, 255, 255, 0.94);
    box-shadow: 0 20px 48px rgba(15, 23, 42, 0.1);
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }

  .pricing-duration-panel {
    border-radius: 28px;
  }

  .pricing-card {
    border-radius: 26px;
  }

  .pricing-card__price strong {
    color: #101828;
  }

  .compare-card,
  .contact-card {
    border-radius: 26px;
  }
}
</style>
