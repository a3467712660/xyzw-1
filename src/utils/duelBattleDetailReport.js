const DEFAULT_SLOT_COUNT = 5;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const toNumber = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const getFirstFinite = (...values) => {
  for (const value of values) {
    const num = Number(value);
    if (Number.isFinite(num)) {
      return num;
    }
  }
  return null;
};

const getFirstNonEmptyString = (...values) => {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) {
      return text;
    }
  }
  return "";
};

const resolveHolyBeastLevel = (hero) =>
  toNumber(
    hero?.HBlevel,
    toNumber(hero?.hB?.order, toNumber(hero?.fourBasest?.level, 0)),
  );

const resolveHolyBeastActive = (hero) => {
  if (!hero || typeof hero !== "object") {
    return false;
  }
  if (hero.HolyBeast === true) {
    return true;
  }
  if (hero?.hB?.active === true) {
    return true;
  }
  return resolveHolyBeastLevel(hero) > 0;
};

const detectOneBasedSlots = (slotValues) => {
  const normalized = slotValues
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));

  if (!normalized.length) {
    return false;
  }

  if (normalized.some((value) => value === 0)) {
    return false;
  }

  return normalized.every((value) => value >= 1 && value <= DEFAULT_SLOT_COUNT);
};

const normalizeSlotIndex = (value, { oneBased = false } = {}) => {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return null;
  }

  const slot = oneBased ? num - 1 : num;
  if (slot < 0) {
    return null;
  }
  return slot;
};

const toCollectionEntries = (collection) => {
  if (!collection) {
    return [];
  }

  if (Array.isArray(collection)) {
    return collection.map((item, index) => ({
      key: String(index),
      value: item,
      index,
    }));
  }

  if (typeof collection === "object") {
    return Object.entries(collection).map(([key, value], index) => ({
      key,
      value,
      index,
    }));
  }

  return [];
};

const normalizeSlottedCollection = (
  collection,
  {
    preferredSlotKeys = [],
    heroIdKeys = [],
  } = {},
) => {
  const entries = toCollectionEntries(collection);
  const slotCandidates = entries.map(({ key, value, index }) =>
    getFirstFinite(
      ...preferredSlotKeys.map((slotKey) => value?.[slotKey]),
      key,
      index,
    ),
  );
  const oneBased = detectOneBasedSlots(slotCandidates);

  return entries.map(({ key, value, index }) => {
    const rawSlot = getFirstFinite(
      ...preferredSlotKeys.map((slotKey) => value?.[slotKey]),
      key,
      index,
    );
    const slot = normalizeSlotIndex(rawSlot, { oneBased });
    const heroId = getFirstFinite(
      ...heroIdKeys.map((heroIdKey) => value?.[heroIdKey]),
    );

    return {
      key,
      index,
      slot,
      heroId,
      raw: value,
    };
  });
};

const normalizeBaseTeamInfo = (teamInfo) =>
  normalizeSlottedCollection(teamInfo, {
    preferredSlotKeys: ["index", "slot", "battleTeamSlot"],
    heroIdKeys: ["heroId", "id"],
  });

const normalizeResultTeamInfo = (teamInfo) =>
  normalizeSlottedCollection(teamInfo, {
    preferredSlotKeys: ["slot", "index", "battleTeamSlot"],
    heroIdKeys: ["heroId", "id"],
  });

const normalizeBattleSnapshotTeam = (teamInfo) =>
  normalizeSlottedCollection(teamInfo, {
    preferredSlotKeys: ["index", "slot", "battleTeamSlot"],
    heroIdKeys: ["id", "heroId"],
  });

const buildHeroLookupMaps = (heroList) => {
  const bySlot = new Map();
  const byHeroId = new Map();

  heroList.forEach((hero, index) => {
    const normalizedHero = {
      ...hero,
      __index: index,
    };

    if (Number.isFinite(hero.battleTeamSlot)) {
      bySlot.set(hero.battleTeamSlot, normalizedHero);
    }

    if (Number.isFinite(hero.heroId)) {
      if (!byHeroId.has(hero.heroId)) {
        byHeroId.set(hero.heroId, []);
      }
      byHeroId.get(hero.heroId).push(normalizedHero);
    }
  });

  return { bySlot, byHeroId };
};

