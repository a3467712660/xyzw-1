<template>
  <MyCard class="helper" :status-class="{ active: state.isRunning }">
    <template #icon>
      <img :alt="t('fishHelperCard.iconAlt')" :src="iconPath">
    </template>
    <template #title>
      <h3>{{ t("fishHelperCard.title") }}</h3>
    </template>
    <template #badge>
      <span>{{ state.isRunning ? t("fishHelperCard.status.running") : t("fishHelperCard.status.stopped") }}</span>
    </template>
    <template #default>
      <div class="container">
        <div class="list">
          <div v-for="item in dataList" :key="item.type" class="item">
            <img :alt="item.type" :src="item.img">
            <div class="box-info">
              <div class="box-type">{{ item.type }}</div>
              <div class="box-count">{{ t("fishHelperCard.count", { count: item.count }) }}</div>
            </div>
          </div>
        </div>
        <div class="selects">
          <n-select v-model:value="type" :options="typeOptions"></n-select>
          <n-select v-model:value="number" :options="numberOptions"></n-select>
        </div>
      </div>
    </template>
    <template #action>
      <a-button
        block
        secondary
        size="small"
        type="primary"
        :disabled="state.isRunning"
        @click="handleHelper"
      >
        {{ state.isRunning ? t("fishHelperCard.status.running") : t("fishHelperCard.actions.start") }}
      </a-button>
    </template>
  </MyCard>
</template>

<script setup>
import { computed, ref } from "vue";
import { useMessage } from "naive-ui/es";
import { useI18n } from "vue-i18n";
import { useTokenStore } from "@/stores/tokenStore";
import MyCard from "../Common/MyCard.vue";

const tokenStore = useTokenStore();
const message = useMessage();
const { t } = useI18n();

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

const number = ref(10);
const numberOptions = [
  { label: "10", value: 10 },
  { label: "20", value: 20 },
  { label: "50", value: 50 },
  { label: "80", value: 80 },
  { label: "100", value: 100 },
  { label: "160", value: 160 },
];

const state = ref({
  isRunning: false,
});

const handleHelper = async () => {
  if (!tokenStore.selectedToken) {
    message.warning(t("fishHelperCard.messages.selectTokenFirst"));
    return;
  }
  const tokenId = tokenStore.selectedToken.id;
  state.value.isRunning = true;
  message.info(t("fishHelperCard.messages.running"));
  console.log("🚀 ~ handleHelper ~ type.value:", type.value);
  if (number.value >= 10) {
    const batches = Math.floor(number.value / 10);
    const remainder = number.value % 10;
    for (let i = 0; i < batches; i++) {
      await tokenStore.sendMessageWithPromise(tokenId, "artifact_lottery", {
        type: type.value,
        lotteryNumber: 10,
        newFree: true,
      });
    }
    if (remainder > 0) {
      await tokenStore.sendMessageWithPromise(tokenId, "artifact_lottery", {
        type: type.value,
        lotteryNumber: remainder,
        newFree: true,
      });
    }
    await tokenStore.sendMessage(tokenId, "role_getroleinfo");
    // 更新活动进度
    tokenStore.sendMessage(tokenId, "activity_get");
    message.success(t("fishHelperCard.messages.done"));
    state.value.isRunning = false;
  }
};
</script>

<style scoped lang="scss">
.container {
  padding: 10px 0;
  display: flex;
  flex-direction: column;

  .list {
    display: flex;
    align-items: center;
    justify-content: space-around;

    .item {
      display: flex;
      flex-direction: column;
      align-items: center;

      > img {
        width: 40px;
        height: 40px;
      }

      .box-info {
        display: flex;
        flex-direction: column;
        align-items: center;

        .box-type {
          font-weight: bold;
          margin-top: 4px;
        }

        .box-count {
          margin-top: 2px;
          color: #666;
        }
      }
    }
  }

  .selects {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-top: 12px;
  }
}
</style>
