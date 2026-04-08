<template>
  <MyCard
    class="refine-helper-card"
    :panel-active="panelActive"
    :status-class="{ active: state.isRunning }"
  >
    <template #icon>
      <img src="/icons/ta.png" :alt="t('refineHelperCard.iconAlt')">
    </template>
    <template #title>
      <h3>{{ t("refineHelperCard.title") }}</h3>
      <p>{{ t("refineHelperCard.subtitle") }}</p>
    </template>
    <template #badge>
      <span>{{ state.isRunning ? t("refineHelperCard.status.running") : t("refineHelperCard.status.stopped") }}</span>
    </template>
    <template #default>
      <div class="gwb2-mini-card__stack">
        <div class="gwb2-mini-card__action-rail refine-toolbar-actions">
          <n-button size="small" type="primary" @click="refreshHeroes">
            {{ t("refineHelperCard.actions.refreshHeroes") }}
          </n-button>
          <n-button size="small" @click="resetCount">
            {{ t("refineHelperCard.actions.reset") }}
          </n-button>
        </div>

        <div class="gwb2-mini-card__metric-grid refine-summary-grid">
          <div class="gwb2-mini-card__metric summary-card">
            <span class="summary-card__label">{{ t("refineHelperCard.labels.whiteJade", { count: jadeCount }) }}</span>
            <strong class="summary-card__value">{{ jadeCount }}</strong>
          </div>
          <div class="gwb2-mini-card__metric summary-card">
            <span class="summary-card__label">{{ t("refineHelperCard.labels.colorJade", { count: colorJadeCount }) }}</span>
            <strong class="summary-card__value">{{ colorJadeCount }}</strong>
          </div>
          <div class="gwb2-mini-card__metric summary-card">
            <span class="summary-card__label">{{ t("refineHelperCard.labels.quenchedCount") }}</span>
            <strong class="summary-card__value">{{ quenchCount }}</strong>
          </div>
          <div class="gwb2-mini-card__metric summary-card">
            <span class="summary-card__label">运行状态</span>
            <strong class="summary-card__value">
              {{ state.isRunning ? t("refineHelperCard.status.running") : t("refineHelperCard.status.stopped") }}
            </strong>
          </div>
        </div>

        <RefineHeroListPanel
          :empty-text="t('refineHelperCard.states.emptyHeroes')"
          :heroes="heroCards"
          :loading="loading"
          :loading-text="t('refineHelperCard.states.loading')"
          :selected-hero-id="selectedHeroId"
          :title="t('refineHelperCard.labels.selectHero')"
          @select-hero="selectHero"
        ></RefineHeroListPanel>

        <RefineEquipTabsPanel
          v-if="selectedHero"
          :equip-parts="equipParts"
          :selected-part="selectedPart"
          :title="t('refineHelperCard.labels.selectEquip')"
          @select-part="selectPart"
        ></RefineEquipTabsPanel>

        <RefineSlotsPanel
          v-if="selectedPart"
          :empty-text="t('refineHelperCard.states.notQuenched')"
          :quench-label="t('refineHelperCard.labels.quenchTimes')"
          :slot-label-prefix="t('refineHelperCard.labels.slot', { id: '' }).trim()"
          :slot-title="t('refineHelperCard.labels.slotLock')"
          :slots="selectedSlots"
          :stats="selectedEquipStats"
          @toggle-lock="handleSlotLock"
        ></RefineSlotsPanel>

        <RefinePasswordPanel
          v-if="selectedPart"
          :is-password-validated="isPasswordValidated"
          :is-verifying="isVerifying"
          :label="t('refineHelperCard.labels.secondaryPassword')"
          :password="password"
          :password-error="passwordError"
          :placeholder="t('refineHelperCard.labels.enterSecondaryPassword')"
          :reset-text="t('refineHelperCard.actions.reverify')"
          :title="t('refineHelperCard.labels.secondaryPassword')"
          :validated-text="t('refineHelperCard.states.passwordVerified')"
          :verify-text="t('refineHelperCard.actions.verify')"
          @reset="resetPasswordValidation"
          @update-password="handlePasswordInput"
          @verify="verifyPassword"
        ></RefinePasswordPanel>

        <RefineAutoConditionsPanel
          v-if="selectedPart"
          :add-text="t('refineHelperCard.actions.addCondition')"
          :attr-options="attrOptions"
          :attribute-label="t('refineHelperCard.labels.attribute')"
          :attribute-placeholder="t('refineHelperCard.labels.selectAttribute')"
          :conditions="targetConditions"
          :delay="delay"
          :delay-label="t('refineHelperCard.labels.delay')"
          :remove-text="t('refineHelperCard.actions.remove')"
          :title="t('refineHelperCard.labels.autoSettings')"
          @add-condition="addCondition"
          @remove-condition="removeCondition"
          @update-condition-attr="updateConditionAttr"
          @update-condition-value="updateConditionValue"
          @update-delay="updateDelay"
        ></RefineAutoConditionsPanel>
      </div>
    </template>
    <template #action>
      <div class="gwb2-mini-card__action-rail refine-actions">
        <n-button
          size="small"
          type="primary"
          :disabled="state.isRunning"
          @click="quenchOnce"
        >
          {{ t("refineHelperCard.actions.quenchOnce") }}
        </n-button>
        <n-button
          size="small"
          type="success"
          :disabled="state.isRunning"
          @click="quenchContinuous"
        >
          {{ t("refineHelperCard.actions.quenchContinuous") }}
        </n-button>
        <n-button
          size="small"
          type="warning"
          :disabled="state.isRunning"
          @click="startAutoQuench"
        >
          {{ t("refineHelperCard.actions.autoQuench") }}
        </n-button>
        <n-button
          size="small"
          type="error"
          :disabled="!state.isRunning"
          @click="stopQuench()"
        >
          {{ t("refineHelperCard.actions.stop") }}
        </n-button>
      </div>
    </template>
  </MyCard>
