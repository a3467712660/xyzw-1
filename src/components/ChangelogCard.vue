<template>
  <div class="changelog-card">
    <div class="changelog-header">
      <div class="version-badge" :class="`badge-${entry.type}`">
        {{ entry.version }}
      </div>
      <div class="changelog-meta">
        <span class="release-date">{{ formatDate(entry.date) }}</span>
        <span class="type-tag" :class="`tag-${entry.type}`">
          {{ getTypeLabel(entry.type) }}
        </span>
      </div>
    </div>

    <div class="changelog-content">
      <div v-if="entry.title" class="changelog-title">{{ entry.title }}</div>

      <div
        v-if="entry.features && entry.features.length"
        class="change-section"
      >
        <h4 class="section-title">
          <i class="icon-sparkles">✨</i>
          新功能
        </h4>
        <ul class="change-list">
          <li v-for="(item, idx) in entry.features" :key="`feature-${idx}`">
            {{ item }}
          </li>
        </ul>
      </div>

      <div
        v-if="entry.improvements && entry.improvements.length"
        class="change-section"
      >
        <h4 class="section-title">
          <i class="icon-arrow-up">⬆️</i>
          改进优化
        </h4>
        <ul class="change-list">
          <li
            v-for="(item, idx) in entry.improvements"
            :key="`improvement-${idx}`"
          >
            {{ item }}
          </li>
        </ul>
      </div>

      <div v-if="entry.fixes && entry.fixes.length" class="change-section">
        <h4 class="section-title">
          <i class="icon-bug">🐛</i>
          修复问题
        </h4>
        <ul class="change-list">
          <li v-for="(item, idx) in entry.fixes" :key="`fix-${idx}`">
            {{ item }}
          </li>
        </ul>
      </div>

      <div
        v-if="entry.breaking && entry.breaking.length"
        class="change-section breaking"
      >
        <h4 class="section-title">
          <i class="icon-warning">⚠️</i>
          重大变更
        </h4>
        <ul class="change-list">
          <li v-for="(item, idx) in entry.breaking" :key="`breaking-${idx}`">
            {{ item }}
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  entry: {
    type: Object,
    required: true,
    validator: (value) => {
      return value.version && value.date && value.type;
    },
  },
});

const formatDate = (dateString) => {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const startOfDay = (value) =>
    new Date(value.getFullYear(), value.getMonth(), value.getDate());

  const now = new Date();
  const diffTime = now.getTime() - date.getTime();
  const dayMs = 1000 * 60 * 60 * 24;
  const diffDays = Math.round(
    (startOfDay(now).getTime() - startOfDay(date).getTime()) / dayMs,
  );

  if (diffTime < 0) {
    const aheadDays = Math.abs(diffDays);
    if (aheadDays === 0) return "今天";
    if (aheadDays === 1) return "明天";
    if (aheadDays < 7) return `${aheadDays}天后`;
    if (aheadDays < 30) return `${Math.floor(aheadDays / 7)}周后`;
    return date.toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  if (diffDays === 0) return "今天";
  if (diffDays === 1) return "昨天";
  if (diffDays < 7) return `${diffDays}天前`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}周前`;

  return date.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const getTypeLabel = (type) => {
  const labels = {
    major: "主要版本",
    minor: "次要版本",
    patch: "补丁版本",
    hotfix: "热修复",
  };
  return labels[type] || type;
};
</script>

<style scoped>
.changelog-card {
  background: var(--bg-elevated);
  border: 1px solid var(--border-light);
  border-radius: var(--border-radius-large);
  padding: var(--spacing-lg);
  margin-bottom: var(--spacing-md);
  box-shadow: var(--shadow-light);
  transition: all var(--transition-normal);
}

.changelog-card:hover {
  box-shadow: var(--shadow-medium);
  transform: translateY(-3px);
  border-color: rgba(15, 107, 255, 0.24);
}

.changelog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-md);
  padding-bottom: var(--spacing-md);
  border-bottom: 1px solid var(--border-light);
}

.version-badge {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
  padding: 8px 16px;
  border-radius: var(--border-radius-medium);
  background: linear-gradient(
    135deg,
    var(--primary-color) 0%,
    var(--secondary-color) 100%
  );
  color: white;
  box-shadow: 0 8px 18px rgba(15, 107, 255, 0.25);
}

.version-badge.badge-major {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
}

.version-badge.badge-minor {
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
}

.version-badge.badge-patch {
  background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
}

.version-badge.badge-hotfix {
  background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
}

.changelog-meta {
  display: flex;
  gap: 12px;
  align-items: center;
}

.release-date {
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
}

.type-tag {
  padding: 4px 12px;
  border-radius: var(--border-radius-full);
  font-size: 12px;
  font-weight: var(--font-weight-semibold);
}

.type-tag.tag-major {
  background: rgba(245, 87, 108, 0.1);
  color: #f5576c;
}

.type-tag.tag-minor {
  background: rgba(79, 172, 254, 0.1);
  color: #4facfe;
}

.type-tag.tag-patch {
  background: rgba(67, 233, 123, 0.1);
  color: #43e97b;
}

.type-tag.tag-hotfix {
  background: rgba(250, 112, 154, 0.1);
  color: #fa709a;
}

.changelog-content {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.changelog-title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
  margin-bottom: 8px;
}

.change-section {
  padding: 12px;
  border-radius: var(--border-radius-medium);
  background: var(--bg-secondary);
  border: 1px solid var(--border-light);
}

.change-section.breaking {
  background: rgba(245, 87, 108, 0.05);
  border-left: 4px solid #f5576c;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
  margin: 0 0 12px 0;
}

.change-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.change-list li {
  padding-left: 24px;
  position: relative;
  color: var(--text-secondary);
  line-height: 1.6;
  font-size: var(--font-size-sm);
}

.change-list li::before {
  content: "•";
  position: absolute;
  left: 8px;
  color: var(--primary-color);
  font-weight: bold;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .changelog-card {
    padding: var(--spacing-md);
  }

  .changelog-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .version-badge {
    font-size: 16px;
    padding: 6px 12px;
  }

  .changelog-title {
    font-size: 16px;
  }
}
</style>
