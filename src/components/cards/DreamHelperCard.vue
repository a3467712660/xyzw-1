<template>
  <MyCard class="dream-helper" :status-class="{ active: isRunning }">
    <template #icon>
      <img :alt="t('dreamHelperCard.iconAlt')" :src="iconPath">
    </template>
    <template #title>
      <h3>{{ t("dreamHelperCard.title") }}</h3>
    </template>
    <template #badge>
      <span>{{ isRunning ? t("dreamHelperCard.status.running") : t("dreamHelperCard.status.stopped") }}</span>
    </template>
    <template #default>
      <div class="dream-helper-content">
        <div class="gwb2-mini-card__segmented tabs">
          <button
            class="tab"
            type="button"
            :class="{ active: activeTab === 'battle' }"
            @click="activeTab = 'battle'"
          >
            {{ t("dreamHelperCard.tabs.battle") }}
          </button>
          <button
            class="tab"
            type="button"
            :class="{ active: activeTab === 'buy' }"
            @click="activeTab = 'buy'"
          >
            {{ t("dreamHelperCard.tabs.buy") }}
          </button>
        </div>

        <!-- 战斗模块 -->
        <div v-if="activeTab === 'battle'" class="tab-content">
          <div v-if="teamHeroes.length > 0" class="team-info">
            <div class="team-title">{{ t("dreamHelperCard.labels.currentTeam") }}</div>
            <div class="gwb2-mini-card__list team-list">
              <div v-for="hero in teamHeroes" :key="hero.id" class="hero-item">
                <div
                  class="hero-name"
                  :style="{ color: getTypeColor(hero.type) }"
                >
                  {{ hero.name }}
                </div>
                <n-button
                  size="small"
                  :type="continuousBattles[hero.id] ? 'warning' : 'primary'"
                  @click="toggleContinuousBattle(hero.id)"
                >
                  {{ continuousBattles[hero.id] ? t("dreamHelperCard.actions.stop") : t("dreamHelperCard.actions.continuousBattle") }}
                </n-button>
              </div>
            </div>
          </div>
          <div class="gwb2-mini-card__actions team-actions">
            <n-button size="small" type="primary" @click="getDefaultTeam">
              {{ t("dreamHelperCard.actions.getTeam") }}
            </n-button>
            <n-button size="small" type="primary" @click="selectDreamTeam">
              {{ t("dreamHelperCard.actions.selectLineup") }}
            </n-button>
            <n-button size="small" type="primary" @click="stopAllBattles">
              {{ t("dreamHelperCard.actions.stopAll") }}
            </n-button>
          </div>
        </div>

        <!-- 购买模块 -->
        <div v-if="activeTab === 'buy'" class="tab-content">
          <div class="merchant-info">
            <div class="merchant-title">{{ t("dreamHelperCard.labels.merchantList") }}</div>
            <div class="gwb2-mini-card__actions merchant-actions">
              <n-button size="small" type="primary" @click="refreshMerchantList">
                {{ t("dreamHelperCard.actions.getItems") }}
              </n-button>
              <n-button size="small" type="primary" @click="buyAllGoldItems">
                {{ t("dreamHelperCard.actions.buyAllGold") }}
              </n-button>
              <n-button size="small" type="primary" @click="buyAllGoldFishItems">
                {{ t("dreamHelperCard.actions.buyAllGoldFish") }}
              </n-button>
            </div>
          </div>
          <div v-if="merchantDataLoaded" class="gwb2-mini-card__list merchant-items">
            <div
              v-for="(items, merchantId) in merchantData"
              :key="merchantId"
              class="merchant-section"
            >
              <div class="merchant-name">
                {{ merchantConfig[merchantId].name }}
              </div>
              <div class="items-list">
                <div v-for="(item, index) in items" :key="index" class="item">
                  <div
                    class="item-name"
                    :style="{ color: getItemColor(parseInt(merchantId), item) }"
                  >
                    {{ getItemName(parseInt(merchantId), item) }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
    <template #action>
      <n-button
        block
        secondary
        size="small"
        type="primary"
        :disabled="isRunning"
        @click="startDreamHelper"
      >
        {{ isRunning ? t("dreamHelperCard.status.running") : t("dreamHelperCard.actions.start") }}
      </n-button>
    </template>
  </MyCard>
</template>

<script setup>
import { computed, ref } from "vue";
import { useMessage } from "naive-ui/es";
import { useI18n } from "vue-i18n";
import { useTokenStore } from "@/stores/tokenStore";
import MyCard from "../Common/MyCard.vue";
import {
  goldItemsConfig,
  isDungeonOpen,
  merchantConfig,
} from "@/utils/dreamConstants";

const tokenStore = useTokenStore();
const message = useMessage();
const { t } = useI18n();

const iconPath = computed(
  () => `${import.meta.env.BASE_URL}174061875626614.png`,
);

// 状态管理
const isRunning = ref(false);
const activeTab = ref("battle");
const isLoading = ref(false);
const hasDefaultInfo = ref(false);
const teamHeroes = ref([]);
const continuousBattles = ref({});
const battleInterval = ref(null);

// 购买模块状态
const merchantData = ref({ 1: [], 2: [], 3: [] });
const levelId = ref(0);
const selectedItems = ref(new Set());
const merchantDataLoaded = ref(false);

// 英雄数据映射
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

// 延迟函数
function delay(seconds) {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

// 获取类型颜色
function getTypeColor(type) {
  const colorMap = {
    魏国: "#3b82f6",
    蜀国: "#10b981",
    吴国: "#f59e0b",
    群雄: "#ef4444",
  };
  return colorMap[type] || "#8b5cf6";
}

// 提取默认队伍信息
function extractDefaultInfoFromResponse(response) {
  try {
    if (!response || !response.presetTeamInfo.presetTeamInfo) {
      return false;
    }

    const useTeamId = response.presetTeamInfo.useTeamId.toString();
    const battleTeam
      = response.presetTeamInfo.presetTeamInfo[useTeamId].teamInfo;
    teamHeroes.value = [];

    for (let i = 0; i < 5; i++) {
      const heroKey = i.toString();
      if (battleTeam[heroKey]) {
        const heroInfo = battleTeam[heroKey];
        const heroId = heroInfo.heroId || heroInfo;
        if (heroId !== 0 && heroData[heroId]) {
          teamHeroes.value.push({
            id: heroId,
            name: heroData[heroId].name,
            type: heroData[heroId].type,
            position: i,
          });
        }
      }
    }

    hasDefaultInfo.value = true;
    return true;
  } catch (error) {
    console.error(t("dreamHelperCard.logs.extractDefaultFailed"), error);
    return false;
  }
}

// 获取默认队伍信息
async function getDefaultTeam() {
  if (!isDungeonOpen()) {
    message.warning(t("dreamHelperCard.messages.notOpen"));
    return;
  }

  if (!tokenStore.selectedToken) {
    message.warning(t("dreamHelperCard.messages.selectTokenFirst"));
    return;
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
      } else {
        message.error(t("dreamHelperCard.messages.teamExtractFailed"));
      }
    }
  } catch (error) {
    message.error(t("dreamHelperCard.messages.getDefaultFailed", { error: error.message }));
  } finally {
    isLoading.value = false;
  }
  return false;
}

