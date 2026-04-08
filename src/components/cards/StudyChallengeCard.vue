<template>
  <MyCard
    class="study-challenge-card"
    :panel-active="panelActive"
    :status-class="statusClass"
  >
    <template #icon>
      <img src="/icons/1736425783912140.png" :alt="t('studyChallengeCard.iconAlt')">
    </template>
    <template #title>
      <h3>{{ t("studyChallengeCard.title") }}</h3>
      <p>{{ t("studyChallengeCard.subtitle") }}</p>
    </template>
    <template #badge>
      <span>{{ headerChipText }}</span>
    </template>
    <template #default>
      <div class="gwb2-mini-card__metric study-metric">
        <span class="study-metric__state">{{ weeklyStatusText }}</span>
        <strong class="study-metric__value">{{ currentStageText }}</strong>
      </div>
      <p class="description">{{ t("studyChallengeCard.description") }}</p>
    </template>
    <template #action>
      <div class="gwb2-mini-card__action-rail gwb2-mini-card__action-rail--single">
        <n-button
          :disabled="primaryActionDisabled"
          :type="primaryActionType"
          @click="handlePrimaryAction"
        >
          {{ primaryActionLabel }}
        </n-button>
      </div>
    </template>
  </MyCard>
</template>

<script setup>
import { computed, onBeforeUnmount, ref } from "vue";
import { useMessage } from "naive-ui/es";
import { useI18n } from "vue-i18n";
import { useGameCardActionLock } from "@/composables/gameCards/useGameCardActionLock";
import {
  getQuestionCount,
  preloadQuestions,
} from "@/utils/studyQuestionsFromJSON.js";
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
const { runLocked } = useGameCardActionLock();
const timeoutHandle = ref(null);

const study = computed(() => tokenStore.gameData.studyStatus || {});
const isWeeklyDone = computed(() => Boolean(study.value?.thisWeek));
const isRunning = computed(() =>
  ["starting", "answering", "claiming_rewards"].includes(study.value?.status || ""),
);
const isCompleted = computed(() =>
  Boolean(study.value?.isCompleted || study.value?.status === "completed" || isWeeklyDone.value),
);
const canStart = computed(() =>
  !isWeeklyDone.value
  && !isRunning.value
  && !isCompleted.value
  && (!study.value?.status || study.value?.status === "idel"),
);

const statusClass = computed(() => ({
  weekly: true,
  active: isRunning.value,
  completed: isCompleted.value,
}));

const currentStageText = computed(() => {
  if (isWeeklyDone.value)
    return t("studyChallengeCard.status.doneThisWeek");
  if (study.value?.status === "starting")
    return t("studyChallengeCard.status.starting");
  if (study.value?.status === "answering")
    return t("studyChallengeCard.status.answering");
  if (study.value?.status === "claiming_rewards")
    return t("studyChallengeCard.status.claimingRewards");
  if (study.value?.status === "completed" || study.value?.isCompleted) {
    return t("studyChallengeCard.status.completed");
  }
  return t("studyChallengeCard.subtitle");
});

const weeklyStatusText = computed(() =>
  isWeeklyDone.value
    ? t("studyChallengeCard.status.doneThisWeek")
    : t("studyChallengeCard.badge"),
);

const headerChipText = computed(() => {
  if (isWeeklyDone.value)
    return t("studyChallengeCard.status.doneThisWeek");
  if (isCompleted.value)
    return t("studyChallengeCard.status.completed");
  if (isRunning.value)
    return currentStageText.value;
  return t("studyChallengeCard.badge");
});

const primaryActionLabel = computed(() => {
  if (isWeeklyDone.value)
    return t("studyChallengeCard.status.doneThisWeek");
  if (isRunning.value)
    return currentStageText.value;
  if (isCompleted.value)
    return t("studyChallengeCard.status.completed");
  return t("studyChallengeCard.actions.start");
});

const primaryActionType = computed(() => {
  if (isWeeklyDone.value)
    return "success";
  if (isRunning.value)
    return "warning";
  if (isCompleted.value)
    return "default";
  return "primary";
});

const primaryActionDisabled = computed(() => !canStart.value);

const clearTimeoutHandle = () => {
  if (timeoutHandle.value) {
    clearTimeout(timeoutHandle.value);
    timeoutHandle.value = null;
  }
};

const handlePrimaryAction = async () => {
  if (!canStart.value) {
    return;
  }
  await runLocked(async () => {
    if (!tokenStore.selectedToken || isWeeklyDone.value)
      return;

    study.value.status = "starting";
    await preloadQuestions();
    study.value.status = "answering";
    const questionCount = await getQuestionCount();

    if (study.value.isCompleted) {
      message.success(t("studyChallengeCard.messages.alreadyCompleted"));
      return;
    }

    try {
      tokenStore.gameData.studyStatus = {
        ...tokenStore.gameData.studyStatus,
        isAnswering: true,
        questionCount: 0,
        answeredCount: 0,
        status: "starting",
        timestamp: Date.now(),
      };
      const tokenId = tokenStore.selectedToken.id;
      tokenStore.sendMessage(tokenId, "study_startgame");
      clearTimeoutHandle();
      timeoutHandle.value = setTimeout(() => {
        if (tokenStore.gameData.studyStatus.isAnswering) {
          tokenStore.gameData.studyStatus = {
            ...tokenStore.gameData.studyStatus,
            isAnswering: false,
            questionCount: 0,
            answeredCount: 0,
            status: "",
            timestamp: null,
          };
          message.warning(t("studyChallengeCard.messages.timeoutReset"));
        }
      }, 40000);
      message.info(t("studyChallengeCard.messages.started", { count: questionCount }));
    } catch (error) {
      message.error(t("studyChallengeCard.messages.startFailed", { error: error.message }));
    }
  });
};

onBeforeUnmount(() => {
  clearTimeoutHandle();
});
</script>

<style scoped lang="scss">
.study-metric {
  align-items: stretch;
  min-height: 84px;
  justify-content: space-between;
}

.study-metric__state,
.study-metric__value {
  min-width: 0;
}

.study-metric__state {
  color: var(--text-tertiary);
  font-size: var(--font-size-sm);
}

.study-metric__value {
  color: var(--text-primary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  text-align: right;
}

.description {
  margin: 0;
  color: var(--text-secondary);
}

.study-challenge-card :deep(.gwb2-mini-card__surface) {
  height: 100%;
}

.study-challenge-card :deep(.gwb2-mini-card__body) {
  display: flex;
  align-items: flex-start;
}

@media (max-width: 959px) {
  .study-metric {
    flex-direction: column;
  }

  .study-metric__value {
    text-align: left;
  }
}
</style>
