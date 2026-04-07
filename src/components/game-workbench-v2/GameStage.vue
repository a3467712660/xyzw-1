<template>
  <section class="game-stage">
    <header class="game-stage__header">
      <div class="game-stage__copy">
        <p class="game-stage__eyebrow">{{ eyebrow }}</p>
        <div class="game-stage__title-row">
          <h2 class="game-stage__title">{{ moduleName }}</h2>
          <span v-if="groupLabel" class="game-stage__group-chip">{{ groupLabel }}</span>
        </div>
        <p class="game-stage__description">{{ moduleDescription }}</p>
      </div>

      <div class="game-stage__telemetry">
        <span class="game-stage__telemetry-label">{{ statusLabel }}</span>
        <strong class="game-stage__telemetry-value" :class="[statusClass]">{{ statusText }}</strong>
      </div>
    </header>

    <div class="game-stage__canvas">
      <slot></slot>
    </div>
  </section>
</template>

<script setup>
defineProps({
  eyebrow: {
    type: String,
    default: "",
  },
  groupLabel: {
    type: String,
    default: "",
  },
  moduleName: {
    type: String,
    default: "",
  },
  moduleDescription: {
    type: String,
    default: "",
  },
  statusLabel: {
    type: String,
    default: "",
  },
  statusText: {
    type: String,
    default: "",
  },
  statusClass: {
    type: String,
    default: "",
  },
});
</script>
