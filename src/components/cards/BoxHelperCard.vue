<template>
  <MyCard
    class="box-helper-card"
    :panel-active="panelActive"
    :status-class="{ active: isRunning }"
  >
    <template #icon>
      <img :alt="t('boxHelperCard.iconAlt')" :src="iconPath">
    </template>
    <template #title>
      <h3>{{ t("boxHelperCard.title") }}</h3>
    </template>
    <template #badge>
      <span>{{ isRunning ? t("boxHelperCard.status.running") : t("boxHelperCard.status.stopped") }}</span>
    </template>
    <template #default>
      <div class="gwb2-mini-card__stack container">
        <div class="gwb2-mini-card__metric-grid gwb2-mini-card__metric-grid--single">
          <div class="gwb2-mini-card__metric total-points">
            <span class="label">{{ t("boxHelperCard.labels.totalPoints") }}</span>
            <span class="value">{{ totalPoints }}</span>
          </div>
        </div>
        <div class="gwb2-mini-card__resource-grid list">
          <div v-for="item in boxDataList" :key="item.type" class="item">
            <img :alt="item.type" :src="item.img">
            <div class="box-info">
              <div class="box-type">{{ item.type }}</div>
              <div class="box-count">{{ t("boxHelperCard.count", { count: item.count }) }}</div>
            </div>
          </div>
        </div>
        <div class="gwb2-mini-card__control-grid selects">
          <n-select v-model:value="type" :options="typeOptions"></n-select>
          <n-select v-model:value="number" :options="numberOptions"></n-select>
        </div>
      </div>
    </template>
    <template #action>
      <div class="gwb2-mini-card__action-rail">
        <n-button
          block
          secondary
          size="small"
          type="primary"
          :disabled="isRunning"
          @click="handleBoxHelper"
        >
          {{ isRunning ? t("boxHelperCard.status.running") : t("boxHelperCard.actions.open") }}
        </n-button>
        <n-button
          size="small"
          type="primary"
          :disabled="isRunning"
          @click="batchclaimboxpointreward"
        >
          {{ t("boxHelperCard.actions.claimPoints") }}
        </n-button>
      </div>
    </template>
  </MyCard>
</template>

<script setup>
import { computed, ref } from "vue";
import { useMessage } from "naive-ui/es";
import { useI18n } from "vue-i18n";
import { useGameCardActionLock } from "@/composables/gameCards/useGameCardActionLock";
import { useGameCardBatchAction } from "@/composables/gameCards/useGameCardBatchAction";
import { useTokenStore } from "@/stores/tokenStore";
import MyCard from "../Common/MyCard.vue";

defineProps({
  panelActive: {
    type: Boolean,
    default: true,
  },
});

const tokenStore = useTokenStore();
const message = useMessage();
const { t } = useI18n();
const { isRunning, runLocked } = useGameCardActionLock();
const { runBatchedCount } = useGameCardBatchAction();

const iconPath = computed(() => `${import.meta.env.BASE_URL}box/zsbx.png`);

const roleInfo = computed(() => tokenStore.gameData?.roleInfo || null);

const boxDataList = computed(() => {
  const getImgPath = (path) =>
    import.meta.env.BASE_URL + path.replace(/^\//, "");
  return [
    {
      type: t("boxHelperCard.types.wooden"),
      img: getImgPath("/box/mzbx.png"),
      count: roleInfo.value?.role?.items?.[2001]?.quantity || 0,
    },
    {
      type: t("boxHelperCard.types.bronze"),
      img: getImgPath("/box/qtbx.png"),
      count: roleInfo.value?.role?.items?.[2002]?.quantity || 0,
    },
    {
      type: t("boxHelperCard.types.gold"),
      img: getImgPath("/box/hjbx.png"),
      count: roleInfo.value?.role?.items?.[2003]?.quantity || 0,
    },
    {
      type: t("boxHelperCard.types.platinum"),
      img: getImgPath("/box/bjbx.png"),
      count: roleInfo.value?.role?.items?.[2004]?.quantity || 0,
    },
  ];
});

const totalPoints = computed(() => {
  const wooden = roleInfo.value?.role?.items?.[2001]?.quantity || 0;
  const bronze = roleInfo.value?.role?.items?.[2002]?.quantity || 0;
  const gold = roleInfo.value?.role?.items?.[2003]?.quantity || 0;
  const platinum = roleInfo.value?.role?.items?.[2004]?.quantity || 0;

  return wooden * 1 + bronze * 10 + gold * 20 + platinum * 50;
});

const type = ref(2001);
const typeOptions = [
  { label: t("boxHelperCard.types.wooden"), value: 2001 },
  { label: t("boxHelperCard.types.bronze"), value: 2002 },
  { label: t("boxHelperCard.types.gold"), value: 2003 },
  { label: t("boxHelperCard.types.platinum"), value: 2004 },
];

const number = ref(10);
const numberOptions = [
  { label: "10", value: 10 },
  { label: "100", value: 100 },
  { label: "1000", value: 1000 },
  { label: "2000", value: 2000 },
  { label: "5000", value: 5000 },
  { label: "10000", value: 10000 },
];

const batchclaimboxpointreward = async () => {
  await runLocked(async () => {
    if (!tokenStore.selectedToken) {
      message.warning(t("boxHelperCard.messages.selectTokenFirst"));
      return;
    }
    const tokenId = tokenStore.selectedToken.id;
    await tokenStore.sendMessage(tokenId, "item_batchclaimboxpointreward");
    await new Promise((r) => setTimeout(r, 500));
    await tokenStore.sendMessage(tokenId, "role_getroleinfo");
    message.success(t("boxHelperCard.messages.claimDone"));
  });
};

const handleBoxHelper = async () => {
  await runLocked(async () => {
    if (!tokenStore.selectedToken) {
      message.warning(t("boxHelperCard.messages.selectTokenFirst"));
      return;
    }
    const tokenId = tokenStore.selectedToken.id;
    message.info(t("boxHelperCard.messages.opening"));
    if (number.value >= 10) {
      await runBatchedCount({
        total: number.value,
        batchSize: 10,
        executeBatch: async (batchCount) => {
          await tokenStore.sendMessageWithPromise(tokenId, "item_openbox", {
            itemId: type.value,
            number: batchCount,
          });
        },
      });
      await tokenStore.sendMessage(tokenId, "item_batchclaimboxpointreward");
      await new Promise((r) => setTimeout(r, 500));
      await tokenStore.sendMessage(tokenId, "role_getroleinfo");
      tokenStore.sendMessage(tokenId, "activity_get");
      message.success(t("boxHelperCard.messages.openDone"));
    }
  });
};
</script>

<style scoped lang="scss">
.container {
  display: flex;
  flex-direction: column;
  gap: 12px;

  .list {
    .item {
      min-width: 0;
      display: flex;
      flex-direction: column;
      align-items: center;

      > img {
        width: 40px;
        height: 40px;
      }

      .box-info {
        display: flex;
        min-width: 0;
        flex-direction: column;
        align-items: center;

        .box-type {
          font-weight: bold;
          margin-top: 4px;
          overflow-wrap: anywhere;
          text-align: center;
        }

        .box-count {
          margin-top: 2px;
          color: #666;
          overflow-wrap: anywhere;
          text-align: center;
        }
      }
    }
  }

  .selects {
    align-items: stretch;
  }

  .total-points {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;

    .label {
      color: var(--text-secondary);
      font-size: var(--font-size-xs);
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .value {
      color: var(--text-primary);
      font-size: var(--font-size-md);
      font-weight: var(--font-weight-semibold);
      font-family: var(--font-family-mono);
    }
  }

}
</style>
