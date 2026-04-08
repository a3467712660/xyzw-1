import { onUnmounted, ref, watch } from "vue";
import { useGameCardPanelActive } from "@/composables/gameCards/useGameCardPanelActive";

const sharedNow = ref(Date.now());
let tickerHandle = null;
let subscriberCount = 0;

const syncSharedNow = () => {
  sharedNow.value = Date.now();
};

const startSharedTicker = () => {
  if (tickerHandle != null || typeof window === "undefined") {
    return;
  }

  syncSharedNow();
  tickerHandle = window.setInterval(syncSharedNow, 1000);
};

const stopSharedTicker = () => {
  if (tickerHandle == null || typeof window === "undefined") {
    return;
  }

  window.clearInterval(tickerHandle);
  tickerHandle = null;
};

const retainSharedTicker = () => {
  subscriberCount += 1;
  startSharedTicker();
};

const releaseSharedTicker = () => {
  subscriberCount = Math.max(0, subscriberCount - 1);
  if (subscriberCount === 0) {
    stopSharedTicker();
  }
};

export function useGameCardTicker(options = {}) {
  const { panelActive: panelActiveSource = true } = options;
  const { panelActive } = useGameCardPanelActive(panelActiveSource);
  const now = ref(Date.now());

  let subscribed = false;
  let stopSharedWatch = null;

  const syncNow = () => {
    now.value = Date.now();
  };

  const attach = () => {
    syncNow();
    if (subscribed) {
      return;
    }

    subscribed = true;
    retainSharedTicker();
    stopSharedWatch = watch(sharedNow, (value) => {
      now.value = value;
    });
  };

  const detach = () => {
    if (typeof stopSharedWatch === "function") {
      stopSharedWatch();
      stopSharedWatch = null;
    }

    if (subscribed) {
      subscribed = false;
      releaseSharedTicker();
    }
  };

  watch(
    panelActive,
    (active) => {
      if (active) {
        attach();
        return;
      }

      syncNow();
      detach();
    },
    { immediate: true },
  );

  onUnmounted(() => {
    detach();
  });

  return {
    now,
    panelActive,
    syncNow,
  };
}
