<template>
  <NModal
    class="hero-detail-modal modal-w-600"
    preset="card"
    size="large"
    title="武将信息"
    v-model:show="showModel"
    :bordered="false"
    :segmented="{ content: 'soft', footer: 'soft' }"
    :show-close="true"
  >
    <template #header-extra>
      <span class="hero-id">武将ID: {{ hero?.heroId }}</span>
    </template>

    <div v-if="hero" class="hero-modal-content">
      <div class="hero-modal-header">
        <div class="hero-modal-avatar">
          <img
            v-if="hero.heroAvate"
            :alt="hero.heroName"
            :src="hero.heroAvate"
          >
          <div v-else class="hero-placeholder">
            {{ hero.heroName?.substring(0, 2) || "?" }}
          </div>
        </div>
        <div class="hero-modal-basic">
          <h3 class="hero-modal-name">{{ hero.heroName }}</h3>
          <div class="hero-modal-stats">
            <span class="stat-item">{{ formatPower(hero.power) }}</span>
            <span class="stat-item">等级: {{ hero.level }}</span>
            <span class="stat-item">星级: {{ hero.star }}</span>
            <NTag :type="hero.HolyBeast ? 'success' : 'warning'">
              {{ hero.HolyBeast ? "已激活" : "未激活" }}
            </NTag>
          </div>
        </div>
      </div>

      <div class="hero-modal-details">
        <NDescriptions bordered column="3" label-placement="left">
          <NDescriptionsItem label="战力">
            {{ formatPower(hero.power) }}
          </NDescriptionsItem>
          <NDescriptionsItem label="等级">
            {{ hero.level }}
          </NDescriptionsItem>
          <NDescriptionsItem label="星级">
            {{ hero.star }}
          </NDescriptionsItem>
          <NDescriptionsItem label="开孔数">
            {{ hero.hole }}
          </NDescriptionsItem>
          <NDescriptionsItem label="红孔数">
            {{ hero.red }}
          </NDescriptionsItem>
          <NDescriptionsItem label="四圣状态">
            {{ hero.HolyBeast ? "已激活" : "未激活" }}
          </NDescriptionsItem>
          <NDescriptionsItem v-if="hero.HolyBeast" label="四圣等级">
            {{ hero.HBlevel }}
          </NDescriptionsItem>
          <NDescriptionsItem label="鱼灵">
            {{
              hero?.PearlInfo?.FishInfo?.name !== undefined
                ? hero.PearlInfo?.FishInfo?.name
                : "无"
            }}
          </NDescriptionsItem>
          <NDescriptionsItem label="鱼珠技能">
            {{
              hero?.PearlInfo?.PearlSkill?.name !== undefined
                ? hero.PearlInfo?.PearlSkill?.name
                : "无"
            }}
          </NDescriptionsItem>
          <NDescriptionsItem label="鱼灵洗练">
            <div v-if="pearlSlots.length > 0">
              <div
                v-for="item in pearlSlots"
                :key="item.id"
                class="ModalEquipment"
                :style="{ '--equip-color': item.value }"
              ></div>
            </div>
            <div v-else>无</div>
          </NDescriptionsItem>
        </NDescriptions>
      </div>

      <div class="hero-modal-equipment">
        <h4 class="section-title">装备详情</h4>
        <div class="equipment-grid">
          <div
            v-for="(group, index) in equipmentGroups"
            :key="group.label"
            class="equipment-item"
          >
            <span class="equipment-label">{{ group.label }}:</span>
            <div class="equipment-slots">
              <div
                v-for="(item, slotIndex) in group.slots"
                :key="`${index}-${slotIndex}`"
                class="equipment-slot"
                :class="{ 'red-slot': item.colorId === 6 }"
              ></div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <NButton @click="showModel = false">关闭</NButton>
    </template>
  </NModal>
</template>

<script setup>
import { computed } from "vue";
import {
  NButton,
  NDescriptions,
  NDescriptionsItem,
  NModal,
  NTag,
} from "naive-ui/es";

const props = defineProps({
  formatPower: {
    type: Function,
    required: true,
  },
  hero: {
    type: Object,
    default: null,
  },
  show: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["update:show"]);

const showModel = computed({
  get: () => props.show,
  set: (value) => emit("update:show", value),
});

const pearlSlots = computed(() => props.hero?.PearlInfo?.slotMap || []);

const equipmentGroups = computed(() => {
  const equipment = Object.values(props.hero?.equipment || {});
  const labels = ["武器", "衣服", "头盔", "坐骑"];
  return labels.map((label, index) => ({
    label,
    slots: Object.values(equipment[index]?.quenches || {}),
  }));
});
</script>

<style scoped lang="scss">
.modal-w-600 {
  width: min(600px, calc(100vw - 24px));
}

.hero-modal-content,
.hero-modal-details,
.hero-modal-equipment {
  display: grid;
  gap: 16px;
}

.hero-modal-header {
  display: flex;
  gap: 16px;
  align-items: center;
}

.hero-modal-avatar img,
.hero-placeholder {
  width: 72px;
  height: 72px;
  border-radius: 50%;
}

.hero-placeholder {
  display: grid;
  place-items: center;
  background: var(--n-border-color);
}

.hero-modal-basic,
.hero-modal-stats {
  display: grid;
  gap: 8px;
}

.equipment-grid {
  display: grid;
  gap: 12px;
}

.equipment-item {
  display: flex;
  gap: 12px;
  align-items: center;
}

.equipment-slots {
  display: flex;
  gap: 6px;
}

.equipment-slot {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.12);
}

.equipment-slot.red-slot {
  background: #d03050;
}

.ModalEquipment {
  display: inline-block;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  margin-right: 6px;
  background: var(--equip-color, #666);
}

@media (max-width: 768px) {
  .hero-modal-header,
  .equipment-item {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
