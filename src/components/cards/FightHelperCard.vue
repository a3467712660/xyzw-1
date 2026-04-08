<template>
  <MyCard
    class="fight-helper-card"
    :panel-active="panelActive"
    :status-class="{ active: isRunning }"
  >
    <template #icon>
      <img src="/icons/1736425783912140.png" :alt="t('fightHelperCard.iconAlt')">
    </template>
    <template #title>
      <h3>{{ t("fightHelperCard.title") }}</h3>
    </template>
    <template #badge>
      <span>{{ isRunning ? t("fightHelperCard.status.running") : t("fightHelperCard.status.stopped") }}</span>
    </template>
    <template #default>
      <div class="gwb2-mini-card__stack container">
        <div class="gwb2-mini-card__metric-grid gwb2-mini-card__metric-grid--single">
          <div class="gwb2-mini-card__metric total-points">
            <span class="label">{{ t("fightHelperCard.labels.ticketCount") }}</span>
            <span class="value">{{ itemcount }}</span>
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
          @click="handleFightHelper"
        >
          {{ isRunning ? t("fightHelperCard.status.running") : t("fightHelperCard.actions.start") }}
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

const roleInfo = computed(() => tokenStore.gameData?.roleInfo || null);
const itemcount = computed(
  () => roleInfo.value?.role?.items?.[1007]?.quantity || 0,
);

const pickArenaTargetId = (targets) => {
  const candidate
    = targets?.rankList?.[0]
      || targets?.roleList?.[0]
      || targets?.targets?.[0]
      || targets?.targetList?.[0]
      || targets?.list?.[0];

  if (candidate?.roleId)
    return candidate.roleId;
  if (candidate?.id)
    return candidate.id;
  return targets?.roleId || targets?.id;
};

const number = ref(10);
const numberOptions = [
  { label: "10", value: 10 },
  { label: "50", value: 50 },
  { label: "100", value: 100 },
  { label: "500", value: 500 },
  { label: "1000", value: 1000 },
  { label: "2000", value: 2000 },
  { label: "5000", value: 5000 },
  { label: "10000", value: 10000 },
];
const handleFightHelper = async () => {
  await runLocked(async () => {
    if (!tokenStore.selectedToken) {
      message.warning(t("fightHelperCard.messages.selectTokenFirst"));
      return;
    }
    if (itemcount.value < number.value) {
      message.warning(t("fightHelperCard.messages.notEnoughTickets"));
      return;
    }
    const tokenId = tokenStore.selectedToken.id;
    message.info(t("fightHelperCard.messages.running"));
    await runBatchedCount({
      total: number.value,
      batchSize: 1,
      executeBatch: async () => {
        await tokenStore.sendMessageWithPromise(tokenId, "arena_startarea", {});
        let targets;
        try {
          targets = await tokenStore.sendMessageWithPromise(
            tokenId,
            "arena_getareatarget",
            {},
          );
        } catch (err) {
          message.error(t("fightHelperCard.messages.targetFailed", { error: err.message }));
          return false;
        }

        const targetId = pickArenaTargetId(targets);
        if (!targetId) {
          message.warning(t("fightHelperCard.messages.noTarget"));
          return false;
        }
        try {
          await tokenStore.sendMessageWithPromise(tokenId, "fight_startareaarena", {
            targetId,
          });
        } catch (e) {
          message.error(t("fightHelperCard.messages.fightFailed", { error: e.message }));
        }
        return true;
      },
    });

    await tokenStore.sendMessage(tokenId, "role_getroleinfo");
    message.success(t("fightHelperCard.messages.done"));
  });
};
</script>

<style scoped lang="scss">
.container {
  display: flex;
  flex-direction: column;
  gap: 12px;
  .list {
    display: flex;
    align-items: center;
    justify-content: center;
    .item {
      display: flex;
      flex-direction: column;
      align-items: center;
      > img {
        width: 40px;
        height: 40px;
      }
      .fight-info {
        display: flex;
        flex-direction: column;
        align-items: center;
        .fight-type {
          font-weight: bold;
          margin-top: 4px;
        }
        .fight-count {
          margin-top: 2px;
          color: #666;
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

  @media (max-width: 959px) {
    .selects {
      grid-template-columns: minmax(0, 1fr);
    }
  }
}
</style>
