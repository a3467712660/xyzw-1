import { useLocalTokenStore as runtimeUseLocalTokenStore } from "./localTokenManager.runtime.js";

export const useLocalTokenStore: typeof runtimeUseLocalTokenStore = runtimeUseLocalTokenStore;
