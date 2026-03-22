import { errorResponse } from "../lib/httpResponse.js";

export const requirePermission = (
  checker,
  {
    message = "权限不足",
    code = "AUTH_FORBIDDEN",
  } = {},
) =>
  (req, res, next) => {
    let allowed = false;
    try {
      allowed = Boolean(checker(req));
    } catch {
      allowed = false;
    }

    if (!allowed) {
      return errorResponse(res, 403, code, message);
    }
    return next();
  };

