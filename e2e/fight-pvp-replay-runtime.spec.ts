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
  battleData: {
    id: "battle-e2e",
    version: 240495,
    leftTeam: {
      roleId: "left-role",
      name: "我方",
    },
    rightTeam: {
      roleId: "right-role",
      name: "敌方",
    },
    result: {
      isWin: true,
    },
    memos: [],
  },
});

test("fight pvp replay runtime no longer dies in wx or bundleVers boot blockers", async ({
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
      "/src/services/replay/fightPvpReplayRuntimeBridge.js"
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

  expect(result.ok).toBeFalsy();
  expect(result.reason).toBe("runtime-load-failed");
  expect(result.diagnostics.runtimeSnapshotAfterBoot.gamePrepared).toBeTruthy();
  expect(
    result.diagnostics.runtimeSnapshotAfterBoot.gameRendererInitialized,
  ).toBeTruthy();
  expect(result.message).toContain("/assets/game/config.json");
  expect(result.message).toContain("/assets/game/index.js");
  expect(result.diagnostics.gameStateHistory).toContain("LoadGameScene");

  const joinedErrors = [...consoleErrors, ...pageErrors].join("\n");
  expect(joinedErrors).not.toContain("wx is not defined");
  expect(joinedErrors).not.toContain("TEXTURE_2D");
  expect(joinedErrors).not.toContain("Cannot read properties of null (reading 'game')");
});
