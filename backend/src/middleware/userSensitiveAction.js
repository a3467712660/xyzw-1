import { makeSensitiveAction } from "./sensitiveAction.js";

export const USER_SENSITIVE_ACTION_TOKEN_HEADER = "x-user-confirm-token";
export const USER_SENSITIVE_ACTION_TOKEN_PURPOSE = "user-sensitive-action";
export const USER_SENSITIVE_ACTION_TTL_SECONDS = 5 * 60;

const userSensitiveAction = makeSensitiveAction({
  purpose: USER_SENSITIVE_ACTION_TOKEN_PURPOSE,
  ttlSeconds: USER_SENSITIVE_ACTION_TTL_SECONDS,
  headerName: USER_SENSITIVE_ACTION_TOKEN_HEADER,
  codePrefix: "USER_CONFIRM",
});

export const issueUserSensitiveActionToken = (user) => userSensitiveAction.issue(user);
export const userSensitiveActionRequired = userSensitiveAction.required;
