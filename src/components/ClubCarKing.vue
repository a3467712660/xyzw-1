<template>
  <NCard embedded class="club-car-king" :bordered="false">
    <NThing>
      <template #avatar>
        <NAvatar
          class="avatar-transparent"
          color="transparent"
          src="/icons/疯狂赛车.png"
          :size="48"
        ></NAvatar>
      </template>
      <template #header>
        <span class="card-title-text">{{ t("clubCarKing.title") }}</span>
      </template>
      <template #description>
        <NSpace class="mt-4" size="small">
          <NTag size="small" type="info" :bordered="false">
            {{
              carList.length > 0
                ? t("clubCarKing.summary.totalCars", { count: carList.length })
                : t("clubCarKing.summary.noData")
            }}
          </NTag>
          <NTag
            size="small"
            :bordered="false"
            :type="hasFreeRefresh ? 'success' : 'default'"
          >
            {{
              hasFreeRefresh
                ? t("clubCarKing.summary.freeRefresh", {
                  count: freeCarsCount,
                })
                : t("clubCarKing.summary.noFreeRefresh")
            }}
          </NTag>
          <NTag size="small" type="warning" :bordered="false">
            <template #icon>
              <NIcon><Ticket></Ticket></NIcon>
            </template>
            {{ t("clubCarKing.summary.tickets", { count: refreshTickets }) }}
          </NTag>
        </NSpace>
      </template>
      <template #header-extra>
        <NSpace size="small">
          <NButton
            size="small"
            type="primary"
            :loading="carLoading"
            @click="fetchCarInfo"
          >
            <template #icon>
              <NIcon><Refresh></Refresh></NIcon>
            </template>
            {{ carLoading ? t("clubCarKing.actions.loading") : t("clubCarKing.actions.refreshData") }}
          </NButton>
          <NButton
            secondary
            size="small"
            :disabled="carLoading || !isConnected"
            @click="smartSendCar"
          >
            <template #icon>
              <NIcon><Flash></Flash></NIcon>
            </template>
            {{ t("clubCarKing.actions.smartSend") }}
          </NButton>
          <NButton
            secondary
            size="small"
            :disabled="carLoading || !isConnected"
            @click="claimAllCars"
          >
            <template #icon>
              <NIcon><ArrowUpCircle></ArrowUpCircle></NIcon>
            </template>
            {{ t("clubCarKing.actions.claimAll") }}
          </NButton>
        </NSpace>
      </template>
    </NThing>

    <div class="card-content card-content-top">
      <div v-if="!isConnected" class="hint">
        <NEmpty :description="t('clubCarKing.empty.selectToken')"></NEmpty>
      </div>
      <div v-else-if="carList.length === 0 && !carLoading" class="hint">
        <NEmpty :description="t('clubCarKing.empty.noCars')"></NEmpty>
      </div>

      <NGrid
        v-if="carList.length > 0"
        item-responsive
        cols="1 600:2 900:3 1200:4"
        x-gap="12"
        y-gap="12"
      >
        <NGi v-for="c in carList" :key="c.key">
          <NCard
            class="car-card-item car-card-pad"
            size="small"
            :bordered="false"
          >
            <div class="car-header">
              <img
                class="car-brand-icon"
                :alt="gradeLabel(c.color)"
                :src="gradeIcon(c.color)"
              >
                <div class="car-info">
                  <div class="car-name">
                    {{ c.name || c.carName || t("clubCarKing.fallbacks.carName", { id: c.id || c.key }) }}
                  </div>
                <div class="car-badges">
                  <NTag
                    size="tiny"
                    :bordered="false"
                    :color="{
                      color: getGradeColor(c.color),
                      textColor: '#fff',
                    }"
                  >
                    {{ gradeLabel(c.color) }}
                  </NTag>
                  <NTag
v-if="c.level != null"
size="tiny"
:bordered="false"
                    >Lv.{{ c.level }}</NTag
                  >
                  <NTag