const findHeroById = (lookupMap, heroId) => {
  if (!Number.isFinite(heroId) || !lookupMap.has(heroId)) {
    return null;
  }

  const heroes = lookupMap.get(heroId);
  return Array.isArray(heroes) && heroes.length > 0 ? heroes[0] : null;
};

const resolveRoleNode = (raw) =>
  raw?.role || raw?.roleInfo || raw?.role_info || raw || {};

const normalizeSideIdentity = (side) => ({
  roleId: side?.roleId ?? "",
  name: side?.name || "",
  headImg: side?.headImg || "",
  powerText: side?.powerText || "0",
  serverName: side?.serverName || "",
  heroList: Array.isArray(side?.heroList) ? side.heroList : [],
});

const buildPearlSlots = (slotMap) => {
  if (!Array.isArray(slotMap)) {
    return [];
  }

  return slotMap
    .map((slot, index) => ({
      id: slot?.id ?? `${slot?.colorId || "slot"}-${index}`,
      colorId: Number(slot?.colorId || 0),
      colorValue: slot?.value || "",
      colorName: slot?.color || "",
    }))
    .filter((slot) => slot.colorId > 0 || slot.colorValue);
};

const buildHeroMeta = ({
  heroId,
  battleTeamSlot,
  sourceHero,
  HERO_DICT,
  fishInfoMap,
  formatPower,
}) => {
  const meta = HERO_DICT?.[heroId] || {};
  const artifactId = sourceHero?.artifactId;
  const pearlInfo = artifactId ? fishInfoMap?.[artifactId] || {} : {};

  return {
    heroId: Number.isFinite(heroId) ? heroId : 0,
    heroName: getFirstNonEmptyString(sourceHero?.heroName, meta?.name, "未知武将"),
    heroAvatar: getFirstNonEmptyString(sourceHero?.heroAvate, sourceHero?.heroAvatar, meta?.avatar),
    battleTeamSlot: Number.isFinite(battleTeamSlot) ? battleTeamSlot : null,
    star: toNumber(sourceHero?.star, 0),
    order: toNumber(sourceHero?.order, 0),
    HolyBeast: resolveHolyBeastActive(sourceHero),
    HBlevel: resolveHolyBeastLevel(sourceHero),
    skin: toNumber(sourceHero?.skin, 0),
    artifactId: artifactId || null,
    fishName: pearlInfo?.FishInfo?.name || "",
    pearlSkillName: pearlInfo?.PearlSkill?.name || "",
    pearlSlots: buildPearlSlots(pearlInfo?.slotMap),
    powerText: formatPower ? formatPower(toNumber(sourceHero?.power, 0)) : String(toNumber(sourceHero?.power, 0)),
    raw: sourceHero || null,
  };
};

const buildFallbackHeroMeta = ({
  heroId,
  battleTeamSlot,
  snapshotHero,
  resultHero,
  HERO_DICT,
}) => {
  const meta = HERO_DICT?.[heroId] || {};
  const source = resultHero || snapshotHero || {};

  return {
    heroId: Number.isFinite(heroId) ? heroId : 0,
    heroName: meta?.name || "未知武将",
    heroAvatar: meta?.avatar || "",
    battleTeamSlot: Number.isFinite(battleTeamSlot) ? battleTeamSlot : null,
    star: toNumber(source?.star, 0),
    order: toNumber(source?.order, 0),
    HolyBeast: resolveHolyBeastActive(source),
    HBlevel: resolveHolyBeastLevel(source),
    fishName: "",
    pearlSkillName: "",
    pearlSlots: [],
    raw: source || null,
  };
};

const buildOverviewHeroListFallback = (rows) =>
  (Array.isArray(rows) ? rows : [])
    .filter((row) => row?.heroId)
    .map((row) => ({
      heroId: row.heroId,
      heroName: row.heroName,
      heroAvatar: row.heroAvatar,
      battleTeamSlot: row.battleTeamSlot,
      star: row.star,
      order: row.order,
      HolyBeast: !!row.HolyBeast,
      HBlevel: toNumber(row.HBlevel, 0),
      fishName: row.fishName || "",
      pearlSkillName: row.pearlSkillName || "",
      pearlSlots: Array.isArray(row.pearlSlots) ? row.pearlSlots : [],
      raw: row.raw || null,
    }))
    .sort((a, b) => a.battleTeamSlot - b.battleTeamSlot);

