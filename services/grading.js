// this module calculates an overall security grade (A+ to F) from all scan findings.

const CATEGORY_WEIGHTS = {
  ssl: 25,
  threats: 25,
  reputation: 15,
  headers: 20,
  whois: 5,
  performance: 10,
};

const SEVERITY_PENALTIES = {
  critical: 20,
  warning: 8,
  info: 0,
};


function calculate(allFindings) {
  const breakdown = {};

  // this group findings by category
  const grouped = {};
  for (const finding of allFindings) {
    const cat = finding.category || "other";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(finding);
  }

  let totalWeight = 0;
  let weightedScore = 0;

  for (const [category, weight] of Object.entries(CATEGORY_WEIGHTS)) {
    const findings = grouped[category] || [];

    if (findings.length === 0) {
      breakdown[category] = { score: 70, maxScore: 100, weight, findings: 0 };
      weightedScore += 70 * weight;
      totalWeight += weight;
      continue;
    }

    // starts at 100 and deduct for issues
    let categoryScore = 100;
    for (const finding of findings) {
      categoryScore -= SEVERITY_PENALTIES[finding.severity] || 0;
    }

    categoryScore = Math.max(0, Math.min(100, categoryScore));

    breakdown[category] = {
      score: categoryScore,
      maxScore: 100,
      weight,
      findings: findings.length,
    };

    weightedScore += categoryScore * weight;
    totalWeight += weight;
  }

  // calculate final score out of 100
  const finalScore = totalWeight > 0 ? Math.round(weightedScore / totalWeight) : 0;
  const grade = scoreToGrade(finalScore);

  return { grade, score: finalScore, breakdown };
}


function scoreToGrade(score) {
  if (score >= 95) return "A+";
  if (score >= 90) return "A";
  if (score >= 85) return "A-";
  if (score >= 80) return "B+";
  if (score >= 75) return "B";
  if (score >= 70) return "B-";
  if (score >= 65) return "C+";
  if (score >= 60) return "C";
  if (score >= 55) return "C-";
  if (score >= 50) return "D+";
  if (score >= 45) return "D";
  if (score >= 40) return "D-";
  return "F";
}

// feedback given to user according to his/her score
function gradeSummary(grade) {
  const summaries = {
    "A+": "Excellent security posture. This domain follows best practices across all categories.",
    A: "Very strong security. Minor improvements possible but overall well-configured.",
    "A-": "Strong security with a few areas for improvement.",
    "B+": "Good security overall. Several recommendations should be addressed.",
    B: "Decent security but notable gaps exist that should be fixed.",
    "B-": "Below average. Multiple security issues need attention.",
    "C+": "Mediocre security posture. Significant improvements are needed.",
    C: "Poor security. This domain has serious configuration issues.",
    "C-": "Very poor security. Immediate action recommended.",
    "D+": "Critical security issues detected. This domain is at risk.",
    D: "Severe security problems. This domain needs urgent attention.",
    "D-": "Extremely poor security configuration.",
    F: "Failing. This domain has critical vulnerabilities that must be addressed immediately.",
  };
  return summaries[grade] || "Unable to determine security posture.";
}

module.exports = { calculate, scoreToGrade, gradeSummary };
