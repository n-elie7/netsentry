// Analyzes SSL/TLS configuration using the Qualys SSL Labs API.

const axios = require("axios");
const config = require("../config");

const BASE_URL = config.apis.sslLabs.baseUrl;

async function analyze(domain) {
  try {
    // starts a new assessment (use cache if available to avoid long waits)
    const { data } = await axios.get(`${BASE_URL}/analyze`, {
      params: {
        host: domain,
        fromCache: "on",
        maxAge: 24, // accepts cached results up to 24 hours old
        all: "done",
      },
      timeout: config.scanTimeout,
    });

    if (data.status === "IN_PROGRESS" || data.status === "DNS") {
      return buildPartialResult(domain);
    }

    if (data.status === "ERROR") {
      return buildErrorResult(domain, data.statusMessage);
    }

    return parseResults(domain, data);
  } catch (error) {
    return await fallbackTlsCheck(domain);
  }
}

function parseResults(domain, data) {
  const findings = [];
  const endpoint = data.endpoints?.[0] || {};
  const grade = endpoint.grade || "N/A";

  findings.push({
    id: "ssl-grade",
    title: "SSL/TLS Grade",
    value: grade,
    severity: gradeToSeverity(grade),
    category: "ssl",
    description: `SSL Labs rates this domain as ${grade}.`,
  });

  if (endpoint.details) {
    const details = endpoint.details;

    // Certificate info
    if (details.cert) {
      const cert = details.cert;
      const expiryDate = new Date(cert.notAfter);
      const daysUntilExpiry = Math.ceil((expiryDate - Date.now()) / (1000 * 60 * 60 * 24));

      findings.push({
        id: "ssl-cert-issuer",
        title: "Certificate Issuer",
        value: cert.issuerLabel || "Unknown",
        severity: "info",
        category: "ssl",
        description: `Certificate issued by ${cert.issuerLabel || "Unknown"}.`,
      });

      findings.push({
        id: "ssl-cert-expiry",
        title: "Certificate Expiry",
        value: `${daysUntilExpiry} days remaining`,
        severity: daysUntilExpiry < 30 ? "critical" : daysUntilExpiry < 90 ? "warning" : "info",
        category: "ssl",
        description: `Certificate expires on ${expiryDate.toISOString().split("T")[0]}.`,
      });
    }

    // Protocol support
    if (details.protocols) {
      const protocols = details.protocols.map((p) => `${p.name} ${p.version}`);
      const hasOldTls = details.protocols.some(
        (p) => p.version === "1.0" || p.version === "1.1"
      );

      findings.push({
        id: "ssl-protocols",
        title: "Supported Protocols",
        value: protocols.join(", "),
        severity: hasOldTls ? "warning" : "info",
        category: "ssl",
        description: hasOldTls
          ? "Outdated TLS versions (1.0/1.1) are still enabled. Consider disabling them."
          : "Only modern TLS versions are enabled.",
      });
    }
  }

  return { grade, findings };
}

// fallback to nodejs tls module
async function fallbackTlsCheck(domain) {
  const tls = require("tls");
  const findings = [];

  return new Promise((resolve) => {
    const socket = tls.connect(443, domain, { servername: domain }, () => {
      const cert = socket.getPeerCertificate();
      socket.end();

      if (cert && cert.subject) {
        const expiryDate = new Date(cert.valid_to);
        const daysUntilExpiry = Math.ceil((expiryDate - Date.now()) / (1000 * 60 * 60 * 24));

        findings.push({
          id: "ssl-cert-subject",
          title: "Certificate Subject",
          value: cert.subject.CN || domain,
          severity: "info",
          category: "ssl",
          description: `Certificate issued for ${cert.subject.CN || domain}.`,
        });

        findings.push({
          id: "ssl-cert-issuer",
          title: "Certificate Issuer",
          value: cert.issuer?.O || "Unknown",
          severity: "info",
          category: "ssl",
          description: `Issued by ${cert.issuer?.O || "Unknown"}.`,
        });

        findings.push({
          id: "ssl-cert-expiry",
          title: "Certificate Expiry",
          value: `${daysUntilExpiry} days remaining`,
          severity: daysUntilExpiry < 30 ? "critical" : daysUntilExpiry < 90 ? "warning" : "info",
          category: "ssl",
          description: `Certificate expires on ${expiryDate.toISOString().split("T")[0]}.`,
        });

        findings.push({
          id: "ssl-cert-valid",
          title: "Certificate Valid",
          value: daysUntilExpiry > 0 ? "Yes" : "No — Expired",
          severity: daysUntilExpiry > 0 ? "info" : "critical",
          category: "ssl",
          description: daysUntilExpiry > 0 ? "Certificate is currently valid." : "Certificate has expired!",
        });
      }

      resolve({ grade: estimateGrade(findings), findings });
    });

    socket.on("error", () => {
      findings.push({
        id: "ssl-error",
        title: "SSL/TLS Connection",
        value: "Failed",
        severity: "critical",
        category: "ssl",
        description: "Could not establish SSL/TLS connection. The domain may not support HTTPS.",
      });
      resolve({ grade: "F", findings });
    });

    socket.setTimeout(10000, () => {
      socket.destroy();
      findings.push({
        id: "ssl-timeout",
        title: "SSL/TLS Check",
        value: "Timeout",
        severity: "warning",
        category: "ssl",
        description: "SSL/TLS connection timed out.",
      });
      resolve({ grade: "N/A", findings });
    });
  });
}

function buildPartialResult(domain) {
  return {
    grade: "Pending",
    findings: [
      {
        id: "ssl-pending",
        title: "SSL/TLS Analysis",
        value: "In Progress",
        severity: "info",
        category: "ssl",
        description: "SSL Labs scan is still in progress. Results may take a few minutes.",
      },
    ],
  };
}

function buildErrorResult(domain, message) {
  return {
    grade: "Error",
    findings: [
      {
        id: "ssl-error",
        title: "SSL/TLS Analysis",
        value: "Error",
        severity: "warning",
        category: "ssl",
        description: message || "Could not complete SSL analysis.",
      },
    ],
  };
}

function gradeToSeverity(grade) {
  if (grade === "A+" || grade === "A") return "info";
  if (grade === "A-" || grade === "B") return "warning";
  return "critical";
}

function estimateGrade(findings) {
  const hasCritical = findings.some((f) => f.severity === "critical");
  const hasWarning = findings.some((f) => f.severity === "warning");
  if (hasCritical) return "F";
  if (hasWarning) return "B";
  return "A";
}

module.exports = { analyze };
