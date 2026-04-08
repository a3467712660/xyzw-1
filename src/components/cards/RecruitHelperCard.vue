<template>
  <MyCard
    class="recruit-helper-card"
    :panel-active="panelActive"
    :status-class="{ active: isRunning }"
  >
    <template #icon>
      <img :alt="t('recruitHelperCard.iconAlt')" :src="iconPath">
    </template>
    <template #title>
      <h3>{{ t("recruitHelperCard.title") }}</h3>
    </template>
    <template #badge>
      <span>{{ isRunning ? t("recruitHelperCard.status.running") : t("recruitHelperCard.status.stopped") }}</span>
    </template>
    <template #default>
      <div class="gwb2-mini-card__stack container">
        <div class="gwb2-mini-card__metric-grid gwb2-mini-card__metric-grid--single">
          <div class="gwb2-mini-card__metric helper-metric">
            <div class="metric-copy">
              <span class="metric-label">{{ t("recruitHelperCard.resourceName") }}</span>
              <strong class="metric-value">{{ t("recruitHelperCard.count", { count: number }) }}</strong>
            </div>
            <span class="metric-summary">{{ t("recruitHelperCard.count", { count: totalRecruitTokens }) }}</span>
          </div>
        </div>
        <div class="gwb2-mini-card__resource-grid list">
          <div v-for="item in dataList" :key="item.type" class="item">
            <img :alt="item.type" :src="item.img">
            <div class="box-info">
              <div class="box-type">{{ item.type }}</div>
              <div class="box-count">{{ t("recruitHelperCard.count", { count: item.count }) }}</div>
            </div>
          </div>
        </div>
        <div class="gwb2-mini-card__control-grid selects">
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
          {{ isRunning ? t("recruitHelperCard.status.running") : t("recruitHelperCard.actions.start") }}
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

const iconPath = computed(() => `${import.meta.env.BASE_URL}icons/zml.png`);

const roleInfo = computed(() => tokenStore.gameData?.roleInfo || null);

const dataList = computed(() => {
  const getImgPath = (path) =>
    import.meta.env.BASE_URL + path.replace(/^\//, "");
  return [
    {
      type: t("recruitHelperCard.resourceName"),
      img: getImgPath("/icons/zml.png"),
      count: roleInfo.value?.role?.items?.[1001]?.quantity || 0,
    },
  ];
});

const number = ref(10);
const numberOptions = [
  { label: "10", value: 10 },
  { label: "50", value: 50 },
  { label: "100", value: 100 },
  { label: "200", value: 200 },
  { label: "400", value: 400 },
];

const totalRecruitTokens = computed(() =>
  dataList.value.reduce((sum, item) => sum + Number(item.count || 0), 0),
);

const handleHelper = async () => {
  await runLocked(async () => {
    if (!tokenStore.selectedToken) {
      message.warning(t("recruitHelperCard.messages.selectTokenFirst"));
      return;
    }
    const tokenId = tokenStore.selectedToken.id;
    message.info(t("recruitHelperCard.messages.running"));
    if (number.value >= 10) {
      await runBatchedCount({
        total: number.value,
        batchSize: 10,
        executeBatch: async (batchCount) => {
          await tokenStore.sendMessageWithPromise(tokenId, "hero_recruit", {
            recruitType: 1,
            recruitNumber: batchCount,
          });
        },
      });
      await tokenStore.sendMessage(tokenId, "role_getroleinfo");
      tokenStore.sendMessage(tokenId, "activity_get");
      message.success(t("recruitHelperCard.messages.done"));
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
