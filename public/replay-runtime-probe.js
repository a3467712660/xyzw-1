const LOADER_FAMILIES = Object.freeze({
  SRC: "src-xyzw-loader",
  PUBLIC: "public-xyzw-loader",
  UNKNOWN: "unknown-loader",
});

const PROBE_FAMILIES = Object.freeze({
  SOURCE: "source-id-probes",
  PRODUCTION: "production-id-probes",
});

const SOURCE_MODULE_IDS = Object.freeze([
  "BattleUIManager",
  "enter-oss",
  "BattleKitCrossSite",
]);

const RUNTIME_SCRIPT_URLS = Object.freeze([
  "/xyzw/cocos2d-js-min.js",
  "/xyzw/game-defines.browser.js",
  "/xyzw/index.js",
]);

const REPLAY_KEYWORD_RE = /replay|playback|battle|fight|pvp/i;
const GLOBAL_KEY_LIMIT = 240;
const MATCH_LIMIT = 40;
const MEMBER_LIMIT = 12;

const toFunctionSource = (value) => {
  if (typeof value !== "function") {
    return "";
  }
  try {
    return Function.prototype.toString.call(value);
  } catch {
    return "";
  }
};

const toNormalizedSourceSnippet = (value) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim();

const getRequireFingerprint = (req) => {
  if (typeof req !== "function") {
    return null;
  }
  const source = toFunctionSource(req);
  return {
    name: req.name || null,
    length: source.length,
    head: source.slice(0, 120),
    tail: source.slice(-120),
  };
};

const isPublicRuntimePath = (value) =>
  String(value || "").includes("/xyzw/index.js");

const looksLikePublicRequire = (source) => {
  const normalized = toNormalizedSourceSnippet(source);
  return normalized.includes("function e(t, n, r)")
    || normalized.includes("function e(t,n,r)")
    || normalized.includes("if (!n[a]) { if (!t[a])")
    || normalized.includes("if(!n[a]){if(!t[a])");
};

const looksLikeSourceRequire = (source) => {
  const normalized = toNormalizedSourceSnippet(source);
  return normalized.includes("function i(a, s, c)")
    || normalized.includes("function i(a,s,c)")
    || normalized.includes("function a(r, s, l)")
    || normalized.includes("function a(r,s,l)")
    || normalized.includes("if (!s[t]) { if (!a[t])")
    || normalized.includes("if(!s[t]){if(!a[t])")
    || normalized.includes("if (!s[t]) { if (!r[t])")
    || normalized.includes("if(!s[t]){if(!r[t])");
};

const getWindowScriptUrls = (targetWindow) => {
  try {
    return Array.from(targetWindow?.document?.scripts || [])
      .map((entry) => String(entry?.src || ""))
      .filter(Boolean);
  } catch {
    return [];
  }
};

const getWindowPerformanceUrls = (targetWindow) => {
  try {
    return Array.from(targetWindow?.performance?.getEntriesByType?.("resource") || [])
      .map((entry) => String(entry?.name || ""))
      .filter(Boolean);
  } catch {
    return [];
  }
};

const isObjectLike = (value) =>
  Boolean(value) && (typeof value === "object" || typeof value === "function");

const matchesReplayKeyword = (value) =>
  REPLAY_KEYWORD_RE.test(String(value || "").trim());

const getObjectName = (value) => {
  if (!value) {
    return null;
  }
  if (typeof value === "function" && value.name) {
    return value.name;
  }
  const constructorName = value?.constructor?.name;
  if (constructorName && constructorName !== "Object") {
    return constructorName;
  }
  return value?.__classname__ || value?.name || null;
};

const visitMemberHolder = (holder, names, methodSet, propertySet) => {
  if (!holder || !Array.isArray(names)) {
    return;
  }

  for (const name of names) {
    if (name === "constructor" || !matchesReplayKeyword(name)) {
      continue;
    }

    let descriptor = null;
    try {
      descriptor = Object.getOwnPropertyDescriptor(holder, name) || null;
    } catch {
      descriptor = null;
    }
    if (!descriptor) {
      continue;
    }

    if (typeof descriptor.value === "function") {
      methodSet.add(name);
      continue;
    }
    propertySet.add(name);
  }
};

