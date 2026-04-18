<template>
  <div
    class="gwb2-mini-card team-formation-card"
    :data-panel-active="panelActive ? 'true' : 'false'"
  >
    <div class="gwb2-mini-card__surface">
      <div class="gwb2-mini-card__toolbar team-formation-card__toolbar">
        <div class="gwb2-mini-card__toolbar-main">
          <img
            alt="阵容"
            class="icon"
            src="/icons/Ob7pyorzmHiJcbab2c25af264d0758b527bc1b61cc3b.png"
          >
          <div class="info">
            <h3>阵容</h3>
            <p>当前使用的战斗阵容</p>
          </div>
        </div>
        <div class="gwb2-mini-card__toolbar-side team-formation-card__controls">
          <div
            class="gwb2-mini-card__chip team-formation-card__status-chip"
            :class="{ 'team-formation-card__status-chip--connected': wsStatus === 'connected' }"
          >
            <div class="gwb2-mini-card__chip-dot"></div>
            <span>{{ wsStatus === "connected" ? "阵容已同步" : "等待连接" }}</span>
          </div>

          <div class="gwb2-mini-card__segmented team-selector">
            <button
              v-for="teamId in availableTeams"
              :key="teamId"
              class="team-segment"
              type="button"
              :aria-pressed="currentTeam === teamId"
              :class="{ active: currentTeam === teamId }"
              :disabled="loading || switching"
              @click="selectTeam(teamId)"
            >
              {{ teamId }}
            </button>
          </div>
          <n-button
            quaternary
            class="refresh-button"
            size="small"
            title="刷新队伍数据"
            :disabled="loading"
            @click="refreshTeamData(true)"
          >
            <template #icon>
              <svg
                class="refresh-icon"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                viewBox="0 0 24 24"
              >
                <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                <path d="M21 3v5h-5" />
                <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                <path d="M3 21v-5h5" />
              </svg>
            </template>
            <span class="refresh-text">刷新</span>
          </n-button>
        </div>
      </div>

      <div class="gwb2-mini-card__body team-formation-card__body">
        <div class="gwb2-mini-card__metric current-team-info">
          <span class="label">当前阵容</span>
          <span class="team-number">
            <template v-if="!loading">阵容 {{ currentTeam }}</template>
            <template v-else>加载中…</template>
          </span>
        </div>

        <div class="gwb2-mini-card__list heroes-container">
          <div v-if="!loading" class="heroes-formation">
            <div class="formation-row front-row">
              <div
                v-for="hero in frontHeroes"
                :key="hero.id || hero.name"
                class="hero-item"
              >
                <div class="hero-circle">
                  <img
                    v-if="hero.avatar"
                    class="hero-avatar"
                    :alt="hero.name"
                    :src="hero.avatar"
                  >
                  <div v-else class="hero-placeholder">
                    {{ hero.name?.substring(0, 2) || "?" }}
                  </div>
                </div>
                <span class="hero-name">{{ hero.name || "未知" }}</span>
              </div>
            </div>

            <div class="formation-row back-row">
              <div
                v-for="hero in backHeroes"
                :key="hero.id || hero.name"
                class="hero-item"
              >
                <div class="hero-circle">
                  <img
                    v-if="hero.avatar"
                    class="hero-avatar"
                    :alt="hero.name"
                    :src="hero.avatar"
                  >
                  <div v-else class="hero-placeholder">
                    {{ hero.name?.substring(0, 2) || "?" }}
                  </div>
                </div>
                <span class="hero-name">{{ hero.name || "未知" }}</span>
              </div>
            </div>
          </div>

          <div v-if="!loading && !hasCurrentTeamHeroes" class="gwb2-mini-card__empty empty-team">
            <p>暂无队伍信息</p>
          </div>
          <div v-if="loading" class="gwb2-mini-card__empty empty-team">
            <p>正在加载队伍信息…</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, toRef, watch } from "vue";