// 选择梦境阵容
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
    // 构造战斗队伍数据
    const battleTeam = {};
    let hasHero = false;

    for (let i = 0; i < 5; i++) {
      const hero = teamHeroes.value.find((h) => h.position === i);
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

// 单个英雄战斗
async function startSingleBattle(heroId) {
  if (!tokenStore.selectedToken) {
    return false;
  }

  const tokenId = tokenStore.selectedToken.id;
  const heroName = heroData[heroId] ? heroData[heroId].name : `ID:${heroId}`;

  try {
    const response = await tokenStore.sendMessageWithPromise(
      tokenId,
      "fight_startdungeon",
      {
        heroId: Number.parseInt(heroId),
      },
      15000,
    );

    if (response) {
      const rawData = response;
      if (rawData) {
        if (rawData.isWin) {
          console.log(`${heroName} 战斗胜利!`);
        } else {
          console.log(`${heroName} 战斗失败`);
        }
      }
      return true;
    }
    return false;
  } catch (error) {
    // 检查是否是2600080或2600050错误码
    if (
      error.message.includes("2600080")
      || error.message.includes("2600050")
    ) {
      return "stop"; // 返回特殊值表示需要停止
    }
    console.error(`${heroName} 开始战斗出错:`, error);
    return false;
  }
}

// 连续战斗功能
async function startContinuousBattle(heroId) {
  const heroName = heroData[heroId] ? heroData[heroId].name : `ID:${heroId}`;

  continuousBattles.value[heroId] = true;
  message.info(t("dreamHelperCard.messages.continuousBattleStarted", { hero: heroName }));

  // 连续战斗循环
  while (continuousBattles.value[heroId]) {
    const result = await startSingleBattle(heroId);

    // 如果返回stop，表示遇到2600080或2600050错误，停止战斗
    if (result === "stop") {
      stopContinuousBattle(heroId);
      break;
    }

    // 等待0.1秒再进行下一次战斗
    if (continuousBattles.value[heroId]) {
      await delay(0.1);
    }
  }
}

// 停止连续战斗
function stopContinuousBattle(heroId) {
  const heroName = heroData[heroId] ? heroData[heroId].name : `ID:${heroId}`;

  continuousBattles.value[heroId] = false;
  message.info(t("dreamHelperCard.messages.continuousBattleStopped", { hero: heroName }));
}

// 切换连续战斗状态
function toggleContinuousBattle(heroId) {
  if (continuousBattles.value[heroId]) {
    stopContinuousBattle(heroId);
  } else {
    startContinuousBattle(heroId);
  }
}

// 停止所有战斗
function stopAllBattles() {
  continuousBattles.value = {};
  message.info(t("dreamHelperCard.messages.allBattlesStopped"));
}

// 获取商品显示名称
function getItemName(merchantId, index) {
  const merchant = merchantConfig[merchantId];
  if (merchant && merchant.items[index] !== undefined) {
    return merchant.items[index];
  }
  return t("dreamHelperCard.labels.unknownItem", { index });
}

// 获取商品颜色
function getItemColor(merchantId, index) {
  const itemName = getItemName(merchantId, index);

  // 黄金鱼竿特殊颜色
  if (itemName.includes("黄金鱼竿")) {
    return "#ffd700";
  }

  // 金币商品颜色
  if (isGoldItem(merchantId, index)) {
    return "#ffa500";
  }

  // 其他商品颜色
  return "#F3BCD6";
}

// 检查是否为金币商品
function isGoldItem(merchantId, index) {
  return (
    goldItemsConfig[merchantId] && goldItemsConfig[merchantId].includes(index)
  );
}

// 获取角色信息（包含商品列表）
async function getRoleInfo() {
  if (!tokenStore.selectedToken) {
    return;
  }

  const tokenId = tokenStore.selectedToken.id;

  try {
    const response = await tokenStore.sendMessageWithPromise(
      tokenId,
      "role_getroleinfo",
      {},
      15000,
    );

    if (response && response && response.role) {
      // 获取商品列表
      if (response.role.dungeon && response.role.dungeon.merchant) {
        merchantData.value = response.role.dungeon.merchant;
      }

      // 获取关卡ID
      if (response.role.levelId) {
        levelId.value = response.role.levelId;
      }

      return { merchantData: merchantData.value, levelId: levelId.value };
    }
  } catch (error) {
    console.error(t("dreamHelperCard.logs.getRoleInfoFailed"), error);
    throw error;
  }
}

// 购买商品
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
  } catch (error) {
    console.error(t("dreamHelperCard.logs.buyItemFailed"), error);
    return false;
  }
}

