import { createI18n } from "vue-i18n";

const normalizeLocale = (value) => {
  const locale = String(value || "").trim();
  if (locale === "en" || locale === "en-US") {
    return "en";
  }
  return "zh-CN";
};

export const applyLocale = (value) => {
  const locale = normalizeLocale(value);
  document.documentElement.lang = locale;
  return locale;
};

const initialLocale = applyLocale(localStorage.getItem("language") || "zh-CN");

const localeLoaders = {
  "en": () => import("@/locales/en.json"),
  "zh-CN": () => import("@/locales/zh-CN.json"),
};

const loadedLocales = new Set();

export const i18n = createI18n({
  legacy: false,
  locale: initialLocale,
  fallbackLocale: "zh-CN",
  messages: {},
});

export const loadLocaleMessages = async (value) => {
  const locale = normalizeLocale(value);
  if (loadedLocales.has(locale)) {
    return locale;
  }

  const loader = localeLoaders[locale] || localeLoaders["zh-CN"];
  const messages = await loader();
  i18n.global.setLocaleMessage(locale, messages.default || messages);
  loadedLocales.add(locale);
  return locale;
};

export const initializeI18n = async () => {
  await loadLocaleMessages(initialLocale);
  if (initialLocale !== "zh-CN") {
    void loadLocaleMessages("zh-CN");
  }
  return initialLocale;
};

export const setLocale = async (value) => {
  const locale = applyLocale(value);
  await loadLocaleMessages(locale);
  i18n.global.locale.value = locale;
  localStorage.setItem("language", locale);
  return locale;
};
