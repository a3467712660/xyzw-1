export interface LocalTokenStoreShape {
  userToken: string | null;
  gameTokens: Record<string, unknown>;
  wsConnections: Record<string, unknown>;
  isUserAuthenticated: boolean;
  hasGameTokens: boolean;
  initTokenManager: () => Promise<void>;
  setUserToken: (token: string | null) => void;
  clearUserToken: () => Promise<void>;
  clearAllGameTokens: () => Promise<void>;
}

export declare const useLocalTokenStore: () => LocalTokenStoreShape;