const reorderHeroListBySlots = (heroList, battleTeam) => {
  if (!Array.isArray(heroList) || heroList.length === 0) {
    return [];
  }

  const snapshotList = normalizeBattleSnapshotTeam(battleTeam)
    .filter((item) => Number.isFinite(item.slot))
    .sort((a, b) => a.slot - b.slot);
  if (!snapshotList.length) {
    return [...heroList].sort((a, b) => {
      const slotA = Number.isFinite(a.battleTeamSlot) ? a.battleTeamSlot : Number.MAX_SAFE_INTEGER;
      const slotB = Number.isFinite(b.battleTeamSlot) ? b.battleTeamSlot : Number.MAX_SAFE_INTEGER;
      return slotA - slotB;
    });
  }

  const lookup = buildHeroLookupMaps(heroList);
  const usedIndexes = new Set();
  const ordered = [];

  snapshotList.forEach((snapshotHero, index) => {
    let matched = lookup.bySlot.get(snapshotHero.slot) || null;

    if (!matched && Number.isFinite(snapshotHero.heroId)) {
      const byHeroId = lookup.byHeroId.get(snapshotHero.heroId) || [];
      matched = byHeroId.find((hero) => !usedIndexes.has(hero.__index)) || null;
    }

    if (!matched) {
      matched = heroList.find((hero, heroIndex) => !usedIndexes.has(heroIndex)) || null;
      if (matched) {
        matched = {
          ...matched,
          __index: heroList.indexOf(matched),
          battleTeamSlot: snapshotHero.slot,
        };
      }
    }

    if (matched) {
      usedIndexes.add(matched.__index);
      ordered.push({
        ...matched,
        battleTeamSlot: Number.isFinite(matched.battleTeamSlot) ? matched.battleTeamSlot : snapshotHero.slot ?? index,
      });
    }
  });

  heroList.forEach((hero, index) => {
    if (!usedIndexes.has(index)) {
      ordered.push({
        ...hero,
        battleTeamSlot: Number.isFinite(hero.battleTeamSlot) ? hero.battleTeamSlot : ordered.length,
      });
    }
  });

  return ordered.sort((a, b) => {
    const slotA = Number.isFinite(a.battleTeamSlot) ? a.battleTeamSlot : Number.MAX_SAFE_INTEGER;
    const slotB = Number.isFinite(b.battleTeamSlot) ? b.battleTeamSlot : Number.MAX_SAFE_INTEGER;
    return slotA - slotB;
  });
};

export function normalizePresetTeamBundle(raw) {
  if (!raw) {
    return { useTeamId: 1, teams: {} };
  }

  const root = raw.presetTeamInfo ?? raw;
  const findUseIdRec = (obj) => {
    if (!obj || typeof obj !== "object") {
      return null;
    }
    if (typeof obj.useTeamId === "number") {
      return obj.useTeamId;
    }
    for (const key of Object.keys(obj)) {
      const found = findUseIdRec(obj[key]);
      if (found) {
        return found;
      }
    }
    return null;
  };

  const useTeamId = Number(
    root.useTeamId ?? root.presetTeamInfo?.useTeamId ?? findUseIdRec(root) ?? 1,
  ) || 1;

  const dict = root.presetTeamInfo ?? root;
  const teams = {};
  const ids = Object.keys(dict || {}).filter((key) => /^\d+$/.test(key));

  ids.forEach((idStr) => {
    const id = Number(idStr);
    const node = dict[idStr];
    if (!node) {
      teams[id] = { teamInfo: {} };
      return;
    }

    if (node.teamInfo) {
      teams[id] = { teamInfo: node.teamInfo };
      return;
    }

    if (Array.isArray(node.heroes)) {
      const teamInfo = {};
      node.heroes.forEach((hero, index) => {
        teamInfo[String(index + 1)] = hero;
      });
      teams[id] = { teamInfo };
      return;
    }

    if (typeof node === "object") {
      const hasHero = Object.values(node).some(
        (value) => value && typeof value === "object" && ("heroId" in value || "id" in value),
      );
      teams[id] = { teamInfo: hasHero ? node : {} };
      return;
    }

    teams[id] = { teamInfo: {} };
  });

  return {
    useTeamId,
    teams,
  };
}

