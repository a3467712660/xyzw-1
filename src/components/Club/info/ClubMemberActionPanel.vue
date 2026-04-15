<template>
  <div class="club-member-action-panel">
    <div class="members-actions-bar">
      <NButton
        v-if="showFetchLineup"
        secondary
        class="members-actions-btn"
        size="small"
        type="primary"
        :disabled="fetchLineupDisabled"
        @click="$emit('fetch-lineup')"
      >
        {{ fetchLineupText }}
      </NButton>
      <NButton
        secondary
        class="members-actions-btn"
        size="small"
        type="info"
        :disabled="exportDisabled"
        @click="$emit('export-image')"
      >
        {{ exportText }}
      </NButton>
    </div>

    <div v-if="isExporting && bannerModel" class="member-export-banner">
      <div class="member-export-title">{{ bannerModel.title }}</div>
      <div class="member-export-club">{{ bannerModel.clubText }}</div>
      <div class="member-export-meta">{{ bannerModel.metaText }}</div>
    </div>
  </div>
</template>

<script setup>
import { NButton } from "naive-ui/es";

defineProps({
  bannerModel: {
    type: Object,
    default: null,
  },
  exportDisabled: {
    type: Boolean,
    default: false,
  },
  exportText: {
    type: String,
    default: "导出图片",
  },
  fetchLineupDisabled: {
    type: Boolean,
    default: false,
  },
  fetchLineupText: {
    type: String,
    default: "获取阵容",
  },
  isExporting: {
    type: Boolean,
    default: false,
  },
  showFetchLineup: {
    type: Boolean,
    default: true,
  },
});

defineEmits(["export-image", "fetch-lineup"]);
</script>

<style scoped lang="scss">
.club-member-action-panel {
  display: grid;
  gap: 12px;
}

.members-actions-bar {
  display: flex;
  justify-content: flex-start;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 10px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-light);
}

.members-actions-btn {
  min-width: 88px;
}

.member-export-banner {
  border-radius: 14px;
  padding: 14px 16px;
  background: linear-gradient(135deg, #eef4ff 0%, #f6fbff 55%, #f2fff8 100%);
  border: 1px solid #dce8ff;
  box-shadow: 0 6px 16px rgba(32, 102, 214, 0.08);
}

.member-export-title {
  font-size: 22px;
  line-height: 1.2;
  font-weight: 700;
  color: #1f3f74;
  letter-spacing: 0.5px;
}

.member-export-club {
  margin-top: 6px;
  font-size: 14px;
  font-weight: 600;
  color: #2b4d86;
}

.member-export-meta {
  margin-top: 6px;
  font-size: 13px;
  color: #5e6b85;
}
</style>
