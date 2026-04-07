<template>
  <div class="game-status-module-rail-shell">
    <aside v-if="!isMobile" class="game-status-module-rail">
      <div class="game-status-module-rail__head">
        <span class="game-status-module-rail__eyebrow">{{ title }}</span>
        <strong class="game-status-module-rail__title">{{ subtitle }}</strong>
      </div>

      <div class="game-status-module-rail__list">
        <button
          v-for="module in modules"
          :key="module.id"
          class="game-status-module-rail__item"
          type="button"
          :class="{ 'game-status-module-rail__item--active': module.id === modelValue }"
          @click="$emit('update:modelValue', module.id)"
        >
          <span class="game-status-module-rail__item-label">{{ module.label }}</span>
          <span class="game-status-module-rail__item-meta">{{ module.description }}</span>
        </button>
      </div>
    </aside>

    <div v-else class="game-status-module-rail-mobile">
      <button
        class="game-status-module-rail-mobile__trigger"
        type="button"
        @click="showDrawer = true"
      >
        <span class="game-status-module-rail-mobile__label">{{ mobileButtonLabel }}</span>
        <strong class="game-status-module-rail-mobile__value">{{ currentModule?.label || subtitle }}</strong>
      </button>

      <n-drawer
        height="72vh"
        placement="bottom"
        v-model:show="showDrawer"
      >
        <n-drawer-content closable :title="drawerTitle">
          <div class="game-status-module-rail__list game-status-module-rail__list--mobile">
            <button
              v-for="module in modules"
              :key="module.id"
              class="game-status-module-rail__item"
              type="button"
              :class="{ 'game-status-module-rail__item--active': module.id === modelValue }"
              @click="selectMobileModule(module.id)"
            >
              <span class="game-status-module-rail__item-label">{{ module.label }}</span>
              <span class="game-status-module-rail__item-meta">{{ module.description }}</span>
            </button>
          </div>
        </n-drawer-content>
      </n-drawer>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from "vue";
import { useResponsive } from "@/composables/useResponsive";

const props = defineProps({
  modules: {
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
  subtitle: {
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
});

const emit = defineEmits(["update:modelValue"]);

const { isMobile } = useResponsive();
const showDrawer = ref(false);

const currentModule = computed(() =>
  props.modules.find((module) => module.id === props.modelValue) || props.modules[0] || null,
);

const selectMobileModule = (moduleId) => {
  emit("update:modelValue", moduleId);
  showDrawer.value = false;
};
</script>

<style scoped lang="scss">
.game-status-module-rail-shell {
  min-width: 0;
}

.game-status-module-rail {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 18px;
  border-radius: 24px;
  border: 1px solid rgba(63, 119, 173, 0.12);
  background:
    linear-gradient(180deg, rgba(63, 119, 173, 0.08), transparent 32%),
    rgba(255, 255, 255, 0.76);
}

.game-status-module-rail__head {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.game-status-module-rail__eyebrow,
.game-status-module-rail-mobile__label {
  color: var(--text-tertiary);
  font-size: 11px;
  font-weight: var(--font-weight-bold);
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.game-status-module-rail__title,
.game-status-module-rail-mobile__value {
  font-size: var(--font-size-lg);
  color: var(--text-primary);
}

.game-status-module-rail__list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.game-status-module-rail__item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  width: 100%;
  padding: 14px 15px;
  border-radius: 18px;
  border: 1px solid rgba(63, 119, 173, 0.1);
  background: rgba(255, 255, 255, 0.48);
  text-align: left;
  transition:
    border-color var(--transition-fast),
    background var(--transition-fast),
    transform var(--transition-fast);

  &:hover {
    transform: translateY(-1px);
  }
}

.game-status-module-rail__item--active {
  border-color: rgba(63, 119, 173, 0.24);
  background:
    linear-gradient(135deg, rgba(63, 119, 173, 0.16), transparent 72%),
    rgba(255, 255, 255, 0.88);
}

.game-status-module-rail__item-label {
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
}

.game-status-module-rail__item-meta {
  color: var(--text-secondary);
  font-size: var(--font-size-xs);
  line-height: 1.55;
}

.game-status-module-rail-mobile__trigger {
  display: flex;
  width: 100%;
  flex-direction: column;
  gap: 6px;
  padding: 14px 16px;
  border-radius: 18px;
  border: 1px solid rgba(63, 119, 173, 0.12);
  background:
    linear-gradient(135deg, rgba(63, 119, 173, 0.14), transparent 72%),
    rgba(255, 255, 255, 0.8);
  text-align: left;
}

.game-status-module-rail__list--mobile {
  padding-bottom: calc(var(--spacing-xl) + env(safe-area-inset-bottom));
}
</style>
