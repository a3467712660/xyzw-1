<template>
  <span
    class="workbench-status-pill"
    :class="[
      `workbench-status-pill--${tone}`,
      `workbench-status-pill--${size}`,
    ]"
  >
    <span v-if="$slots.icon" class="workbench-status-pill__icon">
      <slot name="icon"></slot>
    </span>
    <span class="workbench-status-pill__label">{{ label }}</span>
  </span>
</template>

<script setup>
defineProps({
  tone: {
    type: String,
    default: "default",
  },
  size: {
    type: String,
    default: "md",
  },
  label: {
    type: String,
    default: "",
  },
});
</script>
