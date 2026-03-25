// history rendering functionality

const History = (() => {
  let currentPage = 1;

  function init() {
    DOM.$("#historySearch").addEventListener("input", debounce(loadHistory, 400));
    DOM.$("#historyGradeFilter").addEventListener("change", () => { currentPage = 1; loadHistory(); });
    DOM.$("#historySortFilter").addEventListener("change", () => { currentPage = 1; loadHistory(); });
  }

  async function loadHistory() {
    const search = DOM.$("#historySearch").value.trim();
    const grade = DOM.$("#historyGradeFilter").value;
    const sortBy = DOM.$("#historySortFilter").value;

    const params = new URLSearchParams({ page: currentPage, limit: 15 });
    if (search) params.set("search", search);
    if (grade) params.set("grade", grade);
    if (sortBy) params.set("sortBy", sortBy);

    try {
      const data = await API.get(`/api/history?${params}`);
      renderHistory(data.scans);
      renderPagination(data.pagination);
    } catch (error) {
      DOM.$("#historyList").innerHTML =
        '<p class="empty-state">Failed to load history.</p>';
    }
  }

//   history list
  function renderHistory(scans) {
    const container = DOM.$("#historyList");

    if (!scans || scans.length === 0) {
      container.innerHTML = '<p class="empty-state">No scans found.</p>';
      return;
    }

    container.innerHTML = scans
      .map(
        (scan) => `
      <div class="history-item" data-id="${scan.id}">
        <div class="history-item__grade" style="color:${Format.gradeColor(scan.grade)}">${scan.grade}</div>
        <div>
          <div class="history-item__domain">${escapeHtml(scan.domain)}</div>
          <div class="history-item__date">${Format.date(scan.scanned_at)}</div>
        </div>
        <div class="history-item__score">${scan.score}/100</div>
        <div class="history-item__actions">
          <button class="history-item__delete" onclick="History.deleteScan('${scan.id}', event)" title="Delete">
            ✕
          </button>
        </div>
      </div>
    `
      )
      .join("");

    // Click to view full scan
    container.querySelectorAll(".history-item").forEach((item) => {
      item.addEventListener("click", (e) => {
        if (e.target.closest(".history-item__delete")) return;
        viewScan(item.dataset.id);
      });
    });
  }

  function renderPagination(pagination) {
    const container = DOM.$("#pagination");
    if (pagination.totalPages <= 1) {
      container.innerHTML = "";
      return;
    }

    let html = "";
    for (let i = 1; i <= pagination.totalPages; i++) {
      html += `<button class="pagination__button ${i === pagination.page ? "active" : ""}" onclick="History.goToPage(${i})">${i}</button>`;
    }
    container.innerHTML = html;
  }

  function goToPage(page) {
    currentPage = page;
    loadHistory();
  }

  async function viewScan(id) {
    try {
      const data = await API.get(`/api/scan/${id}`);

      document.querySelector('[data-tab="scan"]').click();
      DOM.$("#domainInput").value = data.domain;
      DOM.show(DOM.$("#scanResults"));

      DOM.$("#gradeCard").dataset.grade = data.grade;
      DOM.$("#gradeValue").textContent = data.grade;
      DOM.$("#gradeValue").style.color = Format.gradeColor(data.grade);
      DOM.$("#gradeDomain").textContent = data.domain;
      DOM.$("#gradeScore").textContent = data.score;
      DOM.$("#gradeSummary").textContent = data.summary;
      DOM.$("#statCritical").textContent = data.stats.critical;
      DOM.$("#statWarning").textContent = data.stats.warning;
      DOM.$("#statInfo").textContent = data.stats.info;
      DOM.$("#statTotal").textContent = data.stats.total;

      // breakdown
      const breakdownContainer = DOM.$("#breakdown");
      breakdownContainer.innerHTML = "";
      ["ssl", "threats", "reputation", "headers", "whois", "performance"].forEach((cat) => {
        const info = data.breakdown[cat] || { score: 0, maxScore: 100 };
        const pct = Math.round((info.score / info.maxScore) * 100);
        const item = document.createElement("div");
        item.className = "breakdown__item";
        item.innerHTML = `
          <div class="breakdown__label">${Format.categoryName(cat)}</div>
          <div class="breakdown__bar"><div class="breakdown__fill" style="width:${pct}%;background:${Format.barColor(pct)}"></div></div>
          <div class="breakdown__score" style="color:${Format.barColor(pct)}">${pct}/100</div>
        `;
        breakdownContainer.appendChild(item);
      });

      // render findings
      const findingsList = DOM.$("#findingsList");
      const severityOrder = { critical: 0, warning: 1, info: 2 };
      const sorted = [...data.findings].sort((a, b) => (severityOrder[a.severity] ?? 3) - (severityOrder[b.severity] ?? 3));
      findingsList.innerHTML = sorted.map((f) => `
        <div class="finding" data-severity="${f.severity}">
          <div class="finding__indicator"></div>
          <div class="finding__body">
            <div class="finding__title">${escapeHtml(f.title)}</div>
            <div class="finding__desc">${escapeHtml(f.description)}</div>
            <span class="finding__category">${Format.categoryName(f.category)}</span>
          </div>
          <div class="finding__value">${escapeHtml(f.value)}</div>
        </div>
      `).join("");
    } catch (error) {
      console.error("Failed to load scan:", error);
    }
  }

  async function deleteScan(id, event) {
    event.stopPropagation();
    if (!confirm("Delete this scan?")) return;

    try {
      await API.delete(`/api/history/${id}`);
      loadHistory();
    } catch (error) {
      console.error("Failed to delete scan:", error);
    }
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function debounce(fn, delay) {
    let timer;
    return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); };
  }

  return { init, loadHistory, goToPage, deleteScan };
})();
