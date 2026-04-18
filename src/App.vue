<template>
  <n-config-provider
    :breakpoints="naiveBreakpoints"
    :theme="naiveTheme"
    :theme-overrides="naiveThemeOverrides"
  >
    <n-message-provider>
      <n-loading-bar-provider>
        <n-notification-provider>
          <n-dialog-provider>
            <div id="app">
              <a class="app-skip-link" href="#app-main">跳到主要内容</a>
              <div aria-hidden="true" class="app-flow-bg">
                <span class="flow-orb flow-orb--a"></span>
                <span class="flow-orb flow-orb--b"></span>
                <span class="flow-orb flow-orb--c"></span>
                <span class="flow-grain"></span>
                <span class="flow-scanline"></span>
              </div>
              <main id="app-main" class="app-content" tabindex="-1">
                <router-view v-slot="{ Component, route }">
                  <transition
                    mode="out-in"
                    :name="getShellTransitionName(route)"
                  >
                    <component
                      :is="Component"
                      :key="getShellRouteKey(route)"
                    ></component>
                  </transition>
                </router-view>
              </main>
            </div>
          </n-dialog-provider>
        </n-notification-provider>
      </n-loading-bar-provider>
    </n-message-provider>
  </n-config-provider>
</template>

<script setup>
import { computed, onMounted, onUnmounted } from "vue";
import { darkTheme } from "naive-ui/es";
import { useTheme } from "@/composables/useTheme";
import { APP_BREAKPOINTS } from "@/constants/ui";

const naiveBreakpoints = APP_BREAKPOINTS;

const {
  isDark,
  initTheme,
  setupSystemThemeListener,
  cleanupSystemThemeListener,
  updateReactiveState,
} = useTheme();

const naiveTheme = computed(() => (isDark.value ? darkTheme : null));