</template>

<script setup>
import { computed, onBeforeUnmount, ref } from "vue";
import { useMessage } from "naive-ui/es";
import { useI18n } from "vue-i18n";
import { useTokenStore } from "@/stores/tokenStore";
import MyCard from "../Common/MyCard.vue";
import RefineAutoConditionsPanel from "./refine-helper/RefineAutoConditionsPanel.vue";
import RefineEquipTabsPanel from "./refine-helper/RefineEquipTabsPanel.vue";
import RefineHeroListPanel from "./refine-helper/RefineHeroListPanel.vue";
import RefinePasswordPanel from "./refine-helper/RefinePasswordPanel.vue";
import RefineSlotsPanel from "./refine-helper/RefineSlotsPanel.vue";
import { HERO_DICT } from "@/utils/HeroList.js";

defineProps({
  panelActive: {
    type: Boolean,
    default: true,
  },
});

const tokenStore = useTokenStore();
const message = useMessage();
const { t } = useI18n();

const loading = ref(false);
const heroes = ref([]);
const allHeroesData = ref({});
const selectedHeroId = ref(null);
const selectedPart = ref(null);
const quenchCount = ref(0);
const delay = ref(350);
const targetConditions = ref([
  {
    attrId: null,
    attrValue: null,
  },
]);
const jadeCount = ref(0);
const colorJadeCount = ref(0);
const password = ref("");
const isPasswordValidated = ref(false);
const passwordError = ref("");
const isVerifying = ref(false);

const state = ref({
  isRunning: false,
  continuousQuenching: false,
  autoQuenching: false,
});

let continuousTimer = null;
let autoTimer = null;

const attrMap = {
  1: "refineHelperCard.attributes.attack",
  2: "refineHelperCard.attributes.hp",
  3: "refineHelperCard.attributes.defense",
  4: "refineHelperCard.attributes.speed",
  5: "refineHelperCard.attributes.armorBreak",
  6: "refineHelperCard.attributes.armorBreakResist",
  7: "refineHelperCard.attributes.accuracy",
  8: "refineHelperCard.attributes.block",
  9: "refineHelperCard.attributes.damageReduction",
  10: "refineHelperCard.attributes.critical",
  11: "refineHelperCard.attributes.criticalResist",
  12: "refineHelperCard.attributes.criticalDamage",
  13: "refineHelperCard.attributes.criticalDamageResist",
  14: "refineHelperCard.attributes.skillDamage",
  15: "refineHelperCard.attributes.controlResist",
  16: "refineHelperCard.attributes.stunResist",
  17: "refineHelperCard.attributes.freezeResist",
  18: "refineHelperCard.attributes.silenceResist",
  19: "refineHelperCard.attributes.bleedResist",
  20: "refineHelperCard.attributes.poisonResist",
  21: "refineHelperCard.attributes.burnResist",
};

