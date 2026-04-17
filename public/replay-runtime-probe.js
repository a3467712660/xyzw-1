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
const REPLAY_EXACT_METHOD_RE = /replay|playback/i;
const REPLAY_BROAD_METHOD_RE = /battle|fight|pvp/i;
const GENERIC_OWNER_RE = /(?:^|\.)(?:window|self|top|parent|frames|document)(?:\.|$)/i;
const GLOBAL_KEY_LIMIT = 240;
const MATCH_LIMIT = 40;
const MEMBER_LIMIT = 12;
const RANKED_TARGET_LIMIT = 10;
const VISUAL_NODE_LIMIT = 30;

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

const toFunctionSourceSnippet = (value, maxLength = 220) =>
  toNormalizedSourceSnippet(toFunctionSource(value)).slice(0, maxLength);

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

const isPlainObject = (value) =>
  Boolean(value)
  && typeof value === "object"
  && Object.getPrototypeOf(value) === Object.prototype;

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

const getBattleDataLike = (value) =>
  value?.battleData
  || value?.battleInputData?.battleData
  || value?.battleInputSnapshot?.battleData
  || value?.lastBattleData
  || value?.fightRoleBase?.lastBattleData
  || null;

const getCollectionType = (value) => {
  if (value == null) {
    return null;
  }
  if (Array.isArray(value)) {
    return "array";
  }
  if (typeof value?.get === "function" && typeof value?.forEach === "function") {
    return "map-like";
  }
  if (typeof value?.forEach === "function") {
    return "iterable";
  }
  return typeof value;
};

const inspectPayloadShape = (value) => {
  const battleData = getBattleDataLike(value);
  const leftTeam = battleData?.leftTeam?.team ?? battleData?.leftTeam ?? null;
  const rightTeam = battleData?.rightTeam?.team ?? battleData?.rightTeam ?? null;

  let kind = "unknown";
  if (looksLikeBattleInput(value)) {
    kind = "battleInputLike";
  } else if (value?.battleInputData || value?.battleInputSnapshot) {
    kind = "wrapped";
  } else if (value?.battleData || value?.fightRoleBase || value?.lastBattleData) {
    kind = "raw";
  }

  return {
    kind,
    hasBattleData: Boolean(value?.battleData),
    hasBattleInputData: Boolean(value?.battleInputData),
    hasBattleInputSnapshot: Boolean(value?.battleInputSnapshot),
    hasFightRoleBase: Boolean(value?.fightRoleBase),
    hasLastBattleData: Boolean(value?.lastBattleData),
    hasMapId: value?.mapId != null,
    hasBattleResult: value?.battleResult != null || battleData?.result != null,
    leftTeamType: leftTeam == null ? null : typeof leftTeam,
    rightTeamType: rightTeam == null ? null : typeof rightTeam,
    leftTeamCollectionType: getCollectionType(leftTeam),
    rightTeamCollectionType: getCollectionType(rightTeam),
  };
};

const cloneOptionsValue = (value) => {
  if (value instanceof Map) {
    return new Map(value);
  }
  if (isPlainObject(value)) {
    return { ...value };
  }
  return value;
};

const mergeOptionsValue = (innerValue, outerValue) => {
  if (innerValue instanceof Map && outerValue instanceof Map) {
    const merged = new Map(innerValue);
    for (const [key, value] of outerValue.entries()) {
      if (!merged.has(key)) {
        merged.set(key, value);
      }
    }
    return {
      value: merged,
      optionsMerge: "map-merged-missing-keys",
    };
  }

  if (isPlainObject(innerValue) && isPlainObject(outerValue)) {
    const merged = { ...innerValue };
    for (const [key, value] of Object.entries(outerValue)) {
      if (!(key in merged) || merged[key] == null) {
        merged[key] = value;
      }
    }
    return {
      value: merged,
      optionsMerge: "object-merged-missing-keys",
    };
  }

  if (innerValue != null) {
    return {
      value: cloneOptionsValue(innerValue),
      optionsMerge: outerValue != null ? "preserved-inner-type" : "inner-preserved",
    };
  }

  if (outerValue != null) {
    return {
      value: cloneOptionsValue(outerValue),
      optionsMerge: "outer-adopted",
    };
  }

  return {
    value: undefined,
    optionsMerge: "none",
  };
};

