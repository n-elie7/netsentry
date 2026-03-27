// Main server entry point.

const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const session = require("express-session");
const { createClient } = require("redis");
const RedisStore = require("connect-redis").default;
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

const sessionConfig = {
  secret: config.session.secret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: config.env === "production",
    maxAge: config.session.maxAge,
    sameSite: "lax",
  },
};
 
if (config.redis && config.redis.url && createClient && RedisStore) {
  const redisSessionClient = createClient({ url: config.redis.url });
  redisSessionClient.connect().then(() => {
    console.log("[REDIS] Connected for shared sessions.");
  }).catch((err) => {
    console.error("[REDIS] Session store connection failed:", err.message);
  });
  sessionConfig.store = new RedisStore({ client: redisSessionClient });
}
 
app.use(session(sessionConfig));

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

app.use((req, res, next) => {
  res.setHeader("X-Server-By", require("os").hostname());
  next();
});

app.get("/api/health", (req, res) => {
  const memUsage = process.memoryUsage();
  res.json({
    success: true,
    status: "healthy",
    version: require("./package.json").version,
    node: process.version,
    pid: process.pid,
    uptime: Math.floor(process.uptime()),
    memory: {
      rss: Math.round(memUsage.rss / 1024 / 1024) + "MB",
      heap_used: Math.round(memUsage.heapUsed / 1024 / 1024) + "MB",
      heap_total: Math.round(memUsage.heapTotal / 1024 / 1024) + "MB",
    },
    hostname: require("os").hostname(),
    platform: process.platform + "/" + process.arch,
    timestamp: new Date().toISOString(),
  });
});

app.use(notFound);
app.use(errorHandler);

db.init().then(() => {
  console.log("[DB] Database initialized.");

  app.listen(config.port, () => {
    console.log(`
              NetSentry v1.0.0 Running            
      Domain Intelligence & Security Analyzer     
    `);
  });
});


module.exports = app;
