import { expect, test } from "playwright/test";
import {
  createFightPvpRuntimeRoleReplayFixture,
} from "../test/fixtures/replay/fightPvpRealReplayFixture.js";

test.use({
  launchOptions: {
    args: ["--use-angle=swiftshader"],
  },
});

const createReplayPayload = () => createFightPvpRuntimeRoleReplayFixture();

test("fight pvp replay runtime probe identifies the production/public loader family", async ({
  page,
}) => {
  await page.goto("/replay-runtime-probe.html");
  await page.waitForFunction(() => typeof (window as any).__xyzwReplayBridge?.inspect === "function");

  const result = await page.evaluate((replayPayload) => {
    const bridge = (window as any).__xyzwReplayBridge;
    return bridge.play(replayPayload).then((playResult: any) => ({
      inspect: bridge.inspect(),
      play: playResult,
    }));
  }, createReplayPayload());
  const bridgeType = await page.evaluate(() => typeof (window as any).__xyzwReplayBridge);

  expect(result.inspect.loaderFamily).toBe("public-xyzw-loader");
  expect(result.inspect.probeFamily).toBe("production-id-probes");
  expect(result.inspect.probeCompatibility).toBe("compatible-probe");
  expect(result.inspect.currentAssetPath).toBe("/xyzw/index.js");
  expect(Array.isArray(result.inspect.rankedTargets)).toBeTruthy();
  expect(Array.isArray(result.inspect.rankedTargetsInstant)).toBeTruthy();
  expect(Array.isArray(result.inspect.rankedTargetsStabilized)).toBeTruthy();
  expect(Array.isArray(result.inspect.buttonHandlerCandidates)).toBeTruthy();
  expect(Array.isArray(result.inspect.interactionTraceCandidates)).toBeTruthy();
  expect(Array.isArray(result.inspect.candidateDiscoverySources)).toBeTruthy();
  expect(result.inspect.payloadShapeDefault.kind).toBeTruthy();
  expect(result.inspect.playTargetSelectionPhase).toBeTruthy();
  expect(result.inspect.minimumPlayableScore).toBe(60);
  expect(result.inspect.targetRejectedReason ?? null).toBeNull();
  expect(typeof result.inspect.targetDiscoverySummary).toBe("object");
  expect(result.inspect.primaryRisk).toBe("runtime-not-ready-for-scene-scan");
    expect(result.inspect.sceneScanBlockedReason).toBe("scene-null");
    expect(result.inspect.runtimeBootState.loaderFamily).toBe("public-xyzw-loader");
  expect(result.inspect.runtimeBootWaitResult.status).toBeTruthy();
  expect(result.inspect.visualProbeCapabilities.showBattleLoading).toBe("not-found(optional)");
  expect(typeof result.inspect.visualProbeCapabilities.canvas).toBe("boolean");
  expect(typeof result.inspect.visualProbeCapabilities.sceneScan).toBe("boolean");
  expect(bridgeType).toBe("object");
  expect(result.inspect.incompatibleProbes).toContain("BattleUIManager");
  expect(result.inspect.incompatibleProbes).toContain("enter-oss");
  expect(result.inspect.incompatibleProbes).toContain("BattleKitCrossSite");
  expect(result.play.ok).toBeFalsy();
  expect(result.play.status).toBe("bridge-exposed-but-play-target-missing");
  expect(result.play.minimumPlayableScore).toBe(60);
  expect(result.play.primaryRisk).toBe("runtime-not-ready-for-scene-scan");
    expect(result.play.playTargetSelectionPhase).toBe("stabilized");
  expect(result.play.payloadShapeBefore.kind).toBeTruthy();
  expect(result.play.payloadShapeAfter).toBeNull();
  expect(result.play.visualPostCheck.skipped).toBe("no-play-target");
});

test("fight pvp replay runtime probe does not treat source-era probes as production bridge signals", async ({
  page,
}) => {
  await page.goto("/replay-runtime-probe.html");
  await page.waitForFunction(() => typeof (window as any).__xyzwReplayBridge?.inspect === "function");

  const inspect = await page.evaluate(() => {
    return (window as any).__xyzwReplayBridge.inspect();
  });
  const traceHelperType = await page.evaluate(() => typeof (window as any).__xyzwReplayBridge.traceUiReplayHandlers);

  expect(inspect.loaderFamilyEvidence.publicEvidence).toContain("document:/xyzw/index.js");
  expect(inspect.bridgeStatus).toBe("bridge-exposed-but-play-target-missing");
  expect(Array.isArray(inspect.rankedTargets)).toBeTruthy();
  expect(Array.isArray(inspect.rankedTargetsInstant)).toBeTruthy();
  expect(Array.isArray(inspect.rankedTargetsStabilized)).toBeTruthy();
  expect(inspect.primaryRisk).toBe("runtime-not-ready-for-scene-scan");
  expect(inspect.sourceIdProbes.BattleUIManager.status).toBe("module-id-family-mismatch");
  expect(inspect.sourceIdProbes["enter-oss"].status).toBe("module-id-family-mismatch");
  expect(inspect.sourceIdProbes.BattleKitCrossSite.status).toBe("module-id-family-mismatch");
  expect(traceHelperType).toBe("function");
});
