import { expect, test } from "playwright/test";
import {
  createFightPvpRealReplayFixture,
} from "../test/fixtures/replay/fightPvpRealReplayFixture.js";

test.use({
  launchOptions: {
    args: ["--use-angle=swiftshader"],
  },
});

const createReplayPayload = () => createFightPvpRealReplayFixture();

test("fight pvp replay runtime real fixture smoke enters game scene and starts replay playback", async ({
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
      hostStats: {
        childElementCount: hostElement?.childElementCount ?? 0,
        hasRuntimeCanvas: Boolean(
          hostElement?.querySelector(".fight-pvp-replay-runtime-canvas"),
        ),
        hasRuntimeViewport: Boolean(
          hostElement?.querySelector(".fight-pvp-replay-runtime-viewport"),
        ),
      },
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
  expect(Array.isArray(result.diagnostics.bundleAssetProbe)).toBeTruthy();
  expect(result.diagnostics.bundleAssetProbe).toHaveLength(2);
  expect(Array.isArray(result.diagnostics.sceneAssetProbe)).toBeTruthy();
  expect(
    result.diagnostics.sceneAssetProbe.some(
      (entry: { stage?: string }) => entry.stage === "scene-import",
    ),
  ).toBeTruthy();
  expect(result.diagnostics.replayEntrypoint).toBe(
    "require:BattleUIManager.SHOW_BATTLE_REPLAY_UI",
  );
  expect(result.diagnostics.replayStartSignal).toBeTruthy();
  expect(result.diagnostics.replayStartIsReplay).toBeTruthy();
  expect(result.diagnostics.replayStartMapId).toBe(110001);
  expect(result.diagnostics.replayStartBattleMode).toBe(32);
  expect(result.diagnostics.replayInputSummary.mapId).toBe(110001);
  expect(result.diagnostics.mapIdSource).toBe("fixture.110001");
  expect(result.diagnostics.fixtureMapFallbackUsed).toBeTruthy();
  expect(result.diagnostics.replayInputSummary.battleMode).toBe(32);
  expect(result.diagnostics.replayInputSummary.stageNameStr).toBe("切磋系统");
  expect(result.diagnostics.missingRuntimeFields).toEqual([]);
  expect(result.diagnostics.firstFailedAssetRequest).toBeFalsy();
  expect(result.hostStats.childElementCount).toBeGreaterThan(0);
  expect(result.hostStats.hasRuntimeViewport).toBeTruthy();
  expect(result.hostStats.hasRuntimeCanvas).toBeTruthy();

  const joinedErrors = [...consoleErrors, ...pageErrors].join("\n");
  expect(joinedErrors).not.toContain("wx is not defined");
  expect(joinedErrors).not.toContain("TEXTURE_2D");
  expect(joinedErrors).not.toContain("Cannot read properties of null (reading 'game')");
  expect(joinedErrors).not.toContain("Cannot find module 'decimal'");
});

test("fight pvp replay runtime reports the first missing Game scene import asset", async ({
  page,
}) => {
  const missingImportPath = "/assets/game/import/73/73788c49-686e-46bd-b737-8f681d06f0be.42ab3.json";
  await page.route(`**${missingImportPath}`, async (route) => {
    await route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ error: "missing scene import asset" }),
    });
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

  expect(result.ok).toBeFalsy();
  expect(result.reason).toBe("runtime-load-failed");
  expect(result.message).toContain("Game scene 依赖资源加载失败");
  expect(result.message).toContain(missingImportPath);
  expect(result.diagnostics.firstMissingAsset).toBe(missingImportPath);
  expect(result.diagnostics.sceneAssetProbe).toBeTruthy();
});