const collectReplayMemberMatches = (value) => {
  if (!isObjectLike(value)) {
    return {
      methodMatches: [],
      propertyMatches: [],
    };
  }

  const methodSet = new Set();
  const propertySet = new Set();

  try {
    visitMemberHolder(
      value,
      Object.keys(value).slice(0, GLOBAL_KEY_LIMIT),
      methodSet,
      propertySet,
    );
  } catch {
    // Ignore dynamic host objects.
  }

  const prototype = Object.getPrototypeOf(value);
  if (
    prototype
    && prototype !== Object.prototype
    && prototype !== Function.prototype
  ) {
    try {
      visitMemberHolder(
        prototype,
        Object.getOwnPropertyNames(prototype).slice(0, GLOBAL_KEY_LIMIT),
        methodSet,
        propertySet,
      );
    } catch {
      // Ignore inaccessible prototypes.
    }
  }

  return {
    methodMatches: [...methodSet].slice(0, MEMBER_LIMIT),
    propertyMatches: [...propertySet].slice(0, MEMBER_LIMIT),
  };
};

const findGameWindow = (root = window) => {
  if (typeof root?.__require === "function") {
    return { gameWindow: root, source: "window" };
  }
  const iframes = Array.from(root?.document?.querySelectorAll?.("iframe") || []);
  for (let index = 0; index < iframes.length; index += 1) {
    try {
      const contentWindow = iframes[index]?.contentWindow || null;
      if (typeof contentWindow?.__require === "function") {
        return {
          gameWindow: contentWindow,
          source: `iframe[${index}]`,
        };
      }
    } catch {
      // Ignore inaccessible iframes.
    }
  }
  return { gameWindow: null, source: null };
};

const detectLoaderFamily = (gameWindow) => {
  const scriptUrls = getWindowScriptUrls(gameWindow);
  const performanceUrls = getWindowPerformanceUrls(gameWindow);
  const requireSource = toFunctionSource(gameWindow?.__require);
  const publicEvidence = [];
  const srcEvidence = [];

  if (scriptUrls.some(isPublicRuntimePath)) {
    publicEvidence.push("document:/xyzw/index.js");
  }
  if (performanceUrls.some(isPublicRuntimePath)) {
    publicEvidence.push("performance:/xyzw/index.js");
  }
  if (looksLikePublicRequire(requireSource)) {
    publicEvidence.push("fingerprint:public");
  }

  if (looksLikeSourceRequire(requireSource)) {
    srcEvidence.push("fingerprint:source");
  }

  let loaderFamily = LOADER_FAMILIES.UNKNOWN;
  if (publicEvidence.length > 0) {
    loaderFamily = LOADER_FAMILIES.PUBLIC;
  } else if (srcEvidence.length > 0) {
    loaderFamily = LOADER_FAMILIES.SRC;
  }

  return {
    loaderFamily,
    evidence: {
      publicEvidence,
      srcEvidence,
    },
    requireFingerprint: getRequireFingerprint(gameWindow?.__require),
    suspectedBundlePath: publicEvidence.length > 0 ? "/xyzw/index.js" : null,
    scriptUrls,
    performanceUrls,
  };
};

const looksLikeBattleInput = (value) =>
  Boolean(
    value?.battleData
    && typeof value?.mapId !== "undefined"
    && (
      typeof value?.battleData?.leftTeam?.team?.get === "function"
      || typeof value?.battleData?.leftTeam?.team?.forEach === "function"
    )
    && (
      typeof value?.battleData?.rightTeam?.team?.get === "function"
      || typeof value?.battleData?.rightTeam?.team?.forEach === "function"
    ),
  );

const ensureReplayInputDataForSourceFamily = (source, gameWindow) => {
  if (looksLikeBattleInput(source)) {
    return source;
  }
  const req = gameWindow?.__require;
  if (typeof req !== "function") {
    throw new Error("live window.__require is unavailable");
  }
  const { EnterOSSState } = req("enter-oss");
  const oss = new EnterOSSState();
  const battleData = oss.getBattleDataByOSS(source);
  if (!battleData) {
    throw new Error("getBattleDataByOSS returned null");
  }
  const inputData = oss.createBattleInputData(battleData, battleData.result);
  inputData.mapId ??= source?.mapId ?? 10001;
  inputData.battleResult ??= inputData.battleData?.result;
  return inputData;
};

