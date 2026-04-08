<template>
  <MyCard
    class="fish-helper-card"
    :panel-active="panelActive"
    :status-class="{ active: isRunning }"
  >
    <template #icon>
      <img :alt="t('fishHelperCard.iconAlt')" :src="iconPath">
    </template>
    <template #title>
      <h3>{{ t("fishHelperCard.title") }}</h3>
    </template>
    <template #badge>
      <span>{{ isRunning ? t("fishHelperCard.status.running") : t("fishHelperCard.status.stopped") }}</span>
    </template>
    <template #default>
      <div class="gwb2-mini-card__stack container">
        <div class="gwb2-mini-card__metric-grid gwb2-mini-card__metric-grid--single">
          <div class="gwb2-mini-card__metric helper-metric">
            <div class="metric-copy">
              <span class="metric-label">{{ selectedTypeLabel }}</span>
              <strong class="metric-value">{{ t("fishHelperCard.count", { count: number }) }}</strong>
            </div>
            <span class="metric-summary">{{ t("fishHelperCard.count", { count: totalRodCount }) }}</span>
          </div>
        </div>
        <div class="gwb2-mini-card__resource-grid list">
          <div v-for="item in dataList" :key="item.type" class="item">
            <img :alt="item.type" :src="item.img">
            <div class="box-info">
              <div class="box-type">{{ item.type }}</div>
              <div class="box-count">{{ t("fishHelperCard.count", { count: item.count }) }}</div>
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
      <div class="gwb2-mini-card__action-rail gwb2-mini-card__action-rail--single">
        <n-button
          block
          secondary
          size="small"
          type="primary"
          :disabled="isRunning"
          @click="handleHelper"
        >
          {{ isRunning ? t("fishHelperCard.status.running") : t("fishHelperCard.actions.start") }}
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

const iconPath = computed(() => {
  return `${import.meta.env.BASE_URL}fish/hjyg.png`;
});

const roleInfo = computed(() => tokenStore.gameData?.roleInfo || null);

const dataList = computed(() => {
  const getImgPath = (path) =>
    import.meta.env.BASE_URL + path.replace(/^\//, "");
  return [
    {
      type: t("fishHelperCard.types.normalRod"),
      img: getImgPath("/fish/ptyg.png"),
      count: roleInfo.value?.role?.items?.[1011]?.quantity || 0,
    },
    {
      type: t("fishHelperCard.types.goldRod"),
      img: getImgPath("/fish/hjyg.png"),
      count: roleInfo.value?.role?.items?.[1012]?.quantity || 0,
    },
  ];
});

const type = ref(1);
const typeOptions = [
  { label: t("fishHelperCard.types.normalRod"), value: 1 },
  { label: t("fishHelperCard.types.goldRod"), value: 2 },
];

const selectedTypeLabel = computed(() => {
  return typeOptions.find((item) => item.value === type.value)?.label || "";
});

const number = ref(10);
const numberOptions = [
  { label: "10", value: 10 },
  { label: "20", value: 20 },
  { label: "50", value: 50 },
  { label: "80", value: 80 },
  { label: "100", value: 100 },
  { label: "160", value: 160 },
];

const totalRodCount = computed(() =>
  dataList.value.reduce((sum, item) => sum + Number(item.count || 0), 0),
);

const handleHelper = async () => {
  await runLocked(async () => {
    if (!tokenStore.selectedToken) {
      message.warning(t("fishHelperCard.messages.selectTokenFirst"));
      return;
    }
    const tokenId = tokenStore.selectedToken.id;
    message.info(t("fishHelperCard.messages.running"));
    if (number.value >= 10) {
      await runBatchedCount({
        total: number.value,
        batchSize: 10,
        executeBatch: async (batchCount) => {
          await tokenStore.sendMessageWithPromise(tokenId, "artifact_lottery", {
            type: type.value,
            lotteryNumber: batchCount,
            newFree: true,
          });
        },
      });
      await tokenStore.sendMessage(tokenId, "role_getroleinfo");
      tokenStore.sendMessage(tokenId, "activity_get");
      message.success(t("fishHelperCard.messages.done"));
    }
  });
};
</script>

<style scoped lang="scss">
.container {
  display: flex;
  flex-direction: column;
  gap: 12px;

  .helper-metric {
    align-items: stretch;
  }

  .metric-copy {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 4px;
  }

  .metric-label {
    color: var(--text-tertiary);
    font-size: var(--font-size-xs);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .metric-value {
    color: var(--text-primary);
    font-weight: var(--font-weight-semibold);
  }

  .metric-summary {
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
    text-align: right;
  }

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

  @media (max-width: 959px) {
    .metric-summary {
      text-align: left;
    }
  }
}
</style>