// 批量购买选中的商品
async function batchBuySelected() {
  if (selectedItems.value.size === 0) {
    message.warning(t("dreamHelperCard.messages.selectItemsFirst"));
    return;
  }

  if (!isDungeonOpen()) {
    message.warning(t("dreamHelperCard.messages.notOpen"));
    return;
  }

  if (levelId.value < 4000) {
    message.warning(t("dreamHelperCard.messages.levelTooLow"));
    return;
  }

  isRunning.value = true;
  const items = Array.from(selectedItems.value);
  let successCount = 0;
  let failCount = 0;

  // 按商人ID和位置排序，从大到小购买
  items.sort((a, b) => {
    const [aMerchant, aIndex, aPos] = a.split("-").map(Number);
    const [bMerchant, bIndex, bPos] = b.split("-").map(Number);

    if (aMerchant !== bMerchant)
      return bMerchant - aMerchant;
    return bPos - aPos;
  });

  for (const itemKey of items) {
    const [merchantId, index, pos] = itemKey.split("-").map(Number);

    try {
      const success = await buyItem(merchantId, index, pos);
      if (success) {
        selectedItems.value.delete(itemKey);
        successCount++;
      } else {
        failCount++;
      }
    } catch (error) {
      failCount++;
    }

    // 延迟避免请求过快
    await delay(0.5);
  }

  // 重新获取商品列表更新界面
  await refreshMerchantList();

  message.success(t("dreamHelperCard.messages.batchBuyDone", { success: successCount, fail: failCount }));
  isRunning.value = false;
}

