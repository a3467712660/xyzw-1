<template>
  <div
    class="app-toolbar workbench-page-toolbar"
    :class="{ 'workbench-page-toolbar--mobile': isMobile }"
  >
    <div v-if="$slots.left" class="app-toolbar__group workbench-page-toolbar__group">
      <slot name="left" :is-mobile="isMobile"></slot>
    </div>

    <div
      v-if="$slots.right"
      class="app-toolbar__group workbench-page-toolbar__group workbench-page-toolbar__group--right"
    >
      <slot name="right" :is-mobile="isMobile"></slot>
    </div>
  </div>
</template>

<script setup>
import { useResponsive } from "@/composables/useResponsive";

const { isMobile } = useResponsive();
</script>
