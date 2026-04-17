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
  expect(result.inspect.payloadShapeDefault.kind).toBeTruthy();
  expect(result.inspect.visualProbeCapabilities.showBattleLoading).toBe("not-found(optional)");
  expect(typeof result.inspect.visualProbeCapabilities.canvas).toBe("boolean");
  expect(typeof result.inspect.visualProbeCapabilities.sceneScan).toBe("boolean");
  expect(bridgeType).toBe("object");
  expect(result.inspect.incompatibleProbes).toContain("BattleUIManager");
  expect(result.inspect.incompatibleProbes).toContain("enter-oss");
  expect(result.inspect.incompatibleProbes).toContain("BattleKitCrossSite");
  expect(result.play.ok).toBeFalsy();
  expect(result.play.status).toBe("bridge-exposed-but-play-target-missing");
  expect(result.play.payloadShapeBefore.kind).toBeTruthy();
  expect(result.play.payloadShapeAfter.kind).toBeTruthy();
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

  expect(inspect.loaderFamilyEvidence.publicEvidence).toContain("document:/xyzw/index.js");
  expect(inspect.bridgeStatus).toBe("bridge-exposed-but-play-target-missing");
  expect(Array.isArray(inspect.rankedTargets)).toBeTruthy();
  expect(inspect.sourceIdProbes.BattleUIManager.status).toBe("module-id-family-mismatch");
  expect(inspect.sourceIdProbes["enter-oss"].status).toBe("module-id-family-mismatch");
  expect(inspect.sourceIdProbes.BattleKitCrossSite.status).toBe("module-id-family-mismatch");
});
