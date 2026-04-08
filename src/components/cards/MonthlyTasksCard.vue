<template>
  <MyCard
    class="monthly-tasks"
    :panel-active="panelActive"
    :status-class="monthActivity ? 'active' : ''"
  >
    <template #icon>
      <img src="/icons/1736425783912140.png" :alt="t('monthlyTasksCard.iconAlt')">
    </template>
    <template #title>
      <h3>{{ t("monthlyTasksCard.title") }}</h3>
      <p>{{ t("monthlyTasksCard.subtitle") }}</p>
    </template>
    <template #badge>
      <span v-if="remainingDays > 0">{{ t("monthlyTasksCard.badge.remainingDays", { days: remainingDays }) }}</span>
      <span v-else>{{ t("monthlyTasksCard.badge.lastDay") }}</span>
    </template>
    <template #default>
      <div class="gwb2-mini-card__stack">
        <div class="gwb2-mini-card__metric-grid">
          <div class="gwb2-mini-card__metric monthly-row">
            <div class="monthly-row__copy">
              <div class="row-title">{{ t("monthlyTasksCard.rows.fish") }}</div>
              <div class="row-subtitle">{{ t("monthlyTasksCard.actions.fishTopUp") }}</div>
            </div>
            <div class="row-value">
              <strong>{{ fishNum }} / {{ FISH_TARGET }}</strong>
              <span class="row-ratio">{{ fishPercent }}%</span>
            </div>
          </div>
          <div class="gwb2-mini-card__metric monthly-row">
            <div class="monthly-row__copy">
              <div class="row-title">{{ t("monthlyTasksCard.rows.arena") }}</div>
              <div class="row-subtitle">{{ t("monthlyTasksCard.actions.arenaTopUp") }}</div>
            </div>
            <div class="row-value">
              <strong>{{ arenaNum }} / {{ ARENA_TARGET }}</strong>
              <span class="row-ratio">{{ arenaPercent }}%</span>
              <span
                v-if="!isArenaActivityOpen"
                class="status-indicator closed"
              >
                {{ t("monthlyTasksCard.rows.arenaClosed") }}
              </span>
            </div>
          </div>
        </div>
        <div class="gwb2-mini-card__list monthly-summary">
          <p class="description muted">
            {{ t("monthlyTasksCard.description", { fishTarget: FISH_TARGET, arenaTarget: ARENA_TARGET }) }}
          </p>
        </div>
      </div>
    </template>
    <template #action>
      <div class="gwb2-mini-card__action-rail monthly-actions">
        <n-button
          class="monthly-refresh"
          size="small"
          :disabled="monthLoading || fishToppingUp || arenaToppingUp"
          @click="handleRefreshMonthlyActivity"
        >
          {{ monthLoading ? t("monthlyTasksCard.actions.refreshing") : t("monthlyTasksCard.actions.refresh") }}
        </n-button>

        <div class="monthly-action-cluster">
          <n-button
            size="small"
            :disabled="monthLoading || fishToppingUp"
            @click="topUpMonthly('fish')"
          >
            {{ fishToppingUp ? t("monthlyTasksCard.actions.toppingUp") : t("monthlyTasksCard.actions.fishTopUp") }}
          </n-button>
          <n-dropdown
            trigger="click"
            :options="fishMoreOptions"
            @select="onFishMoreSelect"
          >
            <n-button
              size="small"
              :disabled="monthLoading || fishToppingUp"
            >
              ▾
            </n-button>
          </n-dropdown>
        </div>

        <div class="monthly-action-cluster">
          <n-button
            size="small"
            :disabled="monthLoading || arenaToppingUp || !isArenaActivityOpen"
            @click="topUpMonthly('arena')"
          >
            {{ arenaToppingUp ? t("monthlyTasksCard.actions.toppingUp") : t("monthlyTasksCard.actions.arenaTopUp") }}
          </n-button>
          <n-dropdown
            trigger="click"
            :options="arenaMoreOptions"
            @select="onArenaMoreSelect"
          >
            <n-button
              size="small"
              :disabled="monthLoading || arenaToppingUp || !isArenaActivityOpen"
            >
              ▾
            </n-button>
          </n-dropdown>
        </div>
      </div>
    </template>
  </MyCard>
</template>

<script setup>
import { computed, ref, toRef, watch } from "vue";
import { useMessage } from "naive-ui/es";
import { useI18n } from "vue-i18n";
import { useGameCardPanelActive } from "@/composables/gameCards/useGameCardPanelActive";
import { useMonthlyTaskActions } from "@/composables/useMonthlyTaskActions";
import { useTokenStore } from "@/stores/tokenStore";
import MyCard from "../Common/MyCard.vue";

const props = defineProps({
  panelActive: {
    type: Boolean,
    default: true,
  },
});

const tokenStore = useTokenStore();
const message = useMessage();
const { t } = useI18n();
const { panelActive } = useGameCardPanelActive(toRef(props, "panelActive"));

const FISH_TARGET = 320;
const ARENA_TARGET = 240;

const monthLoading = ref(false);
const fishToppingUp = ref(false);
const arenaToppingUp = ref(false);
const monthActivity = ref(null);
const pendingRefresh = ref(false);
const loadedTokenId = ref("");

const now = new Date();
const daysInMonth = new Date(
  now.getFullYear(),
  now.getMonth() + 1,
  0,
).getDate();
const dayOfMonth = now.getDate();
const remainingDays = computed(() => Math.max(0, daysInMonth - dayOfMonth));
const monthProgress = computed(() =>
  Math.min(1, Math.max(0, dayOfMonth / daysInMonth)),
);

