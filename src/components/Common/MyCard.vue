<template>
  <div
    class="gwb2-mini-card"
    :class="rootClasses"
    :data-panel-active="panelActive ? 'true' : 'false'"
  >
    <div class="gwb2-mini-card__surface">
      <div class="gwb2-mini-card__toolbar">
        <div class="gwb2-mini-card__toolbar-main">
          <div
            v-if="$slots.icon"
            class="gwb2-mini-card__icon"
          >
            <slot name="icon"></slot>
          </div>
          <div class="gwb2-mini-card__title">
            <slot name="title"></slot>
          </div>
        </div>

        <div
          v-if="$slots.badge || $slots.extra"
          class="gwb2-mini-card__toolbar-side"
        >
          <div
            v-if="$slots.badge"
            class="gwb2-mini-card__chip"
            :class="stateClasses"
          >
            <span class="gwb2-mini-card__chip-dot"></span>
            <slot name="badge"></slot>
          </div>
          <div
            v-if="$slots.extra"
            class="gwb2-mini-card__toolbar-extra"
          >
            <slot name="extra"></slot>
          </div>
        </div>
      </div>

      <div class="gwb2-mini-card__body">
        <slot name="default"></slot>
      </div>
    </div>

    <div
      v-if="$slots.action"
      class="gwb2-mini-card__actions"
    >
      <slot name="action"></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

type StatusKey = "active" | "weekly" | "energy" | "completed";

const props = defineProps<{
  panelActive?: boolean;
  statusClass?: StatusKey | Record<StatusKey, boolean> | string;
}>();

const stateClasses = computed(() => {
  const raw = props.statusClass;
  if (!raw) {
    return [];
  }

  if (typeof raw === "string") {
    return raw
      .split(/\s+/)
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => `gwb2-mini-card--${item}`);
  }

  return Object.entries(raw)
    .filter(([, enabled]) => Boolean(enabled))
    .map(([name]) => `gwb2-mini-card--${name}`);
});

const rootClasses = computed(() => [
  ...stateClasses.value,
  props.panelActive === false
    ? "gwb2-mini-card--panel-inactive"
    : "gwb2-mini-card--panel-active",
]);
</script>

<style lang="scss">
.gwb2-mini-card {
  --gwb2-mini-card-accent: var(--primary-color);
  --gwb2-mini-card-accent-soft: rgba(63, 119, 173, 0.12);
  display: flex;
  min-height: 220px;
  flex-direction: column;
  gap: var(--spacing-md);
  transition: opacity var(--transition-fast);
}

.gwb2-mini-card--active {
  --gwb2-mini-card-accent: var(--success-color);
  --gwb2-mini-card-accent-soft: rgba(63, 143, 107, 0.14);
}

.gwb2-mini-card--weekly {
  --gwb2-mini-card-accent: var(--info-color);
  --gwb2-mini-card-accent-soft: rgba(75, 131, 184, 0.14);
}

.gwb2-mini-card--energy {
  --gwb2-mini-card-accent: var(--warning-color);
  --gwb2-mini-card-accent-soft: rgba(201, 149, 77, 0.14);
}

.gwb2-mini-card--completed {
  --gwb2-mini-card-accent: var(--success-color);
  --gwb2-mini-card-accent-soft: rgba(63, 143, 107, 0.16);
}

.gwb2-mini-card--panel-inactive {
  opacity: 0.96;
}

.gwb2-mini-card__surface {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  gap: var(--spacing-md);
}

.gwb2-mini-card__toolbar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--spacing-md);
}

.gwb2-mini-card__toolbar-main {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  gap: var(--spacing-sm);
}

.gwb2-mini-card__icon {
  width: 40px;
  height: 40px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  > img,
  > svg {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
}

.gwb2-mini-card__title {
  min-width: 0;
  flex: 1;

  h3 {
    margin: 0;
    font-size: var(--font-size-md);
    font-weight: var(--font-weight-semibold);
    color: var(--text-primary);
  }

  p {
    margin: 4px 0 0;
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
    line-height: 1.5;
  }
}

.gwb2-mini-card__toolbar-side {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.gwb2-mini-card__chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  background: var(--gwb2-mini-card-accent-soft);
  color: var(--gwb2-mini-card-accent);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
}

.gwb2-mini-card__chip-dot {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: currentColor;
}

.gwb2-mini-card__toolbar-extra {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
}

.gwb2-mini-card__body {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  gap: var(--spacing-md);
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
}

.gwb2-mini-card__actions {
  display: flex;
  align-items: stretch;
  flex-wrap: wrap;
  gap: var(--spacing-sm);

  > * {
    flex: 1 1 0;
    min-height: 40px;
    min-width: 120px;
  }
}

@media (max-width: 959px) {
  .gwb2-mini-card {
    min-height: auto;
  }

  .gwb2-mini-card__toolbar {
    flex-direction: column;
  }

  .gwb2-mini-card__toolbar-main,
  .gwb2-mini-card__toolbar-side {
    width: 100%;
  }

  .gwb2-mini-card__toolbar-side {
    justify-content: space-between;
  }

  .gwb2-mini-card__actions > * {
    flex-basis: 100%;
    min-width: 100%;
  }
}
</style>