const partMap = {
  1: "refineHelperCard.parts.weapon",
  2: "refineHelperCard.parts.armor",
  3: "refineHelperCard.parts.helmet",
  4: "refineHelperCard.parts.mount",
};

const attrOptions = computed(() =>
  Object.entries(attrMap).map(([id, name]) => ({
    label: t(name),
    value: Number(id),
  })),
);

const heroCards = computed(() =>
  heroes.value.map((hero) => ({
    ...hero,
    avatar: HERO_DICT[hero.id]?.avatar || "",
    shortName: hero.name?.substring(0, 2) || "?",
  })),
);

const selectedHero = computed(() =>
  heroCards.value.find((hero) => hero.id === selectedHeroId.value) || null,
);

const selectedHeroRaw = computed(() => {
  if (selectedHeroId.value == null) {
    return null;
  }

  return allHeroesData.value[String(selectedHeroId.value)] || null;
});

const selectedHeroEquipment = computed(() => selectedHeroRaw.value?.equipment || {});

const equipParts = computed(() =>
  Object.entries(selectedHeroEquipment.value || {}).map(([id, equip]) => ({
    id: Number(id),
    level: equip?.level || 1,
    name: partMap[Number(id)]
      ? t(partMap[Number(id)])
      : t("refineHelperCard.fallbacks.equipment", { id }),
  })),
);

const selectedEquip = computed(() => {
  if (selectedPart.value == null) {
    return null;
  }

  return selectedHeroEquipment.value?.[selectedPart.value] || null;
});

const selectedEquipStats = computed(() => {
  if (!selectedEquip.value || selectedPart.value == null) {
    return {
      bonusName: t("refineHelperCard.attributes.attack"),
      bonusValue: 0,
      quenchTimes: 0,
    };
  }

  const bonusType =
    selectedPart.value === 1
      ? "quenchAttackExt"
      : selectedPart.value === 3
        ? "quenchDefenseExt"
        : "quenchHpExt";
  const bonusName =
    selectedPart.value === 1
      ? t("refineHelperCard.attributes.attack")
      : selectedPart.value === 3
        ? t("refineHelperCard.attributes.defense")
        : t("refineHelperCard.attributes.hp");

  return {
    bonusName,
    bonusValue: selectedEquip.value[bonusType] || 0,
    quenchTimes: selectedEquip.value.quenchTimes || 0,
  };
});

const selectedSlots = computed(() => {
  const quenches = selectedEquip.value?.quenches || {};
  return Object.keys(quenches)
    .sort((left, right) => Number(left) - Number(right))
    .map((key) => {
      const slot = quenches[key] || {};
      return {
        attrId: slot.attrId || null,
        attrName: slot.attrId ? getAttrName(slot.attrId) : "",
        attrNum: slot.attrNum || 0,
        colorId: slot.colorId || 0,
        id: Number(key),
        isLocked: Boolean(slot.isLocked || slot.locked),
      };
    });
});

const clearQuenchTimers = () => {
  if (continuousTimer) {
    clearTimeout(continuousTimer);
    continuousTimer = null;
  }

  if (autoTimer) {
    clearTimeout(autoTimer);
    autoTimer = null;
  }
};

