export interface AuthStoreShape {
  user: unknown;
  token: string | null;
  isLoading: boolean;
  isInitialized: boolean;
  isAuthenticated: boolean;
  userInfo: unknown;
  login: (credentials?: unknown) => Promise<unknown>;
  register: (payload?: unknown) => Promise<unknown>;
  verifyMfaLogin: (payload?: unknown) => Promise<unknown>;
  createMfaQrSession: (payload?: unknown) => Promise<unknown>;
  verifyMfaQrLogin: (payload?: unknown) => Promise<unknown>;
  resetPasswordWithShortCode: (payload?: unknown) => Promise<unknown>;
  logout: () => Promise<void>;
  handleUnauthorized: () => void;
  fetchUserInfo: () => Promise<boolean>;
  refreshAccessToken: () => Promise<boolean>;
  initializeAuth: () => Promise<void>;
  initAuth: () => Promise<void>;
  recoverSessionFromServer: () => Promise<boolean>;
}

export declare const useAuthStore: () => AuthStoreShape;
