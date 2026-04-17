(async function bootstrapReplayProbe() {
  try {
    if (!window.__xyzwReplayBridge?.inspect) {
      await import("/replay-runtime-probe.js");
      if (window.__xyzwReplayBridgeReadyPromise) {
        await window.__xyzwReplayBridgeReadyPromise;
      }
    }
    const bridge = window.__xyzwReplayBridge || window.__xyzwReplay || null;
    if (!bridge) {
      console.error("[xyzw replay] replay bridge is unavailable after bootstrap");
      return;
    }
    const result = bridge.inspect?.() || null;
    console.log("[xyzw replay] bridge ready", result);
  } catch (error) {
    console.error("[xyzw replay] failed to bootstrap replay probe", error);
  }
})();