export function buildSelfSideFromRoleInfo({
  roleInfoRaw,
  presetTeamRaw,
  HERO_DICT,
  HeroFillInfo,
  formatPower,
}) {
  const roleNode = resolveRoleNode(roleInfoRaw);
  const presetTeam = normalizePresetTeamBundle(presetTeamRaw);
  const currentTeam
    = presetTeam.teams[presetTeam.useTeamId]
      || presetTeam.teams[String(presetTeam.useTeamId)]
      || Object.values(presetTeam.teams)[0]
      || { teamInfo: {} };

  const roleHeroes = Array.isArray(roleNode?.heroes)
    ? roleNode.heroes
    : Object.values(roleNode?.heroes || {});
  const fishInfoMap = HeroFillInfo ? HeroFillInfo(roleNode) : {};
  const baseTeamHeroes = normalizeBaseTeamInfo(currentTeam?.teamInfo);
  const usedRoleHeroIndexes = new Set();

  const heroList = baseTeamHeroes
    .sort((a, b) => {
      const slotA = Number.isFinite(a.slot) ? a.slot : Number.MAX_SAFE_INTEGER;
      const slotB = Number.isFinite(b.slot) ? b.slot : Number.MAX_SAFE_INTEGER;
      return slotA - slotB;
    })
    .map((teamHero, index) => {
      const presetHeroId = getFirstFinite(teamHero?.raw?.heroId, teamHero?.raw?.id);
      let roleHero = roleHeroes.find((hero, heroIndex) => {
        if (usedRoleHeroIndexes.has(heroIndex)) {
          return false;
        }
        return getFirstFinite(hero?.heroId, hero?.id) === presetHeroId;
      });

      if (!roleHero && Number.isFinite(teamHero.slot)) {
        roleHero = roleHeroes.find((hero, heroIndex) => {
          if (usedRoleHeroIndexes.has(heroIndex)) {
            return false;
          }
          const rawSlot = getFirstFinite(hero?.battleTeamSlot, hero?.slot, hero?.index);
          const oneBased = detectOneBasedSlots(
            roleHeroes.map((item) => getFirstFinite(item?.battleTeamSlot, item?.slot, item?.index)),
          );
          return normalizeSlotIndex(rawSlot, { oneBased }) === teamHero.slot;
        });
      }

      if (!roleHero) {
        roleHero = roleHeroes.find((hero, heroIndex) => {
          if (usedRoleHeroIndexes.has(heroIndex)) {
            return false;
          }
          return hero;
        }) || null;
      }

      const roleHeroIndex = roleHeroes.indexOf(roleHero);
      if (roleHeroIndex >= 0) {
        usedRoleHeroIndexes.add(roleHeroIndex);
      }

      const heroId = getFirstFinite(
        roleHero?.heroId,
        teamHero?.heroId,
        teamHero?.raw?.heroId,
        teamHero?.raw?.id,
      );

      return buildHeroMeta({
        heroId,
        battleTeamSlot: teamHero.slot ?? index,
        sourceHero: roleHero || teamHero.raw,
        HERO_DICT,
        fishInfoMap,
        formatPower,
      });
    });

  return {
    roleId: roleNode?.roleId ?? roleNode?.id ?? "",
    name: roleNode?.name || "",
    headImg: roleNode?.headImg || "",
    powerText: formatPower ? formatPower(toNumber(roleNode?.power, 0)) : String(toNumber(roleNode?.power, 0)),
    serverName: roleNode?.serverName || roleNode?.server || "",
    heroList,
  };
}