const parseTeamData = (presetTeamInfo) => {
  if (!presetTeamInfo) {
    return {
      teams: {},
      useTeamId: 1,
    };
  }

  const root = presetTeamInfo.presetTeamInfo ?? presetTeamInfo;
  const findUseIdRec = (node) => {
    if (!node || typeof node !== "object") {
      return null;
    }
    if (typeof node.useTeamId === "number") {
      return node.useTeamId;
    }
    for (const key of Object.keys(node)) {
      const value = findUseIdRec(node[key]);
      if (value) {
        return value;
      }
    }
    return null;
  };

  const useTeamId
    = root.useTeamId
      ?? root.presetTeamInfo?.useTeamId
      ?? findUseIdRec(root)
      ?? 1;

  const dict = root.presetTeamInfo ?? root;
  const teams = {};
  const ids = Object.keys(dict || {}).filter((key) => /^\d+$/.test(key));
  for (const idStr of ids) {
    const id = Number(idStr);
    const node = dict[idStr];
    if (!node) {
      teams[id] = { teamInfo: {} };
      continue;
    }
    if (node.teamInfo) {
      teams[id] = { teamInfo: node.teamInfo };
      continue;
    }
    if (node.heroes) {
      const teamInfo = {};
      node.heroes.forEach((hero, index) => {
        teamInfo[String(index + 1)] = hero;
      });
      teams[id] = { teamInfo };
      continue;
    }
    if (typeof node === "object") {
      const hasHero = Object.values(node).some(
        (value) => value && typeof value === "object" && "heroId" in value,
      );
      teams[id] = { teamInfo: hasHero ? node : {} };
      continue;
    }
    teams[id] = { teamInfo: {} };
  }

  return { teams, useTeamId: Number(useTeamId) || 1 };
};

const buildHeroList = (teamData, heroData) => {
  const { useTeamId, teams } = teamData;
  const currentTeam = teams[useTeamId] || { teamInfo: {} };
  const teamInfo = currentTeam.teamInfo;
  const heroList = [];

  for (const [position, hero] of Object.entries(teamInfo || {})) {
    const heroId = hero?.heroId || hero?.id;
    if (!heroId) {
      continue;
    }

    const heroDetail = heroData[String(heroId)] || {};
    heroList.push({
      id: Number(heroId),
      level: hero?.level || heroDetail?.level || 1,
      name: HERO_DICT[Number(heroId)]?.name || t("refineHelperCard.fallbacks.hero", { id: Number(heroId) }),
      position: Number(position),
    });
  }

  if (heroList.length === 0 && Object.keys(heroData).length > 0) {
    for (const [id, hero] of Object.entries(heroData)) {
      if (!hero || !hero.equipment) {
        continue;
      }
      heroList.push({
        id: Number(id),
        level: hero.level || 1,
        name: HERO_DICT[Number(id)]?.name || t("refineHelperCard.fallbacks.hero", { id: Number(id) }),
        position: heroList.length + 1,
      });
      if (heroList.length >= 5) {
        break;
      }
    }
  }

  return heroList.sort((left, right) => left.position - right.position);
};

const getAttrName = (attrId) =>
  attrMap[attrId]
    ? t(attrMap[attrId])
    : t("refineHelperCard.fallbacks.attribute", { id: attrId });

const refreshHeroes = async () => {
  const token = tokenStore.selectedToken;
  if (!token) {
    message.warning(t("refineHelperCard.messages.selectTokenFirst"));
    return;
  }

  const tokenId = token.id;
  const status = tokenStore.getWebSocketStatus(tokenId);
  if (status !== "connected") {
    message.error(t("refineHelperCard.messages.wsDisconnectedRefresh"));
    return;
  }

  loading.value = true;

  try {
    const [presetTeamInfo, roleInfo] = await Promise.all([
      tokenStore.sendMessageWithPromise(tokenId, "presetteam_getinfo", {}),
      tokenStore.sendMessageWithPromise(tokenId, "role_getroleinfo", {}),
    ]);

    const teamData = parseTeamData(presetTeamInfo);
    const role = roleInfo?.role || roleInfo;
    const heroData = role?.heroes || {};
    const items = role?.items || {};
    const heroList = buildHeroList(teamData, heroData);

    jadeCount.value = items["1022"]?.quantity || 0;
    colorJadeCount.value = items["1023"]?.quantity || 0;
    heroes.value = heroList;
    allHeroesData.value = heroData;

    if (!heroList.some((hero) => hero.id === selectedHeroId.value)) {
      selectedHeroId.value = null;
      selectedPart.value = null;
    } else if (selectedPart.value != null && !heroData[String(selectedHeroId.value)]?.equipment?.[selectedPart.value]) {
      selectedPart.value = null;
    }

    message.success(t("refineHelperCard.messages.refreshSuccess"));
  } catch (error) {
    message.error(t("refineHelperCard.messages.refreshFailed", { error: error.message }));
  } finally {
    loading.value = false;
  }
};

