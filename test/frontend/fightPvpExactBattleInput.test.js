import assert from "node:assert/strict";
import test from "node:test";

import {
  createFightPvpExactBattleInput,
  createFightPvpReplaySafeBattleEnd,
  getFightPvpBattleInputMissingFields,
  rehydrateFightPvpBattleInputSnapshot,
  serializeFightPvpBattleInputSnapshot,
  summarizeFightPvpBattleInput,
} from "../../src/services/replay/fightPvpExactBattleInput.js";

const createSampleBattleInput = ({
  mapId = 120001,
  mode = 32,
} = {}) =>
  createFightPvpExactBattleInput({
    battleData: {
      id: `battle-${mapId}-${mode}`,
      version: 88,
      mode,
      leftTeam: {
        roleId: "role-1",
        name: "我方",
        team: {
          0: { heroId: 1001 },
        },
      },
      rightTeam: {
        roleId: "role-2",
        name: "对手",
        team: {
          0: { heroId: 2001 },
        },
      },
      result: {
        isWin: true,
      },
    },
    battleResult: {
      isWin: true,
    },
    mapId,
    stageNameStr: "切磋系统",
    startTipTopName: "切磋系统",
    startTipStage: "开始切磋",
    options: new Map([
      ["targetRole", { roleId: "role-2", name: "对手" }],
      ["selfScore", 12],
      ["oppoScore", 8],
    ]),
  });

test("fight pvp exact battle input keeps original battle input shape and Map options", () => {
  const battleInput = createSampleBattleInput();

  assert.equal(battleInput.mapId, 120001);
  assert.equal(battleInput.battleData.mode, 32);
  assert.equal(battleInput.stageNameStr, "切磋系统");
  assert.equal(battleInput.startTipTopName, "切磋系统");
  assert.equal(battleInput.startTipStage, "开始切磋");
  assert.ok(battleInput.options instanceof Map);
  assert.equal(battleInput.options.get("selfScore"), 12);
  assert.equal(typeof battleInput.battleEnd, "function");
});

test("fight pvp exact battle input snapshot serializes minimal replay fields", () => {
  const battleInput = createSampleBattleInput();
  const snapshot = serializeFightPvpBattleInputSnapshot(battleInput, {
    metadata: {
      fixture: true,
    },
    diagnostics: {
      tried: ["runtime.ROLE.pvpMapId"],
    },
  });

  assert.equal(snapshot.mapId, 120001);
  assert.equal(snapshot.battleVersion, 88);
  assert.equal(snapshot.battleData.mode, 32);
  assert.ok(Array.isArray(snapshot.optionsEntries));
  assert.deepEqual(snapshot.metadata, { fixture: true });
  assert.deepEqual(snapshot.diagnostics, {
    tried: ["runtime.ROLE.pvpMapId"],
  });
  assert.equal("battleEnd" in snapshot, false);
});

test("fight pvp exact battle input snapshot rehydrates replay-safe battleEnd and Map options", () => {
  const snapshot = serializeFightPvpBattleInputSnapshot(createSampleBattleInput());
  const rehydrated = rehydrateFightPvpBattleInputSnapshot(snapshot, {
    battleEnd: createFightPvpReplaySafeBattleEnd(),
  });

  assert.equal(rehydrated.mapId, 120001);
  assert.ok(rehydrated.options instanceof Map);
  assert.equal(rehydrated.options.get("oppoScore"), 8);
  assert.equal(typeof rehydrated.battleEnd, "function");
  assert.deepEqual(getFightPvpBattleInputMissingFields(rehydrated), []);
});

test("fight pvp exact battle input summary carries source and runtime diagnostics", () => {
  const summary = summarizeFightPvpBattleInput(createSampleBattleInput(), {
    sourceType: "live-memory-battle-input",
    battleInputSource: "live-memory-battle-input",
    mapIdSource: "runtime.ROLE.pvpMapId",
    runtimeRoleMapId: 120001,
    engineReplayEntrypoint: "require:BattleUIManager.SHOW_BATTLE_REPLAY_UI",
  });

  assert.equal(summary.sourceType, "live-memory-battle-input");
  assert.equal(summary.battleInputSource, "live-memory-battle-input");
  assert.equal(summary.mapIdSource, "runtime.ROLE.pvpMapId");
  assert.equal(summary.runtimeRoleMapId, 120001);
  assert.equal(
    summary.engineReplayEntrypoint,
    "require:BattleUIManager.SHOW_BATTLE_REPLAY_UI",
  );
});
