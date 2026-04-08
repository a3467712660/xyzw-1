<template>
  <section
    class="game-status-module-stage"
    :class="{ 'game-status-module-stage--embedded': embedded }"
  >
    <header
      v-if="showHeader || hasSecondaryNav"
      class="game-status-module-stage__header"
      :class="{ 'game-status-module-stage__header--compact': !showHeader }"
    >
      <div v-if="showHeader" class="game-status-module-stage__copy">
        <span class="game-status-module-stage__eyebrow">{{ title }}</span>
        <div class="game-status-module-stage__title-row">
          <h2 class="game-status-module-stage__title">{{ module?.label }}</h2>
          <span
            v-if="currentSectionMeta && hasSecondaryNav"
            class="game-status-module-stage__section-chip"
          >
            {{ currentSectionMeta.label }}
          </span>
        </div>
      </div>

      <div
        v-else-if="currentSectionMeta"
        class="game-status-module-stage__compact-copy"
      >
        <span class="game-status-module-stage__eyebrow">{{ compactLabel }}</span>
        <strong class="game-status-module-stage__compact-title">{{ currentSectionMeta.label }}</strong>
      </div>

      <button
        v-if="isMobile && hasSecondaryNav"
        class="game-status-module-stage__mobile-toggle"
        type="button"
        @click="showSectionDrawer = true"
      >
        <span>{{ mobileButtonLabel }}</span>
        <strong>{{ currentSectionMeta?.label }}</strong>
      </button>
    </header>

    <div
      class="game-status-module-stage__body"
      :class="{ 'game-status-module-stage__body--with-subnav': hasSecondaryNav && !isMobile }"
    >
      <aside
        v-if="hasSecondaryNav && !isMobile"
        class="game-status-module-stage__subnav"
      >
        <span class="game-status-module-stage__subnav-label">{{ navLabel }}</span>
        <div class="game-status-module-stage__subnav-list">
          <button
            v-for="section in sections"
            :key="section.id"
            class="game-status-module-stage__subnav-item"
            type="button"
            :class="{ 'game-status-module-stage__subnav-item--active': section.id === modelValue }"
            @click="$emit('update:modelValue', section.id)"
          >
            <span class="game-status-module-stage__subnav-item-label">{{ section.label }}</span>
          </button>
        </div>
      </aside>

      <div class="game-status-module-stage__content">
        <slot></slot>
      </div>
    </div>

    <n-drawer
      v-if="isMobile && hasSecondaryNav"
      height="70vh"
      placement="bottom"
      v-model:show="showSectionDrawer"
    >
      <n-drawer-content closable :title="drawerTitle">
        <div class="game-status-module-stage__mobile-list">
          <button
            v-for="section in sections"
            :key="section.id"
            class="game-status-module-stage__subnav-item"
            type="button"
            :class="{ 'game-status-module-stage__subnav-item--active': section.id === modelValue }"
            @click="selectMobileSection(section.id)"
          >
            <span class="game-status-module-stage__subnav-item-label">{{ section.label }}</span>
          </button>
        </div>
      </n-drawer-content>
    </n-drawer>
  </section>
</template>

<script setup>
import { computed, ref } from "vue";
import { useResponsive } from "@/composables/useResponsive";

const props = defineProps({
  module: {
    type: Object,
    default: null,
  },
  sections: {
    type: Array,
    default: () => [],
  },
  modelValue: {
    type: String,
    default: "",
  },
  title: {
    type: String,
    default: "",
  },
  navLabel: {
    type: String,
    default: "",
  },
  compactLabel: {
    type: String,
    default: "",
  },
  mobileButtonLabel: {
    type: String,
    default: "",
  },
  drawerTitle: {
    type: String,
    default: "",
  },
  showHeader: {
    type: Boolean,
    default: true,
  },
  embedded: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["update:modelValue"]);

const { isMobile } = useResponsive();
const showSectionDrawer = ref(false);

const hasSecondaryNav = computed(() => props.sections.length > 1);
const currentSectionMeta = computed(() =>
  props.sections.find((section) => section.id === props.modelValue) || props.sections[0] || null,
);

const selectMobileSection = (sectionId) => {
  emit("update:modelValue", sectionId);
  showSectionDrawer.value = false;
};
</script>

<style scoped lang="scss">
.game-status-module-stage {
  min-width: 0;
}

.game-status-module-stage__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  margin-bottom: 16px;
}

.game-status-module-stage__header--compact {
  margin-bottom: 12px;
}

.game-status-module-stage__copy {
  min-width: 0;
}

.game-status-module-stage__eyebrow,
.game-status-module-stage__subnav-label {
  display: block;
  color: var(--text-tertiary);
  font-size: 11px;
  font-weight: var(--font-weight-bold);
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.game-status-module-stage__title-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-top: 6px;
}

.game-status-module-stage__title,
.game-status-module-stage__compact-title {
  margin: 0;
  font-size: var(--font-size-2xl);
  color: var(--text-primary);
}

.game-status-module-stage__section-chip {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid rgba(63, 119, 173, 0.16);
  background: rgba(63, 119, 173, 0.08);
  color: var(--primary-color);
  font-size: 12px;
  font-weight: var(--font-weight-semibold);
}

.game-status-module-stage__compact-copy {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.game-status-module-stage__mobile-toggle {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  min-width: 180px;
  padding: 12px 14px;
  border-radius: 16px;
  border: 1px solid rgba(63, 119, 173, 0.14);
  background:
    linear-gradient(135deg, rgba(63, 119, 173, 0.14), transparent 72%),
    rgba(255, 255, 255, 0.72);
  text-align: left;

  span {
    color: var(--text-tertiary);
    font-size: 11px;
    font-weight: var(--font-weight-bold);
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  strong {
    color: var(--text-primary);
    font-size: var(--font-size-sm);
  }
}

.game-status-module-stage__body--with-subnav {
  display: grid;
  grid-template-columns: minmax(220px, 248px) minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}

.game-status-module-stage__subnav {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border-radius: 20px;
  border: 1px solid rgba(63, 119, 173, 0.12);
  background: rgba(255, 255, 255, 0.54);
}

.game-status-module-stage__subnav-list,
.game-status-module-stage__mobile-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.game-status-module-stage__subnav-item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  width: 100%;
  padding: 12px 14px;
  border-radius: 16px;
  border: 1px solid rgba(63, 119, 173, 0.1);
  background: rgba(255, 255, 255, 0.42);
  text-align: left;
}

.game-status-module-stage__subnav-item--active {
  border-color: rgba(63, 119, 173, 0.24);
  background:
    linear-gradient(135deg, rgba(63, 119, 173, 0.14), transparent 72%),
    rgba(255, 255, 255, 0.88);
}

.game-status-module-stage__subnav-item-label {
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
}

.game-status-module-stage__content {
  min-width: 0;
}

.game-status-module-stage__mobile-list {
  padding-bottom: calc(var(--spacing-xl) + env(safe-area-inset-bottom));
}

@media (max-width: 959px) {
  .game-status-module-stage__header {
    flex-direction: column;
  }

  .game-status-module-stage__mobile-toggle {
    width: 100%;
    min-width: 0;
  }
}
</style>
