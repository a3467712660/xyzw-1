<template>
  <section
    class="app-page__hero workbench-page-hero"
    :class="{
      'workbench-page-hero--stack-mobile': stackOnMobile,
      'workbench-page-hero--no-stack-mobile': !stackOnMobile,
    }"
  >
    <div class="app-page__hero-copy workbench-page-hero__copy">
      <span v-if="eyebrow" class="app-page__eyebrow">{{ eyebrow }}</span>

      <slot name="title">
        <h1 v-if="title" class="app-page__title">{{ title }}</h1>
      </slot>

      <slot name="description">
        <p v-if="description" class="app-page__description">
          {{ description }}
        </p>
      </slot>

      <div v-if="$slots.meta" class="workbench-page-hero__meta">
        <slot name="meta"></slot>
      </div>
    </div>

    <div v-if="$slots.actions" class="workbench-page-hero__actions">
      <slot name="actions"></slot>
    </div>
  </section>
</template>

<script setup>
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
  stackOnMobile: {
    type: Boolean,
    default: true,
  },
});
</script>
