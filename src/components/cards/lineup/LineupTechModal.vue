<template>
  <NModal
    preset="card"
    style="width: 700px; max-width: 90vw"
    title="俱乐部科技"
    v-model:show="showModel"
    :bordered="false"
  >
    <div v-if="selectedTechData" class="tech-modal-content">
      <div
        v-for="type in [1, 2, 3, 4, 5, 6]"
        :key="type"
        class="tech-type-section"
      >
        <div class="tech-type-header">
          {{ techTypeName[type] }}
        </div>
        <div class="tech-items">
          <div
            v-for="techId in techTypeMap[type]"
            :key="techId"
            class="tech-item"
          >
            <span class="tech-name">{{ techName[techId] }}</span>
            <span class="tech-level">
              {{ selectedTechData[techId] || 0 }}/{{ techMaxLevel[techId] }}
            </span>
          </div>
        </div>
      </div>
    </div>
    <div v-else class="no-tech-data">暂无科技数据</div>
  </NModal>
</template>

<script setup>
import { computed } from "vue";
import { NModal } from "naive-ui";

const props = defineProps({
  selectedTechData: {
    type: Object,
    default: null,
  },
  show: {
    type: Boolean,
    default: false,
  },
  techMaxLevel: {
    type: Object,
    required: true,
  },
  techName: {
    type: Object,
    required: true,
  },
  techTypeMap: {
    type: Object,
    required: true,
  },
  techTypeName: {
    type: Object,
    required: true,
  },
});

const emit = defineEmits(["update:show"]);

const showModel = computed({
  get: () => props.show,
  set: (value) => emit("update:show", value),
});
</script>