const selectHero = (heroId) => {
  selectedHeroId.value = heroId;
  selectedPart.value = null;
  quenchCount.value = 0;
};

const selectPart = (partId) => {
  selectedPart.value = partId;
  quenchCount.value = 0;
};

const handlePasswordInput = (value) => {
  password.value = value;
  passwordError.value = "";
};

const verifyPassword = async () => {
  if (!password.value) {
    passwordError.value = t("refineHelperCard.messages.enterPassword");
    return;
  }

  const token = tokenStore.selectedToken;
  if (!token) {
    message.warning(t("refineHelperCard.messages.selectTokenFirst"));
    return;
  }

  const tokenId = token.id;
  const status = tokenStore.getWebSocketStatus(tokenId);
  if (status !== "connected") {
    message.error(t("refineHelperCard.messages.wsDisconnectedVerify"));
    return;
  }

  isVerifying.value = true;
  passwordError.value = "";

  try {
    await tokenStore.sendMessageWithPromise(tokenId, "role_commitpassword", {
      password: password.value,
      passwordType: 1,
    });

    isPasswordValidated.value = true;
    message.success(t("refineHelperCard.messages.passwordVerified"));
  } catch (error) {
    passwordError.value = t("refineHelperCard.messages.verifyFailed", { error: error.message });
    message.error(t("refineHelperCard.messages.verifyPasswordFailed", { error: error.message }));
  } finally {
    isVerifying.value = false;
  }
};

const resetPasswordValidation = () => {
  isPasswordValidated.value = false;
  password.value = "";
  passwordError.value = "";
};

const updateSelectedEquip = (equip) => {
  if (selectedHeroId.value == null || selectedPart.value == null) {
    return;
  }

  const heroKey = String(selectedHeroId.value);
  const hero = allHeroesData.value[heroKey] || {};

  allHeroesData.value = {
    ...allHeroesData.value,
    [heroKey]: {
      ...hero,
      equipment: {
        ...(hero.equipment || {}),
        [selectedPart.value]: equip,
      },
    },
  };
};

const handleSlotLock = async ({ slotId, isLocked }) => {
  const token = tokenStore.selectedToken;
  if (!token || !selectedHeroId.value || !selectedPart.value) {
    message.warning(t("refineHelperCard.messages.selectHeroAndEquip"));
    return;
  }

  if (!isLocked && !isPasswordValidated.value) {
    message.warning(t("refineHelperCard.messages.verifyPasswordBeforeUnlock"));
    return;
  }

  const tokenId = token.id;
  try {
    await tokenStore.sendMessageWithPromise(
      tokenId,
      "equipment_updatequenchlock",
      {
        heroId: selectedHeroId.value,
        part: selectedPart.value,
        slot: slotId,
        isLocked,
      },
    );

    const currentEquip = selectedEquip.value;
    const currentSlots = currentEquip?.quenches || {};
    updateSelectedEquip({
      ...currentEquip,
      quenches: {
        ...currentSlots,
        [slotId]: {
          ...currentSlots[slotId],
          isLocked,
          locked: isLocked,
        },
      },
    });

    message.success(
      isLocked
        ? t("refineHelperCard.messages.slotLocked")
        : t("refineHelperCard.messages.slotUnlocked"),
    );
  } catch (error) {
    message.error(t("refineHelperCard.messages.lockSlotFailed", { error: error.message }));
  }
};

const addCondition = () => {
  targetConditions.value.push({
    attrId: null,
    attrValue: null,
  });
};

const removeCondition = (index) => {
  if (targetConditions.value.length <= 1) {
    message.warning(t("refineHelperCard.messages.keepOneCondition"));
    return;
  }

  targetConditions.value.splice(index, 1);
};

