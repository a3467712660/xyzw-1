import { createI18n } from "vue-i18n";
import messages from "@intlify/unplugin-vue-i18n/messages";

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

const getLocaleMessages = (locale) =>
  messages[locale] || messages["zh-CN"] || {};

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

  i18n.global.setLocaleMessage(locale, getLocaleMessages(locale));
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