v-if="c.star != null"
size="tiny"
:bordered="false"
                    >{{ t("clubCarKing.labels.star", { value: c.star }) }}</NTag
                  >
                </div>
              </div>
            </div>

            <div class="car-status section-gap-sm">
              <NGrid cols="2" x-gap="8" y-gap="8">
                <NGi>
                  <div class="status-item">
                    <span class="label">{{ t("clubCarKing.labels.status") }}</span>
                    <span
                      class="value"
                      :class="
                        Number(c.sendAt || 0) === 0
                          ? 'status-idle'
                          : 'status-sent'
                      "
                    >
                      {{
                        Number(c.sendAt || 0) === 0
                          ? t("clubCarKing.status.idle")
                          : t("clubCarKing.status.sent")
                      }}
                    </span>
                  </div>
                </NGi>
                <NGi>
                  <div class="status-item">
                    <span class="label">{{ t("clubCarKing.labels.helper") }}</span>
                    <span class="value">{{ getCarHelperStatus(c) }}</span>
                  </div>
                </NGi>
              </NGrid>
            </div>

            <div
              v-if="c.rewards && c.rewards.length > 0"
              class="car-rewards section-gap-sm"
            >
              <NSpace size="small" :wrap="true">
                <span
                  v-for="(reward, index) in sortRewards(c.rewards)"
                  :key="index"
                  class="reward-tag"
                  :class="getRewardClass(reward)"
                >
                  {{ formatReward(reward) }}
                </span>
              </NSpace>
            </div>

            <div class="car-actions section-gap-md">
              <NGrid cols="3" x-gap="8">
                <NGi>
                  <NButton
                    block
                    secondary
                    size="tiny"
                    :disabled="carLoading || Number(c.sendAt || 0) !== 0"
                    :type="
                      Number(c.refreshCount ?? 0) === 0 ? 'success' : 'warning'
                    "
                    @click="refreshCar(c)"
                  >
                    <template #icon
                      ><NIcon><Refresh></Refresh></NIcon
                    ></template>
                    {{
                      Number(c.refreshCount ?? 0) === 0
                        ? t("clubCarKing.actions.freeRefresh")
                        : t("clubCarKing.actions.refreshGrade")
                    }}
                  </NButton>
                </NGi>
                <NGi>
                  <NButton
                    block
                    size="tiny"
                    type="primary"
                    :disabled="carLoading || actionDisabled(c)"
                    @click="handleAction(c)"
                  >
                    <template #icon
                      ><NIcon><CarSport></CarSport></NIcon
                    ></template>
                    {{
                      actionLabel(c) === t("clubCarKing.actions.send")
                        ? t("clubCarKing.actions.send")
                        : t("clubCarKing.actions.claim")
                    }}
                  </NButton>
                </NGi>
                <NGi>
                  <NButton
                    block
                    quaternary
                    size="tiny"
                    :disabled="
                      carLoading ||
                      Number(c.color || 0) < 5 ||
                      Number(c.sendAt || 0) !== 0
                    "
                    @click="openHelperDialog(c)"
                  >
                    <template #icon
                      ><NIcon><Person></Person></NIcon
                    ></template>
                    {{ t("clubCarKing.actions.helper") }}
                  </NButton>
                </NGi>
              </NGrid>
            </div>
          </NCard>
        </NGi>
      </NGrid>
    </div>
  </NCard>

  <!-- 护卫选择弹窗 -->
  <NModal
    class="modal-w-600"
    preset="card"
    v-model:show="helperDialogVisible"
    :title="t('clubCarKing.helperDialog.title')"
  >
    <div class="helper-body">
      <div class="helper-row">
        <span class="label">{{ t("clubCarKing.helperDialog.memberLabel") }}</span>
        <NSelect
          filterable
          class="helper-select"
          v-model:value="helperSelection"
          :loading="helperLoading"
          :max-tag-count="1"
          :options="helperOptions"
          :placeholder="t('clubCarKing.helperDialog.placeholder')"
        ></NSelect>
      </div>
      <div class="tips">{{ t("clubCarKing.helperDialog.tip") }}</div>
    </div>
    <template #footer>
      <NSpace justify="end">
        <NButton @click="cancelHelper">{{ t("clubCarKing.common.cancel") }}</NButton>
        <NButton type="primary" @click="confirmHelper">{{ t("clubCarKing.common.confirm") }}</NButton>
      </NSpace>
    </template>
  </NModal>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import {
  NAvatar,
  NButton,
  NCard,
  NEmpty,
  NGi,
  NGrid,
  NIcon,
  NModal,
  NSelect,
  NSpace,
  NTag,
  NThing,
  useMessage,
} from "naive-ui/es";
import { useTokenStore } from "@/stores/tokenStore";
import {
  ArrowUpCircle,
  CarSport,
  Flash,
  Person,
  Refresh,
  Ticket,
} from "@vicons/ionicons5";

const tokenStore = useTokenStore();
const message = useMessage();
const { t } = useI18n();

const carLoading = ref(false);
const carRaw = ref(null);
const carFetched = ref(false);
const refreshTickets = ref(0);

// 每日 20:00 后禁止发车：每分钟刷新一次
const nowTs = ref(Date.now());
let nowTimer = null;
onMounted(() => {
  nowTimer = setInterval(() => {
    nowTs.value = Date.now();
  }, 60000);
});
onUnmounted(() => {
  if (nowTimer) clearInterval(nowTimer);
});
const isAfter20 = computed(() => {
  const d = new Date(nowTs.value);
  return d.getHours() >= 20;
});

// 活动开放时间：周一至周三可发车
const isActivityOpen = computed(() => {
  const d = new Date(nowTs.value);
  const wd = d.getDay(); // 0=周日
  return wd >= 1 && wd <= 3;
});

const isConnected = computed(() => {
  const t = tokenStore.selectedToken;
  if (!t) return false;
  return tokenStore.getWebSocketStatus(t.id) === "connected";
});

const normalizeCars = (raw) => {
  const r = raw || {};
  const body = r.body || r;
  const roleCar = body.roleCar || body.rolecar || {};

  // 优先从 roleCar.carDataMap 解析（id -> info）
  const carMap = roleCar.carDataMap || roleCar.cardatamap;
  if (carMap && typeof carMap === "object") {
    return Object.entries(carMap).map(([id, info], idx) => ({
      key: idx,
      id,
      ...(info || {}),
    }));
  }

  // 兜底
  let arr =
    body.cars || body.list || body.data || body.carList || body.vehicles || [];
  if (!Array.isArray(arr) && typeof arr === "object" && arr !== null)
    arr = Object.values(arr);
  if (Array.isArray(body) && arr.length === 0) arr = body;
  return (Array.isArray(arr) ? arr : []).map((it, idx) => ({
    key: idx,
    ...it,
  }));
};

