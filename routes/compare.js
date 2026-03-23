const express = require("express");
const { sanitizeDomain } = require("../utils/validators");
const { requireAuth } = require("../middleware/auth");
const sslLabs = require("../services/sslLabs");
const virusTotal = require("../services/virusTotal");
const whoisLookup = require("../services/whoisLookup");
const domainReputation = require("../services/domainReputation");
const headersAudit = require("../services/headersAudit");
const performanceCheck = require("../services/performanceCheck");
const grading = require("../services/grading");

const router = express.Router();

async function scanDomain(domain) {
  const [sslResult, vtResult, whoisResult, repResult, headersResult, perfResult] =
    await Promise.allSettled([
      sslLabs.analyze(domain),
      virusTotal.analyze(domain),
      whoisLookup.analyze(domain),
      domainReputation.analyze(domain),
      headersAudit.analyze(domain),
      performanceCheck.analyze(domain),
    ]);

  const ssl = sslResult.status === "fulfilled" ? sslResult.value : { grade: "N/A", findings: [] };
  const vt = vtResult.status === "fulfilled" ? vtResult.value : { threats: -1, findings: [] };
  const whois = whoisResult.status === "fulfilled" ? whoisResult.value : { findings: [] };
  const rep = repResult.status === "fulfilled" ? repResult.value : { findings: [] };
  const headers = headersResult.status === "fulfilled" ? headersResult.value : { findings: [] };
  const perf = perfResult.status === "fulfilled" ? perfResult.value : { findings: [] };

  const allFindings = [
    ...ssl.findings,
    ...vt.findings,
    ...whois.findings,
    ...rep.findings,
    ...headers.findings,
    ...perf.findings,
  ];

  const { grade, score, breakdown } = grading.calculate(allFindings);

  return {
    domain,
    grade,
    score,
    summary: grading.gradeSummary(grade),
    breakdown,
    findings: allFindings,
    stats: {
      total: allFindings.length,
      critical: allFindings.filter((f) => f.severity === "critical").length,
      warning: allFindings.filter((f) => f.severity === "warning").length,
      info: allFindings.filter((f) => f.severity === "info").length,
    },
  };
}


router.post("/", requireAuth, async (req, res) => {
  const domainA = sanitizeDomain(req.body.domainA);
  const domainB = sanitizeDomain(req.body.domainB);

  if (!domainA || !domainB) {
    return res.status(400).json({
      success: false,
      error: { message: "Please provide two valid domain names." },
    });
  }

  if (domainA === domainB) {
    return res.status(400).json({
      success: false,
      error: { message: "Please enter two different domains to compare." },
    });
  }

  try {
    console.log(`[COMPARE] Comparing: ${domainA} vs ${domainB}`);

    // Scan both domains in parallel
    const [resultA, resultB] = await Promise.all([
      scanDomain(domainA),
      scanDomain(domainB),
    ]);

    res.json({
      success: true,
      data: {
        domainA: resultA,
        domainB: resultB,
        winner: resultA.score >= resultB.score ? domainA : domainB,
      },
    });
  } catch (error) {
    console.error("[COMPARE] Error:", error.message);
    res.status(500).json({
      success: false,
      error: { message: "An error occurred during comparison." },
    });
  }
});

module.exports = router;
