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

const renderBootstrapError = (error) => {
  const root = document.getElementById("app");
  if (!root) {
    return;
  }
  const message = String(error?.message || "应用初始化失败，请刷新后重试");
  root.replaceChildren();

  const shell = document.createElement("div");
  shell.style.minHeight = "100vh";
  shell.style.display = "flex";
  shell.style.alignItems = "center";
  shell.style.justifyContent = "center";
  shell.style.padding = "24px";
  shell.style.background = "#f7f9fc";
  shell.style.color = "#101828";
  shell.style.fontFamily = "'Avenir Next','PingFang SC','Microsoft YaHei',sans-serif";

  const card = document.createElement("div");
  card.style.maxWidth = "520px";
  card.style.width = "100%";
  card.style.background = "rgba(255,255,255,0.96)";
  card.style.border = "1px solid #e4e7ec";
  card.style.borderRadius = "18px";
  card.style.padding = "28px";
  card.style.boxShadow = "0 16px 40px rgba(16,24,40,0.12)";

  const title = document.createElement("h1");
  title.style.margin = "0 0 12px";
  title.style.fontSize = "22px";
  title.textContent = "应用启动失败";

  const description = document.createElement("p");
  description.style.margin = "0 0 18px";
  description.style.lineHeight = "1.7";
  description.style.color = "#344054";
  description.textContent = message;

  const retryButton = document.createElement("button");
  retryButton.type = "button";
  retryButton.style.height = "40px";
  retryButton.style.padding = "0 18px";
  retryButton.style.border = "none";
  retryButton.style.borderRadius = "10px";
  retryButton.style.background = "#3f77ad";
  retryButton.style.color = "#fff";
  retryButton.style.cursor = "pointer";
  retryButton.textContent = "刷新页面";
  retryButton.addEventListener("click", () => {
    window.location.reload();
  });

  card.append(title, description, retryButton);
  shell.append(card);
  root.append(shell);
};

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
  renderBootstrapError(error);
});
