<template>
  <n-modal
    class="hero-detail-modal modal-w-600"
    preset="card"
    size="large"
    v-model:show="showModel"
    :bordered="false"
    :segmented="{ content: 'soft', footer: 'soft' }"
    :title="t('fightPvpCard.heroModal.title')"
  >
    <template #header-extra>
      <span class="hero-id">{{ t("fightPvpCard.heroModal.heroId", { value: hero?.heroId }) }}</span>
    </template>

    <div v-if="hero" class="hero-modal-content">
      <div class="hero-modal-header">
        <div class="hero-modal-avatar">
          <img
            v-if="hero.heroAvate"
            :alt="hero.heroName"
            :src="hero.heroAvate"
          >
        </div>
        <div class="hero-modal-basic">
          <h3 class="hero-modal-name">{{ hero.heroName }}</h3>
          <div class="hero-modal-stats">
            <span class="stat-item">{{ hero.power }}</span>
            <span class="stat-item">{{ t("fightPvpCard.heroModal.level", { value: hero.level }) }}</span>
            <span class="stat-item">{{ t("fightPvpCard.heroModal.star", { value: hero.star }) }}</span>
            <n-tag :type="hero.HolyBeast ? 'success' : 'warning'">
              {{ hero.HolyBeast ? t("fightPvpCard.heroModal.activated") : t("fightPvpCard.heroModal.notActivated") }}
            </n-tag>
          </div>
        </div>
      </div>

      <div class="hero-modal-details">
        <n-descriptions bordered column="3" label-placement="left">
          <n-descriptions-item :label="t('fightPvpCard.heroModal.labels.power')">
            {{ hero.power }}
          </n-descriptions-item>
          <n-descriptions-item :label="t('fightPvpCard.heroModal.labels.level')">
            {{ hero.level }}
          </n-descriptions-item>
          <n-descriptions-item :label="t('fightPvpCard.heroModal.labels.star')">
            {{ hero.star }}
          </n-descriptions-item>
          <n-descriptions-item :label="t('fightPvpCard.heroModal.labels.hole')">
            {{ hero.hole }}
          </n-descriptions-item>
          <n-descriptions-item :label="t('fightPvpCard.heroModal.labels.red')">
            {{ hero.red }}
          </n-descriptions-item>
          <n-descriptions-item :label="t('fightPvpCard.heroModal.labels.holyBeastStatus')">
            {{ hero.HolyBeast ? t("fightPvpCard.heroModal.activated") : t("fightPvpCard.heroModal.notActivated") }}
          </n-descriptions-item>
          <n-descriptions-item
            v-if="hero.HolyBeast"
            :label="t('fightPvpCard.heroModal.labels.holyBeastLevel')"
          >
            {{ hero.HBlevel }}
          </n-descriptions-item>
          <n-descriptions-item :label="t('fightPvpCard.heroModal.labels.fishInfo')">
            {{ hero?.PearlInfo?.FishInfo?.name != undefined ? hero.PearlInfo?.FishInfo?.name : t("fightPvpCard.common.none") }}
          </n-descriptions-item>
          <n-descriptions-item :label="t('fightPvpCard.heroModal.labels.pearlSkill')">
            {{ hero?.PearlInfo?.PearlSkill?.name != undefined ? hero.PearlInfo?.PearlSkill?.name : t("fightPvpCard.common.none") }}
          </n-descriptions-item>
          <n-descriptions-item :label="t('fightPvpCard.heroModal.labels.pearlWash')">
            <div v-if="hero?.PearlInfo?.slotMap?.length > 0">
              <div
                v-for="item in hero.PearlInfo.slotMap"
                :key="item.id"
                class="ModalEquipment"
                :style="{ '--equip-color': item.value }"
              ></div>
            </div>
            <div v-else>{{ t("fightPvpCard.common.none") }}</div>
          </n-descriptions-item>
        </n-descriptions>
      </div>

      <div class="hero-modal-equipment">
        <h4 class="section-title">{{ t("fightPvpCard.heroModal.equipmentTitle") }}</h4>
        <div class="equipment-grid">
          <div
            v-for="item in equipmentGroups"
            :key="item.label"
            class="equipment-item"
          >
            <span class="equipment-label">{{ item.label }}</span>
            <div class="equipment-slots">
              <div
                v-for="(slot, idx) in item.slots"
                :key="idx"
                class="equipment-slot"
                :class="{
                  'red-slot': isRedQuenchSlot(slot, hero.equipment),
                  'orange-slot': isOrangeQuenchSlot(slot, hero.equipment),
                }"
              ></div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="modal-footer">
        <n-button type="default" @click="showModel = false">
          {{ t("fightPvpCard.actions.close") }}
        </n-button>
      </div>
    </template>
  </n-modal>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
  getEquipmentQuenchSlots: {
    type: Function,
    required: true,
  },
  hero: {
    type: Object,
    default: null,
  },
  isOrangeQuenchSlot: {
    type: Function,
    required: true,
  },
  isRedQuenchSlot: {
    type: Function,
    required: true,
  },
  show: {
    type: Boolean,
    default: false,
  },
  t: {
    type: Function,
    required: true,
  },
});

