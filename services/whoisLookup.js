// this domain retrieves domain registration details using WhoisXML API.

const axios = require("axios");
const config = require("../config");

const API_KEY = config.apis.whoisXml.key;
const BASE_URL = config.apis.whoisXml.baseUrl;

async function analyze(domain) {
  if (!API_KEY) {
    return buildUnavailableResult("WhoisXML API key not configured.");
  }

  try {
    const { data } = await axios.get(BASE_URL, {
      params: {
        apiKey: API_KEY,
        domainName: domain,
        outputFormat: "JSON",
      },
      timeout: config.scanTimeout,
    });

    return parseResults(domain, data);
  } catch (error) {
    if (error.response?.status === 429) {
      return buildUnavailableResult("WhoisXML rate limit reached. Try again later.");
    }
    return buildUnavailableResult("Could not fetch WHOIS data.");
  }
}

function parseResults(domain, data) {
  const findings = [];
  const record = data.WhoisRecord || {};

  // Domain age
  if (record.createdDate || record.registryData?.createdDate) {
    const created = new Date(record.createdDate || record.registryData.createdDate);
    const ageInDays = Math.ceil((Date.now() - created) / (1000 * 60 * 60 * 24));
    const ageInYears = (ageInDays / 365).toFixed(1);

    findings.push({
      id: "whois-age",
      title: "Domain Age",
      value: ageInDays < 365 ? `${ageInDays} days` : `${ageInYears} years`,
      severity: ageInDays < 90 ? "warning" : "info",
      category: "whois",
      description:
        ageInDays < 90
          ? `Domain is only ${ageInDays} days old. Newly registered domains are sometimes used for phishing.`
          : `Domain registered ${ageInYears} years ago (${created.toISOString().split("T")[0]}).`,
    });
  }

  // Expiry date
  if (record.expiresDate || record.registryData?.expiresDate) {
    const expires = new Date(record.expiresDate || record.registryData.expiresDate);
    const daysUntilExpiry = Math.ceil((expires - Date.now()) / (1000 * 60 * 60 * 24));

    findings.push({
      id: "whois-expiry",
      title: "Domain Expiry",
      value: `${daysUntilExpiry} days remaining`,
      severity: daysUntilExpiry < 30 ? "critical" : daysUntilExpiry < 90 ? "warning" : "info",
      category: "whois",
      description: `Domain expires on ${expires.toISOString().split("T")[0]}.`,
    });
  }

  // Registrar
  const registrar =
    record.registrarName || record.registryData?.registrarName || "Unknown";
  findings.push({
    id: "whois-registrar",
    title: "Registrar",
    value: registrar,
    severity: "info",
    category: "whois",
    description: `Domain is registered through ${registrar}.`,
  });

  // Nameservers
  if (record.nameServers?.hostNames?.length > 0) {
    findings.push({
      id: "whois-nameservers",
      title: "Nameservers",
      value: record.nameServers.hostNames.slice(0, 4).join(", "),
      severity: "info",
      category: "whois",
      description: `DNS is handled by: ${record.nameServers.hostNames.join(", ")}.`,
    });
  }

  // Registrant country (if available)
  const country =
    record.registrant?.country || record.registryData?.registrant?.country;
  if (country) {
    findings.push({
      id: "whois-country",
      title: "Registrant Country",
      value: country,
      severity: "info",
      category: "whois",
      description: `Domain registrant is based in ${country}.`,
    });
  }

  // DNSSEC
  if (record.registryData?.dnssec) {
    const dnssec = record.registryData.dnssec;
    findings.push({
      id: "whois-dnssec",
      title: "DNSSEC",
      value: dnssec === "signedDelegation" ? "Enabled" : "Not enabled",
      severity: dnssec === "signedDelegation" ? "info" : "warning",
      category: "whois",
      description:
        dnssec === "signedDelegation"
          ? "DNSSEC is enabled, protecting against DNS spoofing."
          : "DNSSEC is not enabled. Consider enabling it for DNS security.",
    });
  }

  return { findings };
}

function buildUnavailableResult(message) {
  return {
    findings: [
      {
        id: "whois-unavailable",
        title: "WHOIS Lookup",
        value: "Unavailable",
        severity: "info",
        category: "whois",
        description: message,
      },
    ],
  };
}

module.exports = { analyze };
