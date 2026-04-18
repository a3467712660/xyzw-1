<template>
  <header class="game-command-bar">
    <div class="game-command-bar__main">
      <div class="game-command-bar__copy">
        <div class="game-command-bar__eyebrow-row">
          <span class="game-command-bar__eyebrow">{{ eyebrow }}</span>
          <span v-if="activeGroupName" class="game-command-bar__group-chip">{{ activeGroupName }}</span>
        </div>
        <div class="game-command-bar__title-row">
          <h1 class="game-command-bar__title">{{ title }}</h1>
          <span v-if="activeModuleName" class="game-command-bar__module-chip">{{ activeModuleName }}</span>
        </div>
        <p class="game-command-bar__description">{{ description }}</p>
      </div>

      <div class="game-command-bar__actions">
        <div class="game-command-bar__status-stack">
          <div
            class="game-command-bar__status-pill game-signal-pill"
            :class="`game-signal-pill--${connectionTone}`"
          >
            <n-icon>
              <CloudDone></CloudDone>
            </n-icon>
            <span>{{ connectionStatusText }}</span>
          </div>
        </div>

        <div class="game-command-bar__action-stack">
          <n-button
            strong
            :type="isConnected ? 'default' : 'primary'"
            @click="$emit('toggle-connection')"
          >
            {{ connectionActionLabel }}
          </n-button>

          <n-button
            v-if="showTokenButton"
            secondary
            @click="$emit('go-tokens')"
          >
            <template #icon>
              <n-icon>
                <Cube></Cube>
              </n-icon>
            </template>
            {{ tokenActionLabel }}
          </n-button>

          <n-button
            v-if="showInspectorButton"
            quaternary
            @click="$emit('open-inspector')"
          >
            <template #icon>
              <n-icon>
                <Menu></Menu>
              </n-icon>
            </template>
            {{ inspectorActionLabel }}
          </n-button>
        </div>
      </div>
    </div>

    <div class="game-command-bar__signal-grid">
      <article
        v-for="signal in signals"
        :key="signal.label"
        class="game-command-bar__signal"
      >
        <span class="game-command-bar__signal-label">{{ signal.label }}</span>
        <strong class="game-command-bar__signal-value">{{ signal.value }}</strong>
        <span class="game-command-bar__signal-meta">{{ signal.meta }}</span>
      </article>
    </div>
  </header>
</template>

<script setup>
import { CloudDone, Cube, Menu } from "@vicons/ionicons5";

defineProps({
  eyebrow: {
    type: String,
    default: "",
  },
  title: {
    type: String,
    default: "",
  },
  description: {
    type: String,
    default: "",
  },
  activeGroupName: {
    type: String,
    default: "",
  },
  activeModuleName: {
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
  connectionActionLabel: {
    type: String,
    default: "",
  },
  tokenActionLabel: {
    type: String,
    default: "",
  },
  inspectorActionLabel: {
    type: String,
    default: "",
  },
  signals: {
    type: Array,
    default: () => [],
  },
  isConnected: {
    type: Boolean,
    default: false,
  },
  showInspectorButton: {
    type: Boolean,
    default: false,
  },
  showTokenButton: {
    type: Boolean,
    default: true,
  },
});

defineEmits(["toggle-connection", "go-tokens", "open-inspector"]);
</script>