export function buildEnemySideFromRankInfo({
  enemyRoleRaw,
  HERO_DICT,
  HeroFillInfo,
  formatPower,
}) {
  const roleNode = enemyRoleRaw?.roleInfo || enemyRoleRaw?.result?.roleInfo || resolveRoleNode(enemyRoleRaw);
  const roleHeroes = Array.isArray(roleNode?.heroes)
    ? roleNode.heroes
    : Object.values(roleNode?.heroes || {});
  const fishInfoMap = HeroFillInfo ? HeroFillInfo(roleNode) : {};
  const normalizedHeroes = normalizeBaseTeamInfo(roleHeroes);

  const heroList = normalizedHeroes
    .map((hero, index) => {
      const heroId = getFirstFinite(hero?.raw?.heroId, hero?.raw?.id);
      return {
        ...buildHeroMeta({
          heroId,
          battleTeamSlot: hero.slot,
          sourceHero: hero.raw,
          HERO_DICT,
          fishInfoMap,
          formatPower,
        }),
        __originalIndex: index,
      };
    })
    .sort((a, b) => {
      const hasSlotA = Number.isFinite(a.battleTeamSlot);
      const hasSlotB = Number.isFinite(b.battleTeamSlot);
      if (hasSlotA && hasSlotB) {
        return a.battleTeamSlot - b.battleTeamSlot;
      }
      if (hasSlotA) {
        return -1;
      }
      if (hasSlotB) {
        return 1;
      }
      return a.__originalIndex - b.__originalIndex;
    })
    .map(({ __originalIndex, ...hero }) => hero);

  return {
    roleId: roleNode?.roleId ?? roleNode?.id ?? "",
    name: roleNode?.name || "",
    headImg: roleNode?.headImg || "",
    powerText: formatPower ? formatPower(toNumber(roleNode?.power, 0)) : String(toNumber(roleNode?.power, 0)),
    serverName: roleNode?.serverName || roleNode?.server || "",
    heroList,
  };
}

export function buildRoundRows({
  sideKey,
  battleData,
  resultSide,
  baseSide,
  formatPower,
  HERO_DICT,
}) {
  const battleSide = sideKey === "left" ? battleData?.leftTeam : battleData?.rightTeam;
  const snapshotEntries = normalizeBattleSnapshotTeam(battleSide?.team);
  const snapshotBySlot = new Map();
  const snapshotByHeroId = new Map();

  snapshotEntries.forEach((entry) => {
    if (Number.isFinite(entry.slot)) {
      snapshotBySlot.set(entry.slot, entry);
    }
    if (Number.isFinite(entry.heroId) && !snapshotByHeroId.has(entry.heroId)) {
      snapshotByHeroId.set(entry.heroId, []);
    }
    if (Number.isFinite(entry.heroId)) {
      snapshotByHeroId.get(entry.heroId).push(entry);
    }
  });

  const resultEntries = normalizeResultTeamInfo(resultSide?.teamInfo);
  const resultBySlot = new Map();
  const resultByHeroId = new Map();

  resultEntries.forEach((entry) => {
    if (Number.isFinite(entry.slot)) {
      resultBySlot.set(entry.slot, entry);
    }
    if (Number.isFinite(entry.heroId)) {
      if (!resultByHeroId.has(entry.heroId)) {
        resultByHeroId.set(entry.heroId, []);
      }
      resultByHeroId.get(entry.heroId).push(entry);
    }
  });

  const normalizedBaseSide = normalizeSideIdentity(baseSide);
  const baseLookup = buildHeroLookupMaps(normalizedBaseSide.heroList);
  const usedResultIndexes = new Set();

  const consumeResultEntry = (entry) => {
    if (!entry) {
      return null;
    }
    usedResultIndexes.add(entry.index);
    return entry;
  };

  const resolveResultEntry = (slot, index, baseHero) => {
    const slotMatch = resultBySlot.get(slot);
    if (slotMatch && !usedResultIndexes.has(slotMatch.index)) {
      return consumeResultEntry(slotMatch);
    }

    if (Number.isFinite(baseHero?.heroId)) {
      const heroEntries = resultByHeroId.get(baseHero.heroId) || [];
      const heroMatch = heroEntries.find((entry) => !usedResultIndexes.has(entry.index));
      if (heroMatch) {
        return consumeResultEntry(heroMatch);
      }
    }

    const indexEntry = resultEntries.find(
      (entry) => entry.index === index && !usedResultIndexes.has(entry.index),
    );
    if (indexEntry) {
      return consumeResultEntry(indexEntry);
    }

    return null;
  };

  const rows = Array.from({ length: DEFAULT_SLOT_COUNT }, (_, index) => {
    const slot = index;
    const snapshotEntry = snapshotBySlot.get(slot) || null;
    const snapshotHeroId = getFirstFinite(snapshotEntry?.heroId, snapshotEntry?.raw?.id);
    const baseHero
      = baseLookup.bySlot.get(slot)
        || findHeroById(baseLookup.byHeroId, snapshotHeroId)
        || normalizedBaseSide.heroList[index]
        || null;
    const resultEntry = resolveResultEntry(slot, index, baseHero);
    const resultHero = resultEntry?.raw || null;
    const snapshotHero = snapshotEntry?.raw || null;
    const heroId = getFirstFinite(
      resultHero?.heroId,
      baseHero?.heroId,
      snapshotHero?.id,
      snapshotHero?.heroId,
    );
    const maxHp = toNumber(snapshotHero?.hp, 0);
    const hp = toNumber(resultHero?.hp, 0);
    const hpPercent = maxHp > 0 ? clamp((hp / maxHp) * 100, 0, 100) : 0;
    const meta = baseHero
      ? {
          heroId: baseHero.heroId,
          heroName: baseHero.heroName,
          heroAvatar: baseHero.heroAvatar,
          battleTeamSlot: Number.isFinite(baseHero.battleTeamSlot) ? baseHero.battleTeamSlot : slot,
          star: toNumber(baseHero.star, toNumber(resultHero?.star, toNumber(snapshotHero?.star, 0))),
          order: toNumber(baseHero.order, toNumber(resultHero?.order, toNumber(snapshotHero?.order, 0))),
          HolyBeast: !!baseHero.HolyBeast,
          HBlevel: toNumber(baseHero.HBlevel, 0),
          fishName: baseHero.fishName || "",
          pearlSkillName: baseHero.pearlSkillName || "",
          pearlSlots: Array.isArray(baseHero.pearlSlots) ? baseHero.pearlSlots : [],
          raw: resultHero || baseHero.raw || snapshotHero || null,
        }
      : buildFallbackHeroMeta({
          heroId,
          battleTeamSlot: slot,
          snapshotHero,
          resultHero,
          HERO_DICT,
        });

    return {
      heroId: meta.heroId,
      heroName: meta.heroName,
      heroAvatar: meta.heroAvatar,
      battleTeamSlot: slot,
      star: meta.star,
      order: meta.order,
      HolyBeast: !!meta.HolyBeast,
      HBlevel: toNumber(meta.HBlevel, 0),
      fishName: meta.fishName,
      pearlSkillName: meta.pearlSkillName,
      pearlSlots: meta.pearlSlots,
      healText: formatPower ? formatPower(toNumber(resultHero?.treatment, 0)) : String(toNumber(resultHero?.treatment, 0)),
      takeDamageText: formatPower ? formatPower(toNumber(resultHero?.takeDamage, 0)) : String(toNumber(resultHero?.takeDamage, 0)),
      damageText: formatPower ? formatPower(toNumber(resultHero?.damage, 0)) : String(toNumber(resultHero?.damage, 0)),
      hp,
      maxHp,
      hpPercent,
      isDead: hp <= 0,
      raw: resultHero || snapshotHero || meta.raw || null,
    };
  });

  return rows.sort((a, b) => a.battleTeamSlot - b.battleTeamSlot);
}