const carList = computed(() => {
  const list = normalizeCars(carRaw.value);
  return list.sort((a, b) => {
    // 1. 状态排序：可收车 > 未发车 > 已发车(等待中)
    const getStatusWeight = (c) => {
      const isSent = Number(c.sendAt || 0) !== 0;
      if (isSent) {
        // 已发车：若可收车则最优先(2)，否则最低优先级(0)
        return canClaim(c) ? 2 : 0;
      }
      // 未发车：次优先(1)
      return 1;
    };
    const weightA = getStatusWeight(a);
    const weightB = getStatusWeight(b);
    if (weightA !== weightB) return weightB - weightA; // 降序：2 > 1 > 0

    // 2. 品阶排序：高 > 低
    const colorA = Number(a.color || 0);
    const colorB = Number(b.color || 0);
    if (colorA !== colorB) return colorB - colorA;

    // 3. ID 排序：保持稳定
    return String(a.id || "").localeCompare(String(b.id || ""));
  });
});

// 免费刷新信息：每辆车初次刷新免费（refreshCount === 0 表示可免费）
const freeCarsCount = computed(
  () =>
    (carList.value || []).filter((c) => Number(c.refreshCount ?? 0) === 0).length,
);
const hasFreeRefresh = computed(() => freeCarsCount.value > 0);

const gradeLabel = (color) => {
  const map = {
    1: "绿·普通",
    2: "蓝·稀有",
    3: "紫·史诗",
    4: "橙·传说",
    5: "红·神话",
    6: "金·传奇",
  };
  return map[color] || "未知";
};

