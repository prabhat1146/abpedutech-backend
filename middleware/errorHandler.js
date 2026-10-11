const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;

  if (process.env.NODE_ENV !== "production") {
    console.error(err);
  }

  const resp = res.status(statusCode).json({
    success: false,
    message: err.message || "Internal Server Error",
    ...(process.env.NODE_ENV !== "production" && {
      error: err.name,
      stack: err.stack,
    }),
  });

  console.log(resp);

  return resp;
};

module.exports = errorHandler;
