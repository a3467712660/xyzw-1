<template>
  <div class="game-status-intel-shell">
    <aside v-if="!isMobile" class="game-status-intel-panel">
      <div class="game-status-intel-panel__head">
        <span class="game-status-intel-panel__eyebrow">{{ title }}</span>
        <strong class="game-status-intel-panel__title">{{ subtitle }}</strong>
      </div>

      <IdentityCard
        v-if="showIdentityCard"
        embedded
      ></IdentityCard>

      <div class="game-status-intel-panel__facts">
        <article
          v-for="fact in facts"
          :key="fact.label"
          class="game-status-intel-panel__fact"
        >
          <span class="game-status-intel-panel__fact-label">{{ fact.label }}</span>
          <strong class="game-status-intel-panel__fact-value">{{ fact.value }}</strong>
          <span v-if="fact.meta" class="game-status-intel-panel__fact-meta">{{ fact.meta }}</span>
        </article>
      </div>
    </aside>

    <div v-else class="game-status-intel-mobile">
      <button
        class="game-status-intel-mobile__trigger"
        type="button"
        @click="showDrawer = true"
      >
        <span class="game-status-intel-mobile__label">{{ mobileButtonLabel }}</span>
        <strong class="game-status-intel-mobile__value">{{ subtitle }}</strong>
      </button>

      <n-drawer
        height="72vh"
        placement="bottom"
        v-model:show="showDrawer"
      >
        <n-drawer-content closable :title="drawerTitle">
          <div class="game-status-intel-mobile__content">
            <IdentityCard
              v-if="showIdentityCard"
              embedded
            ></IdentityCard>

            <div class="game-status-intel-panel__facts">
              <article
                v-for="fact in facts"
                :key="fact.label"
                class="game-status-intel-panel__fact"
              >
                <span class="game-status-intel-panel__fact-label">{{ fact.label }}</span>
                <strong class="game-status-intel-panel__fact-value">{{ fact.value }}</strong>
                <span v-if="fact.meta" class="game-status-intel-panel__fact-meta">{{ fact.meta }}</span>
              </article>
            </div>
          </div>
        </n-drawer-content>
      </n-drawer>
    </div>
  </div>
</template>

<script setup>
import { ref } from "vue";
import IdentityCard from "@/components/Common/IdentityCard.vue";
import { useResponsive } from "@/composables/useResponsive";

defineProps({
  title: {
    type: String,
    default: "",
  },
  subtitle: {
    type: String,
    default: "",
  },
  facts: {
    type: Array,
    default: () => [],
  },
  showIdentityCard: {
    type: Boolean,
    default: true,
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

const { isMobile } = useResponsive();
const showDrawer = ref(false);
</script>

<style scoped lang="scss">
.game-status-intel-panel {
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

.game-status-intel-panel__head {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.game-status-intel-panel__eyebrow,
.game-status-intel-mobile__label {
  color: var(--text-tertiary);
  font-size: 11px;
  font-weight: var(--font-weight-bold);
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.game-status-intel-panel__title,
.game-status-intel-mobile__value {
  font-size: var(--font-size-lg);
  color: var(--text-primary);
}

.game-status-intel-panel__facts {
  display: grid;
  gap: 10px;
}

.game-status-intel-panel__fact {
  padding: 12px 14px;
  border-radius: 16px;
  border: 1px solid rgba(63, 119, 173, 0.1);
  background: rgba(255, 255, 255, 0.44);
}

.game-status-intel-panel__fact-label {
  display: block;
  color: var(--text-tertiary);
  font-size: var(--font-size-xs);
}

.game-status-intel-panel__fact-value {
  display: block;
  margin-top: 6px;
  color: var(--text-primary);
  line-height: 1.45;
}

.game-status-intel-panel__fact-meta {
  display: block;
  margin-top: 6px;
  color: var(--text-secondary);
  font-size: var(--font-size-xs);
  line-height: 1.55;
}

.game-status-intel-mobile__trigger {
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

.game-status-intel-mobile__content {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding-bottom: calc(var(--spacing-xl) + env(safe-area-inset-bottom));
}
</style>
