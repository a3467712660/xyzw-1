<template>
  <MyCard
    class="dream-helper-card"
    :panel-active="panelActive"
    :status-class="{ active: isBusy || activeBattleCount > 0 }"
  >
    <template #icon>
      <img :alt="t('dreamHelperCard.iconAlt')" :src="iconPath">
    </template>
    <template #title>
      <h3>{{ t("dreamHelperCard.title") }}</h3>
    </template>
    <template #badge>
      <span>{{ isBusy || activeBattleCount > 0 ? t("dreamHelperCard.status.running") : t("dreamHelperCard.status.stopped") }}</span>
    </template>
    <template #default>
      <div class="gwb2-mini-card__stack">
        <div class="gwb2-mini-card__segmented dream-tabs">
          <button
            class="dream-tabs__item"
            type="button"
            :class="{ active: activeTab === 'battle' }"
            @click="activeTab = 'battle'"
          >
            {{ t("dreamHelperCard.tabs.battle") }}
          </button>
          <button
            class="dream-tabs__item"
            type="button"
            :class="{ active: activeTab === 'buy' }"
            @click="activeTab = 'buy'"
          >
            {{ t("dreamHelperCard.tabs.buy") }}
          </button>
        </div>

        <DreamHelperBattlePanel
          v-if="activeTab === 'battle'"
          :active-battle-count="activeBattleCount"
          :continuous-battles="continuousBattles"
          :empty-text="t('dreamHelperCard.messages.getTeamFirst')"
          :is-busy="isBusy"
          :team-heroes="teamHeroes"
          :title="t('dreamHelperCard.labels.currentTeam')"
          @get-team="getDefaultTeam"
          @select-lineup="selectDreamTeam"
          @stop-all="stopAllBattles"
          @toggle-battle="toggleContinuousBattle"
        ></DreamHelperBattlePanel>

        <DreamHelperMerchantPanel
          v-else
          :empty-text="merchantDataLoaded ? '暂无可购买商品' : '请先获取商品列表'"
          :is-busy="isBusy"
          :merchant-data-loaded="merchantDataLoaded"
          :merchant-sections="merchantSections"
          :title="t('dreamHelperCard.labels.merchantList')"
          @buy-gold="buyAllGoldItems"
          @buy-gold-fish="buyAllGoldFishItems"
          @refresh-merchant="refreshMerchantList"
        ></DreamHelperMerchantPanel>
      </div>
    </template>
    <template #action>
      <div class="gwb2-mini-card__action-rail gwb2-mini-card__action-rail--single">
        <n-button
          block
          secondary
          size="small"
          type="primary"
          :disabled="isBusy"
          @click="startDreamHelper"
        >
          {{ isBusy ? t("dreamHelperCard.status.running") : t("dreamHelperCard.actions.start") }}
        </n-button>
      </div>
    </template>
  </MyCard>
</template>

<script setup>
import { computed, onBeforeUnmount, ref } from "vue";
import { useMessage } from "naive-ui/es";
import { useI18n } from "vue-i18n";
import { useTokenStore } from "@/stores/tokenStore";
import MyCard from "../Common/MyCard.vue";
import DreamHelperBattlePanel from "./dream-helper/DreamHelperBattlePanel.vue";
import DreamHelperMerchantPanel from "./dream-helper/DreamHelperMerchantPanel.vue";
import {
  goldItemsConfig,
  isDungeonOpen,
  merchantConfig,
} from "@/utils/dreamConstants";

defineProps({
  panelActive: {
    type: Boolean,
    default: true,
  },
});

const tokenStore = useTokenStore();
const message = useMessage();
const { t } = useI18n();

const iconPath = computed(
  () => `${import.meta.env.BASE_URL}174061875626614.png`,
);

const isRunning = ref(false);
const isLoading = ref(false);
const activeTab = ref("battle");
const hasDefaultInfo = ref(false);
const teamHeroes = ref([]);
const continuousBattles = ref({});
const merchantData = ref({ 1: [], 2: [], 3: [] });
const levelId = ref(0);
const merchantDataLoaded = ref(false);

