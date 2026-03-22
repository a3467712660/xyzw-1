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
      req.body = result.data;
    }

    if (query) {
      const result = query.safeParse(req.query ?? {});
      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: pickFirstIssueMessage(result.error),
        });
      }
      req.query = result.data;
    }

    if (params) {
      const result = params.safeParse(req.params ?? {});
      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: pickFirstIssueMessage(result.error),
        });
      }
      req.params = result.data;
    }

    return next();
  };