const emit = defineEmits(["update:show"]);

const showModel = computed({
  get: () => props.show,
  set: (value) => emit("update:show", value),
});

const equipmentGroups = computed(() => [
  {
    label: props.t("fightPvpCard.heroModal.equipment.weapon"),
    slots: props.getEquipmentQuenchSlots(props.hero?.equipment, 0),
  },
  {
    label: props.t("fightPvpCard.heroModal.equipment.clothes"),
    slots: props.getEquipmentQuenchSlots(props.hero?.equipment, 1),
  },
  {
    label: props.t("fightPvpCard.heroModal.equipment.helmet"),
    slots: props.getEquipmentQuenchSlots(props.hero?.equipment, 2),
  },
  {
    label: props.t("fightPvpCard.heroModal.equipment.mount"),
    slots: props.getEquipmentQuenchSlots(props.hero?.equipment, 3),
  },
]);
</script>

<style scoped lang="scss">
.modal-w-600 {
  width: 600px;
}

.hero-detail-modal .hero-modal-content {
  padding: 20px 0;
}

.hero-modal-header {
  display: flex;
  gap: 24px;
  align-items: center;
  margin-bottom: 24px;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--border-light);
}

.hero-modal-avatar {
  flex-shrink: 0;
}

.hero-modal-avatar img {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  object-fit: cover;
  border: 3px solid var(--primary-color-light);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.hero-modal-basic {
  flex: 1;
}

.hero-modal-name {
  margin: 0 0 12px 0;
  font-size: 24px;
  font-weight: 600;
}

.hero-modal-stats {
  display: flex;
  gap: 16px;
  align-items: center;
  flex-wrap: wrap;
}

.hero-modal-stats .stat-item {
  font-size: 14px;
  color: var(--text-primary);
}

.hero-modal-stats .stat-item:first-child {
  font-size: 18px;
  font-weight: 600;
  color: var(--primary-color);
}

.hero-modal-details {
  margin-bottom: 24px;
}

.hero-modal-equipment .section-title {
  margin: 0 0 16px 0;
  font-size: 16px;
  font-weight: 600;
}

.equipment-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

.equipment-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.equipment-label {
  font-size: 14px;
  color: var(--text-secondary);
}

.equipment-slots {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.equipment-slot {
  width: 20px;
  height: 20px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.equipment-slot.red-slot {
  background-color: #ef4444;
  border-color: #ef4444;
  box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.2);
}

.equipment-slot.orange-slot {
  background-color: #f59e0b;
  border-color: #f59e0b;
  box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.2);
}

.ModalEquipment {
  display: inline-block;
  width: 18px;
  height: 18px;
  background-color: var(--equip-color);
  margin-right: 5px;
  border-radius: 2px;
  border: 1px solid rgba(0, 0, 0, 0.1);
}

.modal-footer {
  display: flex;
  justify-content: center;
  gap: 12px;
}

@media (max-width: 768px) {
  .hero-modal-header {
    flex-direction: column;
    text-align: center;
  }
}
</style>