export function buildDuelDetailRound({
  battleData,
  leftBaseSide,
  rightBaseSide,
  formatPower,
  HERO_DICT,
  index,
}) {
  const leftRows = buildRoundRows({
    sideKey: "left",
    battleData,
    resultSide: battleData?.result?.sponsor,
    baseSide: leftBaseSide,
    formatPower,
    HERO_DICT,
  });
  const rightRows = buildRoundRows({
    sideKey: "right",
    battleData,
    resultSide: battleData?.result?.accept,
    baseSide: rightBaseSide,
    formatPower,
    HERO_DICT,
  });

  const isWin = !!battleData?.result?.isWin;
  const leftDieHero = leftRows.filter((row) => row.heroId && row.hp <= 0).length;
  const rightDieHero = rightRows.filter((row) => row.heroId && row.hp <= 0).length;
  const leftRemainTeamHp = toNumber(
    battleData?.result?.sponsor?.ext?.curHP,
    leftRows.reduce((sum, row) => sum + toNumber(row.hp, 0), 0),
  );
  const rightRemainTeamHp = toNumber(
    battleData?.result?.accept?.ext?.curHP,
    rightRows.reduce((sum, row) => sum + toNumber(row.hp, 0), 0),
  );

  return {
    index,
    isWin,
    leftDieHero,
    rightDieHero,
    leftPerfectWin: isWin && leftDieHero === 0,
    rightPerfectWin: !isWin && rightDieHero === 0,
    leftRows,
    rightRows,
    leftRemainTeamHp,
    rightRemainTeamHp,
    roundCount: toNumber(battleData?.result?.round, 0),
    totalFrame: toNumber(battleData?.result?.totalFrame, 0),
    raw: battleData || null,
  };
}

