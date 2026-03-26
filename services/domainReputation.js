// this module is for domain reputation functionality from WhoisXML
const axios = require("axios");
const config = require("../config");

const API_KEY = config.apis.whoisXml.key;
const BASE_URL = "https://domain-reputation.whoisxmlapi.com/api/v2";

async function analyze(domain) {
  if (!API_KEY) {
    return buildUnavailableResult("WhoisXML API key not configured.");
  }

  try {
    const { data } = await axios.get(BASE_URL, {
      params: {
        apiKey: API_KEY,
        domainName: domain,
        mode: "full",
      },
      timeout: config.scanTimeout,
    });

    return parseResults(domain, data);
  } catch (error) {
    if (error.response?.status === 429) {
      return buildUnavailableResult("Domain Reputation API rate limit reached.");
    }
    return buildUnavailableResult("Could not fetch domain reputation data.");
  }
}

function parseResults(domain, data) {
  const findings = [];
  const score = data.reputationScore;

  if (score === undefined || score === null) {
    return buildUnavailableResult(`No reputation data available for ${domain}.`);
  }

  const safetyScore = Math.max(0, 100 - score);

  findings.push({
    id: "rep-score",
    title: "Domain Reputation Score",
    value: `${safetyScore.toFixed(2)}/100`,
    severity: safetyScore < 40 ? "critical" : safetyScore < 70 ? "warning" : "info",
    category: "reputation",
    description:
      safetyScore < 40
        ? `Safety score is ${safetyScore}/100 — this domain has a poor reputation and may be dangerous.`
        : safetyScore < 70
        ? `Safety score is ${safetyScore}/100 — some reputation concerns exist.`
        : `Safety score is ${safetyScore}/100 — this domain has a good reputation.`,
  });

  if (data.testResults && data.testResults.length > 0) {
    const warnings = data.testResults.filter((t) => t.warnings && t.warnings.length > 0);
    const passed = data.testResults.length - warnings.length;

    findings.push({
      id: "rep-tests",
      title: "Reputation Tests",
      value: `${passed}/${data.testResults.length} passed`,
      severity: warnings.length > 5 ? "critical" : warnings.length > 0 ? "warning" : "info",
      category: "reputation",
      description: `${passed} of ${data.testResults.length} reputation checks passed.`,
    });

    const warningCategories = {};
    for (const test of warnings) {
      for (const warning of test.warnings) {
        const cat = categorizeWarning(test.test);
        if (!warningCategories[cat]) warningCategories[cat] = [];
        const msg = typeof warning === "string"
          ? warning
          : warning.warningDescription || warning.warningCode || warning.message || JSON.stringify(warning);
        warningCategories[cat].push(msg);
      }
    }

    for (const [category, warns] of Object.entries(warningCategories)) {
      findings.push({
        id: `rep-warn-${category.toLowerCase().replace(/\s+/g, "-")}`,
        title: `Reputation: ${category}`,
        value: `${warns.length} issue(s)`,
        severity: warns.length > 3 ? "critical" : "warning",
        category: "reputation",
        description: truncate(warns.join("; "), 200),
      });
    }
  }

  return { safetyScore, findings };
}


function categorizeWarning(testName) {
  if (!testName) return "General";
  const lower = testName.toLowerCase();
  if (lower.includes("malware")) return "Malware";
  if (lower.includes("phish")) return "Phishing";
  if (lower.includes("spam")) return "Spam";
  if (lower.includes("ssl") || lower.includes("cert")) return "SSL Issues";
  if (lower.includes("dns")) return "DNS Issues";
  if (lower.includes("mail") || lower.includes("mx")) return "Email Config";
  return "General";
}

function truncate(str, maxLen) {
  return str.length > maxLen ? str.substring(0, maxLen) + "…" : str;
}

function buildUnavailableResult(message) {
  return {
    safetyScore: -1,
    findings: [
      {
        id: "rep-unavailable",
        title: "Domain Reputation",
        value: "Unavailable",
        severity: "info",
        category: "reputation",
        description: message,
      },
    ],
  };
}

module.exports = { analyze };
