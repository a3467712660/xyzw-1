import { errorResponse } from "../lib/httpResponse.js";

export const adminRequired = (req, res, next) => {
  if (!req.auth?.user?.isAdmin) {
    return errorResponse(res, 403, "AUTH_ADMIN_REQUIRED", "需要管理员权限");
  }
  if (!req.auth?.user?.mfaEnabled) {
    return errorResponse(
      res,
      403,
      "AUTH_ADMIN_MFA_REQUIRED",
      "管理员必须先完成 MFA 绑定后才能访问管理中心",
    );
  }
  return next();
};
