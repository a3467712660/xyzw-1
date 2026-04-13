<template>
  <NModal
    preset="card"
    style="width: 600px; max-width: 90vw"
    v-model:show="showModel"
    :bordered="false"
    :title="title"
  >
    <NSpin :show="loading">
      <div v-if="selectedHeroEquipment" class="refine-modal-content">
        <div
          v-for="partId in [1, 2, 3, 4]"
          :key="partId"
          class="equip-refine-section"
        >
          <div class="equip-header">
            <span class="equip-name">{{ partMap[partId] }}</span>
            <span class="equip-level">
              Lv.{{ selectedHeroEquipment[partId]?.level || 0 }}
            </span>
            <span v-if="selectedHeroEquipment[partId]" class="equip-bonus">
              +{{ getEquipBonus(partId) }}
              {{ partId === 1 ? "攻击" : partId === 3 ? "防御" : "血量" }}
            </span>
          </div>
          <div class="slots-container">
            <div
              v-for="slot in getEquipSlots(partId)"
              :key="slot.id"
              class="slot-item"
              :class="{
                locked: slot.isLocked,
                [`color-${slot.colorId}`]: slot.colorId > 0,
              }"
            >
              <span class="slot-label">孔{{ slot.id }}</span>
              <div v-if="slot.attrId" class="slot-attr">
                <span class="attr-name">{{ getAttrName(slot.attrId) }}</span>
                <span class="attr-value">+{{ slot.attrNum }}%</span>
              </div>
              <div v-else class="slot-empty">未淬炼</div>
              <NTag v-if="slot.isLocked" size="small" type="warning">锁定</NTag>
            </div>
          </div>
        </div>
      </div>
      <div v-else class="no-equipment">暂无装备数据</div>
    </NSpin>
  </NModal>
</template>

<script setup>
import { computed } from "vue";
import { NModal, NSpin, NTag } from "naive-ui";

const props = defineProps({
  getAttrName: {
    type: Function,
    required: true,
  },
  getEquipBonus: {
    type: Function,
    required: true,
  },
  getEquipSlots: {
    type: Function,
    required: true,
  },
  loading: {
    type: Boolean,
    default: false,
  },
  partMap: {
    type: Object,
    required: true,
  },
  selectedHeroEquipment: {
    type: Object,
    default: null,
  },
  show: {
    type: Boolean,
    default: false,
  },
  title: {
    type: String,
    default: "",
  },
});

const emit = defineEmits(["update:show"]);

const showModel = computed({
  get: () => props.show,
  set: (value) => emit("update:show", value),
});
</script>
