<template>
  <div aria-live="polite" class="game-workbench-loading">
    <span class="game-workbench-loading__label">{{ eyebrow }}</span>
    <strong class="game-workbench-loading__title">{{ title }}</strong>
    <p class="game-workbench-loading__description">{{ description }}</p>
    <div aria-hidden="true" class="game-workbench-loading__grid">
      <span v-for="index in 3" :key="index" class="game-workbench-loading__line"></span>
    </div>
  </div>
</template>

<script setup>
defineProps({
  eyebrow: {
    type: String,
    default: "Workbench Loading",
  },
  title: {
    type: String,
    default: "正在准备当前工作区",
  },
  description: {
    type: String,
    default: "连接状态、模块信息和主要面板会在这里稳定出现。",
  },
});
</script>
