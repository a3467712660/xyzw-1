import { useLocalStorage } from "@vueuse/core";
import { computed, ref } from "vue";
import { SAFE_MODE_LOCAL_KEY } from "@/constants/userPreferences";

export interface TokenData {
  id: string;
  ownerId?: string;
  sessId?: string;
  roleId?: string;
  name: string;
  token: string;
  wsUrl: string | null;
  server: string;
  roleIndex?: number | string;
  remark?: string;
  importMethod?: "manual" | "bin" | "url" | "wxQrcode";
  sourceUrl?: string;
  avatar?: string;
  upgradedToPermanent?: boolean;
  upgradedAt?: string;
  updatedAt?: string;
  binSourceState?: "available" | "missing";
  binSourceMissingAt?: string | null;
  activationSessId?: string;
  activationRoleId?: string;
  activationGameAccountId?: string;
  activationRoleName?: string;
  activationRegion?: string;
  activationExpiresAt?: string | null;
  activationBoundAt?: string | null;
}

export interface TokenGroup {
  id: string;
  ownerId?: string;
  name: string;
  color: string;
  tokenIds: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface CrossTabConnectionState {
  [key: string]: unknown;
}

interface OwnedTokenGroup extends TokenGroup {
  ownerId?: string;
}

export const activeUserId = useLocalStorage("activeUserId", "");
export const safeModeEnabled = useLocalStorage<boolean>(
  SAFE_MODE_LOCAL_KEY,
  true,
);
export const allGameTokens = ref<TokenData[]>([]);
export const selectedTokenId = useLocalStorage<string | null>(
  "selectedTokenId",
  null,
);
export const activeConnections = useLocalStorage<
  Record<string, CrossTabConnectionState>
>("activeConnections", {});
export const allTokenGroups = useLocalStorage<OwnedTokenGroup[]>(
  "tokenGroups",
  [],
);

export const getEffectiveUserId = () => {
  const localActive = localStorage.getItem("activeUserId") || "";
  if (localActive && localActive !== activeUserId.value) {
    activeUserId.value = localActive;
  }

  return activeUserId.value || "";
};

export const scopeTokenToUser = (token: TokenData, userId: string) => ({
  ...token,
  ownerId: token.ownerId || userId || undefined,
});

export const gameTokens = computed<TokenData[]>({
  get: () => {
    const userId = getEffectiveUserId();
    if (!userId) {
      return allGameTokens.value.filter((token) => !token.ownerId);
    }
    return allGameTokens.value.filter((token) => token.ownerId === userId);
  },
  set: (tokens) => {
    const userId = getEffectiveUserId();
    if (!userId) {
      allGameTokens.value = tokens;
      return;
    }
    const others = allGameTokens.value.filter(
      (token) => token.ownerId && token.ownerId !== userId,
    );
    allGameTokens.value = [
      ...others,
      ...tokens.map((token) => scopeTokenToUser(token, userId)),
    ];
  },
});

export const hasTokens = computed(() => gameTokens.value.length > 0);

export const selectedToken = computed(() => {
  return gameTokens.value.find((token) => token.id === selectedTokenId.value);
});

export const tokenGroups = computed<OwnedTokenGroup[]>({
  get: () => {
    const userId = getEffectiveUserId();
    if (!userId) {
      return allTokenGroups.value.filter((group) => !group.ownerId);
    }
    return allTokenGroups.value.filter((group) => group.ownerId === userId);
  },
  set: (groups) => {
    const userId = getEffectiveUserId();
    if (!userId) {
      allTokenGroups.value = groups;
      return;
    }
    const others = allTokenGroups.value.filter(
      (group) => group.ownerId && group.ownerId !== userId,
    );
    allTokenGroups.value = [
      ...others,
      ...groups.map((group) => ({
        ...group,
        ownerId: group.ownerId || userId,
      })),
    ];
  },
});
