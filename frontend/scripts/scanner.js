// Handles the domain scan UI: triggering scans, rendering results, filtering findings, and sorting.

const Scanner = (() => {
  let currentResults = null;
  let activeFilter = "all";
  let activeCategory = "all";
  let activeSort = "severity";

  // Initialize scanner event listeners.
  function init() {
    const scanBtn = DOM.$("#scanBtn");
    const domainInput = DOM.$("#domainInput");

    scanBtn.addEventListener("click", runScan);
    domainInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") runScan();
    });

    DOM.$$(".filter-button[data-filter]").forEach((btn) => {
      btn.addEventListener("click", () => {
        DOM.$$(".filter-button[data-filter]").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        activeFilter = btn.dataset.filter;
        renderFindings();
      });
    });

    DOM.$("#categoryFilter").addEventListener("change", (e) => {
      activeCategory = e.target.value;
      renderFindings();
    });

    DOM.$("#sortFilter").addEventListener("change", (e) => {
      activeSort = e.target.value;
      renderFindings();
    });
  }

  async function runScan() {
    const input = DOM.$("#domainInput");
    const btn = DOM.$("#scanBtn");
    const errorEl = DOM.$("#scanError");
    const domain = input.value.trim();

    if (!domain) {
      DOM.showError(errorEl, "Please enter a domain name.");
      return;
    }

    DOM.hide(errorEl);
    DOM.hide(DOM.$("#scanResults"));
    DOM.setLoading(btn, true);

    try {
      const data = await API.post("/api/scan", { domain });
      currentResults = data;
      renderResults(data);
      DOM.show(DOM.$("#scanResults"));
    } catch (error) {
      DOM.showError(errorEl, error.message);
    } finally {
      DOM.setLoading(btn, false);
    }
  }

  function renderResults(data) {
    const gradeCard = DOM.$("#gradeCard");
    gradeCard.dataset.grade = data.grade;
    DOM.$("#gradeValue").textContent = data.grade;
    DOM.$("#gradeValue").style.color = Format.gradeColor(data.grade);
    DOM.$("#gradeDomain").textContent = data.domain;
    DOM.$("#gradeScore").textContent = data.score;
    DOM.$("#gradeSummary").textContent = data.summary;

    DOM.$("#statCritical").textContent = data.stats.critical;
    DOM.$("#statWarning").textContent = data.stats.warning;
    DOM.$("#statInfo").textContent = data.stats.info;
    DOM.$("#statTotal").textContent = data.stats.total;

    renderBreakdown(data.breakdown);

    renderFindings();
  }

  function renderBreakdown(breakdown) {
    const container = DOM.$("#breakdown");
    container.innerHTML = "";

    const categories = ["ssl", "threats", "reputation", "headers", "whois", "performance"];

    categories.forEach((cat) => {
      const info = breakdown[cat] || { score: 0, maxScore: 100 };
      const pct = Math.round((info.score / info.maxScore) * 100);

      const item = document.createElement("div");
      item.className = "breakdown__item";
      item.innerHTML = `
        <div class="breakdown__label">${Format.categoryName(cat)}</div>
        <div class="breakdown__bar">
          <div class="breakdown__fill" style="width:${pct}%;background:${Format.barColor(pct)}"></div>
        </div>
        <div class="breakdown__score" style="color:${Format.barColor(pct)}">${pct}/100</div>
      `;
      container.appendChild(item);
    });
  }

  function renderFindings() {
    if (!currentResults) return;

    const container = DOM.$("#findingsList");
    let findings = [...currentResults.findings];

    if (activeFilter !== "all") {
      findings = findings.filter((f) => f.severity === activeFilter);
    }

    if (activeCategory !== "all") {
      findings = findings.filter((f) => f.category === activeCategory);
    }

    const severityOrder = { critical: 0, warning: 1, info: 2 };
    if (activeSort === "severity") {
      findings.sort((a, b) => (severityOrder[a.severity] ?? 3) - (severityOrder[b.severity] ?? 3));
    } else if (activeSort === "category") {
      findings.sort((a, b) => a.category.localeCompare(b.category));
    }

    if (findings.length === 0) {
      container.innerHTML = '<p class="empty-state">No findings match the selected filters.</p>';
      return;
    }

    container.innerHTML = findings
      .map(
        (f) => `
      <div class="finding" data-severity="${f.severity}">
        <div class="finding__indicator"></div>
        <div class="finding__body">
          <div class="finding__title">${escapeHtml(f.title)}</div>
          <div class="finding__desc">${escapeHtml(f.description)}</div>
          <span class="finding__category">${Format.categoryName(f.category)}</span>
        </div>
        <div class="finding__value">${escapeHtml(f.value)}</div>
      </div>
    `
      )
      .join("");
  }

//   sanitize html
  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  return { init };
})();
