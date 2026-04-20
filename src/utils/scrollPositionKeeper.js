const DEFAULT_SCROLL_TARGET_SELECTORS = [
  ".n-layout-scroll-container",
  ".n-scrollbar-container",
  ".app-shell__content-layout",
  ".app-shell__content",
  ".app-content",
  ".app-root",
  "#app-main",
];

const toFiniteNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const pushUnique = (list, target) => {
  if (!target || list.includes(target)) {
    return;
  }
  list.push(target);
};

const getDocumentScrollTarget = (documentRef) => {
  if (!documentRef) {
    return null;
  }
  return documentRef.scrollingElement || documentRef.documentElement || documentRef.body || null;
};

const getTargetPosition = (entry) => {
  const { documentRef, target, type, windowRef } = entry;

  if (type === "window") {
    return {
      left: toFiniteNumber(windowRef?.pageXOffset ?? windowRef?.scrollX),
      top: toFiniteNumber(windowRef?.pageYOffset ?? windowRef?.scrollY),
    };
  }

  if (type === "document") {
    const scrollTarget = getDocumentScrollTarget(documentRef) || target;
    return {
      left: toFiniteNumber(scrollTarget?.scrollLeft),
      top: toFiniteNumber(scrollTarget?.scrollTop),
    };
  }

  return {
    left: toFiniteNumber(target?.scrollLeft),
    top: toFiniteNumber(target?.scrollTop),
  };
};

const setTargetPosition = (entry) => {
  const { documentRef, left, target, top, type, windowRef } = entry;

  if (type === "window") {
    if (typeof windowRef?.scrollTo === "function") {
      windowRef.scrollTo({ behavior: "auto", left, top });
    }
    return;
  }

  if (type === "document") {
    const scrollTarget = getDocumentScrollTarget(documentRef) || target;
    if (scrollTarget) {
      scrollTarget.scrollLeft = left;
      scrollTarget.scrollTop = top;
    }
    return;
  }

  if (target) {
    target.scrollLeft = left;
    target.scrollTop = top;
  }
};

export const collectScrollTargets = ({
  documentRef = typeof document !== "undefined" ? document : null,
  selectors = DEFAULT_SCROLL_TARGET_SELECTORS,
  candidates = [],
} = {}) => {
  const targets = [];

  pushUnique(targets, documentRef?.documentElement);
  pushUnique(targets, documentRef?.body);

  if (typeof documentRef?.querySelectorAll === "function") {
    selectors.forEach((selector) => {
      documentRef.querySelectorAll(selector).forEach((element) => {
        pushUnique(targets, element);
      });
    });
  }

  candidates.forEach((candidate) => pushUnique(targets, candidate));

  return targets;
};

export const captureScrollPositions = ({
  candidates = [],
  documentRef = typeof document !== "undefined" ? document : null,
  windowRef = typeof window !== "undefined" ? window : null,
} = {}) => {
  const snapshot = [];

  if (windowRef) {
    const windowEntry = {
      documentRef,
      target: windowRef,
      type: "window",
      windowRef,
    };
    snapshot.push({
      ...windowEntry,
      ...getTargetPosition(windowEntry),
    });
  }

  const documentTarget = getDocumentScrollTarget(documentRef);
  if (documentTarget) {
    const documentEntry = {
      documentRef,
      target: documentTarget,
      type: "document",
      windowRef,
    };
    snapshot.push({
      ...documentEntry,
      ...getTargetPosition(documentEntry),
    });
  }

  collectScrollTargets({ candidates, documentRef }).forEach((target) => {
    const elementEntry = {
      documentRef,
      target,
      type: "element",
      windowRef,
    };
    snapshot.push({
      ...elementEntry,
      ...getTargetPosition(elementEntry),
    });
  });

  return snapshot;
};

export const restoreScrollPositions = (snapshot = []) => {
  snapshot.forEach((entry) => {
    setTargetPosition(entry);
  });
};

export const restoreScrollPositionsSoon = (snapshot, windowRef = typeof window !== "undefined" ? window : null) => {
  if (!windowRef || typeof windowRef.requestAnimationFrame !== "function") {
    restoreScrollPositions(snapshot);
    return null;
  }

  return windowRef.requestAnimationFrame(() => {
    windowRef.requestAnimationFrame(() => {
      restoreScrollPositions(snapshot);
    });
  });
};
