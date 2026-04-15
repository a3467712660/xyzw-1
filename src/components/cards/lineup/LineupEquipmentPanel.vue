<template>
  <div
    v-if="
      heroCard.fishCaption
      || heroCard.hasEquipmentSnapshot
      || heroCard.artifactIdText
    "
    class="lineup-equipment-panel"
    :title="heroCard.equipmentSummaryTitle || heroCard.artifactIdText || ''"
  >
    <div
      v-if="heroCard.fishCaption || heroCard.slotColors.length > 0"
      class="hero-fish-row"
    >
      <span v-if="heroCard.fishCaption" class="hero-fish-name">
        {{ heroCard.fishCaption }}
      </span>
      <div v-if="heroCard.slotColors.length > 0" class="hero-fish-slots">
        <span
          v-for="(slotColor, colorIndex) in heroCard.slotColors"
          :key="`${heroCard.name}-${colorIndex}`"
          class="slot-dot"
          :style="{ backgroundColor: slotColor }"
        ></span>
      </div>
    </div>
    <div
      v-if="heroCard.equipmentSummaryTitle || heroCard.artifactIdText"
      class="hero-equipment-summary"
    >
      {{ heroCard.equipmentSummaryTitle || heroCard.artifactIdText }}
    </div>
  </div>
</template>

<script setup>
defineProps({
  heroCard: {
    type: Object,
    required: true,
  },
});
</script>

<style scoped lang="scss">
.lineup-equipment-panel {
  min-width: 0;
}

.hero-fish-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.hero-fish-name {
  font-size: 12px;
  color: rgba(232, 240, 255, 0.78);
}

.hero-equipment-summary {
  margin-top: 4px;
  font-size: 12px;
  color: rgba(232, 240, 255, 0.72);
}

.hero-fish-slots {
  display: flex;
  gap: 4px;
}

.slot-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
}
</style>
