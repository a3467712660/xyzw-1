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
      <p class="description">{{ t("studyChallengeCard.description") }}</p>
    </template>
    <template #action>
      <a-button v-if="!study.thisWeek" status="primary" @click="startStudy">
        {{ t("studyChallengeCard.actions.start") }}
      </a-button>
      <a-button
        v-if="!study.thisWeek && study.status === 'starting'"
        status="warning"
        :disabled="true"
      >
        {{ t("studyChallengeCard.status.starting") }}
      </a-button>
      <a-button
        v-if="!study.thisWeek && study.status === 'answering'"
        status="warning"
        :disabled="true"
      >
        {{ t("studyChallengeCard.status.answering") }}
      </a-button>
      <a-button
        v-if="!study.thisWeek && study.status === 'claiming_rewards'"
        status="warning"
        :disabled="true"
      >
        {{ t("studyChallengeCard.status.claimingRewards") }}
      </a-button>
      <a-button
        v-if="!study.thisWeek && study.status === 'completed'"
        status="warning"
        :disabled="true"
      >
        {{ t("studyChallengeCard.status.completed") }}
      </a-button>
      <a-button v-if="study.thisWeek" status="success" :disabled="true">
        {{ t("studyChallengeCard.status.doneThisWeek") }}
      </a-button>
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
