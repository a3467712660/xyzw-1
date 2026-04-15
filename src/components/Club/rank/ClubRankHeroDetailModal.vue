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

.modal-w-600 :deep(.n-card) {
  max-height: calc(100dvh - 24px);
  display: flex;
  flex-direction: column;
}

.modal-w-600 :deep(.n-card__content) {
  overflow: auto;
  -webkit-overflow-scrolling: touch;
}

.hero-detail-modal {
  .hero-modal-content {
    padding: 20px 0;
  }

  .hero-modal-header {
    display: flex;
    align-items: center;
    gap: 20px;
    margin-bottom: 20px;
  }

  .hero-modal-avatar {
    width: 100px;
    height: 100px;
    border-radius: 50%;
    background: var(--bg-secondary, #f9f9f9);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    border: 2px solid var(--border-light, #eee);

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  }

  .hero-placeholder {
    font-size: 36px;
    font-weight: var(--font-weight-bold, bold);
    color: var(--text-secondary, #999);
  }

  .hero-modal-basic {
    flex: 1;
  }

  .hero-modal-name {
    margin: 0 0 10px 0;
    font-size: var(--font-size-lg, 16px);
    font-weight: var(--font-weight-bold, bold);
  }

  .hero-modal-stats {
    display: flex;
    align-items: center;
    gap: 15px;
    font-size: var(--font-size-sm, 14px);
    color: var(--text-secondary, #666);

    .stat-item {
      padding: 4px 8px;
      background: var(--bg-secondary, #f9f9f9);
      border-radius: var(--border-radius-sm, 4px);
      border: 1px solid var(--border-light, #eee);
    }
  }

  .hero-modal-details {
    margin-bottom: 20px;

    :deep(.n-descriptions) {
      font-size: var(--font-size-sm, 14px);

      .n-descriptions-item-label {
        font-weight: var(--font-weight-medium, 500);
        color: var(--text-primary, #333);
      }

      .n-descriptions-item-content {
        color: var(--text-secondary, #666);
      }
    }
  }

  .hero-modal-equipment {
    margin-top: 20px;
  }

  .section-title {
    margin: 0 0 15px 0;
    font-size: var(--font-size-base, 14px);
    font-weight: var(--font-weight-bold, bold);
  }

  .equipment-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 15px;
  }

  .equipment-item {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .equipment-label {
    font-size: var(--font-size-sm, 14px);
    color: var(--text-primary, #333);
    font-weight: var(--font-weight-medium, 500);
    width: 60px;
  }

  .equipment-slots {
    display: flex;
    gap: 6px;
  }

  .equipment-slot {
    width: 20px;
    height: 20px;
    border: 1px solid var(--border-light, #eee);
    border-radius: var(--border-radius-sm, 4px);
    background: var(--bg-secondary, #f9f9f9);
  }

  .equipment-slot.red-slot {
    background: var(--error-color, #ff4d4f);
    border-color: var(--error-color, #ff4d4f);
  }

  .ModalEquipment {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    margin-right: 4px;
    display: inline-block;
    vertical-align: middle;
    background-color: var(--equip-color);
  }
}

@media (max-width: 768px) {
  .modal-w-600 :deep(.n-card) {
    max-height: calc(100dvh - 12px);
  }

  .hero-detail-modal {
    :deep(.n-modal-content) {
      padding: 0 !important;
    }

    .hero-modal-header {
      flex-direction: column;
      text-align: center;
    }

    .equipment-grid {
      grid-template-columns: 1fr;
    }
  }
}
</style>
