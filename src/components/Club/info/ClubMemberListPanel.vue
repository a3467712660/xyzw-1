<template>
  <div v-if="tableData.length > 0" class="club-member-list-panel">
    <slot name="toolbar"></slot>
    <slot name="banner"></slot>

    <NDataTable
      v-if="!isMobile"
      class="member-table"
      :bordered="false"
      :columns="tableColumns"
      :data="tableData"
      :flex-height="flexHeight"
      :row-key="rowKey"
      :scroll-x="scrollX"
      :size="tableSize"
      :striped="striped"
    ></NDataTable>

    <div v-else class="members-mobile-wrap">
      <div class="member-mobile-title">{{ title }}</div>
      <div class="members-mobile-list">
        <div
          v-for="(item, index) in mobileItems"
          :key="item.key || item.id || index"
          class="member-mobile-item"
        >
          <div class="member-mobile-strip">
            <div class="member-mobile-left" @click="$emit('select', item)">
              <img
                v-if="item.avatar"
                class="member-mobile-avatar"
                :alt="item.name"
                :src="item.avatar"
              >
              <div
                v-else
                class="member-mobile-avatar member-mobile-avatar--placeholder"
              >
                {{ item.avatarText || "?" }}
              </div>
              <div>
                <div class="member-mobile-name">
                  <template v-if="showIndex">{{ index + 1 }}. </template>{{ item.name }}
                </div>
                <div v-if="item.subtext" class="member-mobile-id">
                  {{ item.subtext }}
                </div>
              </div>
            </div>
            <div v-if="item.metrics.length || item.badges.length" class="member-mobile-metrics">
              <div
                v-for="metric in item.metrics"
                :key="`${item.id}-${metric.label}`"
                class="metric-item metric-item--inline"
              >
                <span class="metric-label">{{ metric.label }}</span>
                <span class="metric-value" :class="metric.className">
                  {{ metric.value }}
                </span>
              </div>
              <NTag
                v-for="badge in item.badges"
                :key="`${item.id}-${badge.text}`"
                size="small"
                :bordered="false"
                :color="badge.color"
                :type="badge.type"
              >
                {{ badge.text }}
              </NTag>
            </div>
            <div v-if="item.lineupTag" class="member-mobile-lineup">
              <NTag
                size="small"
                :bordered="false"
                :color="item.lineupTag.color"
              >
                {{ item.lineupTag.text }}
              </NTag>
            </div>
          </div>

          <div v-if="item.chips.length" class="member-mobile-lineup">
            <span
              v-for="(chip, chipIndex) in item.chips"
              :key="`${item.id}-${chipIndex}`"
              class="mobile-hero-chip"
            >
              {{ chip }}
            </span>
          </div>

          <div v-if="item.actionLabel" class="member-mobile-actions">
            <NButton
              block
              ghost
              size="tiny"
              :type="item.actionType || 'default'"
              @click="$emit('action', item)"
            >
              {{ item.actionLabel }}
            </NButton>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div v-else class="empty-state">
    <NEmpty :description="emptyDescription"></NEmpty>
  </div>
</template>

<script setup>
import { NButton, NDataTable, NEmpty, NTag } from "naive-ui/es";

defineProps({
  emptyDescription: {
    type: String,
    default: "暂无数据",
  },
  flexHeight: {
    type: Boolean,
    default: false,
  },
  isMobile: Boolean,
  mobileItems: {
    type: Array,
    default: () => [],
  },
  rowKey: {
    type: Function,
    default: undefined,
  },
  scrollX: {
    type: Number,
    default: 1200,
  },
  showIndex: {
    type: Boolean,
    default: false,
  },
  striped: {
    type: Boolean,
    default: true,
  },
  tableColumns: {
    type: Array,
    default: () => [],
  },
  tableData: {
    type: Array,
    default: () => [],
  },
  tableSize: {
    type: String,
    default: "small",
  },
  title: {
    type: String,
    default: "",
  },
});

defineEmits(["action", "select"]);
</script>

<style scoped lang="scss">
.members-mobile-wrap {
  display: grid;
  gap: 12px;
}

.member-mobile-title {
  font-size: 18px;
  font-weight: 700;
}

.members-mobile-list {
  display: grid;
  gap: 12px;
}

.member-mobile-item {
  border-radius: 16px;
  padding: 14px;
  background: rgba(255, 255, 255, 0.04);
}

.member-mobile-strip {
  display: grid;
  gap: 10px;
}

.member-mobile-left {
  display: flex;
  gap: 12px;
  align-items: center;
  cursor: pointer;
}

.member-mobile-avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  object-fit: cover;
}

.member-mobile-avatar--placeholder {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.08);
}

.member-mobile-name {
  font-weight: 600;
}

.member-mobile-id,
.metric-label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.68);
}

.member-mobile-metrics {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.metric-item--inline {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.member-mobile-lineup {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.mobile-hero-chip {
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  font-size: 12px;
}

.member-mobile-actions {
  margin-top: 10px;
}

.empty-state {
  padding: 24px 0;
}
</style>
