import assert from "node:assert/strict";
import test from "node:test";

import {
  readFightPvpRuntimeMapIdContext,
} from "../../src/services/replay/fightPvpRuntimeMapIdBridge.js";
import {
  resolveFightPvpMapIdForLiveCapture,
  resolveFightPvpMapIdFromRolePayload,
  resolveFightPvpMapIdFromRuntimeContext,
} from "../../src/services/replay/fightPvpRuntimeMapIdResolver.js";
import {
  ensureFightPvpSelfRoleContext,
} from "../../src/services/replay/fightPvpLiveMapIdResolver.js";

test.afterEach(() => {
  delete globalThis.PVPMapConf;
  delete globalThis.EMDressType;
  delete globalThis.ServerData;
  delete globalThis.ROLE;
  delete globalThis.__require;
});

test("fight pvp runtime mapId resolver reads pvpMapId from runtime self role first", () => {
  const result = resolveFightPvpMapIdFromRuntimeContext({
    runtimeContext: {
      runtimeRole: {
        pvpMapId: 120001,
      },
      runtimeRoleAvailable: true,
      runtimeRoleSource: "runtime.ServerData.ROLE",
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.mapId, 120001);
  assert.equal(result.source, "runtime.ServerData.ROLE.pvpMapId");
  assert.equal(result.runtimeRoleAvailable, true);
});

test("fight pvp runtime mapId bridge reads ROLE from runtime ServerData module", () => {
  globalThis.__require = (moduleName) => {
    if (moduleName === "ServerData") {
      return {
        ROLE: {
          roleId: "self-role",
          pvpMapId: 120008,
        },
      };
    }
    throw new Error(`Cannot find module '${moduleName}'`);
  };

  const runtimeContext = readFightPvpRuntimeMapIdContext();

  assert.equal(runtimeContext.ok, true);
  assert.equal(runtimeContext.runtimeRoleAvailable, true);
  assert.equal(runtimeContext.runtimeRole?.pvpMapId, 120008);
  assert.equal(runtimeContext.runtimeRoleSource, "require:ServerData.ROLE");
});

test("fight pvp runtime mapId resolver still succeeds when role payload has no explicit pvpMapId but runtime self role does", () => {
  const runtimeContext = {
    runtimeRole: {
      pvpMapId: 120009,
    },
    runtimeRoleAvailable: true,
    runtimeRoleSource: "runtime.ServerData.ROLE",
  };
  const result = resolveFightPvpMapIdForLiveCapture({
    runtimeContext,
    selfRoleRaw: {
      role: {
        roleId: "self-role",
      },
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.mapId, 120009);
  assert.equal(result.source, "runtime.ServerData.ROLE.pvpMapId");
  assert.equal(result.runtimeRoleAvailable, true);
});

test("fight pvp runtime mapId resolver never uses target role values", () => {
  const result = resolveFightPvpMapIdForLiveCapture({
    selfRoleRaw: {
      role: {
        roleId: "self-role",
      },
    },
    battleInput: {
      targetRoleInfo: {
        role: {
          pvpMapId: 130001,
        },
      },
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.mapId, 40001);
  assert.equal(result.source, "fallback.defaultMapId.40001");
  assert.notEqual(result.mapId, 130001);
});

test("fight pvp runtime mapId resolver marks dress-only numeric keys as ambiguous without runtime enum evidence", () => {
  const result = resolveFightPvpMapIdFromRolePayload({
    rolePayload: {
      role: {
        dress: new Map([[6, { used: 7001 }]]),
      },
    },
    diagnosticBasePath: "selfRole",
  });

  assert.equal(result.ok, false);
  assert.equal(result.mapId, null);
  assert.equal(result.reason, "legacy-dress-ambiguous");
});

test("fight pvp runtime mapId resolver never uses 110001 on ordinary live path", () => {
  const result = resolveFightPvpMapIdForLiveCapture({
    selfRoleRaw: {
      role: {
        roleId: "self-role",
      },
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.mapId, 40001);
  assert.equal(result.source, "fallback.defaultMapId.40001");
  assert.notEqual(result.mapId, 110001);
  assert.notEqual(result.source, "fixture.110001");
});

test("fight pvp runtime mapId ensure refreshes current account role info when cache is missing", async () => {
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
          pvpMapId: 120010,
        },
      };
    },
  };

  const ensured = await ensureFightPvpSelfRoleContext({
    tokenStore,
    selectedToken: tokenStore.selectedToken,
  });

  assert.deepEqual(calls, ["token-1"]);
  assert.equal(ensured.ok, true);
  assert.equal(ensured.refreshed, true);
  assert.equal(ensured.selfRoleContextSource, "refreshed-role_getroleinfo");
});

test("fight pvp runtime mapId ensure returns runtime-self-role-unavailable when refresh still has no self role", async () => {
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
  assert.equal(ensured.reason, "runtime-role-unavailable");
  assert.equal(ensured.selfRoleContextSource, "refreshed-role_getroleinfo");
});