const updateConditionAttr = ({ index, value }) => {
  targetConditions.value[index].attrId = value;
};

const updateConditionValue = ({ index, value }) => {
  targetConditions.value[index].attrValue = value;
};

const updateDelay = (value) => {
  delay.value = value ?? 0;
};

const getEquipFromResult = (result) => {
  if (result?.equipment) {
    return result.equipment;
  }

  if (result?.role?.heroes) {
    const updatedHero = result.role.heroes[String(selectedHeroId.value)];
    if (updatedHero?.equipment) {
      return updatedHero.equipment[selectedPart.value];
    }
  }

  if (result?.quenches && selectedEquip.value) {
    return {
      ...selectedEquip.value,
      quenches: result.quenches,
      quenchTimes: (selectedEquip.value.quenchTimes || 0) + 1,
    };
  }

  return selectedEquip.value;
};

const checkHighQualityAttr = (result) => {
  const equip = getEquipFromResult(result);
  if (!equip?.quenches) {
    return false;
  }

  return Object.values(equip.quenches).some((slot) => slot.colorId && slot.colorId >= 5);
};

const checkTargetAttr = (result) => {
  const validConditions = targetConditions.value.filter(
    (condition) => condition.attrId && condition.attrValue,
  );

  if (validConditions.length === 0) {
    return false;
  }

  const equip = getEquipFromResult(result);
  if (!equip?.quenches) {
    return false;
  }

  const slots = Object.values(equip.quenches);
  return validConditions.some((condition) =>
    slots.some((slot) =>
      slot.attrId === condition.attrId && slot.attrNum >= condition.attrValue,
    ),
  );
};

const executeQuench = async () => {
  const token = tokenStore.selectedToken;
  if (!token) {
    message.warning(t("refineHelperCard.messages.selectTokenFirst"));
    return null;
  }

  if (!selectedHeroId.value || !selectedPart.value) {
    message.warning(t("refineHelperCard.messages.selectHeroAndPart"));
    return null;
  }

  const tokenId = token.id;
  const status = tokenStore.getWebSocketStatus(tokenId);
  if (status !== "connected") {
    message.error(t("refineHelperCard.messages.wsDisconnectedQuench"));
    return null;
  }

  if (selectedPart.value === 1 && (selectedEquip.value?.level || 0) < 4000) {
    message.warning(
      t("refineHelperCard.messages.weaponLevelInsufficient", {
        level: selectedEquip.value?.level || 0,
      }),
    );
    return null;
  }

  const currentEquip = selectedEquip.value;
  if (!currentEquip?.quenches) {
    message.error(t("refineHelperCard.messages.equipmentSlotsMissing"));
    return null;
  }

  try {
    const highAttrSlots = Object.values(currentEquip.quenches).filter(
      (slot) => slot.attrNum > 50 && !(slot.isLocked || slot.locked),
    );
    const hasHighAttrSlot = highAttrSlots.length > 0;
    let seedFromConfirm = 0;

    if (hasHighAttrSlot) {
      const confirmResult = await tokenStore.sendMessageWithPromise(
        tokenId,
        "equipment_confirm",
        {
          heroId: selectedHeroId.value,
          part: selectedPart.value,
          quenchId: 0,
          quenches: currentEquip.quenches,
        },
        15000,
      );

      if (confirmResult?.role?.heroes) {
        const hero = confirmResult.role.heroes[String(selectedHeroId.value)];
        if (hero?.equipment?.[selectedPart.value]?.seed) {
          seedFromConfirm = hero.equipment[selectedPart.value].seed;
        }
      } else if (confirmResult?.seed) {
        seedFromConfirm = confirmResult.seed;
      } else if (confirmResult?.equipment?.seed) {
        seedFromConfirm = confirmResult.equipment.seed;
      }
    }

    const result = await tokenStore.sendMessageWithPromise(
      tokenId,
      "equipment_quench",
      {
        heroId: selectedHeroId.value,
        part: selectedPart.value,
        quenchId: 0,
        quenches: currentEquip.quenches,
        seed: seedFromConfirm,
        skipOrange: false,
      },
      15000,
    );

    quenchCount.value += 1;

    const updatedEquip = getEquipFromResult(result);
    if (updatedEquip) {
      updateSelectedEquip(updatedEquip);
    }

    if (result?.role?.items) {
      const items = result.role.items;
      jadeCount.value = items["1022"]?.quantity || jadeCount.value;
      colorJadeCount.value = items["1023"]?.quantity || colorJadeCount.value;
    }

    return result;
  } catch (error) {
    message.error(t("refineHelperCard.messages.quenchFailed", { error: error.message }));
    return null;
  }
};

