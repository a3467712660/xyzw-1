const normalizeText = (value) => String(value || "").trim();

const normalizeRoleId = (value) => normalizeText(value);

const normalizeRoleIndex = (value) => {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value).trim();
};

export const parseBoundSessId = (accountIdentity) => {
  const parts = String(accountIdentity || "").split("|");
  return normalizeText(parts[0] || "");
};

const getParsedTokenData = (token, parseBase64Token) => {
  if (typeof parseBase64Token !== "function") {
    return null;
  }
  const parsed = parseBase64Token(String(token?.token || ""));
  if (!parsed?.success || !parsed?.data) {
    return null;
  }
  return parsed.data;
};

const buildNormalizedBinding = (binding) => {
  const roleId = normalizeRoleId(binding?.roleId || binding?.gameAccountId);
  if (!roleId) {
    return null;
  }

  return {
    tokenId: normalizeText(binding?.tokenId),
    sessId: parseBoundSessId(binding?.accountIdentity),
    roleId,
    roleName: normalizeText(binding?.roleName),
    region: normalizeText(binding?.region),
    roleIndex: normalizeRoleIndex(binding?.roleIndex),
    expiresAt: binding?.expiresAt || null,
    boundAt: binding?.boundAt || null,
    active: Boolean(binding?.active),
    accountIdentity: normalizeText(binding?.accountIdentity),
  };
};

const buildTokenSnapshot = ({ token, parseBase64Token }) => {
  const parsed = getParsedTokenData(token, parseBase64Token);
  return {
    tokenId: normalizeText(token?.id),
    roleId: normalizeRoleId(
      token?.activationRoleId
        || token?.activationGameAccountId
        || token?.roleId
        || parsed?.activationRoleId
        || parsed?.activationGameAccountId
        || parsed?.roleId,
    ),
    region: normalizeText(
      token?.activationRegion
        || token?.server
        || parsed?.activationRegion
        || parsed?.server,
    ),
    roleIndex: normalizeRoleIndex(token?.roleIndex ?? parsed?.roleIndex ?? ""),
  };
};

export const resolveServerActivationBindingForToken = ({
  token,
  bindings,
  parseBase64Token,
}) => {
  const normalizedBindings = Array.isArray(bindings)
    ? bindings.map((binding) => buildNormalizedBinding(binding)).filter(Boolean)
    : [];
  if (normalizedBindings.length === 0) {
    return null;
  }

  const snapshot = buildTokenSnapshot({ token, parseBase64Token });
  if (snapshot.tokenId) {
    const exactTokenMatch = normalizedBindings.find(
      (binding) => binding.tokenId === snapshot.tokenId,
    );
    if (exactTokenMatch) {
      return exactTokenMatch;
    }
  }

  if (!snapshot.roleId || !snapshot.region) {
    return null;
  }

  const sameRoleBindings = normalizedBindings.filter(
    (binding) =>
      binding.roleId === snapshot.roleId
      && binding.region === snapshot.region,
  );
  if (sameRoleBindings.length === 0) {
    return null;
  }

  if (snapshot.roleIndex) {
    return sameRoleBindings.find(
      (binding) => binding.roleIndex === snapshot.roleIndex,
    ) || null;
  }

  return sameRoleBindings[0] || null;
};
