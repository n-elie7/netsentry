// compare different domains
const Compare = (() => {
  function init() {
    DOM.$("#compareBtn").addEventListener("click", runCompare);

    // Allow Enter key to trigger comparison
    DOM.$("#compareDomainA").addEventListener("keydown", (e) => { if (e.key === "Enter") runCompare(); });
    DOM.$("#compareDomainB").addEventListener("keydown", (e) => { if (e.key === "Enter") runCompare(); });
  }
  async function runCompare() {
    const domainA = DOM.$("#compareDomainA").value.trim();
    const domainB = DOM.$("#compareDomainB").value.trim();
    const btn = DOM.$("#compareBtn");
    const errorEl = DOM.$("#compareError");

    if (!domainA || !domainB) {
      DOM.showError(errorEl, "Please enter both domains.");
      return;
    }

    DOM.hide(errorEl);
    DOM.hide(DOM.$("#compareResults"));
    DOM.setLoading(btn, true);

    try {
      const data = await API.post("/api/compare", { domainA, domainB });
      renderComparison(data);
      DOM.show(DOM.$("#compareResults"));
    } catch (error) {
      DOM.showError(errorEl, error.message);
    } finally {
      DOM.setLoading(btn, false);
    }
  }

  function renderComparison(data) {
    const container = DOM.$("#compareResults");
    container.innerHTML = `
      ${renderColumn(data.domainA, data.winner === data.domainA.domain)}
      ${renderColumn(data.domainB, data.winner === data.domainB.domain)}
    `;
  }
  function renderColumn(result, isWinner) {
    const breakdown = result.breakdown || {};
    const categories = ["ssl", "threats", "reputation", "headers", "whois", "performance"];

    const statsHtml = categories
      .map((cat) => {
        const info = breakdown[cat] || { score: 0 };
        return `
        <div class="compare-stat-row">
          <span class="compare-stat-label">${Format.categoryName(cat)}</span>
          <span class="compare-stat-value" style="color:${Format.barColor(info.score)}">${info.score}/100</span>
        </div>
      `;
      })
      .join("");

    const summaryStats = `
      <div class="compare-stat-row">
        <span class="compare-stat-label">Critical Issues</span>
        <span class="compare-stat-value" style="color:var(--severity-critical)">${result.stats.critical}</span>
      </div>
      <div class="compare-stat-row">
        <span class="compare-stat-label">Warnings</span>
        <span class="compare-stat-value" style="color:var(--severity-warning)">${result.stats.warning}</span>
      </div>
      <div class="compare-stat-row">
        <span class="compare-stat-label">Total Checks</span>
        <span class="compare-stat-value">${result.stats.total}</span>
      </div>
    `;

    return `
      <div class="compare-col ${isWinner ? "compare-col--winner" : ""}">
        <div class="compare-col__header">
          <div class="compare-col__domain">${escapeHtml(result.domain)}</div>
          <div class="compare-col__grade" style="color:${Format.gradeColor(result.grade)}">${result.grade}</div>
          <div class="compare-col__score">${result.score}/100</div>
          ${isWinner ? '<div class="compare-col__winner-badge">Winner</div>' : ""}
        </div>
        ${statsHtml}
        <div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--border)"></div>
        ${summaryStats}
      </div>
    `;
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  return { init };
})();
