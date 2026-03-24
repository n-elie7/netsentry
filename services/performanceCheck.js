// measures response time, redirect chains, and basic performance metrics for performance checks.

const axios = require("axios");
const { performance } = require("perf_hooks");
const dns = require("dns").promises;
const config = require("../config");


async function analyze(domain) {
  const findings = [];

  // DNS Lookup Time
  try {
    const dnsStart = performance.now();
    const addresses = await dns.resolve4(domain);
    const dnsTime = Math.round(performance.now() - dnsStart);

    findings.push({
      id: "perf-dns",
      title: "DNS Lookup Time",
      value: `${dnsTime}ms`,
      severity: dnsTime > 500 ? "warning" : "info",
      category: "performance",
      description:
        dnsTime > 500
          ? `DNS resolution took ${dnsTime}ms — this is slow. Consider using a faster DNS provider.`
          : `DNS resolved in ${dnsTime}ms to ${addresses[0]}.`,
    });
  } catch (error) {
    findings.push({
      id: "perf-dns",
      title: "DNS Lookup",
      value: "Failed",
      severity: "critical",
      category: "performance",
      description: "DNS resolution failed. The domain may not exist or DNS is misconfigured.",
    });
    return { findings };
  }

  // the total Response time and redirect chain
  try {
    const redirects = [];
    const startTime = performance.now();

    const response = await axios.get(`https://${domain}`, {
      timeout: config.scanTimeout,
      maxRedirects: 10,
      validateStatus: () => true,
      headers: { "User-Agent": "NetSentry Security Scanner/1.0" },
      beforeRedirect: (options, { headers: redirectHeaders }) => {
        redirects.push(options.href);
      },
    });

    const totalTime = Math.round(performance.now() - startTime);

    findings.push({
      id: "perf-response-time",
      title: "Total Response Time",
      value: `${totalTime}ms`,
      severity: totalTime > 3000 ? "critical" : totalTime > 1000 ? "warning" : "info",
      category: "performance",
      description:
        totalTime > 3000
          ? `Response took ${totalTime}ms — very slow. Users may leave before the page loads.`
          : totalTime > 1000
          ? `Response took ${totalTime}ms — could be faster.`
          : `Response completed in ${totalTime}ms — good performance.`,
    });

    // redirect chain
    if (redirects.length > 0) {
      findings.push({
        id: "perf-redirects",
        title: "Redirect Chain",
        value: `${redirects.length} redirect(s)`,
        severity: redirects.length > 2 ? "warning" : "info",
        category: "performance",
        description:
          redirects.length > 2
            ? `${redirects.length} redirects detected. Excessive redirects slow down page load.`
            : `${redirects.length} redirect(s) detected: ${redirects.join(" → ")}.`,
      });
    } else {
      findings.push({
        id: "perf-redirects",
        title: "Redirect Chain",
        value: "No redirects",
        severity: "info",
        category: "performance",
        description: "No redirects detected — direct connection.",
      });
    }

    // content size checking
    const contentLength = response.headers["content-length"];
    if (contentLength) {
      const sizeKb = Math.round(parseInt(contentLength) / 1024);
      findings.push({
        id: "perf-size",
        title: "Response Size",
        value: `${sizeKb} KB`,
        severity: sizeKb > 5000 ? "warning" : "info",
        category: "performance",
        description:
          sizeKb > 5000
            ? `Response is ${sizeKb}KB — consider optimizing page size.`
            : `Response size: ${sizeKb}KB.`,
      });
    }

    // compression check
    const encoding = response.headers["content-encoding"];
    findings.push({
      id: "perf-compression",
      title: "Compression",
      value: encoding || "Not enabled",
      severity: encoding ? "info" : "warning",
      category: "performance",
      description: encoding
        ? `Response is compressed with ${encoding}.`
        : "No compression detected. Enable gzip or brotli to reduce transfer size.",
    });
  } catch (error) {
    findings.push({
      id: "perf-response-time",
      title: "Response Time",
      value: "Failed",
      severity: "critical",
      category: "performance",
      description: "Could not measure response time. The domain may be unreachable.",
    });
  }

  return { findings };
}

module.exports = { analyze };