const gradeIcon = (color) => {
  const map = {
    1: "/icons/大众.svg",
    2: "/icons/特斯拉.svg",
    3: "/icons/奥迪.svg",
    4: "/icons/奔驰.svg",
    5: "/icons/保时捷.svg",
    6: "/icons/兰博基尼.svg",
  };
  const path = map[color] || "/icons/大众.svg";
  return import.meta.env.BASE_URL + path.replace(/^\//, "");
};

const getGradeColor = (color) => {
  const map = {
    1: "#22c55e",
    2: "#3b82f6",
    3: "#a855f7",
    4: "#f59e0b",
    5: "#ef4444",
    6: "#eab308",
  };
  return map[color] || "#999";
};

// 物品ID映射字典
const itemMapping = {
  1001: "招募令",
  1003: "进阶石",
  1006: "精铁",
  1007: "竞技场门票",
  1008: "木柴火把",
  1009: "青铜火把",
  1010: "咸神火把",
  1011: "普通鱼竿",
  1012: "黄金鱼竿",
  1013: "珍珠",
  1014: "军团币",
  1016: "晶石",
  1017: "复活丹",
  1019: "盐靛",
  1020: "皮肤币",
  1021: "扫荡魔毯",
  1022: "白玉",
  1023: "彩玉",
  1026: "扳手",
  1033: "贝壳",
  1035: "金盐靛",
  10002: "蓝玉",
  10003: "红玉",
  10101: "四圣碎片",
  2001: "木制宝箱",
  2002: "青铜宝箱",
  2003: "黄金宝箱",
  2004: "铂金宝箱",
  2005: "钻石宝箱",
  2101: "助威币",
  3001: "金币袋子",
  3002: "金砖袋子",
  3005: "紫色随机碎片",
  3006: "橙色随机碎片",
  3007: "红色随机碎片",
  3008: "精铁袋子",
  3009: "进阶袋子",
  3010: "梦魇袋子",
  3011: "白玉袋子",
  3012: "扳手袋子",
  3020: "聚宝盆",
  3021: "豪华聚宝盆",
  3201: "红色万能碎片",
  3302: "橙色万能碎片",
  35002: "刷新券",
  35009: "零件",
};

// 根据物品ID获取物品名称
const getItemName = (itemId) => {
  return itemMapping[itemId] || `未知物品(${itemId})`;
};

// 格式化数字为万的格式
const formatNumber = (num) => {
  const n = Number(num);
  if (n >= 1e12) return `${(n / 1e12).toFixed(2)}兆`;
  if (n >= 1e8) return `${(n / 1e8).toFixed(2)}亿`;
  if (n >= 1e4) return `${(n / 1e4).toFixed(2)}万`;
  return n.toString();
};

// 格式化单个奖励
const formatReward = (reward) => {
  const rewardType = reward.type || 0;
  const itemId = reward.itemId || 0;
  const value = reward.value || 0;

  if (rewardType === 1) {
    // 金币
    return `金币: ${formatNumber(value)}`;
  } else if (rewardType === 2) {
    // 金砖
    return `金砖: ${value.toLocaleString()}`;
  } else if (rewardType === 3) {
    // 物品
    const itemName = getItemName(itemId);
    return `${itemName}: ${value}`;
  } else {
    return `类型${rewardType}物品${itemId}: ${value}`;
  }
};

// 判断是否为高价值奖励
const isHighValueReward = (reward) => {
  const rewardType = Number(reward.type || 0);
  const itemId = Number(reward.itemId || 0);

  // 高价值奖励列表
  const highValueItems = [
    { type: 3, itemId: 3201 }, // 红色万能碎片
    { type: 3, itemId: 1001 }, // 招募令
    { type: 2, itemId: 0 }, // 金砖
    { type: 3, itemId: 1022 }, // 白玉
    { type: 3, itemId: 1023 }, // 彩玉
  ];

  return highValueItems.some(
    (item) => item.type === rewardType && item.itemId === itemId,
  );
};

// 判断是否为刷新券
const isRefreshTicket = (reward) => {
  const rewardType = Number(reward.type || 0);
  const itemId = Number(reward.itemId || 0);
  return rewardType === 3 && itemId === 35002;
};

// 获取奖励的样式类
const getRewardClass = (reward) => {
  const isRefresh = isRefreshTicket(reward);
  const isHigh = isHighValueReward(reward);
  if (isRefresh) {
    return "refresh-ticket";
  }
  if (isHigh) {
    return "high-value";
  }
  return "";
};

// 对奖励进行排序，高价值奖励排在最前面
const sortRewards = (rewards) => {
  if (!Array.isArray(rewards)) return [];
  return [...rewards].sort((a, b) => {
    const isHighA = isHighValueReward(a);
    const isHighB = isHighValueReward(b);
    const isRefreshA = isRefreshTicket(a);
    const isRefreshB = isRefreshTicket(b);

    // 高价值奖励排在最前面
    if (isHighA && !isHighB) return -1;
    if (!isHighA && isHighB) return 1;

    // 刷新券排在中间
    if (isRefreshA && !isRefreshB) return -1;
    if (!isRefreshA && isRefreshB) return 1;

    // 其他奖励保持原有顺序
    return 0;
  });
};

// —— 奖励与发车策略 ——
const isBigPrize = (rewards) => {
  const bigPrizes = [
    { type: 3, itemId: 3201, value: 10 },
    { type: 3, itemId: 1001, value: 10 },
    { type: 3, itemId: 1022, value: 2000 },
    { type: 2, itemId: 0, value: 2000 },
    { type: 3, itemId: 1023, value: 5 },
    { type: 3, itemId: 1022, value: 2500 },
    { type: 3, itemId: 1001, value: 12 },
  ];
  if (!Array.isArray(rewards)) return false;
  return bigPrizes.some((p) =>
    rewards.find(
      (r) =>
        r.type === p.type &&
        r.itemId === p.itemId &&
        Number(r.value || 0) >= p.value,
    ),
  );
};

const countRacingRefreshTickets = (rewards) => {
  if (!Array.isArray(rewards)) return 0;
  return rewards.reduce(
    (acc, r) =>
      acc + (r.type === 3 && r.itemId === 35002 ? Number(r.value || 0) : 0),
    0,
  );
};

const shouldSendCar = (car, tickets) => {
  const color = Number(car?.color || 0);
  const rewards = Array.isArray(car?.rewards) ? car.rewards : [];
  const racingTickets = countRacingRefreshTickets(rewards);
  if (tickets >= 6) {
    return (
      color >= 4 && (color >= 5 || racingTickets >= 4 || isBigPrize(rewards))
    );
  }
  return color >= 4 || racingTickets >= 2 || isBigPrize(rewards);
};

const fetchCarInfo = async () => {
  const token = tokenStore.selectedToken;
  if (!token || !isConnected.value) {
    message.warning(t("clubCarKing.messages.selectTokenFirst"));
    return;
  }
  carLoading.value = true;
  try {
    const res = await tokenStore.sendMessageWithPromise(
      token.id,
      "car_getrolecar",
      {},
      10000,
    );
    // 同步获取刷新券数量
    try {
      const roleRes = await tokenStore.sendMessageWithPromise(
        token.id,
        "role_getroleinfo",
        {},
        10000,
      );
      const qty = roleRes?.role?.items?.[35002]?.quantity;
      refreshTickets.value = Number(qty || 0);
    } catch {}
    carRaw.value = res?.body ?? res;
    carFetched.value = true;
    if (!normalizeCars(carRaw.value).length) {
      message.info(t("clubCarKing.messages.smartParseEnabled"));
    } else {
      message.success(t("clubCarKing.messages.dataUpdated"));
    }
  } catch (e) {
    message.error(
      t("clubCarKing.messages.fetchFailed", {
        error: e.message || t("clubCarKing.messages.unknownError"),
      }),
    );
  } finally {
    carLoading.value = false;
  }
};

// 初次挂载时，若已连接则尝试拉取
watch(
  isConnected,
  (ok) => {
    if (ok && !carFetched.value) fetchCarInfo();
  },
  { immediate: true },
);

// 刷新品阶（单车）
const refreshCar = async (car) => {
  const token = tokenStore.selectedToken;
  if (!token || !isConnected.value) {
    message.warning(t("clubCarKing.messages.selectTokenFirst"));
    return;
  }
  if (!car?.id) {
    message.warning(t("clubCarKing.messages.carIdMissing"));
    return;
  }
  if (Number(car.sendAt || 0) !== 0) {
    message.warning(t("clubCarKing.messages.refreshOnlyIdle"));
    return;
  }
  try {
    if (!(Number(car.refreshCount ?? 0) === 0)) {
      message.info(t("clubCarKing.messages.consumeTicketRefresh"));
    }
    const response = await tokenStore.sendMessageWithPromise(
      token.id,
      "car_refresh",
      { carId: String(car.id) },
      10000,
    );
    const data = response?.car || response?.body?.car || response;
    // 就地更新：颜色与刷新次数
    if (data && typeof data === "object") {
      if (data.color != null) {
        car.color = Number(data.color);
      }
      if (data.rewards != null) {
        car.rewards = data.rewards;
      }
      if (data.refreshCount != null) {
        // 优先按车级别的免费刷新次数
        car.refreshCount = Number(data.refreshCount);
      }

      // 同步更新底层 carRaw 数据源，确保后续计算一致
      const root = carRaw.value?.body || carRaw.value || {};
      if (
        root.roleCar &&
        root.roleCar.carDataMap &&
        root.roleCar.carDataMap[car.id]
      ) {
        // 合并更新
        root.roleCar.carDataMap[car.id] = {
          ...root.roleCar.carDataMap[car.id],
          ...data,
        };
      }

      // 若服务端用全局刷新次数，也尽量同步到元信息
      if (
        data.refreshCount != null &&
        root.roleCar &&
        root.roleCar.refreshCount != null
      ) {
        root.roleCar.refreshCount = Number(data.refreshCount);
      }

      // 弹出奖励与结果摘要（可按需扩展）
      const newGrade = gradeLabel(car.color);
      message.success(t("clubCarKing.messages.refreshDone", { grade: newGrade }));
    } else {
      // 回退：无法解析则整体刷新
      await fetchCarInfo();
      message.success(t("clubCarKing.messages.gradeRefreshDone"));
    }
    // 刷新后更新车票数量
    try {
      const roleRes = await tokenStore.sendMessageWithPromise(
        token.id,
        "role_getroleinfo",
        {},
        8000,
      );
      refreshTickets.value = Number(
        roleRes?.role?.items?.[35002]?.quantity || 0,
      );
    } catch {}
  } catch (e) {
    message.error(
      t("clubCarKing.messages.refreshFailed", {
        error: e.message || t("clubCarKing.messages.unknownError"),
      }),
    );
  }
};

// 发车（未发车时可用）
const sendCar = async (car) => {
  const token = tokenStore.selectedToken;
  if (!token || !isConnected.value) {
    message.warning(t("clubCarKing.messages.selectTokenFirst"));
    return;
  }
  if (Number(car.sendAt || 0) !== 0) {
    message.info(t("clubCarKing.messages.alreadySent"));
    return;
  }
  if (!isActivityOpen.value) {
    message.warning(t("clubCarKing.messages.activityClosed"));
    return;
  }
  if (!car?.id) {
    message.warning(t("clubCarKing.messages.carIdMissing"));
    return;
  }
  if (Number(car.sendAt || 0) !== 0) {
    message.info(t("clubCarKing.messages.alreadySent"));
    return;
  }
  try {
    message.info(t("clubCarKing.messages.sending"));
    const resp = await tokenStore.sendMessageWithPromise(
      token.id,
      "car_send",
      {
        carId: String(car.id),
        helperId: Number(car.helperId || 0),
        text: "",
        isUpgrade: false,
      },
      10000,
    );
    // 解析响应，优先就地更新
    const body = resp?.body || resp;
    const roleCar = body?.roleCar || body?.rolecar;
    const map = roleCar?.carDataMap || roleCar?.cardatamap;
    if (map && map[car.id]) {
      const updated = map[car.id];
      // 更新底层 carRaw 数据源，确保后续计算一致
      const root = carRaw.value?.body || carRaw.value || {};
      if (
        root.roleCar &&
        root.roleCar.carDataMap &&
        root.roleCar.carDataMap[car.id]
      ) {
        root.roleCar.carDataMap[car.id] = {
          ...root.roleCar.carDataMap[car.id],
          ...updated,
        };
      }
      // 直接更新展示对象关键字段
      if (updated.sendAt != null) car.sendAt = updated.sendAt;
      if (updated.color != null) car.color = updated.color;
      if (updated.refreshCount != null) car.refreshCount = updated.refreshCount;
      message.success(t("clubCarKing.messages.sent"));
    } else {
      // 回退到全量刷新
      await fetchCarInfo();
      message.success(t("clubCarKing.messages.sent"));
    }
  } catch (e) {
    message.error(
      t("clubCarKing.messages.sendFailed", {
        error: e.message || t("clubCarKing.messages.unknownError"),
      }),
    );
  }
};

// 计算是否可收车：已发车且超过4小时
const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;
const canClaim = (car) => {
  const t = Number(car?.sendAt || 0);
  if (!t) return false;
  const tsMs = t < 1e12 ? t * 1000 : t;
  return nowTs.value - tsMs >= FOUR_HOURS_MS;
};

// 收车
const claimCar = async (car) => {
  const token = tokenStore.selectedToken;
  if (!token || !isConnected.value)
    return message.warning(t("clubCarKing.messages.selectTokenFirst"));
  if (!car?.id) return message.warning(t("clubCarKing.messages.carIdMissing"));
  if (!canClaim(car)) return message.warning(t("clubCarKing.messages.claimTooEarly"));
  try {
    message.info(t("clubCarKing.messages.claiming"));
    await tokenStore.sendMessageWithPromise(
      token.id,
      "car_claim",
      { carId: String(car.id) },
      10000,
    );
    // 成功后就地更新为未发车
    car.sendAt = 0;
    // 同步底层 map（若存在）
    const root = carRaw.value?.body || carRaw.value || {};
    if (
      root.roleCar &&
      root.roleCar.carDataMap &&
      root.roleCar.carDataMap[car.id]
    ) {
      root.roleCar.carDataMap[car.id] = {
        ...root.roleCar.carDataMap[car.id],
        sendAt: 0,
      };
    }
    message.success(t("clubCarKing.messages.claimDone"));
  } catch (e) {
    message.error(
      t("clubCarKing.messages.claimFailed", {
        error: e.message || t("clubCarKing.messages.unknownError"),
      }),
    );
  }
};

// 计算距可收车剩余时间（毫秒），负数代表已可收车
const msUntilClaim = (car) => {
  const t = Number(car?.sendAt || 0);
  if (!t) return 0;
  const tsMs = t < 1e12 ? t * 1000 : t;
  return tsMs + FOUR_HOURS_MS - nowTs.value;
};

const formatRemaining = (ms) => {
  if (ms <= 0) return t("clubCarKing.time.zeroMinutes");
  const totalSec = Math.ceil(ms / 1000);
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  if (hours > 0)
    return t("clubCarKing.time.hoursMinutes", { hours, minutes });
  return t("clubCarKing.time.minutes", { minutes });
};

// 单按钮动作与状态
const actionLabel = (car) => {
  const sent = Number(car?.sendAt || 0) !== 0;
  if (!sent) return t("clubCarKing.actions.send");
  if (canClaim(car)) return t("clubCarKing.actions.claim");
  return t("clubCarKing.actions.claimWithRemaining", {
    remaining: formatRemaining(msUntilClaim(car)),
  });
};

const actionDisabled = (car) => {
  const sent = Number(car?.sendAt || 0) !== 0;
  if (!sent) {
    return isAfter20.value || !isActivityOpen.value;
  }
  return !canClaim(car);
};

const handleAction = async (car) => {
  const sent = Number(car?.sendAt || 0) !== 0;
  if (!sent) {
    return sendCar(car);
  }
  if (canClaim(car)) {
    return claimCar(car);
  } else {
    const left = formatRemaining(msUntilClaim(car));
    message.info(t("clubCarKing.messages.claimRemaining", { remaining: left }));
  }
};

// 一键收车
const claimAllCars = async () => {
  const token = tokenStore.selectedToken;
  if (!token || !isConnected.value)
    return message.warning(t("clubCarKing.messages.selectTokenFirst"));
  try {
    const claimables = (carList.value || []).filter((c) => canClaim(c));
    for (const c of claimables) {
      try {
        await claimCar(c);
      } catch {}
      await new Promise((r) => setTimeout(r, 300));
    }
    await fetchCarInfo();
    message.success(t("clubCarKing.messages.claimAllDone"));
  } catch (e) {
    message.error(
      t("clubCarKing.messages.claimAllFailed", {
        error: e.message || t("clubCarKing.messages.unknownError"),
      }),
    );
  }
};

// 智能发车
const smartSendCar = async () => {
  const token = tokenStore.selectedToken;
  if (!token || !isConnected.value)
    return message.warning(t("clubCarKing.messages.selectTokenFirst"));
  try {
    await fetchCarInfo();

    // 预加载护卫数据
    let helperUsageMap = {};
    let sortedHelpers = [];

    // 封装获取护卫使用情况的方法
    const updateHelperUsage = async () => {
      try {
        const response = await tokenStore.sendMessageWithPromise(
          token.id,
          "car_getmemberhelpingcnt",
          {},
          5000,
        );
        helperUsageMap =
          response?.body?.memberHelpingCntMap ||
          response?.memberHelpingCntMap ||
          {};
      } catch {
        // 忽略失败
      }
    };

    try {
      await updateHelperUsage();
      // 预先按红淬排序成员
      sortedHelpers = (legionMembers.value || [])
        .filter(
          (m) =>
            !currentRoleId.value || String(m.roleId) !== currentRoleId.value,
        )
        .map((m) => ({
          id: String(m.roleId),
          name: m.name || m.nickname || String(m.roleId),
          redQuench: m.custom?.red_quench_cnt || 0,
        }))
        .sort((a, b) => b.redQuench - a.redQuench);
    } catch {
      // 忽略护卫获取失败，降级为不带护卫发车
    }

    // 自动分配护卫函数
    const assignHelperIfNeeded = async (car) => {
      const color = Number(car.color || 0);
      // 仅红(5)及以上需要护卫
      if (color < 5) return;
      // 已有护卫则跳过
      if (car.helperId) return;

      // 每次分配前刷新护卫状态，避免并发导致的使用次数超标
      await updateHelperUsage();

      // 寻找可用护卫
      const bestHelper = sortedHelpers.find((h) => {
        const used = Number(helperUsageMap[h.id] || 0);
        return used < 4;
      });

      if (bestHelper) {
        car.helperId = bestHelper.id;
        // 更新本地计数 (乐观更新)
        helperUsageMap[bestHelper.id] =
          Number(helperUsageMap[bestHelper.id] || 0) + 1;
        message.success(
          t("clubCarKing.messages.helperAssigned", {
            name: bestHelper.name,
            used: helperUsageMap[bestHelper.id],
          }),
        );
      } else {
        message.warning(
          t("clubCarKing.messages.helperUnavailable", {
            grade: gradeLabel(car.color),
          }),
        );
      }
    };

    let tickets = Number(refreshTickets.value || 0);
    for (const car of carList.value) {
      if (Number(car.sendAt || 0) !== 0) continue;
      if (shouldSendCar(car, tickets)) {
        await assignHelperIfNeeded(car);
        await sendCar(car);
        await new Promise((r) => setTimeout(r, 500));
        continue;
      }
      let shouldRefresh = false;
      const free = Number(car.refreshCount ?? 0) === 0;
      if (tickets >= 6) {
        shouldRefresh = true;
      } else if (free) {
        shouldRefresh = true;
      } else {
        await assignHelperIfNeeded(car);
        await sendCar(car);
        await new Promise((r) => setTimeout(r, 500));
        continue;
      }
      while (shouldRefresh) {
        await refreshCar(car);
        tickets = Number(refreshTickets.value || 0);
        if (shouldSendCar(car, tickets)) {
          await assignHelperIfNeeded(car);
          await sendCar(car);
          await new Promise((r) => setTimeout(r, 500));
          break;
        }
        const freeNow = Number(car.refreshCount ?? 0) === 0;
        if (tickets >= 6) {
          shouldRefresh = true;
        } else if (freeNow) {
          shouldRefresh = true;
        } else {
          await assignHelperIfNeeded(car);
          await sendCar(car);
          await new Promise((r) => setTimeout(r, 500));
          break;
        }
      }
    }
    await fetchCarInfo();
    message.success(t("clubCarKing.messages.smartSendDone"));
  } catch (e) {
    message.error(
      t("clubCarKing.messages.smartSendFailed", {
        error: e.message || t("clubCarKing.messages.unknownError"),
      }),
    );
  }
};

// ===== 护卫选择 =====
const helperDialogVisible = ref(false);
const helperLoading = ref(false);
const helperOptions = ref([]);
const helperSelection = ref(null);
const currentCarForHelper = ref(null);

const legionInfo = computed(() => tokenStore.gameData?.legionInfo || null);
const clubInfo = computed(() => legionInfo.value?.info || {});
const legionMembersMap = computed(() => clubInfo.value?.members || {});
const legionMembers = computed(() =>
  Object.values(legionMembersMap.value || {}),
);

const currentRoleId = computed(() => {
  const info = tokenStore.gameData?.roleInfo;
  return info?.role?.roleId ? String(info.role.roleId) : null;
});

const getHelperName = (helperId) => {
  if (!helperId) return "";
  const members = legionMembers.value || [];
  const m = members.find((m) => String(m.roleId) === String(helperId));
  return m ? m.name || m.nickname || helperId : helperId;
};

const getCarHelperStatus = (c) => {
  // 1. Check for explicit helper objects
  if (c.helperBattleTeam) {
    const name = c.helperBattleTeam.name || c.helperBattleTeam.nickname;
    if (name) return name;
    if (c.helperBattleTeam.roleId)
      return getHelperName(c.helperBattleTeam.roleId);
  }

  // 2. Check for ID fields
  const id = c.helperId || c.guardId;
  if (id) return getHelperName(id);

  // 3. Fallback logic
  if (Number(c.sendAt || 0) !== 0) return t("clubCarKing.helperStatus.none");
  if (Number(c.color || 0) >= 5) return t("clubCarKing.helperStatus.available");
  return t("clubCarKing.helperStatus.na");
};

const openHelperDialog = async (car) => {
  const token = tokenStore.selectedToken;
  if (!token || !isConnected.value)
    return message.warning(t("clubCarKing.messages.selectTokenFirst"));
  if (Number(car.color || 0) < 5)
    return message.warning(t("clubCarKing.messages.helperGradeLimit"));
  if (Number(car.sendAt || 0) !== 0)
    return message.warning(t("clubCarKing.messages.helperSentDisabled"));

  currentCarForHelper.value = car;
  helperDialogVisible.value = true;
  helperLoading.value = true;
  helperSelection.value = car.helperId ? String(car.helperId) : null;

  try {
    // 拉取俱乐部成员护卫可用次数
    const resp = await tokenStore.sendMessageWithPromise(
      token.id,
      "car_getmemberhelpingcnt",
      {},
      10000,
    );
    const map =
      resp?.body?.memberHelpingCntMap || resp?.memberHelpingCntMap || {};

    // 生成候选列表（v<4 可选）
    const opts = legionMembers.value
      .filter(
        (m) => !currentRoleId.value || String(m.roleId) !== currentRoleId.value,
      )
      .map((m) => {
        const mid = String(m.roleId);
        const cnt = Number(map[mid] ?? 0);
        const power = formatNumber(m.power || m.custom?.s_power || 0);
        const redQuench = m.custom?.red_quench_cnt || 0;
        return {
          label: t("clubCarKing.helperDialog.optionLabel", {
            name: m.name || m.nickname || mid,
            power,
            redQuench,
            count: cnt,
          }),
          value: mid,
          disabled: cnt >= 4,
          redQuench, // 暂存用于排序
        };
      })
      .sort((a, b) => b.redQuench - a.redQuench); // 按红淬降序排序

    helperOptions.value = opts;
  } catch (e) {
    message.error(
      t("clubCarKing.messages.helperFetchFailed", {
        error: e.message || t("clubCarKing.messages.unknownError"),
      }),
    );
    helperOptions.value = [];
  } finally {
    helperLoading.value = false;
  }
};

const confirmHelper = () => {
  if (currentCarForHelper.value) {
    const car = currentCarForHelper.value;
    const newVal = helperSelection.value ? String(helperSelection.value) : null;

    // 1. Update reactive object
    car.helperId = newVal;
    car.helperBattleTeam = null; // Clear stale helper info to ensure ID takes precedence

    // 2. Sync to carRaw to persist across re-computations
    const root = carRaw.value?.body || carRaw.value || {};
    const roleCar = root.roleCar || root.rolecar;
    if (roleCar) {
      const map = roleCar.carDataMap || roleCar.cardatamap;
      if (map && map[car.id]) {
        const target = map[car.id];
        target.helperId = newVal;
        // Also clear helperBattleTeam in raw data if it exists
        if (target.helperBattleTeam) {
          delete target.helperBattleTeam;
        }
        // Force update by re-assigning
        map[car.id] = { ...target };
      }
    }
  }
  helperDialogVisible.value = false;
};
const cancelHelper = () => {
  helperDialogVisible.value = false;
};
</script>

<style scoped lang="scss">
.avatar-transparent {
  background-color: transparent;
}

.card-title-text {
  font-size: 18px;
  font-weight: 700;
}

.mt-4 {
  margin-top: 4px;
}

.card-content-top {
  margin-top: 16px;
}

.car-card-pad :deep(.n-card__content) {
  padding: 12px;
}

.section-gap-sm {
  margin-top: 12px;
}

.section-gap-md {
  margin-top: 16px;
}

.status-idle {
  color: #18a058;
}

.status-sent {
  color: #f0a020;
}

.modal-w-600 {
  width: min(600px, calc(100vw - 24px));
}

.helper-select {
  width: 100%;
  min-width: 0;
}

.club-car-king {
  .hint {
    margin-bottom: 16px;
  }
}

.car-card-item {
  transition: all 0.2s ease-in-out;
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
}

.car-header {
  display: flex;
  align-items: center;
  gap: 12px;
}

.car-brand-icon {
  width: 40px;
  height: 40px;
  object-fit: contain;
  background: var(--bg-secondary);
  border-radius: 8px;
  padding: 4px;
}

.car-info {
  flex: 1;
  min-width: 0;
}

.car-name {
  font-weight: bold;
  font-size: 14px;
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.car-badges {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.status-item {
  background: var(--bg-secondary);
  padding: 4px 8px;
  border-radius: 4px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;

  .label {
    font-size: 10px;
    color: var(--text-tertiary);
  }

  .value {
    font-size: 12px;
    font-weight: 500;
  }
}

.reward-tag {
  display: inline-block;
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--bg-secondary);
  font-size: 11px;
  color: var(--text-secondary);
  border: 1px solid var(--border-light);

  &.high-value {
    color: #f59e0b;
    background: rgba(245, 158, 11, 0.1);
    border-color: rgba(245, 158, 11, 0.2);
  }

  &.refresh-ticket {
    color: #22c55e;
    background: rgba(34, 197, 94, 0.1);
    border-color: rgba(34, 197, 94, 0.2);
  }
}

.helper-body {
  padding: 16px 0;
}

.helper-row {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 12px;
}

.helper-row .label {
  font-size: 14px;
  color: var(--text-secondary);
  min-width: 80px;
}

.tips {
  font-size: 12px;
  color: var(--text-tertiary);
  margin-top: 8px;
}

:deep(.n-select) {
  .n-select-tag {
    max-width: none;
    overflow: visible;
  }

  .n-base-select-option {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }
}

@media (max-width: 768px) {
  .card-title-text {
    font-size: 16px;
  }

  .card-content-top {
    margin-top: 12px;
  }

  .car-card-pad :deep(.n-card__content) {
    padding: 10px;
  }

  .car-brand-icon {
    width: 34px;
    height: 34px;
    padding: 3px;
  }

  .car-name {
    font-size: 13px;
  }

  .status-item .label {
    font-size: 9px;
  }

  .status-item .value {
    font-size: 11px;
  }

  .reward-tag {
    font-size: 10px;
    padding: 1px 5px;
  }

  .club-car-king :deep(.n-thing-header) {
    align-items: flex-start;
  }

  .club-car-king :deep(.n-thing-header__extra .n-space) {
    flex-wrap: wrap;
    justify-content: flex-start;
  }

  .club-car-king :deep(.n-thing-header__extra .n-button) {
    margin-top: 4px;
  }

  .helper-row {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
  }

  .helper-row .label {
    min-width: 0;
  }

  .club-car-king :deep(.n-button) {
    font-size: 12px;
  }
}
</style>