const buildSourceIdProbeMismatchMap = (loaderFamily) =>
  Object.fromEntries(
    SOURCE_MODULE_IDS.map((moduleId) => [
      moduleId,
      {
        ok: false,
        status: "module-id-family-mismatch",
        moduleId,
        errorMessage: `${moduleId} is a source-era probe and is incompatible with ${loaderFamily}.`,
        stackTop: null,
      },
    ]),
  );

const unwrapProductionReplayPayload = (value) => {
  if (!value || typeof value !== "object") {
    return value;
  }
  const unwrapped = value?.battleInputData || value?.battleInputSnapshot || value;
  if (unwrapped?.battleResult == null && unwrapped?.battleData?.result != null) {
    unwrapped.battleResult = unwrapped.battleData.result;
  }
  return unwrapped;
};

const createTargetCandidate = (meta) => ({
  componentName: meta.componentName || null,
  invoke: meta.invoke,
  label: meta.label,
  methodName: meta.methodName || null,
  nodeName: meta.nodeName || null,
  nodePath: meta.nodePath || null,
  ownerKey: meta.ownerKey || null,
  source: meta.source,
});

const collectReplayGlobalCandidates = (gameWindow) => {
  const availableGlobals = [];
  const playMethodCandidates = [];
  const targetCandidates = [];
  const roots = [];
  const seenRoots = new Set();
  const seenGlobals = new Set();
  const seenTargets = new Set();

  const addRoot = (holder, source) => {
    if (!isObjectLike(holder) || seenRoots.has(holder)) {
      return;
    }
    seenRoots.add(holder);
    roots.push({ holder, source });
  };

  addRoot(gameWindow, "gameWindow");
  addRoot(window, "window");
  addRoot(globalThis, "globalThis");

  for (const root of roots) {
    let keys = [];
    try {
      keys = Object.keys(root.holder).slice(0, GLOBAL_KEY_LIMIT);
    } catch {
      keys = [];
    }

    for (const key of keys) {
      if (key === "__xyzwReplayBridge" || key === "__xyzwReplay") {
        continue;
      }

      let value = null;
      try {
        value = root.holder[key];
      } catch {
        value = null;
      }

      const keyMatched = matchesReplayKeyword(key);
      const { methodMatches, propertyMatches } = collectReplayMemberMatches(value);
      if (!keyMatched && methodMatches.length === 0 && propertyMatches.length === 0) {
        continue;
      }

      const globalKey = `${root.source}:${key}`;
      if (!seenGlobals.has(globalKey) && availableGlobals.length < MATCH_LIMIT) {
        seenGlobals.add(globalKey);
        availableGlobals.push({
          key,
          keyMatched,
          methodMatches,
          objectType: getObjectName(value),
          propertyMatches,
          source: root.source,
          type: typeof value,
        });
      }

      if (
        typeof value === "function"
        && keyMatched
        && targetCandidates.length < MATCH_LIMIT
      ) {
        const label = `${root.source}.${key}`;
        if (!seenTargets.has(label)) {
          seenTargets.add(label);
          playMethodCandidates.push({
            label,
            methodName: key,
            ownerKey: key,
            source: "global-function",
          });
          targetCandidates.push(createTargetCandidate({
            label,
            source: "global-function",
            ownerKey: key,
            methodName: key,
            invoke: (payload, options = {}) => value.call(root.holder, payload, options),
          }));
        }
      }

      if (!isObjectLike(value)) {
        continue;
      }

      for (const methodName of methodMatches) {
        if (targetCandidates.length >= MATCH_LIMIT) {
          break;
        }

        const method = value?.[methodName];
        if (typeof method !== "function") {
          continue;
        }

        const label = `${root.source}.${key}.${methodName}`;
        if (seenTargets.has(label)) {
          continue;
        }

        seenTargets.add(label);
        playMethodCandidates.push({
          label,
          methodName,
          ownerKey: key,
          source: "global-object",
        });
        targetCandidates.push(createTargetCandidate({
          label,
          source: "global-object",
          ownerKey: key,
          methodName,
          invoke: (payload, options = {}) => value[methodName].call(value, payload, options),
        }));
      }
    }
  }

  return {
    availableGlobals,
    playMethodCandidates,
    targetCandidates,
  };
};

