import { errorResponse } from "../lib/httpResponse.js";

export const adminRequired = (req, res, next) => {
  if (!req.auth?.user?.isAdmin) {
    return errorResponse(res, 403, "AUTH_ADMIN_REQUIRED", "需要管理员权限");
  }
  return next();
};
