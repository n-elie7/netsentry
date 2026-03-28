// this module handles domain scanning requests

const express = require("express");
const { v4: uuidv4 } = require("uuid");
const { sanitizeDomain } = require("../utils/validators");
const { requireAuth } = require("../middleware/auth");
const sslLabs = require("../services/sslLabs");
const virusTotal = require("../services/virusTotal");
const whoisLookup = require("../services/whoisLookup");
const domainReputation = require("../services/domainReputation");
const headersAudit = require("../services/headersAudit");
const performanceCheck = require("../services/performanceCheck");
const grading = require("../services/grading");
const db = require("../database/db");

const router = express.Router();

router.post("/", requireAuth, async (req, res) => {
  const rawDomain = req.body.domain;
  const domain = sanitizeDomain(rawDomain);

  if (!domain) {
    return res.status(400).json({
      success: false,
      error: { message: "Invalid domain. Please enter a valid domain name (e.g., example.com)." },
    });
  }

  try {
    console.log(`[SCAN] Starting scan for: ${domain}`);

    // does the domain even exist?
    const dns = require("dns").promises;
    try {
      await dns.resolve4(domain);
    } catch {
      return res.json({
        success: true,
        data: {
          id: scanId,
          domain,
          grade: "F",
          score: 0,
          summary: "This domain does not exist or has no DNS records.",
          breakdown: {},
          findings: [{
            id: "dns-fail",
            title: "Domain Not Found",
            value: "DNS resolution failed",
            severity: "critical",
            category: "performance",
            description: `The domain "${domain}" could not be resolved. It may not exist, is misspelled, or has no DNS records configured.`,
          }],
          stats: { total: 1, critical: 1, warning: 0, info: 0 },
          scannedAt: new Date().toISOString(),
        },
      });
    }

    // optimized performance by running all analysis in parallel for high speed
    const [sslResult, vtResult, whoisResult, repResult, headersResult, perfResult] =
      await Promise.allSettled([
        sslLabs.analyze(domain),
        virusTotal.analyze(domain),
        whoisLookup.analyze(domain),
        domainReputation.analyze(domain),
        headersAudit.analyze(domain),
        performanceCheck.analyze(domain),
      ]);

    // extract results and failure handled 
    const ssl = sslResult.status === "fulfilled" ? sslResult.value : { grade: "N/A", findings: [] };
    const vt = vtResult.status === "fulfilled" ? vtResult.value : { threats: -1, findings: [] };
    const whois = whoisResult.status === "fulfilled" ? whoisResult.value : { findings: [] };
    const rep = repResult.status === "fulfilled" ? repResult.value : { findings: [] };
    const headers = headersResult.status === "fulfilled" ? headersResult.value : { findings: [] };
    const perf = perfResult.status === "fulfilled" ? perfResult.value : { findings: [] };

    // combine all findings
    const allFindings = [
      ...ssl.findings,
      ...vt.findings,
      ...whois.findings,
      ...rep.findings,
      ...headers.findings,
      ...perf.findings,
    ];


    const { grade, score, breakdown } = grading.calculate(allFindings);
    const summary = grading.gradeSummary(grade);

    const scanId = uuidv4();
    const result = {
      id: scanId,
      domain,
      grade,
      score,
      summary,
      breakdown,
      findings: allFindings,
      stats: {
        total: allFindings.length,
        critical: allFindings.filter((f) => f.severity === "critical").length,
        warning: allFindings.filter((f) => f.severity === "warning").length,
        info: allFindings.filter((f) => f.severity === "info").length,
      },
      scannedAt: new Date().toISOString(),
    };

    try {
      await db.saveScan({
        id: scanId,
        userId: req.session.userId,
        domain,
        grade,
        score,
        results: result,
      });
    } catch (dbError) {
      console.error("[DB] Failed to save scan:", dbError.message);
    }

    console.log(`[SCAN] Completed: ${domain} — Grade: ${grade} (${score}/100)`);

    res.json({ success: true, data: result });
  } catch (error) {
    console.error(`[SCAN] Error scanning ${domain}:`, error.message);
    res.status(500).json({
      success: false,
      error: { message: "Domain doesn't exist. Please try again." },
    });
  }
});

router.get("/:id", requireAuth, async (req, res) => {
  const scan = await db.getScanById(req.params.id, req.session.userId);

  if (!scan) {
    return res.status(404).json({
      success: false,
      error: { message: "Scan not found." },
    });
  }

  res.json({ success: true, data: scan.results });
});

module.exports = router;

