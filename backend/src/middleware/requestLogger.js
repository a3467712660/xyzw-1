import {
  createAppLogger,
  createRequestContextMiddleware,
  createStructuredRequestLogger,
} from "../lib/logger.js";

export const requestLogger = ({ logger }) => {
  const activeLogger = logger || createAppLogger();
  const requestContextMiddleware = createRequestContextMiddleware({
    logger: activeLogger,
  });
  const structuredRequestLogger = createStructuredRequestLogger({
    logger: activeLogger,
  });

  return (req, res, next) => {
    requestContextMiddleware(req, res, (contextError) => {
      if (contextError) {
        next(contextError);
        return;
      }
      structuredRequestLogger(req, res, next);
    });
  };
};