const prepareProductionReplayPayload = (value, options = {}) => {
  const wrapper = isObjectLike(value) ? value : null;
  const unwrapped = wrapper?.battleInputData ?? wrapper?.battleInputSnapshot ?? value;

  if (!isObjectLike(unwrapped)) {
    return {
      optionsMerge: "non-object",
      payload: unwrapped,
    };
  }

  const payload = { ...unwrapped };
  const outer = wrapper && wrapper !== unwrapped ? wrapper : null;

  for (const field of [
    "mapId",
    "battleResult",
    "stageNameStr",
    "topName",
    "showRightPower",
  ]) {
    if (payload[field] == null && outer?.[field] != null) {
      payload[field] = outer[field];
    }
  }

  const optionsMergeResult = mergeOptionsValue(payload.options, outer?.options);
  if (optionsMergeResult.value !== undefined) {
    payload.options = optionsMergeResult.value;
  } else if ("options" in payload && payload.options == null) {
    delete payload.options;
  }

  if (payload.battleResult == null && payload?.battleData?.result != null) {
    payload.battleResult = payload.battleData.result;
  }

  if (payload.mapId == null && options?.mapId != null) {
    payload.mapId = options.mapId;
  }

  return {
    optionsMerge: optionsMergeResult.optionsMerge,
    payload,
  };
};