const naiveThemeOverrides = computed(() => {
  const isNight = isDark.value;
  const palette = {
    primary: "#0f6bff",
    primaryHover: "#0a58d8",
    primaryPressed: "#0847ad",
    accent: "#14b8a6",
    success: "#16a34a",
    warning: "#d97706",
    error: "#dc2626",
    info: "#2563eb",
    text1: isNight ? "#f8fafc" : "#0f172a",
    text2: isNight ? "#cbd5e1" : "#334155",
    text3: isNight ? "#94a3b8" : "#64748b",
    body: isNight ? "#050b16" : "#f8fbff",
    card: isNight ? "rgba(10, 20, 36, 0.9)" : "rgba(255, 255, 255, 0.88)",
    elevated: isNight ? "#0d1a2d" : "#ffffff",
    border: isNight ? "#20324d" : "#d9e2ef",
    hover: isNight ? "rgba(15, 107, 255, 0.16)" : "rgba(15, 107, 255, 0.08)",
    modal: isNight ? "#091221" : "#ffffff",
    divider: isNight ? "#2a4161" : "#d9e2ef",
  };

  return {
    common: {
      primaryColor: palette.primary,
      primaryColorHover: palette.primaryHover,
      primaryColorPressed: palette.primaryPressed,
      primaryColorSuppl: palette.accent,
      successColor: palette.success,
      warningColor: palette.warning,
      errorColor: palette.error,
      infoColor: palette.info,
      bodyColor: palette.body,
      cardColor: palette.card,
      modalColor: palette.modal,
      popoverColor: palette.modal,
      tableColor: palette.elevated,
      dividerColor: palette.divider,
      borderColor: palette.border,
      textColorBase: palette.text1,
      textColor1: palette.text1,
      textColor2: palette.text2,
      textColor3: palette.text3,
      textColorDisabled: isNight ? "#667085" : "#98a2b3",
      placeholderColor: isNight ? "rgba(208, 213, 221, 0.52)" : "rgba(102, 112, 133, 0.68)",
      hoverColor: palette.hover,
      fontFamily:
        "\"Segoe UI Variable\", \"Avenir Next\", \"PingFang SC\", \"HarmonyOS Sans SC\", \"Microsoft YaHei\", sans-serif",
      fontFamilyMono:
        "\"JetBrains Mono\", \"SF Mono\", \"Monaco\", \"Inconsolata\", \"Roboto Mono\", monospace",
      borderRadius: "18px",
      borderRadiusSmall: "10px",
      borderRadiusMedium: "16px",
      borderRadiusLarge: "22px",
      boxShadow1: isNight
        ? "0 12px 28px rgba(0, 0, 0, 0.28)"
        : "0 10px 24px rgba(15, 23, 42, 0.06)",
      boxShadow2: isNight
        ? "0 22px 46px rgba(0, 0, 0, 0.34)"
        : "0 18px 42px rgba(15, 23, 42, 0.1)",
      boxShadow3: isNight
        ? "0 34px 72px rgba(0, 0, 0, 0.42)"
        : "0 28px 56px rgba(15, 23, 42, 0.16)",
    },
    Layout: {
      color: palette.body,
      siderColor: isNight ? "rgba(7, 15, 27, 0.96)" : "rgba(255, 255, 255, 0.84)",
      headerColor: isNight ? "rgba(9, 18, 32, 0.84)" : "rgba(255, 255, 255, 0.78)",
      colorEmbedded: palette.body,
      borderColor: palette.border,
      siderBorderColor: palette.border,
      headerBorderColor: palette.border,
    },
    Card: {
      color: palette.card,
      colorModal: palette.modal,
      borderRadius: "22px",
      borderColor: palette.border,
      paddingSmall: "16px",
      paddingMedium: "20px",
      paddingLarge: "24px",
      titleTextColor: palette.text1,
      textColor: palette.text2,
    },
    Drawer: {
      color: palette.modal,
      borderRadius: "24px",
    },
    Modal: {
      color: palette.modal,
      borderRadius: "24px",
    },
    DataTable: {
      tdColor: palette.elevated,
      thColor: isNight ? "rgba(18, 32, 58, 0.92)" : "rgba(247, 249, 252, 0.9)",
      borderColor: palette.border,
      tdTextColor: palette.text2,
      thTextColor: palette.text1,
      tdColorHover: palette.hover,
    },
    Menu: {
      itemColorActive: palette.hover,
      itemColorActiveHover: palette.hover,
      itemTextColorActive: palette.primary,
      itemTextColorActiveHover: palette.primary,
      itemIconColorActive: palette.primary,
      itemIconColorActiveHover: palette.primary,
      arrowColor: palette.text3,
      arrowColorHover: palette.text1,
      dividerColor: palette.border,
      groupTextColor: palette.text3,
    },
    Input: {
      borderHover: palette.primaryHover,
      borderFocus: palette.primary,
      boxShadowFocus: `0 0 0 3px ${isNight ? "rgba(71, 122, 178, 0.2)" : "rgba(63, 119, 173, 0.14)"}`,
      color: palette.elevated,
      colorFocus: palette.elevated,
      textColor: palette.text1,
      placeholderColor: isNight ? "rgba(208, 213, 221, 0.52)" : "rgba(102, 112, 133, 0.68)",
    },
    Select: {
      peers: {
        InternalSelection: {
          color: palette.elevated,
          textColor: palette.text1,
        },
      },
    },
  };
});

const handleThemeChange = () => {
  updateReactiveState();
  setTimeout(() => {
    updateReactiveState();
  }, 50);
};

const recoverInteractionLayers = () => {
  if (typeof window === "undefined") return;

  const overlaySelectors = [".n-modal-mask", ".n-drawer-mask"];
  const overlays = document.querySelectorAll(overlaySelectors.join(","));

  overlays.forEach((overlay) => {
    const style = window.getComputedStyle(overlay);
    const isHidden =
      style.display === "none"
      || style.visibility === "hidden"
      || Number.parseFloat(style.opacity || "1") < 0.02;

    if (isHidden) {
      overlay.style.pointerEvents = "none";
    } else {
      overlay.style.pointerEvents = "";
    }
  });
};

const handleVisibilityResume = () => {
  if (document.visibilityState === "visible") {
    recoverInteractionLayers();
  }
};

const getShellRouteKey = (route) => route?.matched?.[0]?.path || route?.path || "/";
const getShellTransitionName = (route) =>
  route?.name === "Home" ? "page-none" : "page-shell";

onMounted(() => {
  initTheme();
  setupSystemThemeListener();
  window.addEventListener("theme-change", handleThemeChange);
  window.addEventListener("focus", recoverInteractionLayers);
  window.addEventListener("pageshow", recoverInteractionLayers);
  document.addEventListener("visibilitychange", handleVisibilityResume);
  updateReactiveState();
  recoverInteractionLayers();
});

onUnmounted(() => {
  cleanupSystemThemeListener();
  window.removeEventListener("theme-change", handleThemeChange);
  window.removeEventListener("focus", recoverInteractionLayers);
  window.removeEventListener("pageshow", recoverInteractionLayers);
  document.removeEventListener("visibilitychange", handleVisibilityResume);
});
</script>

