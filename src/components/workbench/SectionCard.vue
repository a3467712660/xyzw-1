<template>
  <section
    class="app-section-card workbench-section-card"
    :class="{ 'workbench-section-card--compact': compact }"
  >
    <div
      v-if="title || description || $slots['header-extra']"
      class="workbench-section-card__head"
      :class="{ 'workbench-section-card__head--compact': compact }"
    >
      <div v-if="title || description" class="workbench-section-card__heading">
        <h2 v-if="title">{{ title }}</h2>
        <p v-if="description">{{ description }}</p>
      </div>

      <div v-if="$slots['header-extra']" class="workbench-section-card__extra">
        <slot name="header-extra"></slot>
      </div>
    </div>

    <div class="workbench-section-card__content" :class="contentClass">
      <slot></slot>
    </div>
  </section>
</template>

<script setup>
defineProps({
  title: {
    type: String,
    default: "",
  },
  description: {
    type: String,
    default: "",
  },
  compact: {
    type: Boolean,
    default: false,
  },
  contentClass: {
    type: [String, Array, Object],
    default: "",
  },
});
</script>