export function buildDuelDetailReport({
  selfRoleRaw,
  selfPresetTeamRaw,
  enemyRoleRaw,
  battleResults,
  formatPower,
  HERO_DICT,
  HeroFillInfo,
}) {
  const roundsSource = Array.isArray(battleResults) ? battleResults.filter(Boolean) : [];
  if (!roundsSource.length) {
    return null;
  }

  const leftBaseSide = buildSelfSideFromRoleInfo({
    roleInfoRaw: selfRoleRaw,
    presetTeamRaw: selfPresetTeamRaw,
    HERO_DICT,
    HeroFillInfo,
    formatPower,
  });
  const rightBaseSide = buildEnemySideFromRankInfo({
    enemyRoleRaw,
    HERO_DICT,
    HeroFillInfo,
    formatPower,
  });

  const rounds = roundsSource.map((battleData, roundIndex) =>
    buildDuelDetailRound({
      battleData,
      leftBaseSide,
      rightBaseSide,
      formatPower,
      HERO_DICT,
      index: roundIndex + 1,
    }),
  );

  const firstBattle = roundsSource[0] || {};
  const firstRound = rounds[0] || {};
  const leftOverviewHeroes = reorderHeroListBySlots(leftBaseSide.heroList, firstBattle?.leftTeam?.team);
  const rightOverviewHeroes = reorderHeroListBySlots(rightBaseSide.heroList, firstBattle?.rightTeam?.team);
  const leftIdentity = {
    ...normalizeSideIdentity(leftBaseSide),
    roleId: firstBattle?.leftTeam?.roleId ?? leftBaseSide.roleId,
    name: firstBattle?.leftTeam?.name || leftBaseSide.name,
    headImg: firstBattle?.leftTeam?.headImg || leftBaseSide.headImg,
    powerText: formatPower
      ? formatPower(toNumber(firstBattle?.leftTeam?.power, toNumber(resolveRoleNode(selfRoleRaw)?.power, 0)))
      : String(toNumber(firstBattle?.leftTeam?.power, toNumber(resolveRoleNode(selfRoleRaw)?.power, 0))),
    heroList: leftOverviewHeroes.length ? leftOverviewHeroes : buildOverviewHeroListFallback(firstRound.leftRows),
  };
  const rightIdentity = {
    ...normalizeSideIdentity(rightBaseSide),
    roleId: firstBattle?.rightTeam?.roleId ?? rightBaseSide.roleId,
    name: firstBattle?.rightTeam?.name || rightBaseSide.name,
    headImg: firstBattle?.rightTeam?.headImg || rightBaseSide.headImg,
    powerText: formatPower
      ? formatPower(toNumber(firstBattle?.rightTeam?.power, toNumber((enemyRoleRaw?.roleInfo || enemyRoleRaw?.result?.roleInfo || {}).power, 0)))
      : String(toNumber(firstBattle?.rightTeam?.power, toNumber((enemyRoleRaw?.roleInfo || enemyRoleRaw?.result?.roleInfo || {}).power, 0))),
    heroList: rightOverviewHeroes.length ? rightOverviewHeroes : buildOverviewHeroListFallback(firstRound.rightRows),
  };

  const leftWinCount = rounds.filter((round) => round.isWin).length;
  const rightWinCount = rounds.length - leftWinCount;
  const leftPerfectWinCount = rounds.filter((round) => round.leftPerfectWin).length;
  const rightPerfectWinCount = rounds.filter((round) => round.rightPerfectWin).length;

  return {
    createdAt: new Date().toISOString(),
    totalCount: rounds.length,
    left: leftIdentity,
    right: rightIdentity,
    summary: {
      leftWinCount,
      rightWinCount,
      leftPerfectWinCount,
      rightPerfectWinCount,
      winRate: rounds.length ? Number(((leftWinCount / rounds.length) * 100).toFixed(2)) : 0,
    },
    rounds,
  };
}
