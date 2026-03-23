// auth middleware to protect some resources.
function requireAuth(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }

  return res.status(401).json({
    success: false,
    error: { message: "Please log in to access this feature." },
  });
}

module.exports = { requireAuth };
