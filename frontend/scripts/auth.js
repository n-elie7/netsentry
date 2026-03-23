// this function handles authentication functionality
const Auth = (() => {
  let currentUser = null;

  // initialize auth event listeners.
  function init() {
    // Auth tab switching 
    DOM.$$(".auth-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        DOM.$$(".auth-tab").forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");

        const target = tab.dataset.auth;
        DOM.$$(".auth-form").forEach((f) => f.classList.remove("active"));
        DOM.$(target === "login" ? "#authLogin" : "#authRegister").classList.add("active");
      });
    });

    // login
    DOM.$("#loginBtn").addEventListener("click", handleLogin);
    DOM.$("#loginUsername").addEventListener("keydown", (e) => { if (e.key === "Enter") handleLogin(); });
    DOM.$("#loginPassword").addEventListener("keydown", (e) => { if (e.key === "Enter") handleLogin(); });

    // register
    DOM.$("#registerBtn").addEventListener("click", handleRegister);
    DOM.$("#regUsername").addEventListener("keydown", (e) => { if (e.key === "Enter") handleRegister(); });
    DOM.$("#regPasswordConfirm").addEventListener("keydown", (e) => { if (e.key === "Enter") handleRegister(); });

    // logout
    DOM.$("#logoutBtn").addEventListener("click", handleLogout);
  }

  
  async function checkSession() {
    try {
      const user = await API.get("/api/auth/me");
      currentUser = user;
      showApp(user);
      return true;
    } catch {
      showAuthScreen();
      return false;
    }
  }


  async function handleLogin() {
    const username = DOM.$("#loginUsername").value.trim();
    const password = DOM.$("#loginPassword").value;
    const btn = DOM.$("#loginBtn");
    const errorEl = DOM.$("#loginError");

    if (!username || !password) {
      DOM.showError(errorEl, "Please enter both username and password.");
      return;
    }

    DOM.hide(errorEl);
    DOM.setLoading(btn, true);

    try {
      const user = await API.post("/api/auth/login", { username, password });
      currentUser = user;
      showApp(user);
      clearAuthForms();
    } catch (error) {
      DOM.showError(errorEl, error.message);
    } finally {
      DOM.setLoading(btn, false);
    }
  }


  async function handleRegister() {
    const username = DOM.$("#regUsername").value.trim();
    const password = DOM.$("#regPassword").value;
    const confirm = DOM.$("#regPasswordConfirm").value;
    const btn = DOM.$("#registerBtn");
    const errorEl = DOM.$("#registerError");

    if (!username || !password || !confirm) {
      DOM.showError(errorEl, "Please fill in all fields.");
      return;
    }

    if (password !== confirm) {
      DOM.showError(errorEl, "Passwords do not match.");
      return;
    }

    if (password.length < 6) {
      DOM.showError(errorEl, "Password must be at least 6 characters.");
      return;
    }

    DOM.hide(errorEl);
    DOM.setLoading(btn, true);

    try {
      const user = await API.post("/api/auth/register", { username, password });
      currentUser = user;
      showApp(user);
      clearAuthForms();
    } catch (error) {
      DOM.showError(errorEl, error.message);
    } finally {
      DOM.setLoading(btn, false);
    }
  }



  async function handleLogout() {
    try {
      await API.post("/api/auth/logout", {});
    } catch {
      // Logout anyway on client side
    }

    currentUser = null;
    showAuthScreen();
  }



  function showApp(user) {
    DOM.hide(DOM.$("#authScreen"));
    DOM.$(".main").hidden = false;
    DOM.$(".footer").hidden = false;
    DOM.$("#navTabs").hidden = false;
    DOM.show(DOM.$("#navUser"));
    DOM.$("#navUsername").textContent = user.username;
  }



  function showAuthScreen() {
    DOM.show(DOM.$("#authScreen"));
    DOM.$(".main").hidden = true;
    DOM.$(".footer").hidden = true;
    DOM.$("#navTabs").hidden = true;
    DOM.hide(DOM.$("#navUser"));
  }

  function clearAuthForms() {
    DOM.$("#loginUsername").value = "";
    DOM.$("#loginPassword").value = "";
    DOM.$("#regUsername").value = "";
    DOM.$("#regPassword").value = "";
    DOM.$("#regPasswordConfirm").value = "";
  }

  function getUser() {
    return currentUser;
  }

  return { init, checkSession, getUser, showAuthScreen };
})();
