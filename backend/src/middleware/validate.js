const pickFirstIssueMessage = (error) => {
  const issue = error?.issues?.[0];
  if (!issue) {
    return "请求参数无效";
  }

  const path = Array.isArray(issue.path) && issue.path.length > 0
    ? issue.path.join(".")
    : "request";

  return `${path}: ${issue.message}`;
};

const replaceRequestPayload = (req, key, nextValue) => {
  try {
    req[key] = nextValue;
    return;
  } catch {
    const currentValue = req[key];
    if (currentValue && typeof currentValue === "object") {
      Object.keys(currentValue).forEach((currentKey) => {
        delete currentValue[currentKey];
      });
      Object.assign(currentValue, nextValue);
      return;
    }

    Object.defineProperty(req, key, {
      configurable: true,
      enumerable: true,
      writable: true,
      value: nextValue,
    });
  }
};

export const validateRequest = ({ body, query, params }) =>
  (req, res, next) => {
    if (body) {
      const result = body.safeParse(req.body ?? {});
      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: pickFirstIssueMessage(result.error),
        });
      }
      replaceRequestPayload(req, "body", result.data);
    }

    if (query) {
      const result = query.safeParse(req.query ?? {});
      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: pickFirstIssueMessage(result.error),
        });
      }
      replaceRequestPayload(req, "query", result.data);
    }

    if (params) {
      const result = params.safeParse(req.params ?? {});
      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: pickFirstIssueMessage(result.error),
        });
      }
      replaceRequestPayload(req, "params", result.data);
    }

    return next();
  };
