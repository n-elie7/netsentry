
const API = {
  async request(url, options = {}) {
    try {
      const response = await fetch(url, {
        headers: { "Content-Type": "application/json" },
        ...options,
      });

      const data = await response.json();

      if (response.status === 401 && typeof Auth !== "undefined" && !url.includes("/api/auth/")) {
        Auth.showAuthScreen();
        throw new Error("Session expired. Please log in again.");
      }

      if (!data.success) {
        throw new Error(data.error?.message || "Request failed.");
      }

      return data.data;
    } catch (error) {
      if (error.message === "Failed to fetch") {
        throw new Error("Network error. Please check your connection.");
      }
      throw error;
    }
  },

  post(url, body) {
    return this.request(url, { method: "POST", body: JSON.stringify(body) });
  },

  get(url) {
    return this.request(url);
  },

  async delete(url) {
    return this.request(url, { method: "DELETE" });
  },
};

const DOM = {
  $(selector) { return document.querySelector(selector); },
  $$(selector) { return document.querySelectorAll(selector); },

  show(el) { el.hidden = false; },
  hide(el) { el.hidden = true; },

  setLoading(btn, loading) {
    const text = btn.querySelector(".btn__text");
    const loader = btn.querySelector(".btn__loader");
    if (text) text.hidden = loading;
    if (loader) loader.hidden = !loading;
    btn.disabled = loading;
  },

  showError(el, message) {
    el.textContent = message;
    el.hidden = false;
    setTimeout(() => { el.hidden = true; }, 8000);
  },
};

const Format = {
  gradeColor(grade) {
    if (!grade) return "var(--text-muted)";
    const letter = grade.charAt(0);
    const colors = { A: "var(--grade-a)", B: "var(--grade-b)", C: "var(--grade-c)", D: "var(--grade-d)", F: "var(--grade-f)" };
    return colors[letter] || "var(--text-muted)";
  },

  barColor(score) {
    if (score >= 80) return "var(--grade-a)";
    if (score >= 60) return "var(--grade-b)";
    if (score >= 40) return "var(--grade-c)";
    return "var(--grade-f)";
  },

  date(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  },

  categoryName(cat) {
    const names = {
      ssl: "SSL/TLS",
      threats: "Threats",
      reputation: "Reputation",
      headers: "Headers",
      whois: "WHOIS",
      performance: "Performance",
    };
    return names[cat] || cat;
  },
};