const createTargetCandidate = ({
  componentName = null,
  fn = null,
  invoke,
  label,
  methodName = null,
  nodeName = null,
  nodePath = null,
  ownerKey = null,
  source,
} = {}) => ({
  arity: typeof fn === "function" ? fn.length : null,
  componentName,
  functionSourceSnippet: toFunctionSourceSnippet(fn),
  invoke,
  label,
  methodName,
  nodeName,
  nodePath,
  ownerKey,
  source,
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
      if (
        key === "__xyzwReplayBridge"
        || key === "__xyzwReplay"
        || key === "__xyzwReplayBridgeReadyPromise"
      ) {
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
            arity: value.length,
            functionSourceSnippet: toFunctionSourceSnippet(value),
            label,
            methodName: key,
            ownerKey: key,
            source: "global-function",
          });
          targetCandidates.push(createTargetCandidate({
            fn: value,
            invoke: (payload, playOptions = {}) => value.call(root.holder, payload, playOptions),
            label,
            methodName: key,
            ownerKey: key,
            source: "global-function",
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
          arity: method.length,
          functionSourceSnippet: toFunctionSourceSnippet(method),
          label,
          methodName,
          ownerKey: key,
          source: "global-object",
        });
        targetCandidates.push(createTargetCandidate({
          fn: method,
          invoke: (payload, playOptions = {}) => value[methodName].call(value, payload, playOptions),
          label,
          methodName,
          ownerKey: key,
          source: "global-object",
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
          arity: method.length,
          componentName,
          functionSourceSnippet: toFunctionSourceSnippet(method),
          label,
          methodName,
          nodeName,
          nodePath,
          source: "scene-component",
        });
        targetCandidates.push(createTargetCandidate({
          componentName,
          fn: method,
          invoke: (payload, playOptions = {}) => component[methodName].call(component, payload, playOptions),
          label,
          methodName,
          nodeName,
          nodePath,
          source: "scene-component",
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

const scoreProductionReplayTarget = (candidate) => {
  let score = 0;
  const why = [];
  const methodName = String(candidate?.methodName || "");
  const componentName = String(candidate?.componentName || "");
  const nodeLabel = `${candidate?.nodeName || ""} ${candidate?.nodePath || ""}`;
  const functionSourceSnippet = String(candidate?.functionSourceSnippet || "");

  if (REPLAY_EXACT_METHOD_RE.test(methodName)) {
    score += 60;
    why.push("methodName:replay/playback");
  } else if (REPLAY_BROAD_METHOD_RE.test(methodName)) {
    score += 28;
    why.push("methodName:battle/fight/pvp");
  }

  if (candidate?.source === "scene-component") {
    score += 24;
    why.push("source:scene-component");
  } else if (candidate?.source === "global-object") {
    score += 10;
    why.push("source:global-object");
  } else if (candidate?.source === "global-function") {
    score += 4;
    why.push("source:global-function");
  }

  if (REPLAY_EXACT_METHOD_RE.test(componentName)) {
    score += 24;
    why.push("componentName:replay/playback");
  } else if (REPLAY_BROAD_METHOD_RE.test(componentName)) {
    score += 12;
    why.push("componentName:battle/fight/pvp");
  }

  if (REPLAY_EXACT_METHOD_RE.test(nodeLabel)) {
    score += 18;
    why.push("nodePath:replay/playback");
  } else if (REPLAY_BROAD_METHOD_RE.test(nodeLabel)) {
    score += 10;
    why.push("nodePath:battle/fight/pvp");
  }

  if (REPLAY_KEYWORD_RE.test(functionSourceSnippet)) {
    score += 12;
    why.push("functionSource:replay/fight/pvp");
  }

  if (candidate?.arity === 1 || candidate?.arity === 2) {
    score += 8;
    why.push(`arity:${candidate.arity}`);
  } else if (candidate?.arity === 0 || candidate?.arity >= 3) {
    score -= 6;
    why.push(`arity:${candidate.arity ?? "unknown"}:less-like-payload-options`);
  }

  const ownerLabel = `${candidate?.ownerKey || ""} ${candidate?.label || ""}`;
  if (GENERIC_OWNER_RE.test(ownerLabel)) {
    score -= 20;
    why.push("generic-owner-penalty");
  }

  return {
    score,
    why,
  };
};

const sortRankedTargetEntries = (left, right) => {
  if (right.score !== left.score) {
    return right.score - left.score;
  }

  const sourcePriority = {
    "scene-component": 3,
    "global-object": 2,
    "global-function": 1,
  };
  const sourceDiff = (sourcePriority[right.candidate.source] || 0) - (sourcePriority[left.candidate.source] || 0);
  if (sourceDiff !== 0) {
    return sourceDiff;
  }

  return String(left.candidate.label || "").localeCompare(String(right.candidate.label || ""));
};

const resolveProductionReplayPlayTarget = (gameWindow) => {
  const globalCandidates = collectReplayGlobalCandidates(gameWindow);
  const sceneCandidates = scanSceneForReplayCandidates(gameWindow);
  const targetCandidates = [
    ...globalCandidates.targetCandidates,
    ...sceneCandidates.targetCandidates,
  ];

  const rankedEntries = targetCandidates
    .filter(isValidTargetCandidate)
    .map((candidate) => {
      const score = scoreProductionReplayTarget(candidate);
      return {
        candidate,
        score: score.score,
        why: score.why,
      };
    })
    .sort(sortRankedTargetEntries);

  const playTargetEntry = rankedEntries[0] || null;
  const rankedTargets = rankedEntries
    .slice(0, RANKED_TARGET_LIMIT)
    .map(({ candidate, score, why }) => ({
      arity: candidate.arity,
      componentName: candidate.componentName,
      functionSourceSnippet: candidate.functionSourceSnippet,
      label: candidate.label,
      methodName: candidate.methodName,
      nodePath: candidate.nodePath,
      score,
      source: candidate.source,
      why,
    }));

  return {
    availableGlobals: globalCandidates.availableGlobals,
    bridgeStatus: playTargetEntry ? "bridge-ready" : "bridge-exposed-but-play-target-missing",
    playMethodCandidates: [
      ...globalCandidates.playMethodCandidates,
      ...sceneCandidates.playMethodCandidates,
    ].slice(0, MATCH_LIMIT),
    playTarget: playTargetEntry?.candidate || null,
    playTargetLabel: playTargetEntry?.candidate?.label || null,
    playTargetScore: playTargetEntry?.score ?? null,
    playTargetSource: playTargetEntry?.candidate?.source || null,
    playTargetWhy: playTargetEntry?.why || [],
    rankedTargets,
    scene: sceneCandidates.scene,
    sceneComponentMatches: sceneCandidates.sceneComponentMatches,
    sceneNodeMatches: sceneCandidates.sceneNodeMatches,
  };
};

const getDefaultReplayPayload = () =>
  window.__REPLAY_DATA__ ?? window.__xyzwReplayData ?? null;

const getVisualProbeCapabilities = (gameWindow) => ({
  canvas: typeof window?.document?.querySelectorAll === "function",
  sceneScan: typeof gameWindow?.cc?.director?.getScene === "function",
  showBattleLoading: "not-found(optional)",
});

const getSceneNodeSummary = (scene) => {
  const summary = [];
  const keywordNodeMatches = [];

  if (!scene) {
    return {
      keywordNodeMatches,
      sceneNodeSummary: summary,
    };
  }

  const queue = [{
    node: scene,
    path: scene?.name || "Game",
  }];
  const seenNodes = new Set();

  while (queue.length > 0 && summary.length < VISUAL_NODE_LIMIT) {
    const current = queue.shift();
    const node = current?.node || null;
    if (!node || seenNodes.has(node)) {
      continue;
    }
    seenNodes.add(node);

    const nodeName = String(node?.name || "(anonymous)");
    const nodePath = current?.path || nodeName;
    const componentNames = getSceneNodeComponents(node)
      .map((component) => getObjectName(component))
      .filter(Boolean)
      .slice(0, 6);
    const signature = componentNames.length > 0
      ? `${nodePath}#${componentNames.join(",")}`
      : nodePath;

    summary.push(signature);

    if (
      matchesReplayKeyword(nodeName)
      || componentNames.some((entry) => matchesReplayKeyword(entry))
    ) {
      keywordNodeMatches.push(signature);
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
    keywordNodeMatches: keywordNodeMatches.slice(0, VISUAL_NODE_LIMIT),
    sceneNodeSummary: summary,
  };
};

const isCanvasVisible = (canvas) => {
  if (!canvas || typeof canvas.getBoundingClientRect !== "function") {
    return false;
  }

  const rect = canvas.getBoundingClientRect();
  const style = window.getComputedStyle(canvas);
  return rect.width > 0
    && rect.height > 0
    && style.display !== "none"
    && style.visibility !== "hidden"
    && Number(style.opacity || 1) > 0;
};

const summarizeCanvas = (canvas, index) => ({
  className: String(canvas?.className || ""),
  height: canvas?.height ?? null,
  id: canvas?.id || null,
  index,
  visible: isCanvasVisible(canvas),
  width: canvas?.width ?? null,
});

const snapshotVisualState = (gameWindow) => {
  const scene = gameWindow?.cc?.director?.getScene?.() || null;
  const canvases = Array.from(window?.document?.querySelectorAll?.("canvas") || []);
  const visibleCanvases = canvases
    .map(summarizeCanvas)
    .filter((entry) => entry.visible)
    .slice(0, 10);
  const sceneSummary = getSceneNodeSummary(scene);

  return {
    canvasCount: canvases.length,
    hasGameCanvas: Boolean(gameWindow?.cc?.game?.canvas),
    keywordNodeMatches: sceneSummary.keywordNodeMatches,
    scene: scene?.name || null,
    sceneNodeSummary: sceneSummary.sceneNodeSummary,
    visibleCanvases,
  };
};

const sleep = (ms) =>
  new Promise((resolve) => window.setTimeout(resolve, ms));

const toStableListKey = (value) =>
  JSON.stringify(value || []);

const deriveVisualChange = (before, after300, after1200) => {
  const reasons = [];
  const beforeKeywordSet = new Set(before?.keywordNodeMatches || []);

  const compareSnapshot = (label, snapshot) => {
    if (!snapshot) {
      return;
    }

    if (snapshot.scene !== before?.scene) {
      reasons.push(`${label}:scene:${before?.scene || "null"}->${snapshot.scene || "null"}`);
    }

    if (Boolean(snapshot.hasGameCanvas) !== Boolean(before?.hasGameCanvas)) {
      reasons.push(`${label}:hasGameCanvas:${Boolean(before?.hasGameCanvas)}->${Boolean(snapshot.hasGameCanvas)}`);
    }

    if (snapshot.canvasCount !== before?.canvasCount) {
      reasons.push(`${label}:canvasCount:${before?.canvasCount || 0}->${snapshot.canvasCount}`);
    }

    if (toStableListKey(snapshot.visibleCanvases) !== toStableListKey(before?.visibleCanvases)) {
      reasons.push(`${label}:visibleCanvases:changed`);
    }

    if (toStableListKey(snapshot.sceneNodeSummary) !== toStableListKey(before?.sceneNodeSummary)) {
      reasons.push(`${label}:sceneNodeSummary:changed`);
    }

    const newKeywordMatches = (snapshot.keywordNodeMatches || [])
      .filter((entry) => !beforeKeywordSet.has(entry));
    if (newKeywordMatches.length > 0) {
      reasons.push(`${label}:newKeywordMatches:${newKeywordMatches.slice(0, 5).join(", ")}`);
    }
  };

  compareSnapshot("after300", after300);
  compareSnapshot("after1200", after1200);

  return {
    visualChanged: reasons.length > 0,
    visualChangeReasons: reasons,
  };
};

const compressVisualSnapshot = (snapshot) => ({
  canvasCount: snapshot?.canvasCount ?? 0,
  hasGameCanvas: Boolean(snapshot?.hasGameCanvas),
  keywordNodeMatchCount: snapshot?.keywordNodeMatches?.length || 0,
  scene: snapshot?.scene || null,
  sceneNodeCount: snapshot?.sceneNodeSummary?.length || 0,
  visibleCanvasCount: snapshot?.visibleCanvases?.length || 0,
});

const buildVisualPostCheck = ({
  after300 = null,
  after1200 = null,
  before = null,
  debugVisualProbe = false,
  extra = {},
  visualChangeReasons = [],
  visualChanged = false,
} = {}) => {
  if (debugVisualProbe) {
    return {
      after300,
      after1200,
      before,
      ...extra,
      visualChangeReasons,
      visualChanged,
    };
  }

  return {
    after300: after300 ? compressVisualSnapshot(after300) : null,
    after1200: after1200 ? compressVisualSnapshot(after1200) : null,
    before: before ? compressVisualSnapshot(before) : null,
    ...extra,
    visualChangeReasons,
    visualChanged,
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
    payloadShapeDefault: inspectPayloadShape(getDefaultReplayPayload()),
    playMethodCandidates: resolution.playMethodCandidates,
    playTargetLabel: resolution.playTargetLabel,
    playTargetScore: resolution.playTargetScore,
    playTargetSource: resolution.playTargetSource,
    playTargetWhy: resolution.playTargetWhy,
    probeCompatibility: "compatible-probe",
    probeFamily: PROBE_FAMILIES.PRODUCTION,
    rankedTargets: resolution.rankedTargets,
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
    visualProbeCapabilities: getVisualProbeCapabilities(gameWindow),
  };
};

const play = async (
  rawOrWrappedData = getDefaultReplayPayload(),
  options = {},
) => {
  const { gameWindow } = findGameWindow(window);
  const loaderInfo = detectLoaderFamily(gameWindow);

  if (loaderInfo.loaderFamily === LOADER_FAMILIES.PUBLIC) {
    const resolution = resolveProductionReplayPlayTarget(gameWindow);
    const payloadShapeBefore = inspectPayloadShape(rawOrWrappedData);
    const preparedPayload = prepareProductionReplayPayload(rawOrWrappedData, options);
    const payloadShapeAfter = inspectPayloadShape(preparedPayload.payload);
    const before = snapshotVisualState(gameWindow);

    if (!resolution.playTarget) {
      return {
        ok: false,
        status: "bridge-exposed-but-play-target-missing",
        loaderFamily: loaderInfo.loaderFamily,
        detail:
          "The production replay bridge is exposed, but no stable play target was resolved from globals or the Game scene.",
        optionsMerge: preparedPayload.optionsMerge,
        payloadShapeAfter,
        payloadShapeBefore,
        playTargetLabel: null,
        playTargetScore: null,
        playTargetSource: null,
        playTargetWhy: [],
        rankedTargets: resolution.rankedTargets,
        visualPostCheck: buildVisualPostCheck({
          before,
          debugVisualProbe: options.debugVisualProbe === true,
          extra: {
            skipped: "no-play-target",
          },
          visualChangeReasons: ["no-play-target"],
          visualChanged: false,
        }),
      };
    }

    try {
      const result = await Promise.resolve(
        resolution.playTarget.invoke(preparedPayload.payload, options),
      );
      await sleep(300);
      const after300 = snapshotVisualState(gameWindow);
      await sleep(900);
      const after1200 = snapshotVisualState(gameWindow);
      const visualChange = deriveVisualChange(before, after300, after1200);
      const status = visualChange.visualChanged
        ? "played-via-production-bridge-and-visual-changed"
        : "played-via-production-bridge-but-no-visual-change";

      return {
        ok: true,
        status,
        loaderFamily: loaderInfo.loaderFamily,
        optionsMerge: preparedPayload.optionsMerge,
        payloadShapeAfter,
        payloadShapeBefore,
        playTargetLabel: resolution.playTargetLabel,
        playTargetScore: resolution.playTargetScore,
        playTargetSource: resolution.playTargetSource,
        playTargetWhy: resolution.playTargetWhy,
        rankedTargets: resolution.rankedTargets,
        result,
        visualPostCheck: buildVisualPostCheck({
          after300,
          after1200,
          before,
          debugVisualProbe: options.debugVisualProbe === true,
          visualChangeReasons: visualChange.visualChangeReasons,
          visualChanged: visualChange.visualChanged,
        }),
      };
    } catch (error) {
      return {
        ok: false,
        status: "bridge-play-target-threw",
        loaderFamily: loaderInfo.loaderFamily,
        errorMessage: error?.message || String(error),
        optionsMerge: preparedPayload.optionsMerge,
        payloadShapeAfter,
        payloadShapeBefore,
        playTargetLabel: resolution.playTargetLabel,
        playTargetScore: resolution.playTargetScore,
        playTargetSource: resolution.playTargetSource,
        playTargetWhy: resolution.playTargetWhy,
        rankedTargets: resolution.rankedTargets,
        stackTop: String(error?.stack || "")
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)[1] || null,
        visualPostCheck: buildVisualPostCheck({
          before,
          debugVisualProbe: options.debugVisualProbe === true,
          extra: {
            skipped: "invoke-threw-before-post-check",
          },
          visualChangeReasons: ["invoke-threw-before-post-check"],
          visualChanged: false,
        }),
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
      <code>await window.__xyzwReplayBridge.play(window.__REPLAY_DATA__)</code>
      <code>await window.__xyzwReplayBridge.play(window.__REPLAY_DATA__, { debugVisualProbe: true })</code>
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

  playButton?.addEventListener("click", async () => {
    const result = await bridge.play(window.__REPLAY_DATA__, {
      debugVisualProbe: true,
    });
    console.log("[xyzw replay] play(window.__REPLAY_DATA__)", result);
    renderProbeOutput(result, "await play(window.__REPLAY_DATA__)");
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
