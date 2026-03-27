

require("dotenv").config();

module.exports = {
  port: process.env.PORT || 3000,
  env: process.env.NODE_ENV || "development",

  apis: {
    virusTotal: {
      key: process.env.VIRUSTOTAL_API_KEY,
      baseUrl: "https://www.virustotal.com/api/v3",
    },
    whoisXml: {
      key: process.env.WHOISXML_API_KEY,
      baseUrl: "https://www.whoisxmlapi.com/whoisserver/WhoisService",
    },
    sslLabs: {
      baseUrl: "https://api.ssllabs.com/api/v3",
    },
  },

  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50, // requests per window
  },

  session: {
    secret: process.env.SESSION_SECRET || "netsentry-dev-secret-change-in-production",
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  },

  redis: {
    url: process.env.REDIS_URL || null,
  },

  scanTimeout: 30000,
};
