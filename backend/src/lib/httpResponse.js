export const errorResponse = (
  res,
  status,
  code,
  message,
  details = undefined,
) => {
  const body = {
    success: false,
    message,
    error: {
      code,
      message,
    },
  };

  if (details !== undefined) {
    body.error.details = details;
  }

  return res.status(status).json(body);
};