const isBusy = computed(() => isRunning.value || isLoading.value);
const activeBattleCount = computed(() =>
  Object.values(continuousBattles.value).filter(Boolean).length,
);

const merchantSections = computed(() =>
  Object.entries(merchantData.value || {})
    .map(([merchantId, items]) => {
      const parsedMerchantId = Number.parseInt(merchantId, 10);
      return {
        id: parsedMerchantId,
        items: (items || []).map((item, pos) => ({
          color: getItemColor(parsedMerchantId, item),
          name: getItemName(parsedMerchantId, item),
          pos,
        })),
        name: merchantConfig[merchantId]?.name || `商人 ${merchantId}`,
      };
    })
    .filter((section) => section.items.length > 0),
);

const heroData = {
  101: { name: "司马懿", type: "魏国" },
  102: { name: "郭嘉", type: "魏国" },
  103: { name: "关羽", type: "蜀国" },
  104: { name: "诸葛亮", type: "蜀国" },
  105: { name: "周瑜", type: "吴国" },
  106: { name: "太史慈", type: "吴国" },
  107: { name: "吕布", type: "群雄" },
  108: { name: "华佗", type: "群雄" },
  109: { name: "甄姬", type: "魏国" },
  110: { name: "黄月英", type: "蜀国" },
  111: { name: "孙策", type: "吴国" },
  112: { name: "贾诩", type: "群雄" },
  113: { name: "曹仁", type: "魏国" },
  114: { name: "姜维", type: "蜀国" },
  115: { name: "孙坚", type: "吴国" },
  116: { name: "公孙瓒", type: "群雄" },
  117: { name: "典韦", type: "魏国" },
  118: { name: "赵云", type: "蜀国" },
  119: { name: "大乔", type: "吴国" },
  120: { name: "张角", type: "群雄" },
};

