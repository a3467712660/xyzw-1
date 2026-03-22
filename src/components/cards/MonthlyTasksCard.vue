<template>
  <MyCard class="monthly-tasks" :status-class="monthActivity ? 'active' : ''">
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
      <div class="monthly-row">
        <div class="row-title">{{ t("monthlyTasksCard.rows.fish") }}</div>
        <div class="row-value">
          {{ fishNum }} / {{ FISH_TARGET }}（{{ fishPercent }}%）
        </div>
      </div>
      <div class="monthly-row">
        <div class="row-title">{{ t("monthlyTasksCard.rows.arena") }}</div>
        <div class="row-value">
          {{ arenaNum }} / {{ ARENA_TARGET }}（{{ arenaPercent }}%）
          <span
v-if="!isArenaActivityOpen"
class="status-indicator closed"
            >{{ t("monthlyTasksCard.rows.arenaClosed") }}</span
          >
        </div>
      </div>
      <div class="action-row">
        <button
          class="action-button secondary"
          :disabled="monthLoading || fishToppingUp || arenaToppingUp"
          @click="fetchMonthlyActivity"
        >
          {{ monthLoading ? t("monthlyTasksCard.actions.refreshing") : t("monthlyTasksCard.actions.refresh") }}
        </button>

        <n-button-group>
          <n-button
            class="action-button"
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
            <n-button :disabled="monthLoading || fishToppingUp">▾</n-button>
          </n-dropdown>
        </n-button-group>

        <n-button-group>
          <n-button
            class="action-button"
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
              :disabled="monthLoading || arenaToppingUp || !isArenaActivityOpen"
              >▾</n-button
            >
          </n-dropdown>
        </n-button-group>
      </div>
      <p class="description muted">
        {{ t("monthlyTasksCard.description", { fishTarget: FISH_TARGET, arenaTarget: ARENA_TARGET }) }}
      </p>
    </template>
  </MyCard>
</template>

<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { useMessage } from "naive-ui/es";
import { useI18n } from "vue-i18n";
import { useMonthlyTaskActions } from "@/composables/useMonthlyTaskActions";
import { useTokenStore } from "@/stores/tokenStore";
import MyCard from "../Common/MyCard.vue";

const tokenStore = useTokenStore();
const message = useMessage();
const { t } = useI18n();

const FISH_TARGET = 320;
const ARENA_TARGET = 240;

const monthLoading = ref(false);
const fishToppingUp = ref(false);
const arenaToppingUp = ref(false);
const monthActivity = ref(null);

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

const isConnected = computed(() => {
  if (!tokenStore.selectedToken) return false;
  return (
    tokenStore.getWebSocketStatus(tokenStore.selectedToken.id) === "connected"
  );
});

const isArenaActivityOpen = computed(() => {
  const hour = new Date().getHours();
  return hour >= 6 && hour < 22;
});

const onFishMoreSelect = (key) => {
  if (key === "complete-fish") completeMonthly("fish");
};
const onArenaMoreSelect = (key) => {
  if (key === "complete-arena") completeMonthly("arena");
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

const hasFetchedOnce = ref(false);
watch(
  () =>
    tokenStore.selectedToken
      ? tokenStore.getWebSocketStatus(tokenStore.selectedToken.id)
      : "disconnected",
  (status) => {
    if (status === "connected" && !hasFetchedOnce.value) {
      hasFetchedOnce.value = true;
      fetchMonthlyActivity();
    }
  },
  { immediate: true },
);

onMounted(() => {
  if (tokenStore.selectedToken && isConnected.value) fetchMonthlyActivity();
});

defineExpose({ fetchMonthlyActivity });
</script>

<style scoped lang="scss">
.monthly-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: var(--spacing-xs);
  font-size: var(--font-size-sm);
}
.description.muted {
  color: var(--text-tertiary);
  margin-top: var(--spacing-sm);
}
.action-row {
  display: flex;
  gap: var(--spacing-sm);
  .action-button {
    flex: 1;
  }
}

.action-button {
  width: 100%;
  padding: var(--spacing-sm) var(--spacing-md);
  border: none;
  border-radius: var(--border-radius-medium);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  transition: all var(--transition-fast);
  background: var(--primary-color);
  color: #fff;
  &:hover:not(:disabled) {
    background: var(--primary-color-hover);
    transform: translateY(-1px);
  }
  &:disabled {
    background: var(--bg-tertiary);
    color: var(--text-tertiary);
    cursor: not-allowed;
  }
  &.secondary {
    background: var(--secondary-color);
    &:hover:not(:disabled) {
      background: var(--secondary-color-hover);
    }
  }
}

.status-indicator {
  font-size: var(--font-size-xs);
  margin-left: var(--spacing-xs);
  &.open {
    color: var(--success-color, #059669);
  }
  &.closed {
    color: var(--error-color, #dc2626);
  }
}
</style>
