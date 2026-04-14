<template>
  <div class="club-info-summary">
    <NGrid item-responsive cols="2" x-gap="12" y-gap="12">
      <NGi span="2">
        <NCard embedded class="overview-header-card" :bordered="false">
          <NThing>
            <template #avatar>
              <NAvatar
                class="club-logo-avatar"
                :size="64"
                :src="club.logo || '/icons/xiaoyugan.png'"
              ></NAvatar>
            </template>
            <template #header>
              <span class="club-name">{{ club.name }}</span>
            </template>
            <template #description>
              <NSpace class="mt-4" size="small">
                <NTag size="small" type="warning" :bordered="false">ID: {{ club.id }}</NTag>
                <NTag size="small" type="info" :bordered="false">
                  服务器: {{ club.serverId - 27 }}
                </NTag>
                <NTag size="small" type="success" :bordered="false">
                  成员: {{ memberCount }}
                </NTag>
              </NSpace>
            </template>
            <template #header-extra>
              <NButton
                size="small"
                :disabled="legionSignedIn"
                :secondary="legionSignedIn"
                :type="legionSignedIn ? 'success' : 'primary'"
                @click="$emit('sign-in')"
              >
                <template #icon>
                  <n-icon><ShieldCheckmark></ShieldCheckmark></n-icon>
                </template>
                {{ legionSignedIn ? "已签到" : "俱乐部签到" }}
              </NButton>
            </template>
          </NThing>
        </NCard>
      </NGi>

      <NGi>
        <NCard embedded class="h-full" size="small" :bordered="false">
          <NStatistic label="战力">
            <template #prefix>
              <n-icon color="#18a058"><BarChart></BarChart></n-icon>
            </template>
            {{ formatNumber(clubOverview.power) }}
          </NStatistic>
        </NCard>
      </NGi>
      <NGi>
        <NCard embedded class="h-full" size="small" :bordered="false">
          <NStatistic label="红粹">
            <template #prefix>
              <n-icon color="#d03050"><Flame></Flame></n-icon>
            </template>
            {{ clubOverview.redQuench }}
          </NStatistic>
        </NCard>
      </NGi>
      <NGi>
        <NCard embedded class="h-full" size="small" :bordered="false">
          <NStatistic label="当前BossId">
            <template #prefix>
              <n-icon color="#8a2be2"><Skull></Skull></n-icon>
            </template>
            {{ clubOverview.currentBossId }}
          </NStatistic>
        </NCard>
      </NGi>
      <NGi>
        <NCard embedded class="h-full" size="small" :bordered="false">
          <NStatistic label="Boss剩余血量">
            <template #prefix>
              <n-icon color="#f0a020"><Skull></Skull></n-icon>
            </template>
            {{ clubOverview.currentHP }}
          </NStatistic>
        </NCard>
      </NGi>

      <NGi
        v-if="clubOverview.unfoughtBosses && clubOverview.unfoughtBosses.length > 0"
        span="2"
      >
        <NAlert type="warning" :bordered="false">
          <template #icon>
            <n-icon><Skull></Skull></n-icon>
          </template>
          <div class="boss-summary-head">
            <div>
              <span class="fw-bold">Boss 击杀情况</span>
              <div class="boss-summary-meta">
                已击杀: {{ 150 - clubOverview.unfoughtBosses.length }} / 150
                <span class="boss-missing">遗漏: {{ clubOverview.unfoughtBosses.length }}</span>
              </div>
            </div>
          </div>
          <NCollapse arrow-placement="right" class="mt-8">
            <NCollapseItem name="1" title="展开查看遗漏Boss列表">
              <NSpace class="mt-8" size="small">
                <NTag
                  v-for="boss in clubOverview.unfoughtBosses"
                  :key="boss"
                  size="small"
                  type="error"
                  :bordered="false"
                >
                  {{ boss }}
                </NTag>
              </NSpace>
            </NCollapseItem>
          </NCollapse>
        </NAlert>
      </NGi>

      <NGi v-if="club.announcement" span="2">
        <NCard embedded size="small" title="公告" :bordered="false">
          <template #header-extra>
            <n-icon color="#f0a020" size="18"><Megaphone></Megaphone></n-icon>
          </template>
          <div class="announcement-text">
            {{ club.announcement }}
          </div>
        </NCard>
      </NGi>

      <NGi v-if="leader" span="2">
        <NCard embedded size="small" title="会长" :bordered="false">
          <template #header-extra>
            <n-icon color="#2080f0" size="18"><Person></Person></n-icon>
          </template>
          <div class="leader-wrap">
            <NAvatar
              round
              class="leader-avatar"
              :size="40"
              :src="leader.headImg || '/icons/xiaoyugan.png'"
            ></NAvatar>
            <div>
              <div class="leader-name">{{ leader.name }}</div>
              <div class="leader-id">ID: {{ leader.roleId }}</div>
            </div>
          </div>
        </NCard>
      </NGi>
    </NGrid>
  </div>
</template>

<script setup>
import {
  NAlert,
  NAvatar,
  NButton,
  NCard,
  NCollapse,
  NCollapseItem,
  NGi,
  NGrid,
  NSpace,
  NStatistic,
  NTag,
  NThing,
} from "naive-ui/es";
import {
  BarChart,
  Flame,
  Megaphone,
  Person,
  ShieldCheckmark,
  Skull,
} from "@vicons/ionicons5";

defineProps({
  club: {
    type: Object,
    required: true,
  },
  clubOverview: {
    type: Object,
    required: true,
  },
  formatNumber: {
    type: Function,
    required: true,
  },
  leader: {
    type: Object,
    default: null,
  },
  legionSignedIn: Boolean,
  memberCount: {
    type: Number,
    default: 0,
  },
});

defineEmits(["sign-in"]);
</script>

<style scoped lang="scss">
.boss-summary-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.boss-summary-meta,
.leader-id {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.6);
}

.boss-missing {
  color: #d03050;
  margin-left: 6px;
}

.club-name,
.leader-name {
  font-weight: 600;
}

.announcement-text {
  white-space: pre-wrap;
  line-height: 1.6;
}

.leader-wrap {
  display: flex;
  align-items: center;
  gap: 12px;
}
</style>