const getSceneNodeChildren = (node) => {
  if (Array.isArray(node?.children)) {
    return node.children.filter(Boolean);
  }
  if (Array.isArray(node?._children)) {
    return node._children.filter(Boolean);
  }
  return [];
};

const getSceneNodeComponents = (node) => {
  if (Array.isArray(node?._components)) {
    return node._components.filter(Boolean);
  }
  if (Array.isArray(node?.components)) {
    return node.components.filter(Boolean);
  }
  return [];
};

const scanSceneForReplayCandidates = (gameWindow) => {
  const scene = gameWindow?.cc?.director?.getScene?.() || null;
  const sceneNodeMatches = [];
  const sceneComponentMatches = [];
  const playMethodCandidates = [];
  const targetCandidates = [];
  const seenNodes = new Set();
  const seenTargets = new Set();

  if (!scene) {
    return {
      playMethodCandidates,
      scene: null,
      sceneComponentMatches,
      sceneNodeMatches,
      targetCandidates,
    };
  }

  const queue = [{
    node: scene,
    path: scene?.name || "Game",
  }];

  while (queue.length > 0) {
    const current = queue.shift();
    const node = current?.node || null;
    if (!node || seenNodes.has(node)) {
      continue;
    }
    seenNodes.add(node);

    const nodeName = String(node?.name || "");
    const nodePath = current?.path || nodeName || "Game";

    if (matchesReplayKeyword(nodeName) && sceneNodeMatches.length < MATCH_LIMIT) {
      sceneNodeMatches.push({
        nodeName,
        nodePath,
      });
    }

    for (const component of getSceneNodeComponents(node)) {
      if (!component) {
        continue;
      }

      const componentName = getObjectName(component) || "AnonymousComponent";
      const componentNameMatched = matchesReplayKeyword(componentName);
      const { methodMatches, propertyMatches } = collectReplayMemberMatches(component);

      if (!componentNameMatched && methodMatches.length === 0 && propertyMatches.length === 0) {
        continue;
      }

      if (sceneComponentMatches.length < MATCH_LIMIT) {
        sceneComponentMatches.push({
          componentName,
          componentNameMatched,
          methodMatches,
          nodeName,
          nodePath,
          propertyMatches,
        });
      }

      for (const methodName of methodMatches) {
        if (targetCandidates.length >= MATCH_LIMIT) {
          break;
        }

        const method = component?.[methodName];
        if (typeof method !== "function") {
          continue;
        }

        const label = `${nodePath}#${componentName}.${methodName}`;
        if (seenTargets.has(label)) {
          continue;
        }

        seenTargets.add(label);
        playMethodCandidates.push({
          componentName,
          label,
          methodName,
          nodeName,
          nodePath,
          source: "scene-component",
        });
        targetCandidates.push(createTargetCandidate({
          componentName,
          label,
          methodName,
          nodeName,
          nodePath,
          source: "scene-component",
          invoke: (payload, options = {}) => component[methodName].call(component, payload, options),
        }));
      }
    }

    for (const child of getSceneNodeChildren(node)) {
      const childName = String(child?.name || "(anonymous)");
      queue.push({
        node: child,
        path: `${nodePath}/${childName}`,
      });
    }
  }

  return {
    playMethodCandidates,
    scene: scene?.name || null,
    sceneComponentMatches,
    sceneNodeMatches,
    targetCandidates,
  };
};

const isValidTargetCandidate = (candidate) =>
  Boolean(candidate && typeof candidate.invoke === "function");