import { useGameCardPanelActive } from "@/composables/gameCards/useGameCardPanelActive";
import { useTokenStore } from "@/stores/tokenStore";
import { useMessage } from "naive-ui/es";
import { HERO_DICT } from "@/utils/HeroList.js";

const props = withDefaults(defineProps<{
  panelActive?: boolean;
}>(), {
  panelActive: true,
});

const tokenStore = useTokenStore();
const message = useMessage();
const { panelActive } = useGameCardPanelActive(toRef(props, "panelActive"));

const loading = ref(false);
const switching = ref(false);
const currentTeam = ref(1);
const availableTeams = ref<number[]>([1, 2, 3, 4, 5, 6]);
const frontHeroes = ref<any[]>([]);
const backHeroes = ref<any[]>([]);
const pendingTeamRefresh = ref(false);
let connectRefreshHandle: ReturnType<typeof setTimeout> | null = null;

const wsStatus = computed(() => {
  if (!tokenStore.selectedToken)
    return "disconnected";
  return tokenStore.getWebSocketStatus(tokenStore.selectedToken.id);
});

const presetTeamRaw = computed(() => tokenStore.gameData?.presetTeam ?? null);

function normalizePresetTeam(raw: any) {
  if (!raw) {
    return {
      useTeamId: 1,
      teams: {} as Record<number, { teamInfo: Record<string, any> }>,
    };
  }
  const root = raw.presetTeamInfo ?? raw;
  const findUseIdRec = (obj: any): number | null => {
    if (!obj || typeof obj !== "object")
      return null;
    if (typeof obj.useTeamId === "number")
      return obj.useTeamId;
    for (const k of Object.keys(obj)) {
      const v = findUseIdRec(obj[k]);
      if (v)
        return v;
    }
    return null;
  };
  const useTeamId
    = root.useTeamId ?? root.presetTeamInfo?.useTeamId ?? findUseIdRec(root) ?? 1;

  const dict = root.presetTeamInfo ?? root;
  const teams: Record<number, { teamInfo: Record<string, any> }> = {};
  const ids = Object.keys(dict || {}).filter((k) => /^\d+$/.test(k));
  for (const idStr of ids) {
    const id = Number(idStr);
    const node = dict[idStr];
    if (!node) {
      teams[id] = { teamInfo: {} };
      continue;
    }
    if (node.teamInfo) {
      teams[id] = { teamInfo: node.teamInfo };
    } else if (node.heroes) {
      const ti: Record<string, any> = {};
      node.heroes.forEach((h: any, idx: number) => {
        ti[String(idx + 1)] = h;
      });
      teams[id] = { teamInfo: ti };
    } else if (typeof node === "object") {
      const hasHero = Object.values(node).some(
        (v: any) => v && typeof v === "object" && "heroId" in v,
      );
      teams[id] = { teamInfo: hasHero ? node : {} };
    } else {
      teams[id] = { teamInfo: {} };
    }
  }
  return { useTeamId: Number(useTeamId) || 1, teams };
}