const myMonthInfo = computed(() => monthActivity.value?.myMonthInfo || {});
const myArenaInfo = computed(() => monthActivity.value?.myArenaInfo || {});

const fishNum = computed(() => Number(myMonthInfo.value?.["2"]?.num || 0));
const arenaNum = computed(() => Number(myArenaInfo.value?.num || 0));
const fishPercent = computed(() =>
  Math.min(100, Math.round((fishNum.value / FISH_TARGET) * 100)),
);
const arenaPercent = computed(() =>
  Math.min(100, Math.round((arenaNum.value / ARENA_TARGET) * 100)),
);

const fishShouldBe = computed(() =>
  remainingDays.value === 0
    ? FISH_TARGET
    : Math.min(FISH_TARGET, Math.ceil(monthProgress.value * FISH_TARGET)),
);
const arenaShouldBe = computed(() =>
  remainingDays.value === 0
    ? ARENA_TARGET
    : Math.min(ARENA_TARGET, Math.ceil(monthProgress.value * ARENA_TARGET)),
);

const fishMoreOptions = computed(() => [{ label: t("monthlyTasksCard.actions.completeAll"), key: "complete-fish" }]);
const arenaMoreOptions = computed(() => [{ label: t("monthlyTasksCard.actions.completeAll"), key: "complete-arena" }]);

const selectedTokenId = computed(() =>
  tokenStore.selectedToken ? String(tokenStore.selectedToken.id) : "",
);

const isConnected = computed(() => {
  if (!selectedTokenId.value)
    return false;
  return tokenStore.getWebSocketStatus(selectedTokenId.value) === "connected";
});

const isArenaActivityOpen = computed(() => {
  const hour = new Date().getHours();
  return hour >= 6 && hour < 22;
});

const onFishMoreSelect = (key) => {
  if (key === "complete-fish")
    completeMonthly("fish");
};
const onArenaMoreSelect = (key) => {
  if (key === "complete-arena")
    completeMonthly("arena");
};

const {
  completeMonthly,
  fetchMonthlyActivity,
  topUpMonthly,
} = useMonthlyTaskActions({
  tokenStore,
  message,
  t,
  monthActivity,
  monthLoading,
  fishToppingUp,
  arenaToppingUp,
  isConnected,
  isArenaActivityOpen,
  fishNum,
  arenaNum,
  fishShouldBe,
  arenaShouldBe,
  FISH_TARGET,
  ARENA_TARGET,
});

const requestMonthlyRefresh = async ({ forceUi = false } = {}) => {
  if (!selectedTokenId.value || !isConnected.value) {
    return;
  }
  if (!panelActive.value && !forceUi) {
    pendingRefresh.value = true;
    return;
  }
  pendingRefresh.value = false;
  await fetchMonthlyActivity();
  loadedTokenId.value = selectedTokenId.value;
};

const handleRefreshMonthlyActivity = async () => {
  await requestMonthlyRefresh({ forceUi: true });
};

watch(
  [selectedTokenId, isConnected],
  async ([tokenId, connected], [prevTokenId, prevConnected]) => {
    const tokenChanged = tokenId !== prevTokenId;
    const connectionRestored = connected && !prevConnected;

    if (tokenChanged) {
      monthActivity.value = null;
      loadedTokenId.value = "";
      pendingRefresh.value = Boolean(tokenId);
    }

    if (
      tokenId
      && connected
      && (tokenChanged || connectionRestored || loadedTokenId.value !== tokenId)
    ) {
      await requestMonthlyRefresh();
    }
  },
  { immediate: true },
);

watch(
  panelActive,
  async (active) => {
    if (active && pendingRefresh.value) {
      await requestMonthlyRefresh({ forceUi: true });
    }
  },
  { immediate: true },
);

defineExpose({ fetchMonthlyActivity });
</script>

<style scoped lang="scss">
.monthly-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-md);
}

.monthly-row__copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 4px;
}

.row-title {
  color: var(--text-primary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
}

.row-subtitle {
  color: var(--text-tertiary);
  font-size: var(--font-size-xs);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.row-value {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
  text-align: right;

  strong {
    color: var(--text-primary);
    font-family: var(--font-family-mono);
    font-size: 1rem;
  }
}

.row-ratio {
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
}

.description.muted {
  color: var(--text-tertiary);
  margin: 0;
}

.monthly-summary {
  align-items: center;
  justify-content: center;
}

.monthly-actions {
  grid-template-columns: minmax(0, 0.88fr) repeat(2, minmax(0, 1fr));
  align-items: stretch;
}

.monthly-refresh {
  grid-column: auto;
}

.monthly-action-cluster {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
  min-width: 0;
}

.monthly-action-cluster > * {
  min-width: 0;
}

.status-indicator {
  font-size: var(--font-size-xs);
  margin-left: 0;

  &.open {
    color: var(--success-color, #059669);
  }

  &.closed {
    color: var(--error-color, #dc2626);
  }
}

@media (max-width: 1279px) {
  .monthly-actions {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .monthly-refresh {
    grid-column: 1 / -1;
  }
}

@media (max-width: 959px) {
  .monthly-row {
    flex-direction: column;
    align-items: flex-start;
  }

  .row-value {
    justify-content: flex-start;
    text-align: left;
  }

  .monthly-action-cluster {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
