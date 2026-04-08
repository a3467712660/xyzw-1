import { computed, unref, watch } from "vue";

export function useGameCardPanelActive(source = true, options = {}) {
  const panelActive = computed(() => {
    const raw = unref(source);
    return raw == null ? true : Boolean(raw);
  });

  if (typeof options.onActive === "function" || typeof options.onInactive === "function") {
    watch(
      panelActive,
      (active, previous) => {
        if (previous === undefined) {
          if (options.immediate === true) {
            if (active) {
              options.onActive?.();
            } else {
              options.onInactive?.();
            }
          }
          return;
        }

        if (active === previous) {
          return;
        }

        if (active) {
          options.onActive?.();
          return;
        }

        options.onInactive?.();
      },
      { immediate: true },
    );
  }

  return {
    panelActive,
    isPanelActive: panelActive,
    isPanelPaused: computed(() => !panelActive.value),
  };
}