const buildTeamHeroes = (teamInfo: Record<string, any> | undefined | null) => {
  if (!teamInfo)
    return [] as any[];
  const heroes: any[] = [];
  for (const [pos, hero] of Object.entries(teamInfo)) {
    const hid = (hero as any)?.heroId ?? (hero as any)?.id;
    if (!hid)
      continue;
    const meta = HERO_DICT[Number(hid)];
    const avatarPath = meta?.avatar;
    const fullAvatarPath = avatarPath
      ? import.meta.env.BASE_URL + avatarPath.replace(/^\//, "")
      : undefined;
    heroes.push({
      id: Number(hid),
      name: meta?.name ?? `英雄${hid}`,
      type: meta?.type ?? "",
      position: Number(pos),
      level: (hero as any)?.level ?? 1,
      avatar: fullAvatarPath,
    });
  }
  heroes.sort((a, b) => a.position - b.position);
  return heroes;
};

const normalizedPresetTeam = ref(normalizePresetTeam(null));
const hasCurrentTeamHeroes = computed(() =>
  frontHeroes.value.length + backHeroes.value.length > 0,
);

const executeGameCommand = async (
  tokenId: string | number,
  cmd: string,
  params = {},
  description = "",
  timeout = 8000,
) => {
  try {
    return await tokenStore.sendMessageWithPromise(
      String(tokenId),
      cmd,
      params,
      timeout,
    );
  } catch (error: any) {
    if (description)
      message.error(`${description}失败：${error?.message ?? error}`);
    throw error;
  }
};

const getTeamInfoWithCache = async (force = false) => {
  if (!tokenStore.selectedToken) {
    message.warning("请先选择Token");
    return null;
  }
  const tokenId = tokenStore.selectedToken.id;
  if (!force) {
    const cached = (tokenStore.gameData as any)?.presetTeam?.presetTeamInfo;
    if (cached)
      return cached;
  }
  loading.value = true;
  try {
    const result = await executeGameCommand(
      tokenId,
      "presetteam_getinfo",
      {},
      "获取阵容信息",
    );
    tokenStore.$patch((state: any) => {
      state.gameData = { ...(state.gameData ?? {}), presetTeam: result };
    });
    return result?.presetTeamInfo ?? null;
  } catch {
    return null;
  } finally {
    loading.value = false;
  }
};

const syncTeamRows = () => {
  const teamInfo = normalizedPresetTeam.value.teams[currentTeam.value]?.teamInfo;
  const heroes = buildTeamHeroes(teamInfo);
  frontHeroes.value = heroes.slice(0, 2);
  backHeroes.value = heroes.slice(2);
};

const applyPresetTeamState = (raw: any = presetTeamRaw.value) => {
  normalizedPresetTeam.value = normalizePresetTeam(raw);
  const ids = Object.keys(normalizedPresetTeam.value.teams)
    .map(Number)
    .filter((n) => !Number.isNaN(n))
    .sort((a, b) => a - b);
  availableTeams.value = ids.length ? ids : [1, 2, 3, 4, 5, 6];
  const nextTeam = normalizedPresetTeam.value.useTeamId || availableTeams.value[0] || 1;
  if (!availableTeams.value.includes(currentTeam.value) || !switching.value) {
    currentTeam.value = nextTeam;
  }
  syncTeamRows();
};

const selectTeam = async (teamId: number) => {
  if (switching.value || loading.value)
    return;
  if (teamId === currentTeam.value)
    return;
  if (!tokenStore.selectedToken) {
    message.warning("请先选择Token");
    return;
  }
  const prev = currentTeam.value;
  switching.value = true;
  try {
    await executeGameCommand(
      tokenStore.selectedToken.id,
      "presetteam_saveteam",
      { teamId },
      `切换到阵容 ${teamId}`,
    );
    currentTeam.value = teamId;
    message.success(`已切换到阵容 ${teamId}`);
    await refreshTeamData(true);
  } catch (e) {
    currentTeam.value = prev;
  } finally {
    switching.value = false;
  }
};

const refreshTeamData = async (force = false) => {
  const result = await getTeamInfoWithCache(force);
  if (panelActive.value) {
    applyPresetTeamState(result);
    pendingTeamRefresh.value = false;
    return;
  }
  pendingTeamRefresh.value = true;
};

onMounted(async () => {
  if (tokenStore.selectedToken && wsStatus.value === "connected") {
    await refreshTeamData(false);
    if (!presetTeamRaw.value) {
      await refreshTeamData(true);
    }
  }
});

watch(currentTeam, () => {
  syncTeamRows();
});

watch(wsStatus, (newStatus, oldStatus) => {
  if (
    newStatus === "connected"
    && oldStatus !== "connected"
    && tokenStore.selectedToken
  ) {
    if (connectRefreshHandle) {
      clearTimeout(connectRefreshHandle);
    }
    connectRefreshHandle = setTimeout(async () => {
      if (!panelActive.value) {
        pendingTeamRefresh.value = true;
        return;
      }
      await refreshTeamData(false);
      if (!presetTeamRaw.value) {
        await refreshTeamData(true);
      }
    }, 1000);
  }
});

watch(
  () => tokenStore.selectedToken,
  async (newToken, oldToken) => {
    if (newToken && newToken.id !== (oldToken as any)?.id) {
      const status = tokenStore.getWebSocketStatus(newToken.id);
      if (status === "connected") {
        await refreshTeamData(true);
      }
    }
  },
);

watch(
  presetTeamRaw,
  () => {
    if (!panelActive.value) {
      pendingTeamRefresh.value = true;
      return;
    }
    applyPresetTeamState();
  },
  { immediate: true },
);

watch(
  panelActive,
  async (active) => {
    if (!active || !pendingTeamRefresh.value) {
      return;
    }
    await refreshTeamData(false);
    if (pendingTeamRefresh.value) {
      applyPresetTeamState();
      pendingTeamRefresh.value = false;
    }
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  if (connectRefreshHandle) {
    clearTimeout(connectRefreshHandle);
    connectRefreshHandle = null;
  }
});
</script>

<style scoped lang="scss">
.team-formation-card {
  min-height: 220px;
}

.team-formation-card__toolbar {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-md);
}

