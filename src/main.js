import "@arco-design/web-vue/dist/arco.css";
import "virtual:uno.css";
import "./assets/styles/global.scss";

import { createApp } from "vue";
import { createPinia } from "pinia";
import router from "./router";
import App from "./App.vue";
import { useAuthStore } from "@/stores/auth";
import { i18n, initializeI18n } from "@/i18n";
import { setupRouterGuards } from "@/router/guards";
import { useTheme } from "@/composables/useTheme";
import { APP_MOTION_STORAGE_KEY } from "@/constants/ui";

const app = createApp(App);
const pinia = createPinia();
app.use(pinia);
app.use(i18n);

const applyMotionPreference = () => {
  const preference = localStorage.getItem(APP_MOTION_STORAGE_KEY) || "force";
  if (preference === "force") {
    document.documentElement.setAttribute("data-motion", "force");
  } else {
    document.documentElement.removeAttribute("data-motion");
  }
};

const bootstrap = async () => {
  applyMotionPreference();

  const { initializeThemeState } = useTheme();
  initializeThemeState();

  await initializeI18n();
  const authStore = useAuthStore();
  await authStore.initializeAuth();
  setupRouterGuards(router);
  app.use(router);
  await router.isReady();
  app.mount("#app");
};

bootstrap().catch((error) => {
  console.error("[bootstrap] failed:", error);
});
