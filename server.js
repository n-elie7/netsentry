// Main server entry point.

const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const session = require("express-session");
const rateLimit = require("express-rate-limit");
const path = require("path");

const config = require("./config");
const db = require("./database/db");
const { notFound, errorHandler } = require("./middleware/errorHandler");

const authRoutes = require("./routes/auth");
const scanRoutes = require("./routes/scan");
const historyRoutes = require("./routes/history");
const compareRoutes = require("./routes/compare");

// app initialization
const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.use(
  session({
    secret: config.session.secret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: config.env === "production",
      maxAge: config.session.maxAge,
      sameSite: "lax",
    },
  })
);

app.use(
  "/api/",
  rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.max,
    message: {
      success: false,
      error: { message: "Too many requests. Please try again later." },
    },
  })
);

// Serve static frontend files
app.use(express.static(path.join(__dirname, "frontend")));

app.use("/api/auth", authRoutes);
app.use("/api/scan", scanRoutes);
app.use("/api/history", historyRoutes);
app.use("/api/compare", compareRoutes);

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    status: "healthy",
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

app.use(notFound);
app.use(errorHandler);

db.init();
console.log("[DB] Database initialized.");

app.listen(config.port, () => {
  console.log(`
             NetSentry v1.0.0 Running            
     Domain Intelligence & Security Analyzer     
  `);
});

module.exports = app;
