// it scans domains against 70+ security vendors for threats.

const axios = require("axios");
const config = require("../config");

const API_KEY = config.apis.virusTotal.key;
const BASE_URL = config.apis.virusTotal.baseUrl;

async function analyze(domain) {
  if (!API_KEY) {
    return buildUnavailableResult("VirusTotal API key not configured.");
  }

  try {
    const { data } = await axios.get(`${BASE_URL}/domains/${domain}`, {
      headers: { "x-apikey": API_KEY },
      timeout: config.scanTimeout,
    });

    return parseResults(domain, data);
  } catch (error) {
    if (error.response?.status === 404) {
      return buildNotFoundResult(domain);
    }
    if (error.response?.status === 429) {
      return buildUnavailableResult("VirusTotal rate limit reached. Try again later.");
    }
    return buildUnavailableResult("Could not reach VirusTotal API.");
  }
}

function parseResults(domain, data) {
  const findings = [];
  const attributes = data.data?.attributes || {};
  const stats = attributes.last_analysis_stats || {};
  const totalEngines = Object.values(stats).reduce((a, b) => a + b, 0);
  const malicious = stats.malicious || 0;
  const suspicious = stats.suspicious || 0;
  const threats = malicious + suspicious;

  // Overall reputation
  findings.push({
    id: "vt-reputation",
    title: "Threat Detection",
    value: threats > 0 ? `${threats}/${totalEngines} vendors flagged` : `Clean (${totalEngines} vendors)`,
    severity: threats > 3 ? "critical" : threats > 0 ? "warning" : "info",
    category: "threats",
    description:
      threats > 0
        ? `${malicious} vendors detected malicious activity, ${suspicious} flagged as suspicious.`
        : `No security vendors flagged this domain as malicious.`,
  });

  // Reputation score
  const reputation = attributes.reputation || 0;
  findings.push({
    id: "vt-score",
    title: "Community Reputation Score",
    value: reputation.toString(),
    severity: reputation < -5 ? "critical" : reputation < 0 ? "warning" : "info",
    category: "threats",
    description: `VirusTotal community reputation score: ${reputation}. Negative scores indicate poor reputation.`,
  });

  // Categories assigned by vendors
  if (attributes.categories && Object.keys(attributes.categories).length > 0) {
    const categories = [...new Set(Object.values(attributes.categories))];
    findings.push({
      id: "vt-categories",
      title: "Site Categories",
      value: categories.slice(0, 5).join(", "),
      severity: "info",
      category: "threats",
      description: `Categorized as: ${categories.join(", ")}.`,
    });
  }

  // HTTPS certificate info from virus total
  if (attributes.last_https_certificate) {
    const cert = attributes.last_https_certificate;
    const validTo = cert.validity?.not_after;
    if (validTo) {
      findings.push({
        id: "vt-cert-validity",
        title: "HTTPS Certificate (via VirusTotal)",
        value: validTo,
        severity: "info",
        category: "threats",
        description: `Last observed HTTPS certificate valid until ${validTo}.`,
      });
    }
  }

  // DNS records from Virus total
  if (attributes.last_dns_records && attributes.last_dns_records.length > 0) {
    const aRecords = attributes.last_dns_records
      .filter((r) => r.type === "A")
      .map((r) => r.value);

    if (aRecords.length > 0) {
      findings.push({
        id: "vt-dns-a",
        title: "DNS A Records",
        value: aRecords.join(", "),
        severity: "info",
        category: "threats",
        description: `Resolves to IP address(es): ${aRecords.join(", ")}.`,
      });
    }
  }

  return { threats, findings };
}

function buildNotFoundResult(domain) {
  return {
    threats: 0,
    findings: [
      {
        id: "vt-not-found",
        title: "Threat Detection",
        value: "No data available",
        severity: "info",
        category: "threats",
        description: `VirusTotal has no records for ${domain}. This may indicate a new or rarely visited domain.`,
      },
    ],
  };
}

function buildUnavailableResult(message) {
  return {
    threats: -1,
    findings: [
      {
        id: "vt-unavailable",
        title: "Threat Detection",
        value: "Unavailable",
        severity: "info",
        category: "threats",
        description: message,
      },
    ],
  };
}

module.exports = { analyze };
