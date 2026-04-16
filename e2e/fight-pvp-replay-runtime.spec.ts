import { expect, test } from "playwright/test";

test.use({
  launchOptions: {
    args: ["--use-angle=swiftshader"],
  },
});

const createReplayPayload = () => ({
  replayId: "fight-pvp-live:e2e",
  battleId: "battle-e2e",
  battleVersion: 240495,
  tokenId: "token-e2e",
  mapId: 110001,
  stageNameStr: "切磋系统",
  startTipTopName: "切磋系统",
  startTipStage: "开始切磋",
  runtimeOptionsSnapshot: {
    targetRole: {
      roleId: "right-role",
      name: "敌方",
      headImg: "/right.png",
    },
    selfScore: 12,
    oppoScore: 8,
    replayFlag: true,
  },
  battleResult: {
    isWin: true,
  },
  battleData: {
    id: "battle-e2e",
    version: 240495,
    mode: 7,
    leftTeam: {
      roleId: "left-role",
      name: "我方",
      headImg: "/left.png",
      team: [
        { heroId: 1001, level: 1, color: 1, star: 1 },
        { heroId: 1002, level: 1, color: 1, star: 1 },
      ],
    },
    rightTeam: {
      roleId: "right-role",
      name: "敌方",
      headImg: "/right.png",
      team: [
        { heroId: 2001, level: 1, color: 1, star: 1 },
        { heroId: 2002, level: 1, color: 1, star: 1 },
      ],
    },
    result: {
      isWin: true,
    },
    memos: [],
  },
});

test("fight pvp replay runtime enters game scene and starts replay playback", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text());
    }
  });
  page.on("pageerror", (error) => {
    pageErrors.push(String(error));
  });

  await page.goto("/replay-runtime-probe.html");

  const result = await page.evaluate(async (replayPayload) => {
    const { startFightPvpReplayRuntime } = await import(
      "/src/services/replay/fightPvpReplayRuntimeBridge.js",
    );

    const hostElement = document.getElementById("runtime-probe-host");
    const session = await startFightPvpReplayRuntime({
      replay: replayPayload,
      hostElement,
    });

    return {
      ok: session.ok,
      reason: session.reason,
      message: session.message,
      diagnostics: session.diagnostics,
    };
  }, createReplayPayload());

  expect(result.ok).toBeTruthy();
  expect(result.reason).toBe("ok");
  expect(result.diagnostics.runtimeSnapshotAfterBoot.gamePrepared).toBeTruthy();
  expect(
    result.diagnostics.runtimeSnapshotAfterBoot.gameRendererInitialized,
  ).toBeTruthy();
  expect(result.diagnostics.runtimeSnapshotAfterLauncher.sceneName).toBe("Game");
  expect(result.diagnostics.gameStateHistory).toContain("LoadGameScene");
  expect(result.diagnostics.replayEntrypoint).toBe(
    "require:BattleUIManager.SHOW_BATTLE_REPLAY_UI",
  );
  expect(result.diagnostics.replayStartSignal).toBeTruthy();
  expect(result.diagnostics.replayStartIsReplay).toBeTruthy();
  expect(result.diagnostics.replayStartMapId).toBe(110001);
  expect(result.diagnostics.replayStartBattleMode).toBe(7);
  expect(result.diagnostics.replayInputSummary.mapId).toBe(110001);
  expect(result.diagnostics.replayInputSummary.battleMode).toBe(7);
  expect(result.diagnostics.replayInputSummary.stageNameStr).toBe("切磋系统");
  expect(result.diagnostics.missingRuntimeFields).toEqual([]);

  const joinedErrors = [...consoleErrors, ...pageErrors].join("\n");
  expect(joinedErrors).not.toContain("wx is not defined");
  expect(joinedErrors).not.toContain("TEXTURE_2D");
  expect(joinedErrors).not.toContain("Cannot read properties of null (reading 'game')");
  expect(joinedErrors).not.toContain("Cannot find module 'decimal'");
});
