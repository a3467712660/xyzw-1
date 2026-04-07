<template>
  <MyCard
    class="study"
    :status-class="{ weekly: true, completed: study.isCompleted }"
  >
    <template #icon>
      <img src="/icons/1736425783912140.png" :alt="t('studyChallengeCard.iconAlt')">
    </template>
    <template #title>
      <h3>{{ t("studyChallengeCard.title") }}</h3>
      <p>{{ t("studyChallengeCard.subtitle") }}</p>
    </template>
    <template #badge>
      <span>{{ t("studyChallengeCard.badge") }}</span>
    </template>
    <template #default>
      <div class="gwb2-mini-card__metric study-metric">
        <span class="study-metric__state">{{ weeklyStatusText }}</span>
        <strong class="study-metric__value">{{ currentStageText }}</strong>
      </div>
      <p class="description">{{ t("studyChallengeCard.description") }}</p>
    </template>
    <template #action>
      <n-button v-if="!study.thisWeek" type="primary" @click="startStudy">
        {{ t("studyChallengeCard.actions.start") }}
      </n-button>
      <n-button
        v-if="!study.thisWeek && study.status === 'starting'"
        type="warning"
        :disabled="true"
      >
        {{ t("studyChallengeCard.status.starting") }}
      </n-button>
      <n-button
        v-if="!study.thisWeek && study.status === 'answering'"
        type="warning"
        :disabled="true"
      >
        {{ t("studyChallengeCard.status.answering") }}
      </n-button>
      <n-button
        v-if="!study.thisWeek && study.status === 'claiming_rewards'"
        type="warning"
        :disabled="true"
      >
        {{ t("studyChallengeCard.status.claimingRewards") }}
      </n-button>
      <n-button
        v-if="!study.thisWeek && study.status === 'completed'"
        type="warning"
        :disabled="true"
      >
        {{ t("studyChallengeCard.status.completed") }}
      </n-button>
      <n-button v-if="study.thisWeek" type="success" :disabled="true">
        {{ t("studyChallengeCard.status.doneThisWeek") }}
      </n-button>
    </template>
  </MyCard>
</template>

<script setup>
import { computed } from "vue";
import { useMessage } from "naive-ui/es";
import { useI18n } from "vue-i18n";
import {
  getQuestionCount,
  preloadQuestions,
} from "@/utils/studyQuestionsFromJSON.js";
import { useTokenStore } from "@/stores/tokenStore";
import MyCard from "../Common/MyCard.vue";

const tokenStore = useTokenStore();
const message = useMessage();
const { t } = useI18n();
const study = computed(() => tokenStore.gameData.studyStatus);

const currentStageText = computed(() => {
  if (study.value?.thisWeek) return t("studyChallengeCard.status.doneThisWeek");
  if (study.value?.status === "starting") return t("studyChallengeCard.status.starting");
  if (study.value?.status === "answering") return t("studyChallengeCard.status.answering");
  if (study.value?.status === "claiming_rewards") return t("studyChallengeCard.status.claimingRewards");
  if (study.value?.status === "completed" || study.value?.isCompleted) {
    return t("studyChallengeCard.status.completed");
  }
  return t("studyChallengeCard.subtitle");
});

const weeklyStatusText = computed(() => {
  return study.value?.thisWeek
    ? t("studyChallengeCard.status.doneThisWeek")
    : t("studyChallengeCard.badge");
});

const startStudy = async () => {
  if (!tokenStore.selectedToken || study.value.thisWeek) return;
  if (study.value.status !== "" && study.value.status !== "idel") return;
  console.log(t("studyChallengeCard.logs.starting"), study.value);

  study.value.status = "starting";
  await preloadQuestions();
  study.value.status = "answering";
  const questionCount = await getQuestionCount();
  message.info(t("studyChallengeCard.messages.started", { count: questionCount }));

  if (study.value.isCompleted)
    return message.success(t("studyChallengeCard.messages.alreadyCompleted"));
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
    setTimeout(() => {
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
    console.error(t("studyChallengeCard.logs.startFailed"), error);
    message.error(t("studyChallengeCard.messages.startFailed", { error: error.message }));
  }
};
</script>

<style scoped lang="scss">
.study-metric {
  align-items: stretch;
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
}

@media (max-width: 768px) {
  .study-metric {
    flex-direction: column;
  }

  .study-metric__value {
    text-align: left;
  }
}
</style>
