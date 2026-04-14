<template>
  <n-tag
    class="club-battle-result-badge"
    :bordered="false"
    :size="size"
    :type="tone"
  >
    <slot>{{ text }}</slot>
  </n-tag>
</template>

<script setup>
defineProps({
  size: {
    type: String,
    default: "small",
  },
  text: {
    type: String,
    default: "",
  },
  tone: {
    type: String,
    default: "default",
  },
});
</script>