const resolveProductionReplayPlayTarget = (gameWindow) => {
  const globalCandidates = collectReplayGlobalCandidates(gameWindow);
  const sceneCandidates = scanSceneForReplayCandidates(gameWindow);
  const targetCandidates = [
    ...globalCandidates.targetCandidates,
    ...sceneCandidates.targetCandidates,
  ];
  const playTarget = targetCandidates.find(isValidTargetCandidate) || null;

  return {
    availableGlobals: globalCandidates.availableGlobals,
    bridgeStatus: playTarget ? "bridge-ready" : "bridge-exposed-but-play-target-missing",
    playMethodCandidates: [
      ...globalCandidates.playMethodCandidates,
      ...sceneCandidates.playMethodCandidates,
    ].slice(0, MATCH_LIMIT),
    playTarget,
    playTargetLabel: playTarget?.label || null,
    playTargetSource: playTarget?.source || null,
    scene: sceneCandidates.scene,
    sceneComponentMatches: sceneCandidates.sceneComponentMatches,
    sceneNodeMatches: sceneCandidates.sceneNodeMatches,
  };
};

const inspect = () => {
  const { gameWindow, source } = findGameWindow(window);
  const loaderInfo = detectLoaderFamily(gameWindow);
  const resolution = resolveProductionReplayPlayTarget(gameWindow);
  return {
    availableGlobals: resolution.availableGlobals,
    bridgeStatus: resolution.bridgeStatus,
    currentAssetPath: loaderInfo.suspectedBundlePath,
    gameWindowSource: source,
    incompatibleProbes:
      loaderInfo.loaderFamily === LOADER_FAMILIES.PUBLIC
        ? [...SOURCE_MODULE_IDS]
        : [],
    loaderFamily: loaderInfo.loaderFamily,
    loaderFamilyEvidence: loaderInfo.evidence,
    playMethodCandidates: resolution.playMethodCandidates,
    playTargetLabel: resolution.playTargetLabel,
    playTargetSource: resolution.playTargetSource,
    probeCompatibility: "compatible-probe",
    probeFamily: PROBE_FAMILIES.PRODUCTION,
    requireFingerprint: loaderInfo.requireFingerprint,
    scene: resolution.scene,
    sceneComponentMatches: resolution.sceneComponentMatches,
    sceneNodeMatches: resolution.sceneNodeMatches,
    scriptUrls: loaderInfo.scriptUrls,
    sourceIdProbes:
      loaderInfo.loaderFamily === LOADER_FAMILIES.PUBLIC
        ? buildSourceIdProbeMismatchMap(loaderInfo.loaderFamily)
        : {},
    suspectedBundlePath: loaderInfo.suspectedBundlePath,
    performanceUrls: loaderInfo.performanceUrls,
  };
};

const play = (
  rawOrWrappedData = window.__xyzwReplayData || window.__REPLAY_DATA__ || null,
  options = {},
) => {
  const { gameWindow } = findGameWindow(window);
  const loaderInfo = detectLoaderFamily(gameWindow);
  if (loaderInfo.loaderFamily === LOADER_FAMILIES.PUBLIC) {
    const resolution = resolveProductionReplayPlayTarget(gameWindow);
    if (!resolution.playTarget) {
      return {
        ok: false,
        status: "bridge-exposed-but-play-target-missing",
        loaderFamily: loaderInfo.loaderFamily,
        detail:
          "The production replay bridge is exposed, but no stable play target was resolved from globals or the Game scene.",
        playMethodCandidates: resolution.playMethodCandidates,
        playTargetLabel: null,
        playTargetSource: null,
      };
    }

    try {
      const result = resolution.playTarget.invoke(
        unwrapProductionReplayPayload(rawOrWrappedData),
        options,
      );
      return {
        ok: true,
        status: "played-via-production-bridge",
        loaderFamily: loaderInfo.loaderFamily,
        playTargetLabel: resolution.playTargetLabel,
        playTargetSource: resolution.playTargetSource,
        result,
      };
    } catch (error) {
      return {
        ok: false,
        status: "bridge-play-target-threw",
        loaderFamily: loaderInfo.loaderFamily,
        errorMessage: error?.message || String(error),
        playTargetLabel: resolution.playTargetLabel,
        playTargetSource: resolution.playTargetSource,
        stackTop: String(error?.stack || "")
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)[1] || null,
      };
    }
  }

  if (loaderInfo.loaderFamily !== LOADER_FAMILIES.SRC) {
    return {
      ok: false,
      status: "loader-family-mismatch",
      loaderFamily: loaderInfo.loaderFamily,
      detail: "The current loader family is not compatible with source-era replay probes.",
    };
  }

  try {
    const prepared = ensureReplayInputDataForSourceFamily(rawOrWrappedData, gameWindow);
    const result = gameWindow.__require("BattleUIManager").SHOW_BATTLE_REPLAY_UI(prepared);
    return {
      ok: true,
      status: "played-via-source-bridge",
      loaderFamily: loaderInfo.loaderFamily,
      result,
    };
  } catch (error) {
    return {
      ok: false,
      status: "require-exec-error",
      loaderFamily: loaderInfo.loaderFamily,
      errorMessage: error?.message || String(error),
      stackTop: String(error?.stack || "")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)[1] || null,
    };
  }
};

