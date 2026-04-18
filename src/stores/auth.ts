import { useAuthStore as runtimeUseAuthStore } from "./auth.runtime.js";

export const useAuthStore: typeof runtimeUseAuthStore = runtimeUseAuthStore;