.icon {
  width: 32px;
  height: 32px;
  object-fit: contain;
  flex-shrink: 0;
}

.info h3 {
  margin: 0 0 2px 0;
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
}

.info p {
  margin: 0;
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
}

.refresh-button {
  gap: 6px;
}

.team-formation-card__controls {
  gap: 12px;
}

.team-formation-card__status-chip--connected {
  color: var(--success-color);
}

.team-selector {
  flex-wrap: wrap;
}

.team-segment {
  min-width: 42px;
}

.refresh-icon {
  width: 14px;
  height: 14px;
  transition: transform var(--transition-fast, 0.15s ease);
}

.refresh-button:not(:disabled):hover .refresh-icon {
  transform: rotate(180deg);
}

.refresh-button:disabled .refresh-icon {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

.team-formation-card__body .current-team-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.team-formation-card__body .label {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}

.team-formation-card__body .team-number {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
  color: var(--text-primary);
}

.heroes-container {
  min-height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.heroes-formation {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  align-items: center;
  width: 100%;
}

.formation-row {
  display: flex;
  gap: var(--spacing-lg);
  justify-content: center;
  width: 100%;
}

.hero-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  min-width: 64px;
}

.hero-circle {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  border: 1px solid rgba(78, 94, 116, 0.14);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.18), rgba(214, 224, 234, 0.18)),
    rgba(240, 245, 249, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.hero-avatar {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.hero-placeholder {
  font-size: 12px;
  color: var(--text-secondary);
}

.hero-name {
  font-size: 12px;
  color: var(--text-secondary);
  text-align: center;
  min-width: 90px;
  max-width: 140px;
  white-space: nowrap;
}

.empty-team {
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
}

@media (max-width: 959px) {
  .refresh-button {
    min-height: 36px;
    padding: 0 12px;
  }

  .team-formation-card__toolbar {
    flex-direction: column;
    gap: var(--spacing-sm);
    text-align: center;
    align-items: center;
  }

  .team-selector {
    width: 100%;
    gap: 6px;
  }

  .team-formation-card__controls {
    width: 100%;
    justify-content: space-between;
  }

  .heroes-container {
    padding: var(--spacing-xs);
  }

  .heroes-formation {
    gap: var(--spacing-xs);
  }

  .formation-row {
    gap: 8px;
  }

  .hero-item {
    min-width: 52px;
    gap: 2px;
  }

  .hero-circle {
    width: 36px;
    height: 36px;
    border-radius: 10px;
  }

  .hero-name {
    font-size: 10px;
    min-width: 0;
    max-width: 52px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .team-segment {
    min-width: 34px;
    min-height: 32px;
    padding: 0 8px;
  }
}
</style>
