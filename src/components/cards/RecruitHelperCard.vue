<template>
  <MyCard class="helper" :status-class="{ active: state.isRunning }">
    <template #icon>
      <img :alt="t('recruitHelperCard.iconAlt')" :src="iconPath">
    </template>
    <template #title>
      <h3>{{ t("recruitHelperCard.title") }}</h3>
    </template>
    <template #badge>
      <span>{{ state.isRunning ? t("recruitHelperCard.status.running") : t("recruitHelperCard.status.stopped") }}</span>
    </template>
    <template #default>
      <div class="container">
        <div class="list">
          <div v-for="item in dataList" :key="item.type" class="item">
            <img :alt="item.type" :src="item.img">
            <div class="box-info">
              <div class="box-type">{{ item.type }}</div>
              <div class="box-count">{{ t("recruitHelperCard.count", { count: item.count }) }}</div>
            </div>
          </div>
        </div>
        <div class="selects">
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
        {{ state.isRunning ? t("recruitHelperCard.status.running") : t("recruitHelperCard.actions.start") }}
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

const state = ref({
  isRunning: false,
});

const handleHelper = async () => {
  if (!tokenStore.selectedToken) {
    message.warning(t("recruitHelperCard.messages.selectTokenFirst"));
    return;
  }
  const tokenId = tokenStore.selectedToken.id;
  state.value.isRunning = true;
  message.info(t("recruitHelperCard.messages.running"));
  if (number.value >= 10) {
    const batches = Math.floor(number.value / 10);
    const remainder = number.value % 10;
    for (let i = 0; i < batches; i++) {
      await tokenStore.sendMessageWithPromise(tokenId, "hero_recruit", {
        recruitType: 1,
        recruitNumber: 10,
      });
    }
    if (remainder > 0) {
      await tokenStore.sendMessageWithPromise(tokenId, "hero_recruit", {
        recruitType: 1,
        recruitNumber: remainder,
      });
    }
    await tokenStore.sendMessage(tokenId, "role_getroleinfo");
    // 更新活动进度
    tokenStore.sendMessage(tokenId, "activity_get");
    message.success(t("recruitHelperCard.messages.done"));
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
