import assert from "node:assert/strict";
import test from "node:test";

import {
  FIGHT_PVP_REPLAY_FIXTURE_FALLBACK_MAP_ID,
  explainFightPvpMapIdResolution,
  resolveFightPvpMapIdFromLiveContext,
  resolveFightPvpMapIdFromReplay,
} from "../../src/services/replay/fightPvpReplayMapIdResolver.js";

test.afterEach(() => {
  delete globalThis.PVPMapConf;
  delete globalThis.__require;
});

test("fight pvp mapId resolver reads selfRoleRaw.role.pvpMapId for live capture", () => {
  const result = resolveFightPvpMapIdFromLiveContext({
    selfRoleRaw: {
      role: {
        pvpMapId: 120001,
      },
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.mapId, 120001);
  assert.equal(result.pvpMapId, 120001);
  assert.equal(result.mapIdSource, "selfRoleRaw.role.pvpMapId");
});

test("fight pvp mapId resolver reads selfRoleRaw.roleInfo.pvpMapId for live capture", () => {
  const result = resolveFightPvpMapIdFromLiveContext({
    selfRoleRaw: {
      roleInfo: {
        pvpMapId: 120002,
      },
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.mapId, 120002);
  assert.equal(result.mapIdSource, "selfRoleRaw.roleInfo.pvpMapId");
});

test("fight pvp mapId resolver reads tokenStore.gameData.roleInfo.role.pvpMapId for live capture", () => {
  const result = resolveFightPvpMapIdFromLiveContext({
    tokenStoreRoleInfo: {
      role: {
        pvpMapId: 120003,
      },
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.mapId, 120003);
  assert.equal(result.mapIdSource, "tokenStore.gameData.roleInfo.role.pvpMapId");
});

test("fight pvp mapId resolver reads tokenStore.gameData.roleInfo.pvpMapId for live capture", () => {
  const result = resolveFightPvpMapIdFromLiveContext({
    tokenStoreRoleInfo: {
      pvpMapId: 120004,
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.mapId, 120004);
  assert.equal(result.mapIdSource, "tokenStore.gameData.roleInfo.pvpMapId");
});

test("fight pvp mapId resolver maps dress used id through PVPMapConf when available", () => {
  globalThis.PVPMapConf = {
    getById(id) {
      if (id === 7001) {
        return { mapId: 120005 };
      }
      return null;
    },
  };

  const result = resolveFightPvpMapIdFromLiveContext({
    selfRoleRaw: {
      role: {
        dress: new Map([[6, { used: 7001 }]]),
      },
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.mapId, 120005);
  assert.equal(result.pvpMapId, 120005);
  assert.equal(result.mapIdSource, "selfRoleRaw.role.dress.PVPMapConf.mapId");
  assert.equal(result.pvpMapIdSource, "selfRoleRaw.role.dress.PVPMapConf.mapId");
  assert.equal(result.dressPvpMapUsedId, 7001);
  assert.equal(result.dressPvpMapMapId, 120005);
});

test("fight pvp mapId resolver keeps dress used id out of pvpMapId when config lookup is unavailable", () => {
  const result = resolveFightPvpMapIdFromLiveContext({
    selfRoleRaw: {
      role: {
        dress: new Map([[6, { used: 7001 }]]),
      },
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.mapId, null);
  assert.equal(result.pvpMapId, null);
  assert.equal(result.pvpMapIdSource, null);
  assert.equal(result.dressPvpMapUsedId, 7001);
  assert.equal(result.dressPvpMapMapId, null);
  assert.equal(
    result.diagnostics.availableValues["selfRoleRaw.role.dress.configLookup"],
    "dress-config-unavailable",
  );
});

test("fight pvp mapId resolver probes runtime Configs modules for dress map resolution", () => {
  globalThis.__require = (moduleName) => {
    if (moduleName === "../../../../../launcher/config/Configs") {
      return {
        PVPMapConf: {
          getById(id) {
            return id === 7001 ? { mapId: 120005 } : null;
          },
        },
        EMDressType: {
          pvpMap: 6,
        },
      };
    }
    throw new Error(`Cannot find module '${moduleName}'`);
  };

  const result = resolveFightPvpMapIdFromLiveContext({
    selfRoleRaw: {
      role: {
        dress: new Map([[6, { used: 7001 }]]),
      },
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.mapId, 120005);
  assert.equal(result.pvpMapId, 120005);
  assert.equal(result.mapIdSource, "selfRoleRaw.role.dress.PVPMapConf.mapId");
});

test("fight pvp mapId resolver accepts persisted replay.mapId first", () => {
  const result = resolveFightPvpMapIdFromReplay({
    replay: {
      mapId: 130001,
      mapIdSource: "replay.mapId",
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.mapId, 130001);
  assert.equal(result.mapIdSource, "replay.mapId");
});

test("fight pvp mapId resolver backfills from replay meta pvpMapId", () => {
  const result = resolveFightPvpMapIdFromReplay({
    replay: {
      meta: {
        pvpMapId: 130002,
      },
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.mapId, 130002);
  assert.equal(result.mapIdSource, "replay.meta.pvpMapId");
});

test("fight pvp mapId resolver backfills from replay context pvpMapId", () => {
  const result = resolveFightPvpMapIdFromReplay({
    replay: {
      context: {
        pvpMapId: 130003,
      },
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.mapId, 130003);
  assert.equal(result.mapIdSource, "replay.context.pvpMapId");
});

test("fight pvp mapId resolver backfills from selfRoleSnapshot pvpMapId", () => {
  const result = resolveFightPvpMapIdFromReplay({
    replay: {
      selfRoleSnapshot: {
        pvpMapId: 130004,
      },
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.mapId, 130004);
  assert.equal(result.mapIdSource, "replay.selfRoleSnapshot.pvpMapId");
});

test("fight pvp mapId resolver backfills from persisted selfRoleSnapshot dress used id through PVPMapConf", () => {
  globalThis.__require = (moduleName) => {
    if (moduleName === "../../../../../launcher/config/Configs") {
      return {
        PVPMapConf: {
          getById(id) {
            return id === 7001 ? { mapId: 120005 } : null;
          },
        },
      };
    }
    throw new Error(`Cannot find module '${moduleName}'`);
  };

  const result = resolveFightPvpMapIdFromReplay({
    replay: {
      selfRoleSnapshot: {
        pvpMapId: null,
        dressPvpMapUsedId: 7001,
        dressPvpMapMapId: null,
      },
      context: {
        pvpMapId: null,
        dressPvpMapUsedId: 7001,
        dressPvpMapMapId: null,
      },
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.mapId, 120005);
  assert.equal(result.pvpMapId, 120005);
  assert.equal(
    result.mapIdSource,
    "replay.selfRoleSnapshot.persistedDressPVPMapConf.mapId",
  );
  assert.equal(
    result.pvpMapIdSource,
    "replay.selfRoleSnapshot.persistedDressPVPMapConf.mapId",
  );
  assert.equal(result.dressPvpMapUsedId, 7001);
  assert.equal(result.dressPvpMapMapId, 120005);
  assert.equal(
    result.diagnostics.availableValues["replay.selfRoleSnapshot.PVPMapConf[7001].mapId"],
    120005,
  );
  assert.equal(
    result.diagnostics.availableValues["replay.context.dressPvpMapUsedId"],
    7001,
  );
});

test("fight pvp mapId resolver backfills from persisted selfRoleSnapshot dress snapshot through PVPMapConf", () => {
  globalThis.__require = (moduleName) => {
    if (moduleName === "../../../../../launcher/config/Configs") {
      return {
        PVPMapConf: {
          getById(id) {
            return id === 7001 ? { mapId: 120005 } : null;
          },
        },
      };
    }
    throw new Error(`Cannot find module '${moduleName}'`);
  };

  const result = resolveFightPvpMapIdFromReplay({
    replay: {
      selfRoleSnapshot: {
        dress: {
          pvpMap: {
            used: 7001,
          },
        },
      },
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.mapId, 120005);
  assert.equal(result.mapIdSource, "replay.selfRoleSnapshot.dress.PVPMapConf.mapId");
  assert.equal(
    result.diagnostics.availableValues["replay.selfRoleSnapshot.dress.PVPMapConf[7001].mapId"],
    120005,
  );
});

test("fight pvp mapId resolver backfills from persisted context dress used id through PVPMapConf", () => {
  globalThis.__require = (moduleName) => {
    if (moduleName === "../../../../../launcher/config/Configs") {
      return {
        PVPMapConf: {
          getById(id) {
            return id === 7001 ? { mapId: 120005 } : null;
          },
        },
      };
    }
    throw new Error(`Cannot find module '${moduleName}'`);
  };

  const result = resolveFightPvpMapIdFromReplay({
    replay: {
      selfRoleSnapshot: {
        pvpMapId: null,
        dressPvpMapUsedId: null,
        dressPvpMapMapId: null,
      },
      context: {
        pvpMapId: null,
        dressPvpMapUsedId: 7001,
        dressPvpMapMapId: null,
      },
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.mapId, 120005);
  assert.equal(result.pvpMapId, 120005);
  assert.equal(
    result.mapIdSource,
    "replay.context.persistedDressPVPMapConf.mapId",
  );
  assert.equal(
    result.diagnostics.availableValues["replay.context.PVPMapConf[7001].mapId"],
    120005,
  );
});

test("fight pvp mapId resolver backfills from persisted context dress snapshot through PVPMapConf", () => {
  globalThis.__require = (moduleName) => {
    if (moduleName === "../../../../../launcher/config/Configs") {
      return {
        PVPMapConf: {
          getById(id) {
            return id === 7001 ? { mapId: 120005 } : null;
          },
        },
      };
    }
    throw new Error(`Cannot find module '${moduleName}'`);
  };

  const result = resolveFightPvpMapIdFromReplay({
    replay: {
      context: {
        dress: {
          pvpMap: {
            used: 7001,
          },
        },
      },
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.mapId, 120005);
  assert.equal(result.mapIdSource, "replay.context.dress.PVPMapConf.mapId");
  assert.equal(
    result.diagnostics.availableValues["replay.context.dress.PVPMapConf[7001].mapId"],
    120005,
  );
});

test("fight pvp mapId resolver keeps failing when only persisted dress used id exists but PVPMapConf is unavailable", () => {
  const result = resolveFightPvpMapIdFromReplay({
    replay: {
      selfRoleSnapshot: {
        pvpMapId: null,
        dressPvpMapUsedId: 7001,
        dressPvpMapMapId: null,
      },
      context: {
        pvpMapId: null,
        dressPvpMapUsedId: 7001,
        dressPvpMapMapId: null,
      },
      source: "fight-pvp-live",
      meta: {},
      battleData: {
        id: "persisted-usedid-no-config",
      },
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.mapId, null);
  assert.equal(result.pvpMapId, null);
  assert.equal(result.dressPvpMapUsedId, 7001);
  assert.equal(result.dressPvpMapMapId, null);
  assert.equal(
    result.diagnostics.availableValues["replay.selfRoleSnapshot.persistedDressPVPMapConfLookup"],
    "dress-config-unavailable",
  );
});

test("fight pvp mapId resolver does not mistake leaked dress used ids for final replay mapId", () => {
  const result = resolveFightPvpMapIdFromReplay({
    replay: {
      pvpMapId: 7001,
      context: {
        pvpMapId: 7001,
        dressPvpMapUsedId: 7001,
      },
      selfRoleSnapshot: {
        pvpMapId: 7001,
        dressPvpMapUsedId: 7001,
      },
    },
    liveContext: {
      mapId: 120006,
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.mapId, 120006);
  assert.equal(result.pvpMapId, 120006);
  assert.equal(result.mapIdSource, "live.explicit.mapId");
  assert.notEqual(result.mapId, 7001);
  assert.equal(result.diagnostics.availableValues["replay.pvpMapId.suspectLegacyDressUsedLeak"], true);
  assert.equal(result.diagnostics.availableValues["replay.context.pvpMapId.suspectLegacyDressUsedLeak"], true);
  assert.equal(result.diagnostics.availableValues["replay.selfRoleSnapshot.pvpMapId.suspectLegacyDressUsedLeak"], true);
});

test("fight pvp mapId resolver reports failure when no replay map clues exist", () => {
  const result = resolveFightPvpMapIdFromReplay({
    replay: {
      battleData: {
        id: "missing-map",
      },
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.mapId, null);
  assert.deepEqual(result.diagnostics.availableValues, {});
  assert.match(result.diagnostics.tried.join("|"), /replay\.mapId/);
});

test("fight pvp mapId resolver never uses 110001 for ordinary payloads but allows fixture fallback", () => {
  const ordinary = resolveFightPvpMapIdFromReplay({
    replay: {
      source: "fight-pvp-live",
      battleData: {
        id: "ordinary",
      },
    },
  });

  assert.equal(ordinary.ok, false);
  assert.equal(ordinary.mapId, null);

  const fixture = resolveFightPvpMapIdFromReplay({
    replay: {
      source: "fight-pvp-real-fixture",
      meta: {
        fixtureMapFallback: true,
        fixtureName: "fight-pvp-real-replay",
      },
      battleData: {
        id: "fixture",
      },
    },
  });

  assert.equal(fixture.ok, true);
  assert.equal(fixture.mapId, FIGHT_PVP_REPLAY_FIXTURE_FALLBACK_MAP_ID);
  assert.equal(fixture.fixtureMapFallbackUsed, true);
  assert.equal(fixture.mapIdSource, "fixture.110001");
});

test("fight pvp mapId resolver explanation surfaces tried paths and available values", () => {
  const explanation = explainFightPvpMapIdResolution({
    replay: {
      context: {
        pvpMapId: 130005,
      },
    },
  });

  assert.equal(explanation.ok, true);
  assert.equal(explanation.mapId, 130005);
  assert.equal(explanation.availableValues["replay.context.pvpMapId"], 130005);
  assert.match(explanation.tried.join("|"), /replay\.context\.pvpMapId/);
});
