import assert from "node:assert/strict";
import test from "node:test";

import {
  ensureFightPvpSelfRoleContext,
  resolveFightPvpMapIdFromLiveContext,
  resolveFightPvpMapIdFromLiveRole,
} from "../../src/services/replay/fightPvpLiveMapIdResolver.js";

test.afterEach(() => {
  delete globalThis.PVPMapConf;
  delete globalThis.__require;
});

test("fight pvp live mapId resolver reads self role pvpMapId first", () => {
  const result = resolveFightPvpMapIdFromLiveRole({
    role: {
      pvpMapId: 120001,
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.mapId, 120001);
  assert.equal(result.pvpMapId, 120001);
  assert.equal(result.source, "selfRole.role.pvpMapId");
  assert.equal(result.reason, null);
});

test("fight pvp live mapId resolver maps dress used id through PVPMapConf", () => {
  globalThis.PVPMapConf = {
    getById(id) {
      return id === 7001 ? { mapId: 120005 } : null;
    },
  };

  const result = resolveFightPvpMapIdFromLiveRole({
    role: {
      dress: new Map([[6, { used: 7001 }]]),
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.mapId, 120005);
  assert.equal(result.pvpMapId, 120005);
  assert.equal(result.source, "selfRole.dress:PVPMapConf");
  assert.equal(result.dressPvpMapUsedId, 7001);
});

test("fight pvp live mapId resolver never uses target role values", () => {
  const result = resolveFightPvpMapIdFromLiveContext({
    selfRoleRaw: {
      role: {
        roleId: "self-role",
      },
    },
    targetRoleInfo: {
      role: {
        pvpMapId: 130001,
      },
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.mapId, null);
  assert.notEqual(result.mapId, 130001);
});

test("fight pvp live mapId resolver reports config lookup failures without using used id as final map", () => {
  const result = resolveFightPvpMapIdFromLiveRole({
    role: {
      dress: new Map([[6, { used: 7001 }]]),
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.mapId, null);
  assert.equal(result.pvpMapId, null);
  assert.equal(result.reason, "missing-pvp-map-conf");
  assert.equal(result.dressPvpMapUsedId, 7001);
});

test("fight pvp live mapId resolver never uses fixture fallback on ordinary live path", () => {
  const result = resolveFightPvpMapIdFromLiveContext({
    selfRoleRaw: {
      role: {
        roleId: "self-role",
      },
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.mapId, null);
  assert.notEqual(result.mapId, 110001);
});

test("fight pvp live mapId ensure refreshes current account role info when cache is missing", async () => {
  const calls = [];
  const tokenStore = {
    selectedToken: {
      id: "token-1",
    },
    selectedTokenRoleInfo: null,
    gameData: {
      roleInfo: null,
    },
    async sendGetRoleInfo(tokenId) {
      calls.push(tokenId);
      return {
        role: {
          roleId: "self-role",
          pvpMapId: 120009,
        },
      };
    },
  };

  const ensured = await ensureFightPvpSelfRoleContext({
    tokenStore,
    selectedToken: tokenStore.selectedToken,
  });
  const resolved = resolveFightPvpMapIdFromLiveContext({
    tokenStoreRoleInfo: ensured.roleInfo,
  });

  assert.deepEqual(calls, ["token-1"]);
  assert.equal(ensured.ok, true);
  assert.equal(ensured.refreshed, true);
  assert.equal(ensured.selfRoleContextSource, "refreshed-role_getroleinfo");
  assert.equal(resolved.ok, true);
  assert.equal(resolved.mapId, 120009);
});

test("fight pvp live mapId ensure returns a stable refresh failure reason when self role still missing", async () => {
  const tokenStore = {
    selectedToken: {
      id: "token-1",
    },
    selectedTokenRoleInfo: null,
    gameData: {
      roleInfo: null,
    },
    async sendGetRoleInfo() {
      return null;
    },
  };

  const ensured = await ensureFightPvpSelfRoleContext({
    tokenStore,
    selectedToken: tokenStore.selectedToken,
  });

  assert.equal(ensured.ok, false);
  assert.equal(ensured.refreshed, true);
  assert.equal(ensured.reason, "missing-self-role-after-refresh");
  assert.equal(ensured.selfRoleContextSource, "refreshed-role_getroleinfo");
});
