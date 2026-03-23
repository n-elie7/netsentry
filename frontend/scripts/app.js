// main application entry point

document.addEventListener("DOMContentLoaded", async () => {
  // Initialize all module event listeners
  Auth.init();
  Scanner.init();
  History.init();
  Compare.init();

  // tab navigation
  DOM.$$(".nav__tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      DOM.$$(".nav__tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");

      const targetId = `tab-${tab.dataset.tab}`;
      DOM.$$(".tab-content").forEach((section) => {
        section.classList.toggle("active", section.id === targetId);
      });

      if (tab.dataset.tab === "history") {
        History.loadHistory();
      }
    });
  });

  await Auth.checkSession();
});
