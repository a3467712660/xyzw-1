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
                class="member-lineup-tag"
                size="small"
                :bordered="false"
                :color="item.lineupTag.color"
              >
                {{ item.lineupTag.text }}
              </NTag>
            </div>
          </div>

          <div v-if="item.chips.length" class="member-mobile-lineup member-mobile-chips">
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
  gap: 10px;
}

.member-mobile-title {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  position: relative;
  padding: 8px 12px;
  border-radius: 999px;
  border: 1px solid var(--border-light);
  background: linear-gradient(
    180deg,
    var(--bg-tertiary) 0%,
    var(--bg-secondary) 100%
  );
  font-size: 13px;
  font-weight: 700;
  text-align: center;
  color: var(--text-primary);
  letter-spacing: 0.5px;
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.06);
}

.member-mobile-title::before,
.member-mobile-title::after {
  content: "";
  flex: 1;
  max-width: 56px;
  height: 1px;
  background: var(--border-light);
}

.members-mobile-list {
  display: grid;
  gap: 10px;
}

.member-mobile-item {
  border: 1px solid var(--border-light);
  border-radius: 12px;
  padding: 10px 12px;
  background: linear-gradient(
    180deg,
    var(--bg-tertiary) 0%,
    var(--bg-secondary) 100%
  );
  box-shadow: 0 4px 14px rgba(15, 23, 42, 0.05);
}

.member-mobile-strip {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 10px;
}

.member-mobile-left {
  display: flex;
  gap: 8px;
  cursor: pointer;
  min-width: 0;
}

.member-mobile-avatar {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
  border: 1px solid var(--border-light);
}

.member-mobile-avatar--placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-primary);
  color: var(--text-secondary);
  font-size: 13px;
  border: 1px solid var(--border-light);
}

.member-mobile-name {
  color: #1890ff;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.25;
  word-break: break-all;
}

.member-mobile-id {
  margin-top: 2px;
  font-size: 12px;
  color: var(--text-secondary);
  word-break: break-all;
}

.member-mobile-metrics {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: nowrap;
  gap: 6px;
  min-width: 0;
  overflow: hidden;
}

.metric-item {
  padding: 5px 7px;
  border-radius: 8px;
  background: var(--bg-primary);
  border: 1px solid var(--border-light);
}

.metric-item--inline {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.metric-label {
  font-size: 11px;
  color: var(--text-secondary);
  white-space: nowrap;
}

.metric-value {
  font-size: 12px;
  color: var(--text-primary);
  font-weight: 600;
  white-space: nowrap;
}

.metric-value.red {
  color: #ff4d4f;
}

.member-lineup-tag {
  font-weight: 700;
  max-width: 96px;
}

.member-mobile-lineup {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  min-width: 62px;
  justify-self: end;
  flex-shrink: 0;
}

.member-mobile-chips {
  gap: 6px;
  flex-wrap: wrap;
  min-width: 0;
  justify-content: flex-start;
  justify-self: auto;
}

.mobile-hero-chip {
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  font-size: 12px;
}

.member-mobile-actions {
  margin-top: 8px;
}

.empty-state {
  padding: 24px 0;
}

@media (max-width: 768px) {
  .member-mobile-strip {
    grid-template-columns: 1fr;
    align-items: stretch;
    gap: 8px;
  }

  .member-mobile-metrics {
    justify-content: flex-start;
    flex-wrap: wrap;
    gap: 4px;
    overflow: visible;
  }

  .member-mobile-lineup {
    min-width: 0;
    justify-content: flex-start;
    justify-self: start;
  }

  .member-mobile-item {
    padding: 8px 10px;
  }

  .member-mobile-avatar {
    width: 34px;
    height: 34px;
  }

  .member-mobile-name {
    font-size: 13px;
  }

  .member-mobile-id {
    font-size: 11px;
  }

  .metric-item {
    padding: 3px 6px;
  }

  .metric-label {
    font-size: 10px;
  }

  .metric-value {
    font-size: 11px;
  }

  .member-lineup-tag {
    max-width: 84px;
  }

  :deep(.n-tag) {
    font-size: 11px;
    padding: 0 6px;
  }
}
</style>
