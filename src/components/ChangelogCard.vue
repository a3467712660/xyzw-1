<template>
  <article class="changelog-card">
    <header class="changelog-card__header">
      <div class="changelog-card__version">
        <span class="changelog-card__badge" :class="`changelog-card__badge--${entry.type}`">
          {{ entry.version }}
        </span>
        <div class="changelog-card__meta">
          <div class="changelog-card__date">
            <n-icon size="15">
              <TimeOutline></TimeOutline>
            </n-icon>
            <span>{{ formatDate(entry.date) }}</span>
          </div>
          <span class="changelog-card__type" :class="`changelog-card__type--${entry.type}`">
            {{ getTypeLabel(entry.type) }}
          </span>
        </div>
      </div>

      <div v-if="entry.title" class="changelog-card__headline">
        <h3>{{ entry.title }}</h3>
      </div>
    </header>

    <div class="changelog-card__content">
      <section
        v-for="section in sections"
        :key="section.key"
        class="changelog-card__section"
        :class="{ 'changelog-card__section--breaking': section.key === 'breaking' }"
      >
        <div class="changelog-card__section-title">
          <n-icon size="17">
            <component :is="section.icon"></component>
          </n-icon>
          <span>{{ section.label }}</span>
        </div>

        <ul class="changelog-card__list">
          <li
            v-for="(item, idx) in section.items"
            :key="`${section.key}-${idx}`"
          >
            {{ item }}
          </li>
        </ul>
      </section>
    </div>
  </article>
</template>

<script setup>
import { computed } from "vue";
import {
  AlertCircleOutline,
  BugOutline,
  SparklesOutline,
  TimeOutline,
  TrendingUpOutline,
} from "@vicons/ionicons5";

const props = defineProps({
  entry: {
    type: Object,
    required: true,
    validator: (value) => {
      return value.version && value.date && value.type;
    },
  },
});

const sections = computed(() => {
  const entry = props.entry || {};
  return [
    {
      key: "features",
      label: "新功能",
      icon: SparklesOutline,
      items: Array.isArray(entry.features) ? entry.features : [],
    },
    {
      key: "improvements",
      label: "改进优化",
      icon: TrendingUpOutline,
      items: Array.isArray(entry.improvements) ? entry.improvements : [],
    },
    {
      key: "fixes",
      label: "修复问题",
      icon: BugOutline,
      items: Array.isArray(entry.fixes) ? entry.fixes : [],
    },
    {
      key: "breaking",
      label: "重大变更",
      icon: AlertCircleOutline,
      items: Array.isArray(entry.breaking) ? entry.breaking : [],
    },
  ].filter((section) => section.items.length);
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

<style scoped lang="scss">
.changelog-card {
  display: grid;
  gap: 18px;
  padding: 22px;
  border-radius: 24px;
  border: 1px solid var(--surface-glass-border);
  background:
    linear-gradient(135deg, rgba(15, 107, 255, 0.08), transparent 78%),
    var(--surface-glass-strong);
  box-shadow: var(--shadow-light);
}

.changelog-card__header {
  display: grid;
  gap: 14px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--console-divider);
}

.changelog-card__version {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.changelog-card__badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 36px;
  padding: 0 16px;
  border-radius: 999px;
  background: rgba(15, 107, 255, 0.12);
  border: 1px solid rgba(15, 107, 255, 0.18);
  color: var(--primary-color);
  font-size: 15px;
  font-weight: 800;
  letter-spacing: 0.02em;
}

.changelog-card__badge--major,
.changelog-card__type--major {
  background: rgba(220, 38, 38, 0.1);
  border-color: rgba(220, 38, 38, 0.18);
  color: #b91c1c;
}

.changelog-card__badge--minor,
.changelog-card__type--minor {
  background: rgba(15, 107, 255, 0.12);
  border-color: rgba(15, 107, 255, 0.18);
  color: var(--primary-color);
}

.changelog-card__badge--patch,
.changelog-card__type--patch {
  background: rgba(22, 163, 74, 0.12);
  border-color: rgba(22, 163, 74, 0.2);
  color: #166534;
}

.changelog-card__badge--hotfix,
.changelog-card__type--hotfix {
  background: rgba(249, 115, 22, 0.12);
  border-color: rgba(249, 115, 22, 0.18);
  color: #b45309;
}

.changelog-card__meta {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.changelog-card__date,
.changelog-card__type {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 30px;
  padding: 0 12px;
  border-radius: 999px;
  background: var(--console-panel);
  border: 1px solid var(--surface-glass-border);
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 700;
}

.changelog-card__headline h3 {
  margin: 0;
  font-size: 24px;
  line-height: 1.3;
  color: var(--text-primary);
}

.changelog-card__content {
  display: grid;
  gap: 12px;
}

.changelog-card__section {
  display: grid;
  gap: 12px;
  padding: 16px;
  border-radius: 18px;
  background: var(--console-panel);
  border: 1px solid var(--surface-glass-border);
}

.changelog-card__section--breaking {
  background: rgba(220, 38, 38, 0.05);
  border-color: rgba(220, 38, 38, 0.14);
}

.changelog-card__section-title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 700;
}

.changelog-card__list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 8px;
}

.changelog-card__list li {
  position: relative;
  padding-left: 18px;
  color: var(--text-secondary);
  line-height: 1.65;
}

.changelog-card__list li::before {
  content: "";
  position: absolute;
  left: 2px;
  top: 10px;
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: var(--primary-color);
}

@media (max-width: 640px) {
  .changelog-card {
    padding: 18px;
    border-radius: 20px;
  }

  .changelog-card__headline h3 {
    font-size: 20px;
  }
}
</style>