function delay(seconds) {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

function extractDefaultInfoFromResponse(response) {
  try {
    if (!response || !response.presetTeamInfo?.presetTeamInfo) {
      return false;
    }

    const useTeamId = response.presetTeamInfo.useTeamId.toString();
    const battleTeam = response.presetTeamInfo.presetTeamInfo[useTeamId].teamInfo;
    teamHeroes.value = [];

    for (let i = 0; i < 5; i += 1) {
      const heroKey = i.toString();
      if (!battleTeam[heroKey]) {
        continue;
      }

      const heroInfo = battleTeam[heroKey];
      const heroId = heroInfo.heroId || heroInfo;

      if (heroId !== 0 && heroData[heroId]) {
        teamHeroes.value.push({
          id: heroId,
          name: heroData[heroId].name,
          position: i,
          type: heroData[heroId].type,
        });
      }
    }

    hasDefaultInfo.value = true;
    return true;
  } catch {
    return false;
  }
}

async function getDefaultTeam() {
  if (!isDungeonOpen()) {
    message.warning(t("dreamHelperCard.messages.notOpen"));
    return false;
  }

  if (!tokenStore.selectedToken) {
    message.warning(t("dreamHelperCard.messages.selectTokenFirst"));
    return false;
  }

  isLoading.value = true;
  const tokenId = tokenStore.selectedToken.id;

  try {
    const roleInfo = await tokenStore.sendMessageWithPromise(
      tokenId,
      "presetteam_getinfo",
      {},
      15000,
    );

    if (roleInfo) {
      const extracted = extractDefaultInfoFromResponse(roleInfo);
      if (extracted) {
        message.success(t("dreamHelperCard.messages.teamLoaded"));
        return true;
      }
      message.error(t("dreamHelperCard.messages.teamExtractFailed"));
    }
  } catch (error) {
    message.error(t("dreamHelperCard.messages.getDefaultFailed", { error: error.message }));
  } finally {
    isLoading.value = false;
  }

  return false;
}

async function selectDreamTeam() {
  if (!isDungeonOpen()) {
    message.warning(t("dreamHelperCard.messages.notOpen"));
    return;
  }

  if (!tokenStore.selectedToken) {
    message.warning(t("dreamHelperCard.messages.selectTokenFirst"));
    return;
  }

  if (!hasDefaultInfo.value) {
    const success = await getDefaultTeam();
    if (!success) {
      message.warning(t("dreamHelperCard.messages.getTeamFirst"));
      return;
    }
  }

  isLoading.value = true;
  const tokenId = tokenStore.selectedToken.id;

  try {
    const battleTeam = {};
    let hasHero = false;

    for (let i = 0; i < 5; i += 1) {
      const hero = teamHeroes.value.find((item) => item.position === i);
      if (hero) {
        battleTeam[i.toString()] = hero.id;
        hasHero = true;
      } else {
        battleTeam[i.toString()] = 0;
      }
    }

    if (!hasHero) {
      message.warning(t("dreamHelperCard.messages.noHeroes"));
      return;
    }

    const response = await tokenStore.sendMessageWithPromise(
      tokenId,
      "dungeon_selecthero",
      {
        battleTeam,
      },
      15000,
    );

    if (response) {
      message.success(t("dreamHelperCard.messages.lineupSelected"));
    }
  } catch (error) {
    message.error(t("dreamHelperCard.messages.selectLineupFailed", { error: error.message }));
  } finally {
    isLoading.value = false;
  }
}

async function startSingleBattle(heroId) {
  if (!tokenStore.selectedToken) {
    return false;
  }

  const tokenId = tokenStore.selectedToken.id;

  try {
    const response = await tokenStore.sendMessageWithPromise(
      tokenId,
      "fight_startdungeon",
      {
        heroId: Number.parseInt(heroId, 10),
      },
      15000,
    );

    return Boolean(response);
  } catch (error) {
    if (
      error.message.includes("2600080")
      || error.message.includes("2600050")
    ) {
      return "stop";
    }
    return false;
  }
}

async function startContinuousBattle(heroId) {
  const heroName = heroData[heroId] ? heroData[heroId].name : `ID:${heroId}`;

  continuousBattles.value[heroId] = true;
  message.info(t("dreamHelperCard.messages.continuousBattleStarted", { hero: heroName }));

  while (continuousBattles.value[heroId]) {
    const result = await startSingleBattle(heroId);

    if (result === "stop") {
      stopContinuousBattle(heroId);
      break;
    }

    if (continuousBattles.value[heroId]) {
      await delay(0.1);
    }
  }
}

function stopContinuousBattle(heroId, { silent = false } = {}) {
  const heroName = heroData[heroId] ? heroData[heroId].name : `ID:${heroId}`;

  continuousBattles.value[heroId] = false;
  if (!silent) {
    message.info(t("dreamHelperCard.messages.continuousBattleStopped", { hero: heroName }));
  }
}

function toggleContinuousBattle(heroId) {
  if (continuousBattles.value[heroId]) {
    stopContinuousBattle(heroId);
    return;
  }

  void startContinuousBattle(heroId);
}

function stopAllBattles({ silent = false } = {}) {
  continuousBattles.value = {};
  if (!silent) {
    message.info(t("dreamHelperCard.messages.allBattlesStopped"));
  }
}

function getItemName(merchantId, index) {
  const merchant = merchantConfig[merchantId];
  if (merchant && merchant.items[index] !== undefined) {
    return merchant.items[index];
  }
  return t("dreamHelperCard.labels.unknownItem", { index });
}

function getItemColor(merchantId, index) {
  const itemName = getItemName(merchantId, index);

  if (itemName.includes("黄金鱼竿")) {
    return "#ffd700";
  }

  if (isGoldItem(merchantId, index)) {
    return "#ffa500";
  }

  return "#F3BCD6";
}

function isGoldItem(merchantId, index) {
  return goldItemsConfig[merchantId] && goldItemsConfig[merchantId].includes(index);
}

async function getRoleInfo() {
  if (!tokenStore.selectedToken) {
    return null;
  }

  const tokenId = tokenStore.selectedToken.id;

  const response = await tokenStore.sendMessageWithPromise(
    tokenId,
    "role_getroleinfo",
    {},
    15000,
  );

  if (response?.role?.dungeon?.merchant) {
    merchantData.value = response.role.dungeon.merchant;
  }

  if (response?.role?.levelId) {
    levelId.value = response.role.levelId;
  }

  return { levelId: levelId.value, merchantData: merchantData.value };
}

async function buyItem(merchantId, index, pos) {
  if (!tokenStore.selectedToken) {
    return false;
  }

  const tokenId = tokenStore.selectedToken.id;

  try {
    const response = await tokenStore.sendMessageWithPromise(
      tokenId,
      "dungeon_buymerchant",
      {
        id: merchantId,
        index,
        pos,
      },
      15000,
    );

    return response && response.code === 0;
  } catch {
    return false;
  }
}

async function buyAllGoldItems() {
  if (!isDungeonOpen()) {
    message.warning(t("dreamHelperCard.messages.notOpen"));
    return;
  }

  if (levelId.value < 4000) {
    message.warning(t("dreamHelperCard.messages.levelTooLow"));
    return;
  }

  isRunning.value = true;
  let successCount = 0;
  let failCount = 0;

  for (const merchantId in merchantData.value) {
    const items = merchantData.value[merchantId];
    const numId = Number.parseInt(merchantId, 10);

    for (let pos = items.length - 1; pos >= 0; pos -= 1) {
      const index = items[pos];

      if (!isGoldItem(numId, index)) {
        continue;
      }

      try {
        const success = await buyItem(numId, index, pos);
        if (success) {
          successCount += 1;
        } else {
          failCount += 1;
        }
      } catch {
        failCount += 1;
      }

      await delay(0.5);
    }
  }

  await refreshMerchantList();

  message.success(t("dreamHelperCard.messages.quickBuyDone", { success: successCount, fail: failCount }));
  isRunning.value = false;
}

async function buyAllGoldFishItems() {
  if (!isDungeonOpen()) {
    message.warning(t("dreamHelperCard.messages.notOpen"));
    return;
  }

  if (levelId.value < 4000) {
    message.warning(t("dreamHelperCard.messages.levelTooLow"));
    return;
  }

  isRunning.value = true;
  let successCount = 0;
  let failCount = 0;

  const items = merchantData.value[3] || [];
  for (let pos = items.length - 1; pos >= 0; pos -= 1) {
    const index = items[pos];

    if (index !== 2) {
      continue;
    }

    try {
      const success = await buyItem(3, index, pos);
      if (success) {
        successCount += 1;
      } else {
        failCount += 1;
      }
    } catch {
      failCount += 1;
    }

    await delay(0.5);
  }

  await refreshMerchantList();

  message.success(t("dreamHelperCard.messages.quickBuyDone", { success: successCount, fail: failCount }));
  isRunning.value = false;
}

async function refreshMerchantList() {
  if (!isDungeonOpen()) {
    message.warning(t("dreamHelperCard.messages.notOpen"));
    return;
  }

  if (!tokenStore.selectedToken) {
    message.warning(t("dreamHelperCard.messages.selectTokenFirst"));
    return;
  }

  try {
    message.info(t("dreamHelperCard.messages.startMerchantFlow"));

    await getDefaultTeam();
    await selectDreamTeam();
    await getRoleInfo();
    merchantDataLoaded.value = true;

    message.success(t("dreamHelperCard.messages.merchantLoaded"));
  } catch (error) {
    message.error(t("dreamHelperCard.messages.merchantLoadFailed", { error: error.message }));
  }
}

async function startDreamHelper() {
  if (!tokenStore.selectedToken) {
    message.warning(t("dreamHelperCard.messages.selectTokenFirst"));
    return;
  }

  if (!isDungeonOpen()) {
    message.warning(t("dreamHelperCard.messages.notOpen"));
    return;
  }

  isRunning.value = true;
  message.info(t("dreamHelperCard.messages.running"));

  await getDefaultTeam();

  isRunning.value = false;
  message.success(t("dreamHelperCard.messages.done"));
}

onBeforeUnmount(() => {
  stopAllBattles({ silent: true });
});
</script>

<style scoped lang="scss">
.dream-tabs__item {
  flex: 1;
}

@media (max-width: 959px) {
  .dream-tabs {
    width: 100%;
  }
}
</style>
