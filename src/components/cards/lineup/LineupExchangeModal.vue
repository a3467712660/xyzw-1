<template>
  <NModal
    preset="card"
    style="width: 700px; max-width: 90vw"
    v-model:show="showModel"
    :bordered="false"
    :title="exchangeMode === 'add' ? '上阵英雄' : '更换武将'"
  >
    <div class="exchange-modal-content">
      <div v-if="exchangeMode === 'exchange'" class="current-hero-info">
        <span>当前武将：</span>
        <NTag size="large" type="primary">
          {{ getHeroName(exchangeHero?.heroId) || `武将${exchangeHero?.heroId}` }}
        </NTag>
      </div>
      <div v-else class="current-hero-info">
        <span>上阵位置：</span>
        <NTag size="large" type="success">位置 {{ getFirstEmptySlot() + 1 }}</NTag>
      </div>
      <NInput
        clearable
        placeholder="搜索武将名称..."
        style="margin-bottom: 12px"
        v-model:value="heroSearchKeywordModel"
      ></NInput>
      <div class="hero-filter-section">
        <div class="filter-label">品质：</div>
        <div class="filter-tags">
          <NTag
            v-for="quality in heroQualities"
            :key="quality"
            style="cursor: pointer; margin-right: 8px"
            :bordered="false"
            :type="selectedQualityModel === quality ? 'primary' : 'default'"
            @click="
              selectedQualityModel =
                selectedQualityModel === quality ? '全部' : quality
            "
          >
            {{ quality }}
          </NTag>
        </div>
      </div>
      <div class="hero-filter-section">
        <div class="filter-label">国家：</div>
        <div class="filter-tags">
          <NTag
            v-for="country in heroCountries"
            :key="country"
            style="cursor: pointer; margin-right: 8px"
            :bordered="false"
            :type="selectedCountryModel === country ? 'primary' : 'default'"
            @click="
              selectedCountryModel =
                selectedCountryModel === country ? '全部' : country
            "
          >
            {{ country }}
          </NTag>
        </div>
      </div>
      <NSpin :show="exchangeLoading">
        <div class="hero-select-grid">
          <div
            v-for="hero in filteredHeroList"
            :key="hero.id"
            class="hero-select-item"
            :class="{
              'selected': exchangeTargetHeroId === hero.id,
              'quality-red': hero.quality === '红将',
              'quality-orange': hero.quality === '橙将',
              'quality-purple': hero.quality === '紫将',
            }"
            @click="$emit('select-hero', hero)"
          >
            <div class="hero-select-avatar">
              <img v-if="hero.avatar" :alt="hero.name" :src="hero.avatar">
              <div v-else class="hero-placeholder">
                {{ hero.name?.substring(0, 2) || "?" }}
              </div>
            </div>
            <div class="hero-select-name">{{ hero.name }}</div>
            <div class="hero-select-tags">
              <NTag
                size="small"
                :bordered="false"
                :type="
                  hero.quality === '红将'
                    ? 'error'
                    : hero.quality === '橙将'
                      ? 'warning'
                      : hero.quality === '紫将'
                        ? 'info'
                        : 'default'
                "
              >
                {{ hero.quality }}
              </NTag>
              <NTag size="small" type="default" :bordered="false">
                {{ hero.type }}
              </NTag>
            </div>
          </div>
        </div>
      </NSpin>
    </div>
    <template #footer>
      <div style="display: flex; justify-content: flex-end; gap: 8px">
        <NButton @click="showModel = false">取消</NButton>
        <NButton
          type="primary"
          :disabled="!exchangeTargetHeroId"
          :loading="exchangeLoading"
          @click="$emit('confirm')"
        >
          {{ exchangeMode === "add" ? "确认上阵" : "确认更换" }}
        </NButton>
      </div>
    </template>
  </NModal>
</template>

<script setup>
import { computed } from "vue";
import { NButton, NInput, NModal, NSpin, NTag } from "naive-ui";

const props = defineProps({
  exchangeHero: {
    type: Object,
    default: null,
  },
  exchangeLoading: {
    type: Boolean,
    default: false,
  },
  exchangeMode: {
    type: String,
    default: "exchange",
  },
  exchangeTargetHeroId: {
    type: [Number, String],
    default: null,
  },
  filteredHeroList: {
    type: Array,
    default: () => [],
  },
  getFirstEmptySlot: {
    type: Function,
    required: true,
  },
  getHeroName: {
    type: Function,
    required: true,
  },
  heroCountries: {
    type: Array,
    default: () => [],
  },
  heroQualities: {
    type: Array,
    default: () => [],
  },
  heroSearchKeyword: {
    type: String,
    default: "",
  },
  selectedCountry: {
    type: String,
    default: "全部",
  },
  selectedQuality: {
    type: String,
    default: "全部",
  },
  show: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits([
  "confirm",
  "select-hero",
  "update:heroSearchKeyword",
  "update:selectedCountry",
  "update:selectedQuality",
  "update:show",
]);

const showModel = computed({
  get: () => props.show,
  set: (value) => emit("update:show", value),
});

const heroSearchKeywordModel = computed({
  get: () => props.heroSearchKeyword,
  set: (value) => emit("update:heroSearchKeyword", value),
});

const selectedCountryModel = computed({
  get: () => props.selectedCountry,
  set: (value) => emit("update:selectedCountry", value),
});

const selectedQualityModel = computed({
  get: () => props.selectedQuality,
  set: (value) => emit("update:selectedQuality", value),
});
</script>
