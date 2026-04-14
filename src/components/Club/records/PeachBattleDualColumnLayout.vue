<template>
  <div class="comparison-container">
    <div class="club-column own-column" :class="`variant-${variant}`">
      <div v-if="variant === 'style1'" class="style1-header own-header">
        <h3>{{ ownTitle }}</h3>
      </div>
      <div v-else class="style2-header">
        <div class="style2-title">
          <span class="trophy-icon">🏆</span>
          <div class="title-text">
            <h2>{{ ownTitle }}</h2>
            <div class="date-text">{{ ownSubtitle }}</div>
          </div>
        </div>
      </div>
      <div class="column-content">
        <slot name="own"></slot>
      </div>
    </div>

    <div class="club-column opponent-column" :class="`variant-${variant}`">
      <div v-if="variant === 'style1'" class="style1-header opponent-header">
        <h3>{{ opponentTitle }}</h3>
      </div>
      <div v-else class="style2-header">
        <div class="style2-title">
          <span class="trophy-icon">🏆</span>
          <div class="title-text">
            <h2>{{ opponentTitle }}</h2>
            <div class="date-text">{{ opponentSubtitle }}</div>
          </div>
        </div>
      </div>
      <div class="column-content">
        <slot name="opponent"></slot>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  opponentSubtitle: {
    type: String,
    default: "",
  },
  opponentTitle: {
    type: String,
    default: "",
  },
  ownSubtitle: {
    type: String,
    default: "",
  },
  ownTitle: {
    type: String,
    default: "",
  },
  variant: {
    type: String,
    default: "style1",
  },
});
</script>

<style scoped lang="scss">
.comparison-container {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.club-column {
  min-width: 0;
}

.style1-header {
  padding: 10px;
  text-align: center;
  color: #fff;
}

.own-header {
  background: #800080;
}

.opponent-header {
  background: #d32f2f;
}

.style1-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: bold;
}

.style2-header {
  display: flex;
  justify-content: center;
  margin-bottom: 15px;
  background: #fff;
  padding: 10px;
  border-bottom: 1px solid #eee;
}

.style2-title {
  display: flex;
  align-items: center;
  gap: 10px;
}

.trophy-icon {
  font-size: 24px;
}

.title-text h2 {
  font-size: 16px;
  color: #333;
  margin: 0;
  font-weight: 800;
}

.date-text {
  font-size: 12px;
  color: #888;
  margin-top: 2px;
}

.column-content {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

@media (max-width: 768px) {
  .comparison-container {
    grid-template-columns: 1fr;
  }
}
</style>
