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
              <div aria-hidden="true" class="app-flow-bg">
                <span class="flow-orb flow-orb--a"></span>
                <span class="flow-orb flow-orb--b"></span>
                <span class="flow-orb flow-orb--c"></span>
                <span class="flow-grain"></span>
              </div>
              <div class="app-content">
                <router-view v-slot="{ Component, route }">
                  <transition
                    appear
                    mode="out-in"
                    :name="getShellTransitionName(route)"
                  >
                    <component
                      :is="Component"
                      :key="getShellRouteKey(route)"
                    ></component>
                  </transition>
                </router-view>
              </div>
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
    primary: "#3f77ad",
    primaryHover: "#345f8a",
    primaryPressed: "#2b4f74",
    accent: "#5a9b8e",
    success: "#3f8f6b",
    warning: "#c9954d",
    error: "#bc5a71",
    info: "#4b83b8",
    text1: isNight ? "#f2f4f7" : "#101828",
    text2: isNight ? "#d0d5dd" : "#344054",
    text3: isNight ? "#98a2b3" : "#667085",
    body: isNight ? "#08121f" : "#f7f9fc",
    card: isNight ? "rgba(14, 29, 52, 0.88)" : "rgba(255, 255, 255, 0.88)",
    elevated: isNight ? "#12203a" : "#ffffff",
    border: isNight ? "#25324d" : "#e4e7ec",
    hover: isNight ? "rgba(71, 122, 178, 0.16)" : "rgba(63, 119, 173, 0.08)",
    modal: isNight ? "#12203a" : "#ffffff",
    divider: isNight ? "#25324d" : "#e4e7ec",
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
        "\"Avenir Next\", \"PingFang SC\", \"HarmonyOS Sans SC\", \"Segoe UI Variable\", \"Microsoft YaHei\", sans-serif",
      fontFamilyMono:
        "\"JetBrains Mono\", \"SF Mono\", \"Monaco\", \"Inconsolata\", \"Roboto Mono\", monospace",
      borderRadius: "14px",
      borderRadiusSmall: "8px",
      borderRadiusMedium: "14px",
      borderRadiusLarge: "18px",
      boxShadow1: isNight
        ? "0 4px 18px rgba(0, 0, 0, 0.32)"
        : "0 2px 10px rgba(16, 24, 40, 0.05)",
      boxShadow2: isNight
        ? "0 16px 34px rgba(0, 0, 0, 0.38)"
        : "0 8px 24px rgba(16, 24, 40, 0.09)",
      boxShadow3: isNight
        ? "0 26px 54px rgba(0, 0, 0, 0.45)"
        : "0 16px 40px rgba(16, 24, 40, 0.14)",
    },
    Layout: {
      color: palette.body,
      siderColor: isNight ? "rgba(10, 22, 38, 0.92)" : "rgba(255, 255, 255, 0.8)",
      headerColor: isNight ? "rgba(12, 25, 45, 0.78)" : "rgba(255, 255, 255, 0.72)",
      colorEmbedded: palette.body,
      borderColor: palette.border,
      siderBorderColor: palette.border,
      headerBorderColor: palette.border,
    },
    Card: {
      color: palette.card,
      colorModal: palette.modal,
      borderRadius: "18px",
      borderColor: palette.border,
      paddingSmall: "16px",
      paddingMedium: "20px",
      paddingLarge: "24px",
      titleTextColor: palette.text1,
      textColor: palette.text2,
    },
    Drawer: {
      color: palette.modal,
      borderRadius: "18px",
    },
    Modal: {
      color: palette.modal,
      borderRadius: "18px",
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
  min-height: 100vh;
  position: relative;
  overflow-x: hidden;
  color: var(--text-primary);
  transition:
    background 0.3s ease,
    color 0.3s ease;
}

.app-content {
  position: relative;
  z-index: 1;
}

.app-flow-bg {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  overflow: hidden;
  background: var(--bg-gradient);
}

.flow-orb {
  position: absolute;
  border-radius: 999px;
  filter: blur(52px);
  opacity: 0.56;
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
  opacity: 0.18;
  background-image: radial-gradient(var(--flow-grain) 0.6px, transparent 0.6px);
  background-size: 3px 3px;
  mask-image: linear-gradient(to bottom, rgba(0, 0, 0, 0.34), transparent 74%);
  animation: app-grain-move 20s linear infinite;
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
}
</style>