const loadRuntimeScript = (src) =>
  new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-replay-runtime-probe="${src}"]`);
    if (existing?.dataset.loaded === "true") {
      resolve();
      return;
    }
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error(`Failed to load runtime script: ${src}`)), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.defer = true;
    script.src = src;
    script.dataset.replayRuntimeProbe = src;
    script.addEventListener("load", () => {
      script.dataset.loaded = "true";
      resolve();
    }, { once: true });
    script.addEventListener("error", () => reject(new Error(`Failed to load runtime script: ${src}`)), { once: true });
    document.head.appendChild(script);
  });

const ensureRuntimeLoaded = async () => {
  for (const scriptUrl of RUNTIME_SCRIPT_URLS) {
    await loadRuntimeScript(scriptUrl);
  }
};

let probePanel = null;

const ensureProbePanel = () => {
  if (probePanel) {
    return probePanel;
  }

  const host = document.getElementById("runtime-probe-host") || document.body;
  const panel = document.createElement("div");
  panel.className = "runtime-probe-panel";
  panel.innerHTML = `
    <div class="runtime-probe-actions">
      <button type="button" data-action="inspect">Inspect</button>
      <button type="button" data-action="play">Play window.__REPLAY_DATA__</button>
    </div>
    <pre class="runtime-probe-output" data-output="main">Waiting for bridge...</pre>
    <div class="runtime-probe-console">
      <code>window.__xyzwReplayBridge.inspect()</code>
      <code>window.__xyzwReplayBridge.play(window.__REPLAY_DATA__)</code>
    </div>
  `;
  host.appendChild(panel);
  probePanel = panel;
  return probePanel;
};

const renderProbeOutput = (value, label) => {
  const panel = ensureProbePanel();
  const output = panel.querySelector('[data-output="main"]');
  if (!output) {
    return;
  }
  output.textContent = `${label}\n${JSON.stringify(value, null, 2)}`;
};

const attachProbeUiHandlers = (bridge) => {
  const panel = ensureProbePanel();
  const inspectButton = panel.querySelector('[data-action="inspect"]');
  const playButton = panel.querySelector('[data-action="play"]');

  inspectButton?.addEventListener("click", () => {
    const result = bridge.inspect();
    console.log("[xyzw replay] inspect()", result);
    renderProbeOutput(result, "inspect()");
  });

  playButton?.addEventListener("click", () => {
    const result = bridge.play(window.__REPLAY_DATA__);
    console.log("[xyzw replay] play(window.__REPLAY_DATA__)", result);
    renderProbeOutput(result, "play(window.__REPLAY_DATA__)");
  });
};

const attachBridge = async () => {
  await ensureRuntimeLoaded();
  const bridge = {
    __xyzwReplayBridgeReady: true,
    inspect,
    play,
  };
  window.__xyzwReplayBridge = bridge;
  window.__xyzwReplay = bridge;
  attachProbeUiHandlers(bridge);
  const result = inspect();
  console.log("[xyzw replay] public replay bridge attached", result);
  renderProbeOutput(result, "inspect() auto-run");
  return bridge;
};

window.__xyzwReplayBridgeReadyPromise = attachBridge();
