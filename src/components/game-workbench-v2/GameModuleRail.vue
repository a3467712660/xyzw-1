<template>
  <div class="game-module-rail-shell">
    <aside v-if="!isMobile" class="game-module-rail">
      <section
        v-for="group in groups"
        :key="group.id"
        class="game-module-rail__group"
        :class="{ 'game-module-rail__group--active': isGroupActive(group) }"
      >
        <div
          class="game-module-rail__group-head"
          :class="{ 'game-module-rail__group-head--compact': !showGroupCaption }"
        >
          <div class="game-module-rail__group-icon">
            <n-icon>
              <component :is="group.icon"></component>
            </n-icon>
          </div>
          <div
            class="game-module-rail__group-copy"
            :class="{ 'game-module-rail__group-copy--compact': !showGroupCaption }"
          >
            <strong>{{ group.label }}</strong>
            <span v-if="showGroupCaption">{{ group.caption }}</span>
          </div>
        </div>

        <div class="game-module-rail__module-list">
          <button
            v-for="item in group.items"
            :key="item.id"
            class="game-module-rail__module"
            type="button"
            :class="{
              'game-module-rail__module--active': item.id === modelValue,
              'game-module-rail__module--compact': !showModuleNote,
            }"
            @click="selectModule(item.id)"
          >
            <span class="game-module-rail__module-name">{{ item.label }}</span>
            <span
              v-if="showModuleNote"
              class="game-module-rail__module-note"
            >
              {{ item.description }}
            </span>
          </button>
        </div>
      </section>
    </aside>

    <div v-else class="game-module-dock">
      <div
        v-if="mobilePanelGroup"
        class="game-module-dock__panel"
      >
        <div class="game-module-dock__panel-head">
          <div>
            <p class="game-module-dock__panel-label">{{ dockLabel }}</p>
            <strong>{{ mobilePanelGroup.label }}</strong>
          </div>
          <button
            class="game-module-dock__close"
            type="button"
            @click="mobilePanelGroupId = null"
          >
            ×
          </button>
        </div>

        <div class="game-module-dock__module-list">
          <button
            v-for="item in mobilePanelGroup.items"
            :key="item.id"
            class="game-module-dock__module"
            type="button"
            :class="{
              'game-module-dock__module--active': item.id === modelValue,
              'game-module-dock__module--compact': !showModuleNote,
            }"
            @click="selectModule(item.id)"
          >
            <span class="game-module-dock__module-name">{{ item.label }}</span>
            <span
              v-if="showModuleNote"
              class="game-module-dock__module-note"
            >
              {{ item.description }}
            </span>
          </button>
        </div>
      </div>

      <div class="game-module-dock__bar">
        <button
          v-for="group in groups"
          :key="group.id"
          class="game-module-dock__group"
          type="button"
          :class="{
            'game-module-dock__group--active': isGroupActive(group),
            'game-module-dock__group--expanded': mobilePanelGroupId === group.id,
          }"
          @click="toggleMobileGroup(group.id)"
        >
          <n-icon>
            <component :is="group.icon"></component>
          </n-icon>
          <span>{{ group.label }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from "vue";
import { useResponsive } from "@/composables/useResponsive";

const props = defineProps({
  groups: {
    type: Array,
    default: () => [],
  },
  modelValue: {
    type: String,
    default: "",
  },
  dockLabel: {
    type: String,
    default: "",
  },
  showGroupCaption: {
    type: Boolean,
    default: true,
  },
  showModuleNote: {
    type: Boolean,
    default: true,
  },
});

const emit = defineEmits(["update:modelValue"]);

const { isMobile } = useResponsive();
const mobilePanelGroupId = ref(null);

const findGroupIdByModule = (groups, moduleId) =>
  groups.find((group) => group.items.some((item) => item.id === moduleId))?.id || null;

const mobilePanelGroup = computed(() =>
  props.groups.find((group) => group.id === mobilePanelGroupId.value) || null,
);

const isGroupActive = (group) =>
  group.items.some((item) => item.id === props.modelValue);

const selectModule = (moduleId) => {
  emit("update:modelValue", moduleId);
  if (isMobile.value) {
    mobilePanelGroupId.value = null;
  }
};

const toggleMobileGroup = (groupId) => {
  mobilePanelGroupId.value = mobilePanelGroupId.value === groupId ? null : groupId;
};

watch(
  [() => props.groups, () => props.modelValue, isMobile],
  ([groups, modelValue, mobile]) => {
    if (!mobile) {
      mobilePanelGroupId.value = null;
      return;
    }

    const activeGroupId = findGroupIdByModule(groups, modelValue);
    if (!groups.some((group) => group.id === mobilePanelGroupId.value)) {
      mobilePanelGroupId.value = activeGroupId;
    }
  },
  { immediate: true, deep: true },
);
</script>
