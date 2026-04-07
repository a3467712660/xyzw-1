<template>
  <aside class="game-inspector">
    <div class="game-inspector__hero">
      <div>
        <p class="game-inspector__eyebrow">{{ title }}</p>
        <h3 class="game-inspector__title">{{ moduleName }}</h3>
        <p class="game-inspector__subtitle">{{ subtitle }}</p>
      </div>
      <div
        class="game-inspector__status-pill game-signal-pill"
        :class="`game-signal-pill--${connectionTone}`"
      >
        {{ connectionStatusText }}
      </div>
    </div>

    <section class="game-inspector__recommendation">
      <span class="game-inspector__section-label">{{ recommendationLabel }}</span>
      <strong class="game-inspector__recommendation-title">{{ recommendationTitle }}</strong>
      <p class="game-inspector__recommendation-detail">{{ recommendationDetail }}</p>
    </section>

    <section class="game-inspector__facts">
      <span class="game-inspector__section-label">{{ factsLabel }}</span>
      <div class="game-inspector__fact-list">
        <article
          v-for="fact in facts"
          :key="fact.label"
          class="game-inspector__fact"
        >
          <span class="game-inspector__fact-label">{{ fact.label }}</span>
          <strong
            class="game-inspector__fact-value"
            :class="fact.valueClass"
          >
            {{ fact.value }}
          </strong>
          <span v-if="fact.meta" class="game-inspector__fact-meta">{{ fact.meta }}</span>
        </article>
      </div>
    </section>

    <section class="game-inspector__actions">
      <n-button
        block
        strong
        :type="isConnected ? 'default' : 'primary'"
        @click="$emit('toggle-connection')"
      >
        {{ connectionActionLabel }}
      </n-button>
      <n-button
        v-if="showTokenButton"
        block
        secondary
        @click="$emit('go-tokens')"
      >
        {{ tokenActionLabel }}
      </n-button>
    </section>
  </aside>
</template>

<script setup>
defineProps({
  title: {
    type: String,
    default: "",
  },
  moduleName: {
    type: String,
    default: "",
  },
  subtitle: {
    type: String,
    default: "",
  },
  connectionStatusText: {
    type: String,
    default: "",
  },
  connectionTone: {
    type: String,
    default: "default",
  },
  recommendationLabel: {
    type: String,
    default: "",
  },
  recommendationTitle: {
    type: String,
    default: "",
  },
  recommendationDetail: {
    type: String,
    default: "",
  },
  factsLabel: {
    type: String,
    default: "",
  },
  facts: {
    type: Array,
    default: () => [],
  },
  connectionActionLabel: {
    type: String,
    default: "",
  },
  tokenActionLabel: {
    type: String,
    default: "",
  },
  isConnected: {
    type: Boolean,
    default: false,
  },
  showTokenButton: {
    type: Boolean,
    default: true,
  },
});

defineEmits(["toggle-connection", "go-tokens"]);
</script>
