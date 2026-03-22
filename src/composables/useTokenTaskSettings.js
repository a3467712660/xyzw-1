import { computed, reactive, ref } from "vue";

function createDefaultSettings() {
  return {
    arenaFormation: 1,
    towerFormation: 1,
    bossFormation: 1,
    bossTimes: 2,
    claimBottle: true,
    payRecruit: true,
    openBox: true,
    arenaEnable: true,
    claimHangUp: true,
    claimEmail: true,
    blackMarketPurchase: true,
  };
}

export function useTokenTaskSettings({
  batchFish,
  batchOpenBox,
  batchRecruit,
  message,
}) {
  const showSettingsModal = ref(false);
  const currentSettingsTokenId = ref(null);
  const currentSettingsTokenName = ref("");
  const currentSettings = reactive(createDefaultSettings());

  const showHelperModal = ref(false);
  const helperType = ref("box");
  const helperSettings = reactive({
    boxType: 2001,
    fishType: 1,
    count: 100,
  });

  const helperModalTitle = computed(() => {
    const titles = { box: "批量开宝箱", fish: "批量钓鱼", recruit: "批量招募" };
    return titles[helperType.value] || "批量助手";
  });

  const loadSettings = (tokenId) => {
    try {
      const raw = localStorage.getItem(`daily-settings:${tokenId}`);
      const defaultSettings = createDefaultSettings();
      return raw ? { ...defaultSettings, ...JSON.parse(raw) } : defaultSettings;
    } catch (error) {
      console.error("Failed to load settings:", error);
      return null;
    }
  };

  const openSettings = (token) => {
    currentSettingsTokenId.value = token.id;
    currentSettingsTokenName.value = token.name;
    const saved = loadSettings(token.id);
    Object.assign(currentSettings, saved);
    showSettingsModal.value = true;
  };

  const saveSettings = () => {
    if (currentSettingsTokenId.value) {
      localStorage.setItem(
        `daily-settings:${currentSettingsTokenId.value}`,
        JSON.stringify(currentSettings),
      );
      message.success(`已保存 ${currentSettingsTokenName.value} 的设置`);
      showSettingsModal.value = false;
    }
  };

  const openHelperModal = (type) => {
    helperType.value = type;
    showHelperModal.value = true;
  };

  const executeHelper = () => {
    if (helperSettings.count % 10 !== 0 || helperSettings.count < 10) {
      message.warning("消耗数量必须是10的整数倍，最小为10");
      return;
    }
    showHelperModal.value = false;
    if (helperType.value === "box") {
      batchOpenBox();
    } else if (helperType.value === "fish") {
      batchFish();
    } else if (helperType.value === "recruit") {
      batchRecruit();
    }
  };

  return {
    currentSettings,
    currentSettingsTokenId,
    currentSettingsTokenName,
    executeHelper,
    helperModalTitle,
    helperSettings,
    helperType,
    loadSettings,
    openHelperModal,
    openSettings,
    saveSettings,
    showHelperModal,
    showSettingsModal,
  };
}