<style>
html.dark,
html[data-theme="dark"] {
  color-scheme: dark;
}

#app {
  min-height: 100dvh;
  position: relative;
  overflow-x: hidden;
  color: var(--text-primary);
  transition:
    background 0.3s ease,
    color 0.3s ease;
}

.app-skip-link {
  position: fixed;
  top: 12px;
  left: 12px;
  z-index: calc(var(--z-toast) + 1);
  padding: 10px 14px;
  border-radius: 999px;
  background: var(--console-panel-strong);
  border: 1px solid var(--surface-glass-border);
  box-shadow: var(--shadow-light);
  color: var(--text-primary);
  transform: translateY(-180%);
  transition: transform var(--transition-fast);
}

.app-skip-link:focus-visible {
  transform: translateY(0);
}

.app-content {
  position: relative;
  z-index: 1;
  isolation: isolate;
}

.app-flow-bg {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  overflow: hidden;
  background: var(--bg-gradient);
  isolation: isolate;
}

.app-flow-bg::before {
  content: "";
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 18% 12%, rgba(15, 107, 255, 0.06), transparent 22%),
    radial-gradient(circle at 84% 18%, rgba(20, 184, 166, 0.07), transparent 22%),
    radial-gradient(circle at 50% 100%, rgba(249, 115, 22, 0.08), transparent 28%);
}

.flow-orb {
  position: absolute;
  border-radius: 999px;
  filter: blur(44px);
  opacity: 0.44;
  transform: translateZ(0);
}

.flow-orb--a {
  width: 42vw;
  height: 42vw;
  left: -12vw;
  top: -10vh;
  background: radial-gradient(circle, var(--flow-orb-a), transparent 70%);
  animation: app-flow-a 28s ease-in-out infinite alternate;
}

.flow-orb--b {
  width: 40vw;
  height: 40vw;
  right: -10vw;
  top: 18vh;
  background: radial-gradient(circle, var(--flow-orb-b), transparent 72%);
  animation: app-flow-b 32s ease-in-out infinite alternate;
}

.flow-orb--c {
  width: 34vw;
  height: 34vw;
  left: 26vw;
  bottom: -18vh;
  background: radial-gradient(circle, var(--flow-orb-c), transparent 74%);
  animation: app-flow-c 36s ease-in-out infinite;
}

.flow-grain {
  position: absolute;
  inset: 0;
  opacity: 0.1;
  background-image: radial-gradient(var(--flow-grain) 0.6px, transparent 0.6px);
  background-size: 3px 3px;
  mask-image: linear-gradient(to bottom, rgba(0, 0, 0, 0.34), transparent 74%);
  animation: app-grain-move 20s linear infinite;
}

.flow-scanline {
  position: absolute;
  inset: 0;
  opacity: 0.06;
  background:
    linear-gradient(
      180deg,
      rgba(148, 163, 184, 0.08),
      rgba(148, 163, 184, 0) 32%
    ),
    repeating-linear-gradient(
      180deg,
      rgba(255, 255, 255, 0.02) 0,
      rgba(255, 255, 255, 0.02) 1px,
      transparent 1px,
      transparent 4px
    );
  mix-blend-mode: soft-light;
}

@keyframes app-flow-a {
  0% {
    transform: translate3d(0, 0, 0) scale(1);
  }
  100% {
    transform: translate3d(9vw, 12vh, 0) scale(1.08);
  }
}

@keyframes app-flow-b {
  0% {
    transform: translate3d(0, 0, 0) scale(1);
  }
  100% {
    transform: translate3d(-8vw, -10vh, 0) scale(1.06);
  }
}

@keyframes app-flow-c {
  0%,
  100% {
    transform: translate3d(0, 0, 0) scale(1);
  }
  50% {
    transform: translate3d(3vw, -8vh, 0) scale(1.05);
  }
}

@keyframes app-grain-move {
  0% {
    transform: translate3d(0, 0, 0);
  }
  100% {
    transform: translate3d(-16px, -12px, 0);
  }
}

@media (prefers-reduced-motion: reduce) {
  html:not([data-motion="force"]) .flow-orb,
  html:not([data-motion="force"]) .flow-grain {
    animation: none !important;
  }

  html:not([data-motion="force"]) .flow-scanline {
    display: none;
  }
}
</style>
