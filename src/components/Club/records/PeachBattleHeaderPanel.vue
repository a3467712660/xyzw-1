<template>
  <div class="battle-header">
    <h2>{{ headerTitle }}</h2>
    <div class="club-info">
      <div class="club-side own">
        <img
          v-if="ownClub?.logo"
          class="club-logo"
          :alt="ownMeta.nameText"
          :src="ownClub.logo"
        >
        <div class="club-name">{{ ownMeta.nameText }}</div>
        <div class="club-id">{{ ownMeta.idText }}</div>
        <div class="club-power">{{ ownMeta.summaryText }}</div>
      </div>
      <div class="vs">VS</div>
      <div class="club-side opponent">
        <img
          v-if="opponentClub?.logo"
          class="club-logo"
          :alt="opponentMeta.nameText"
          :src="opponentClub.logo"
        >
        <div class="club-name">{{ opponentMeta.nameText }}</div>
        <div class="club-id">{{ opponentMeta.idText }}</div>
        <div class="club-power">{{ opponentMeta.summaryText }}</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";
import {
  buildPeachBattleClubMeta,
  buildPeachBattleHeaderTitle,
} from "./clubBattleRecordLayoutHelpers.js";

const props = defineProps({
  opponentClub: {
    type: Object,
    default: null,
  },
  ownClub: {
    type: Object,
    default: null,
  },
  queryDate: {
    type: String,
    default: "",
  },
});

const ownMeta = computed(() => buildPeachBattleClubMeta(props.ownClub));
const opponentMeta = computed(() =>
  buildPeachBattleClubMeta(props.opponentClub),
);
const headerTitle = computed(() =>
  buildPeachBattleHeaderTitle(
    props.queryDate,
    props.ownClub?.name,
    props.opponentClub?.name,
  ),
);
</script>

<style scoped lang="scss">
.battle-header {
  background: var(--bg-secondary);
  border-radius: var(--border-radius-medium);
  padding: var(--spacing-md);
  margin-bottom: var(--spacing-md);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.battle-header h2 {
  text-align: center;
  margin-bottom: var(--spacing-lg);
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-bold);
  color: var(--text-primary);
  padding: var(--spacing-md);
  background: var(--bg-primary);
  border-radius: var(--border-radius-sm);
  border: 1px solid var(--border-light);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.club-info {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 0 var(--spacing-lg);
  margin-top: var(--spacing-md);
}

.club-side {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  flex: 1;
}

.club-side.own {
  align-items: flex-end;
  text-align: right;
}

.club-side.opponent {
  align-items: flex-start;
  text-align: left;
}

.club-name {
  font-weight: var(--font-weight-semibold);
  font-size: var(--font-size-lg);
}

.club-logo {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  object-fit: cover;
  border: 1px solid var(--border-light);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  margin-bottom: var(--spacing-sm);
}

.club-id,
.club-power {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}

.vs {
  align-self: center;
  font-weight: var(--font-weight-bold);
  font-size: var(--font-size-xl);
  color: var(--text-secondary);
  margin: 0 var(--spacing-lg);
}

@media (max-width: 768px) {
  .club-info {
    flex-direction: column;
    gap: var(--spacing-lg);
    padding: 0;
  }

  .club-side.own,
  .club-side.opponent {
    align-items: flex-start;
    text-align: left;
  }

  .vs {
    margin: 0;
  }
}
</style>
