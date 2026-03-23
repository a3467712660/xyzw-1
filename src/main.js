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
  root.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:#f7f9fc;color:#101828;font-family:'Avenir Next','PingFang SC','Microsoft YaHei',sans-serif;">
      <div style="max-width:520px;width:100%;background:rgba(255,255,255,0.96);border:1px solid #e4e7ec;border-radius:18px;padding:28px;box-shadow:0 16px 40px rgba(16,24,40,0.12);">
        <h1 style="margin:0 0 12px;font-size:22px;">应用启动失败</h1>
        <p style="margin:0 0 18px;line-height:1.7;color:#344054;">${message}</p>
        <button id="bootstrap-retry-btn" style="height:40px;padding:0 18px;border:none;border-radius:10px;background:#3f77ad;color:#fff;cursor:pointer;">刷新页面</button>
      </div>
    </div>
  `;
  document.getElementById("bootstrap-retry-btn")?.addEventListener("click", () => {
    window.location.reload();
  });
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
