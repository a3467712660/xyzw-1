import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const parseBoolEnv = (value, fallback = false) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return fallback;
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
};

async function safeImport(moduleName, humanName) {
  try {
    return await import(moduleName);
  } catch (error) {
    if (error?.code === "ERR_MODULE_NOT_FOUND") {
      console.warn(
        `[vite] Optional dependency "${moduleName}" (${humanName}) not found; continuing without it.`,
      );
      return null;
    }
    throw error;
  }
}

export default defineConfig(async ({ command, mode }) => {
  let basicSsl;
  try {
    ({ default: basicSsl } = await import("@vitejs/plugin-basic-ssl"));
  } catch (error) {
    if (error?.code !== "ERR_MODULE_NOT_FOUND") {
      throw error;
    }
    console.warn(
      "[vite] '@vitejs/plugin-basic-ssl' not found, starting without HTTPS support.",
    );
  }

  const autoImportModule = await safeImport(
    "unplugin-auto-import/vite",
    "auto-imports",
  );
  const componentsModule = await safeImport(
    "unplugin-vue-components/vite",
    "component auto-registration",
  );
  const componentsResolversModule = componentsModule
    ? await safeImport(
        "unplugin-vue-components/resolvers",
        "component resolvers",
      )
    : null;
  const unoCssModule = await safeImport("unocss/vite", "UnoCSS");
  const vueDevToolsModule = await safeImport(
    "vite-plugin-vue-devtools",
    "Vue DevTools",
  );
  const vueI18nModule = await safeImport(
    "@intlify/unplugin-vue-i18n/vite",
    "Vue I18n pre-compiler",
  );

  const autoImportPlugin = autoImportModule?.default?.({
    imports: ["vue", "vue-router", "vue-i18n"],
    dts: "src/auto-imports.d.ts",
  });

  const { ArcoResolver, NaiveUiResolver } = componentsResolversModule ?? {};
  const componentsPlugin = componentsModule?.default?.({
    dirs: ["src/components"],
    resolvers: [
      ArcoResolver &&
        ArcoResolver({
          importStyle: false,
        }),
      NaiveUiResolver && NaiveUiResolver(),
    ].filter(Boolean),
  });

  const unoCssPlugin = unoCssModule?.default?.();
  const vueDevToolsPlugin = vueDevToolsModule?.default?.();
  const vueI18nPlugin = vueI18nModule?.default?.({
    module: "vue-i18n",
    include: path.resolve(__dirname, "./src/locales/**"),
  });

  const coreDevProxy = {
    "/api/v1": {
      target: "http://localhost:8787",
      changeOrigin: true,
    },
    "/ws": {
      target: "ws://localhost:8787",
      ws: true,
      changeOrigin: true,
    },
  };

  const thirdPartyDebugProxy = {
    "/api/weixin": {
      target: "https://open.weixin.qq.com",
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/api\/weixin/, ""),
      secure: true,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Linux; Android 7.0; Mi-4c Build/NRD90M; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/53.0.2785.49 Mobile MQQBrowser/6.2 TBS/043632 Safari/537.36 MicroMessenger/6.6.1.1220(0x26060135) NetType/WIFI Language/zh_CN",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        Referer: "https://open.weixin.qq.com/",
      },
    },
    "/api/weixin-long": {
      target: "https://long.open.weixin.qq.com",
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/api\/weixin-long/, ""),
      secure: true,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Linux; Android 7.0; Mi-4c Build/NRD90M; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/53.0.2785.49 Mobile MQQBrowser/6.2 TBS/043632 Safari/537.36 MicroMessenger/6.6.1.1220(0x26060135) NetType/WIFI Language/zh_CN",
        Accept: "*/*",
        Referer: "https://open.weixin.qq.com/",
      },
    },
    "/api/hortor": {
      target: "https://comb-platform.hortorgames.com",
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/api\/hortor/, ""),
      secure: true,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Linux; Android 12; 23117RK66C Build/V417IR; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/95.0.4638.74 Mobile Safari/537.36",
        Accept: "*/*",
        Host: "comb-platform.hortorgames.com",
        Connection: "keep-alive",
        "Content-Type": "text/plain; charset=utf-8",
        Origin: "https://open.weixin.qq.com",
        Referer: "https://open.weixin.qq.com/",
      },
    },
  };

  const plugins = [
    vue(),
    vueDevToolsPlugin,
    basicSsl && basicSsl(),
    unoCssPlugin,
    autoImportPlugin,
    componentsPlugin,
    vueI18nPlugin,
  ].filter(Boolean);
  const isDebugMode = mode === "debug";
  const exposeHost = parseBoolEnv(process.env.VITE_DEV_EXPOSE_HOST, isDebugMode);
  const enableDebugProxy = parseBoolEnv(process.env.VITE_DEV_DEBUG_PROXY, isDebugMode);
  const autoOpenBrowser = parseBoolEnv(process.env.VITE_DEV_OPEN, isDebugMode);
  if (command === "build" && (isDebugMode || enableDebugProxy)) {
    throw new Error(
      "Refusing to build with debug mode or debug proxy enabled. Use production mode with VITE_DEV_DEBUG_PROXY=false.",
    );
  }
  const devHost = exposeHost
    ? String(process.env.VITE_DEV_HOST || "0.0.0.0").trim() || "0.0.0.0"
    : "127.0.0.1";
  const devAllowedHosts = exposeHost ? ["cn.xq5007.fun", "xyzw.xq5007.fun"] : [];
  const previewAllowedHosts = Array.from(
    new Set(["xyzw.xq5007.fun", ...devAllowedHosts]),
  );
  const devProxy = enableDebugProxy
    ? {
        ...coreDevProxy,
        ...thirdPartyDebugProxy,
      }
    : {
        ...coreDevProxy,
      };

  return {
    plugins,
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes("node_modules")) {
              // Keep exceljs in its own on-demand async graph.
              if (id.includes("/exceljs/")) {
                return;
              }
              if (id.includes("/vue/")) {
                return "vendor-vue";
              }
              if (id.includes("/vue-router/") || id.includes("/pinia/")) {
                return "vendor-state";
              }
              if (id.includes("/naive-ui/")) {
                return "vendor-vue";
              }
              if (id.includes("/vue-i18n/") || id.includes("/@intlify/")) {
                return "vendor-i18n";
              }
              if (
                id.includes("/@arco-design/web-vue/es/date-picker/")
                || id.includes("/@arco-design/web-vue/es/time-picker/")
              ) {
                return "vendor-arco-date";
              }
              if (id.includes("/@arco-design/")) {
                return "vendor-arco";
              }
              if (id.includes("/element-plus/")) {
                return "vendor-element";
              }
              if (id.includes("/@vicons/") || id.includes("/@iconify/")) {
                return "vendor-icons";
              }
              if (id.includes("/axios/")) {
                return "vendor-network";
              }
              if (id.includes("/html2canvas/")) {
                return "vendor-capture";
              }
              if (id.includes("/crypto-js/")) {
                return "vendor-crypto";
              }
              if (id.includes("/moment/")) {
                return "vendor-moment";
              }
              if (id.includes("/lodash-es/")) {
                return "vendor-lodash";
              }
              if (
                id.includes("/date-fns/")
                || id.includes("/date-fns-tz/")
                || id.includes("/dayjs/")
              ) {
                return "vendor-date";
              }
              if (id.includes("/@vueuse/")) {
                return "vendor-vueuse";
              }
              if (id.includes("/idb/")) {
                return "vendor-storage";
              }
              if (id.includes("/p-queue/")) {
                return "vendor-queue";
              }
              if (id.includes("/lz4js/")) {
                return "vendor-compress";
              }
              if (id.includes("/tesseract.js/")) {
                return "vendor-ocr";
              }
              return "vendor-misc";
            }

            if (id.includes("/src/xyzw/")) {
              return "xyzw-runtime";
            }

            if (
              id.includes("/src/utils/batch/daily.js")
              || id.includes("/src/utils/batch/tasksBottle.js")
              || id.includes("/src/utils/batch/tasksHangUp.js")
              || id.includes("/src/utils/batch/tasksItem.js")
            ) {
              return "task-control-daily";
            }

            if (
              id.includes("/src/utils/batch/combat.js")
              || id.includes("/src/utils/batch/tasksArena.js")
              || id.includes("/src/utils/batch/tasksDungeon.js")
              || id.includes("/src/utils/batch/tasksTower.js")
            ) {
              return "task-control-combat";
            }

            if (
              id.includes("/src/utils/batch/resource.js")
              || id.includes("/src/utils/batch/tasksCar.js")
              || id.includes("/src/utils/batch/tasksLegacy.js")
              || id.includes("/src/utils/batch/tasksStore.js")
            ) {
              return "task-control-resource";
            }

            if (
              id.includes("/src/views/BatchDailyTasks.vue")
              || id.includes("/src/composables/useBatch")
              || id.includes("/src/composables/useScheduledTask")
              || id.includes("/src/composables/useTokenGroupManager")
              || id.includes("/src/composables/useTaskTemplateManager")
              || id.includes("/src/composables/useTokenTaskSettings")
              || id.includes("/src/composables/useWarGuessManager")
              || id.includes("/src/composables/useLegacyGiftManager")
              || id.includes("/src/composables/createBatchTaskDeps")
              || id.includes("/src/utils/batch/")
              || id.includes("/src/utils/dailyTaskRunner")
            ) {
              return "task-control-runner";
            }
          },
        },
      },
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"),
        "@components": path.resolve(__dirname, "src/components"),
        "@views": path.resolve(__dirname, "src/views"),
        "@assets": path.resolve(__dirname, "src/assets"),
        "@utils": path.resolve(__dirname, "src/utils"),
        "@api": path.resolve(__dirname, "src/api"),
        "@stores": path.resolve(__dirname, "src/stores"),
      },
    },
    server: {
      port: 3000,
      open: autoOpenBrowser,
      host: devHost,
      allowedHosts: devAllowedHosts,
      proxy: devProxy,
    },
    preview: {
      host: devHost,
      allowedHosts: previewAllowedHosts,
    },
    css: {
      preprocessorOptions: {
        scss: {
          additionalData: '@use "@/assets/styles/variables.scss" as vars;',
        },
      },
    },
  };
});
