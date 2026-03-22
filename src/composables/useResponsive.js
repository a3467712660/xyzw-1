import { computed } from "vue";
import { useBreakpoints, useWindowSize } from "@vueuse/core";
import { APP_BREAKPOINTS } from "@/constants/ui";

export function useResponsive() {
  const { width } = useWindowSize();
  const breakpoints = useBreakpoints(APP_BREAKPOINTS);

  const isXs = breakpoints.smaller("s");
  const isMobile = breakpoints.smaller("m");
  const isTablet = computed(() => width.value >= APP_BREAKPOINTS.s && width.value < APP_BREAKPOINTS.l);
  const isDesktop = breakpoints.greaterOrEqual("m");
  const isWide = breakpoints.greaterOrEqual("l");

  return {
    width,
    isXs,
    isMobile,
    isTablet,
    isDesktop,
    isWide,
  };
}
