<template>
  <MyCard class="bottle-helper" :status-class="{ active: state.isRunning }">
    <template #icon>
      <img :alt="t('boxHelperCard.iconAlt')" :src="iconPath">
    </template>
    <template #title>
      <h3>{{ t("boxHelperCard.title") }}</h3>
    </template>
    <template #badge>
      <span>{{ state.isRunning ? t("boxHelperCard.status.running") : t("boxHelperCard.status.stopped") }}</span>
    </template>
    <template #default>
      <div class="total-points">
        <span class="label">{{ t("boxHelperCard.labels.totalPoints") }}</span>
        <span class="value">{{ totalPoints }}</span>
      </div>
      <div class="container">
        <div class="list">
          <div v-for="item in boxDataList" :key="item.type" class="item">
            <img :alt="item.type" :src="item.img">
            <div class="box-info">
              <div class="box-type">{{ item.type }}</div>
              <div class="box-count">{{ t("boxHelperCard.count", { count: item.count }) }}</div>
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
        @click="handleBoxHelper"
      >
        {{ state.isRunning ? t("boxHelperCard.status.running") : t("boxHelperCard.actions.open") }}
      </a-button>
      <a-button size="small" type="primary" @click="batchclaimboxpointreward">
        {{ t("boxHelperCard.actions.claimPoints") }}
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

const iconPath = computed(() => `${import.meta.env.BASE_URL}box/zsbx.png`);

const roleInfo = computed(() => tokenStore.gameData?.roleInfo || null);

const boxDataList = computed(() => {
  const getImgPath = (path) =>
    import.meta.env.BASE_URL + path.replace(/^\//, "");
  return [
    {
      type: t("boxHelperCard.types.wooden"),
      img: getImgPath("/box/mzbx.png"),
      count: roleInfo.value?.role?.items?.[2001]?.quantity || 0,
    },
    {
      type: t("boxHelperCard.types.bronze"),
      img: getImgPath("/box/qtbx.png"),
      count: roleInfo.value?.role?.items?.[2002]?.quantity || 0,
    },
    {
      type: t("boxHelperCard.types.gold"),
      img: getImgPath("/box/hjbx.png"),
      count: roleInfo.value?.role?.items?.[2003]?.quantity || 0,
    },
    {
      type: t("boxHelperCard.types.platinum"),
      img: getImgPath("/box/bjbx.png"),
      count: roleInfo.value?.role?.items?.[2004]?.quantity || 0,
    },
  ];
});

const totalPoints = computed(() => {
  const wooden = roleInfo.value?.role?.items?.[2001]?.quantity || 0;
  const bronze = roleInfo.value?.role?.items?.[2002]?.quantity || 0;
  const gold = roleInfo.value?.role?.items?.[2003]?.quantity || 0;
  const platinum = roleInfo.value?.role?.items?.[2004]?.quantity || 0;

  return wooden * 1 + bronze * 10 + gold * 20 + platinum * 50;
});

const type = ref(2001);
const typeOptions = [
  { label: t("boxHelperCard.types.wooden"), value: 2001 },
  { label: t("boxHelperCard.types.bronze"), value: 2002 },
  { label: t("boxHelperCard.types.gold"), value: 2003 },
  { label: t("boxHelperCard.types.platinum"), value: 2004 },
];

const number = ref(10);
const numberOptions = [
  { label: "10", value: 10 },
  { label: "100", value: 100 },
  { label: "1000", value: 1000 },
  { label: "2000", value: 2000 },
  { label: "5000", value: 5000 },
  { label: "10000", value: 10000 },
];

const state = ref({
  isRunning: false,
});

const batchclaimboxpointreward = async () => {
  if (!tokenStore.selectedToken) {
    message.warning(t("boxHelperCard.messages.selectTokenFirst"));
    return;
  }
  const tokenId = tokenStore.selectedToken.id;
  await tokenStore.sendMessage(tokenId, "item_batchclaimboxpointreward");
  await new Promise((r) => setTimeout(r, 500));
  await tokenStore.sendMessage(tokenId, "role_getroleinfo");
  message.success(t("boxHelperCard.messages.claimDone"));
};

const handleBoxHelper = async () => {
  if (!tokenStore.selectedToken) {
    message.warning(t("boxHelperCard.messages.selectTokenFirst"));
    return;
  }
  const tokenId = tokenStore.selectedToken.id;
  state.value.isRunning = true;
  message.info(t("boxHelperCard.messages.opening"));
  if (number.value >= 10) {
    const batches = Math.floor(number.value / 10);
    const remainder = number.value % 10;
    for (let i = 0; i < batches; i++) {
      await tokenStore.sendMessageWithPromise(tokenId, "item_openbox", {
        itemId: type.value,
        number: 10,
      });
    }
    if (remainder > 0) {
      await tokenStore.sendMessageWithPromise(tokenId, "item_openbox", {
        itemId: type.value,
        number: remainder,
      });
    }
    await tokenStore.sendMessage(tokenId, "item_batchclaimboxpointreward");
    await new Promise((r) => setTimeout(r, 500));
    await tokenStore.sendMessage(tokenId, "role_getroleinfo");
    // 更新活动进度
    tokenStore.sendMessage(tokenId, "activity_get");
    message.success(t("boxHelperCard.messages.openDone"));
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
    justify-content: space-between;

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

  .total-points {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 2px;
    padding: 2px;
    background: var(--bg-tertiary);
    border-radius: var(--border-radius-medium);

    .label {
      color: var(--text-secondary);
      font-size: var(--font-size-sm);
    }

    .value {
      color: var(--text-primary);
      font-size: var(--font-size-md);
      font-weight: var(--font-weight-semibold);
    }
  }
}
</style>
