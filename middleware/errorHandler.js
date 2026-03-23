// global error handling.
function notFound(req, res, next) {
  const error = new Error(`Not Found: ${req.originalUrl}`);
  error.status = 404;
  next(error);
}

function errorHandler(err, req, res, _next) {
  const status = err.status || 500;
  const message = err.message || "Internal Server Error";

  console.error(`[ERROR] ${status} — ${message}`);

  if (req.path.startsWith("/api/")) {
    return res.status(status).json({
      success: false,
      error: {
        message,
        status,
      },
    });
  }

  res.status(status).send(`<h1>${status}</h1><p>${message}</p>`);
}

module.exports = { notFound, errorHandler };