// 一键购买所有金币商品
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

  // 遍历所有商人的商品
  for (const merchantId in merchantData.value) {
    const items = merchantData.value[merchantId];
    const numId = Number.parseInt(merchantId);

    // 从后往前购买（pos从大到小）
    for (let pos = items.length - 1; pos >= 0; pos--) {
      const index = items[pos];

      if (isGoldItem(numId, index)) {
        try {
          const success = await buyItem(numId, index, pos);
          if (success) {
            successCount++;
          } else {
            failCount++;
          }
        } catch (error) {
          failCount++;
        }

        // 延迟避免请求过快
        await delay(0.5);
      }
    }
  }

  // 重新获取商品列表更新界面
  await refreshMerchantList();

  message.success(t("dreamHelperCard.messages.quickBuyDone", { success: successCount, fail: failCount }));
  isRunning.value = false;
}

// 一键购买所有高级商人鱼竿
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

  const items = merchantData.value[3];
  // 从后往前购买（pos从大到小）
  for (let pos = items.length - 1; pos >= 0; pos--) {
    const index = items[pos];

    if (index === 2) {
      try {
        const success = await buyItem(3, index, pos);
        if (success) {
          successCount++;
        } else {
          failCount++;
        }
      } catch (error) {
        failCount++;
      }

      // 延迟避免请求过快
      await delay(0.5);
    }
  }

  // 重新获取商品列表更新界面
  await refreshMerchantList();

  message.success(t("dreamHelperCard.messages.quickBuyDone", { success: successCount, fail: failCount }));
  isRunning.value = false;
}

// 获取商品列表（包含自动获取阵容）
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

    // 第一步：获取默认队伍信息
    await getDefaultTeam();

    // 第二步：选择梦境阵容
    await selectDreamTeam();

    // 第三步：获取商品列表
    await getRoleInfo();
    merchantDataLoaded.value = true;

    message.success(t("dreamHelperCard.messages.merchantLoaded"));
  } catch (error) {
    message.error(t("dreamHelperCard.messages.merchantLoadFailed", { error: error.message }));
  }
}

// 启动梦境助手
const startDreamHelper = async () => {
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

  // 这里可以根据需要实现自动运行逻辑
  // 例如：自动获取队伍 -> 选择阵容 -> 开始连续战斗 -> 购买商品

  // 暂时先简单实现，获取队伍信息
  await getDefaultTeam();

  isRunning.value = false;
  message.success(t("dreamHelperCard.messages.done"));
};
</script>

<style scoped lang="scss">
.dream-helper-content {
  display: flex;
  flex-direction: column;
  gap: 12px;

  .tabs {
    .tab {
      flex: 1;
    }
  }

  .tab-content {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .team-info {
    .team-title {
      font-size: var(--font-size-sm);
      color: var(--text-tertiary);
      margin-bottom: 8px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .team-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .hero-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 6px 0;
      border-bottom: 1px solid rgba(78, 94, 116, 0.1);
    }

    .hero-item:last-child {
      border-bottom: none;
    }

    .hero-name {
      padding: 4px 8px;
      border-radius: 10px;
      background: rgba(63, 119, 173, 0.08);
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-medium);
    }
  }

  .team-actions {
    margin-top: 0;
  }

  .merchant-info {
    .merchant-title {
      font-size: var(--font-size-sm);
      color: var(--text-tertiary);
      margin-bottom: 8px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .merchant-actions {
      margin-top: 0;
    }
  }

  .merchant-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 6px 0;
    border-bottom: 1px solid rgba(78, 94, 116, 0.1);

    .merchant-name {
      font-size: var(--font-size-sm);
      font-weight: 700;
      color: var(--text-primary);
    }

    .items-list {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 4px 0;
    }

    .item-name {
      font-size: var(--font-size-xs);
    }
  }

  .merchant-section:last-child {
    border-bottom: none;
  }
}

@media (max-width: 768px) {
  .dream-helper-content .hero-item,
  .dream-helper-content .merchant-section .item {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
