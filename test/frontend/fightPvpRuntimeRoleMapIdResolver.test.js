import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveFightPvpMapIdForLiveCapture,
  resolveFightPvpMapIdFromRuntimeGlobals,
  resolveFightPvpMapIdFromRuntimeRole,
} from "../../src/services/replay/fightPvpRuntimeRoleMapIdResolver.js";

test.afterEach(() => {
  delete globalThis.ServerData;
  delete globalThis.ROLE;
});

test("fight pvp runtime-role resolver prefers runtime.ROLE.pvpMapId for live capture", () => {
  const result = resolveFightPvpMapIdFromRuntimeRole({
    runtimeRole: {
      pvpMapId: 40001,
    },
    runtimeRolePath: "runtime.ROLE",
    runtimeRoleSource: "window.ROLE",
  });

  assert.equal(result.ok, true);
  assert.equal(result.mapId, 40001);
  assert.equal(result.source, "runtime.ROLE.pvpMapId");
  assert.equal(result.runtimeRoleAvailable, true);
  assert.equal(result.runtimeRolePath, "runtime.ROLE");
});

test("fight pvp runtime-role resolver falls back to runtime ServerData self role", () => {
  globalThis.ServerData = {
    ROLE: {
      pvpMapId: 40001,
    },
  };

  const result = resolveFightPvpMapIdFromRuntimeGlobals({
    runtimeContext: {
      runtimeRoot: globalThis,
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.mapId, 40001);
  assert.equal(result.source, "runtime.ServerData.ROLE.pvpMapId");
  assert.equal(result.runtimeRolePath, "runtime.ServerData.ROLE");
});

test("fight pvp runtime-role resolver uses already-written battle input mapId only after runtime sources", () => {
  const result = resolveFightPvpMapIdForLiveCapture({
    battleInput: {
      battleInputData: {
        mapId: 40001,
      },
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.mapId, 40001);
  assert.equal(result.source, "battleInput.battleInputData.mapId");
});

test("fight pvp runtime-role resolver reports runtime-role-unavailable when no runtime self role exists", () => {
  const result = resolveFightPvpMapIdForLiveCapture({});

  assert.equal(result.ok, true);
  assert.equal(result.reason, "runtime-role-unavailable");
  assert.equal(result.runtimeRoleAvailable, false);
  assert.equal(result.mapId, 40001);
  assert.equal(result.source, "fallback.defaultMapId.40001");
});

test("fight pvp runtime-role resolver reports runtime-role-no-pvpMapId when runtime self role has no pvpMapId", () => {
  globalThis.ROLE = {
    roleId: "self-role",
  };

  const result = resolveFightPvpMapIdForLiveCapture({
    runtimeContext: {
      runtimeRoot: globalThis,
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.reason, "runtime-role-no-pvpMapId");
  assert.equal(result.runtimeRoleAvailable, true);
  assert.equal(result.runtimeRolePath, "runtime.ROLE");
  assert.equal(result.mapId, 40001);
  assert.equal(result.source, "fallback.defaultMapId.40001");
});

test("fight pvp runtime-role resolver reports battle-input-mapId-not-written when live battle input still misses mapId", () => {
  globalThis.ROLE = {
    roleId: "self-role",
  };

  const result = resolveFightPvpMapIdForLiveCapture({
    runtimeContext: {
      runtimeRoot: globalThis,
    },
    battleInput: {
      battleInputData: {
        mapId: null,
      },
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.reason, "battle-input-mapId-not-written");
  assert.equal(result.battleInputAvailable, true);
  assert.equal(result.mapId, 40001);
  assert.equal(result.source, "fallback.defaultMapId.40001");
});

test("fight pvp runtime-role resolver never falls back to 110001 on ordinary live path", () => {
  globalThis.ROLE = {
    roleId: "self-role",
  };

  const result = resolveFightPvpMapIdForLiveCapture({
    runtimeContext: {
      runtimeRoot: globalThis,
    },
    battleInput: {
      battleInputData: {
        mapId: null,
      },
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.mapId, 40001);
  assert.notEqual(result.source, "fixture.110001");
});
