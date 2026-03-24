// this module checks for the presence and configuration of critical security headers.

const axios = require("axios");
const config = require("../config");

const SECURITY_HEADERS = [
  {
    name: "Strict-Transport-Security",
    id: "hsts",
    title: "HTTP Strict Transport Security (HSTS)",
    severity: "critical",
    recommendation: "Add 'Strict-Transport-Security: max-age=31536000; includeSubDomains' to enforce HTTPS.",
  },
  {
    name: "Content-Security-Policy",
    id: "csp",
    title: "Content Security Policy (CSP)",
    severity: "warning",
    recommendation: "Implement a Content-Security-Policy header to prevent XSS and injection attacks.",
  },
  {
    name: "X-Frame-Options",
    id: "x-frame",
    title: "X-Frame-Options",
    severity: "warning",
    recommendation: "Add 'X-Frame-Options: DENY' or 'SAMEORIGIN' to prevent clickjacking.",
  },
  {
    name: "X-Content-Type-Options",
    id: "x-content-type",
    title: "X-Content-Type-Options",
    severity: "warning",
    recommendation: "Add 'X-Content-Type-Options: nosniff' to prevent MIME-type sniffing.",
  },
  {
    name: "Referrer-Policy",
    id: "referrer",
    title: "Referrer Policy",
    severity: "info",
    recommendation: "Add 'Referrer-Policy: strict-origin-when-cross-origin' to control referrer information.",
  },
  {
    name: "Permissions-Policy",
    id: "permissions",
    title: "Permissions Policy",
    severity: "info",
    recommendation: "Add a Permissions-Policy header to control browser feature access.",
  },
  {
    name: "X-XSS-Protection",
    id: "xss",
    title: "X-XSS-Protection",
    severity: "info",
    recommendation: "While largely deprecated in modern browsers, 'X-XSS-Protection: 0' is now recommended. Use CSP instead.",
  },
];

// analyze security headers
async function analyze(domain) {
  try {
    const response = await axios.get(`https://${domain}`, {
      timeout: config.scanTimeout,
      maxRedirects: 5,
      validateStatus: () => true,
      headers: {
        "User-Agent": "NetSentry Security Scanner/1.0",
      },
    });

    return parseHeaders(domain, response.headers, response.status);
  } catch (error) {
    try {
      const response = await axios.get(`http://${domain}`, {
        timeout: config.scanTimeout,
        maxRedirects: 5,
        validateStatus: () => true,
        headers: {
          "User-Agent": "NetSentry Security Scanner/1.0",
        },
      });

      const findings = parseHeaders(domain, response.headers, response.status);

      // critical finding for no HTTPS
      findings.findings.unshift({
        id: "header-no-https",
        title: "HTTPS Not Available",
        value: "HTTP Only",
        severity: "critical",
        category: "headers",
        description: "This domain does not support HTTPS. All traffic is unencrypted.",
      });

      return findings;
    } catch (innerError) {
      return buildUnavailableResult("Could not connect to the domain.");
    }
  }
}


function parseHeaders(domain, headers, statusCode) {
  const findings = [];
  let presentCount = 0;

  for (const header of SECURITY_HEADERS) {
    const value = headers[header.name.toLowerCase()];
    const isPresent = !!value;

    if (isPresent) presentCount++;

    findings.push({
      id: `header-${header.id}`,
      title: header.title,
      value: isPresent ? (typeof value === "string" ? truncate(value, 80) : "Present") : "Missing",
      severity: isPresent ? "info" : header.severity,
      category: "headers",
      description: isPresent
        ? `${header.title} is configured: ${truncate(String(value), 120)}`
        : `${header.title} is missing. ${header.recommendation}`,
    });
  }

  findings.push({
    id: "header-status",
    title: "HTTP Status Code",
    value: statusCode.toString(),
    severity: statusCode >= 400 ? "warning" : "info",
    category: "headers",
    description: `Server responded with HTTP ${statusCode}.`,
  });

  if (headers["server"]) {
    findings.push({
      id: "header-server-disclosure",
      title: "Server Header Disclosure",
      value: headers["server"],
      severity: "warning",
      category: "headers",
      description: `Server header reveals: "${headers["server"]}". Consider removing or obscuring this to reduce information leakage.`,
    });
  }

  if (headers["x-powered-by"]) {
    findings.push({
      id: "header-powered-by",
      title: "X-Powered-By Disclosure",
      value: headers["x-powered-by"],
      severity: "warning",
      category: "headers",
      description: `X-Powered-By header reveals: "${headers["x-powered-by"]}". Remove this header to hide technology stack details.`,
    });
  }

  return {
    headersPresent: presentCount,
    headersTotal: SECURITY_HEADERS.length,
    findings,
  };
}

function truncate(str, maxLen) {
  return str.length > maxLen ? str.substring(0, maxLen) + "…" : str;
}

function buildUnavailableResult(message) {
  return {
    headersPresent: 0,
    headersTotal: SECURITY_HEADERS.length,
    findings: [
      {
        id: "headers-unavailable",
        title: "Security Headers Audit",
        value: "Unavailable",
        severity: "warning",
        category: "headers",
        description: message,
      },
    ],
  };
}

module.exports = { analyze };