const quenchOnce = async () => {
  await executeQuench();
};

const stopQuench = ({ silent = false } = {}) => {
  state.value.continuousQuenching = false;
  state.value.autoQuenching = false;
  state.value.isRunning = false;
  clearQuenchTimers();

  if (!silent) {
    message.success(t("refineHelperCard.messages.quenchStopped"));
  }
};

const quenchContinuous = () => {
  if (state.value.continuousQuenching) {
    return;
  }

  if (!selectedHeroId.value || !selectedPart.value) {
    message.warning(t("refineHelperCard.messages.selectHeroAndPart"));
    return;
  }

  state.value.continuousQuenching = true;
  state.value.isRunning = true;
  message.info(t("refineHelperCard.messages.continuousStarted"));

  const run = async () => {
    if (!state.value.continuousQuenching) {
      return;
    }

    try {
      const result = await executeQuench();
      if (result && checkHighQualityAttr(result)) {
        message.success(t("refineHelperCard.messages.continuousAutoStopped"));
        stopQuench();
        return;
      }

      const randomDelay = Math.floor(Math.random() * 150) + delay.value;
      continuousTimer = setTimeout(run, randomDelay);
    } catch (error) {
      message.error(t("refineHelperCard.messages.continuousFailed", { error: error.message }));
      stopQuench();
    }
  };

  void run();
};

const startAutoQuench = () => {
  const hasValidCondition = targetConditions.value.some(
    (condition) => condition.attrId !== null && condition.attrValue !== null,
  );

  if (!hasValidCondition) {
    message.warning(t("refineHelperCard.messages.setValidCondition"));
    return;
  }

  if (!selectedHeroId.value || !selectedPart.value) {
    message.warning(t("refineHelperCard.messages.selectHeroAndPart"));
    return;
  }

  state.value.autoQuenching = true;
  state.value.isRunning = true;

  const conditionDescriptions = targetConditions.value
    .filter((condition) => condition.attrId && condition.attrValue)
    .map((condition) => `${getAttrName(condition.attrId)} ≥ ${condition.attrValue}`);

  message.info(
    t("refineHelperCard.messages.autoStarted", {
      conditions: conditionDescriptions.join(t("refineHelperCard.common.or")),
    }),
  );

  const run = async () => {
    if (!state.value.autoQuenching) {
      return;
    }

    try {
      const result = await executeQuench();
      if (result && checkTargetAttr(result)) {
        message.success(t("refineHelperCard.messages.autoStoppedOnTarget"));
        stopQuench();
        return;
      }

      const randomDelay = Math.floor(Math.random() * 150) + delay.value;
      autoTimer = setTimeout(run, randomDelay);
    } catch (error) {
      message.error(t("refineHelperCard.messages.autoFailed", { error: error.message }));
      stopQuench();
    }
  };

  void run();
};

const resetCount = () => {
  quenchCount.value = 0;
  message.success(t("refineHelperCard.messages.resetDone"));
};

onBeforeUnmount(() => {
  stopQuench({ silent: true });
});
</script>

<style scoped lang="scss">
.refine-toolbar-actions {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.refine-summary-grid {
  align-items: stretch;
}

.summary-card {
  align-items: stretch;
}

.summary-card__label {
  color: var(--text-tertiary);
  font-size: var(--font-size-xs);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.summary-card__value {
  color: var(--text-primary);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
  overflow-wrap: anywhere;
}

@media (max-width: 959px) {
  .refine-toolbar-actions {
    grid-template-columns: 1fr;
  }
}
</style>
