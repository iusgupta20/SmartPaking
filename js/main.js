/* ==========================================================================
   main.js — Shared application shell
   --------------------------------------------------------------------------
   Responsibilities:
   • Boot sequence: theme → loader → seed data → auth guard → layout
   • Role-aware navbar + notification bell + theme toggle (injected once)
   • Page protection (user pages vs. admin pages)
   • Login / Register / Forgot-password / Contact-form logic
   Every page loads this file; the per-page script registers itself in
   window.PageScripts under its data-page name.
   ========================================================================== */

(function () {
  "use strict";

  /* Pages that require a signed-in user (or an admin for admin:* ) */
  const AUTH = {
    dashboard: "user",
    booking: "user",
    "my-bookings": "user",
    profile: "user",
    "admin-dashboard": "admin",
    "parking-management": "admin",
    reports: "admin",
  };

  const PAGE = (document.body.dataset.page || "index").toLowerCase();
  const ALLOWED_RETURN = new Set(["dashboard.html", "booking.html", "my-bookings.html", "profile.html", "admin-dashboard.html", "parking-management.html", "reports.html"]);

  /* ---------------- Theme (light / dark) ---------------- */
  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.setAttribute("data-bs-theme", theme);
  }
  function currentTheme() {
    return DB.getSettings().theme || "light";
  }
  function toggleTheme() {
    const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    const s = DB.getSettings();
    s.theme = next;
    DB.saveSettings(s);
    applyTheme(next);
    const btn = document.getElementById("themeToggle");
    if (btn) btn.innerHTML = next === "dark" ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
    Utils.toast(next === "dark" ? "Dark mode enabled" : "Light mode enabled", "info", "Theme");
  }

  /* ---------------- Auth guard ---------------- */
  function guard() {
    const need = AUTH[PAGE];
    if (!need) return;
    const user = DB.getCurrentUser();
    if (!user) {
      location.replace("login.html?returnTo=" + encodeURIComponent(PAGE + ".html"));
      return;
    }
    if (need === "admin" && user.role !== "admin") location.replace("dashboard.html");
  }

  /* ---------------- Navbar ---------------- */
  const LINKS = {
    public: [
      { href: "index.html", label: "Home", icon: "fa-house" },
      { href: "index.html#features", label: "Features", icon: "fa-layer-group" },
      { href: "map.html", label: "Live Map", icon: "fa-map-location-dot" },
      { href: "index.html#about", label: "About", icon: "fa-circle-info" },
      { href: "contact.html", label: "Contact", icon: "fa-headset" },
    ],
    user: [
      { href: "dashboard.html", label: "Dashboard", icon: "fa-gauge-high" },
      { href: "map.html", label: "Live Map", icon: "fa-map-location-dot" },
      { href: "my-bookings.html", label: "My Bookings", icon: "fa-ticket" },
      { href: "contact.html", label: "Contact", icon: "fa-headset" },
    ],
    admin: [
      { href: "admin-dashboard.html", label: "Dashboard", icon: "fa-gauge-high" },
      { href: "parking-management.html", label: "Parking Mgmt", icon: "fa-square-parking" },
      { href: "reports.html", label: "Reports", icon: "fa-chart-column" },
      { href: "map.html", label: "Live Map", icon: "fa-map-location-dot" },
    ],
  };

  function currentFile() {
    return (window.location.pathname.split("/").pop() || "index.html") + (window.location.hash || "");
  }

  function buildNav() {
    const mount = document.getElementById("navbar");
    if (!mount) return;

    const user = DB.getCurrentUser();
    const isAdmin = !!user && user.role === "admin";
    const links = isAdmin ? LINKS.admin : user ? LINKS.user : LINKS.public;
    const file = currentFile();

    const linkHtml = links
      .map((l) => `<a class="nav-link-sp ${file === l.href ? "active" : ""}" href="${l.href}"><i class="fa-solid ${l.icon}"></i>${l.label}</a>`)
      .join("");

    /* right-side actions */
    let actions = "";
    if (user) {
      const unread = DB.unreadCount(user.id);
      actions += `
        <div class="dropdown">
          <button class="icon-btn" data-bs-toggle="dropdown" aria-expanded="false" title="Notifications">
            <i class="fa-regular fa-bell"></i>
            ${unread ? `<span class="notif-badge">${unread > 9 ? "9+" : unread}</span>` : ""}
          </button>
          <div class="dropdown-menu dropdown-menu-end notif-drop">
            <div class="notif-head"><span>Notifications</span><a href="#" class="text-accent small fw-semibold" data-action="mark-read">Mark all read</a></div>
            <div class="notif-list" id="notifList"></div>
          </div>
        </div>`;
      actions += `
        <button class="icon-btn" id="themeToggle" data-action="theme-toggle" title="Toggle dark mode"><i class="fa-solid fa-${currentTheme() === "dark" ? "sun" : "moon"}"></i></button>
        <div class="dropdown">
          <button class="avatar" data-bs-toggle="dropdown" aria-expanded="false" title="Account">${Utils.initials(user.name)}</button>
          <div class="dropdown-menu dropdown-menu-end notif-drop" style="width:240px">
            <div class="px-3 py-2"><div class="user-menu-name">${Utils.esc(user.name)}</div><div class="user-menu-mail">${Utils.esc(user.email)}</div></div>
            <div class="dropdown-divider"></div>
            <a class="dropdown-item py-2" href="profile.html"><i class="fa-solid fa-user me-2 text-accent"></i>My Profile</a>
            <a class="dropdown-item py-2" href="my-bookings.html"><i class="fa-solid fa-ticket me-2 text-accent"></i>My Bookings</a>
            ${isAdmin ? '<a class="dropdown-item py-2" href="admin-dashboard.html"><i class="fa-solid fa-gauge-high me-2 text-accent"></i>Admin Console</a>' : ""}
            <div class="dropdown-divider"></div>
            <a class="dropdown-item py-2 text-danger" href="#" data-action="logout"><i class="fa-solid fa-right-from-bracket me-2"></i>Log out</a>
          </div>
        </div>`;
    } else {
      actions += `
        <button class="icon-btn" id="themeToggle" data-action="theme-toggle" title="Toggle dark mode"><i class="fa-solid fa-${currentTheme() === "dark" ? "sun" : "moon"}"></i></button>
        <a class="btn btn-ghost d-none d-sm-inline-flex" href="login.html">Sign in</a>
        <a class="btn btn-primary" href="register.html">Get Started</a>`;
    }

    mount.innerHTML = `
      <nav class="navbar-sp" id="siteNav">
        <div class="container d-flex align-items-center justify-content-between">
          <a class="brand" href="index.html">
            <img class="brand-logo" src="assets/logo.svg" alt="SmartPark 360 logo">
            <span class="d-none d-sm-block">
              <span class="brand-name">SmartPark <em>360</em></span>
              <span class="brand-tag">Smart City Mission</span>
            </span>
          </a>
          <div class="nav-center d-none d-lg-flex">${linkHtml}</div>
          <div class="nav-actions">
            <a class="icon-btn" href="download.html" title="Download project ZIP"><i class="fa-solid fa-file-zipper"></i></a>
            ${actions}
            <button class="icon-btn d-lg-none" data-action="mobile-toggle" title="Menu"><i class="fa-solid fa-bars"></i></button>
          </div>
        </div>
        <div class="d-lg-none" id="mobileNav" style="display:none; background:var(--surface); border-top:1px solid var(--border); padding:12px 16px;">
          <div class="d-flex flex-column gap-1">${linkHtml}</div>
        </div>
      </nav>`;

    renderNotifs(user);
  }

  function renderNotifs(user) {
    const list = document.getElementById("notifList");
    if (!list) return;
    const notifs = user ? DB.getNotifications(user.id).slice(0, 6) : [];
    if (!notifs.length) {
      list.innerHTML = `<div class="p-4 text-center text-muted-sp small">No notifications yet</div>`;
      return;
    }
    list.innerHTML = notifs
      .map(
        (n) => `
        <div class="notif-item ${n.read ? "" : "unread"}">
          <div class="notif-ico"><i class="fa-solid ${n.icon || "fa-bell"}"></i></div>
          <div><div class="notif-msg">${Utils.esc(n.message)}</div><div class="notif-time">${Utils.timeAgo(n.time)}</div></div>
        </div>`
      )
      .join("");
  }

  function buildFooter() {
    const mount = document.getElementById("footer");
    if (!mount) return;
    if (PAGE === "login" || PAGE === "register") return;
    mount.innerHTML = `
      <footer class="footer">
        <div class="container">
          <div class="footer-grid">
            <div class="footer-brand">
              <a class="brand" href="index.html">
                <img class="brand-logo" src="assets/logo.svg" alt="SmartPark 360">
                <span><span class="brand-name">SmartPark <em>360</em></span><span class="brand-tag">Smart City Mission</span></span>
              </a>
              <p>Smart and effective realtime management of street parking — an end-to-end prototype built for Smart India Hackathon 2026 (SIH1515).</p>
              <span class="live-badge"><span class="live-dot"></span>Live simulation active</span>
            </div>
            <div>
              <div class="footer-title">Quick Links</div>
              <a class="footer-link" href="index.html">Home</a>
              <a class="footer-link" href="index.html#features">Features</a>
              <a class="footer-link" href="map.html">Live Parking Map</a>
              <a class="footer-link" href="contact.html">Contact &amp; Support</a>
            </div>
            <div>
              <div class="footer-title">Platform</div>
              <a class="footer-link" href="dashboard.html">User Dashboard</a>
              <a class="footer-link" href="my-bookings.html">My Bookings</a>
              <a class="footer-link" href="admin-dashboard.html">Admin Console</a>
              <a class="footer-link" href="reports.html">Reports &amp; Analytics</a>
              <a class="footer-link" href="download.html">Download Project (ZIP)</a>
            </div>
            <div>
              <div class="footer-title">Emergency Contact</div>
              <div class="footer-emergency">
                <a class="emo-chip" href="tel:112"><i class="fa-solid fa-shield-halved"></i>Police 112</a>
                <a class="emo-chip" href="tel:108"><i class="fa-solid fa-truck-medical"></i>Ambulance 108</a>
                <a class="emo-chip" href="tel:1095"><i class="fa-solid fa-car-burst"></i>Traffic 1095</a>
              </div>
              <ul class="footer-contact list-unstyled mt-3">
                <li><i class="fa-solid fa-envelope"></i>support@smartpark360.gov.in</li>
                <li><i class="fa-solid fa-phone"></i>1800-123-3600 (toll free)</li>
              </ul>
            </div>
          </div>
          <div class="footer-bottom">
            <span>© 2026 SmartPark 360 · Ministry of Smart Cities (Demonstration Prototype)</span>
            <span>Built for <strong>SIH 2026 · SIH1515</strong></span>
          </div>
        </div>
      </footer>`;
  }

  /* ---------------- Delegated global actions ---------------- */
  document.addEventListener("click", (e) => {
    const actionEl = e.target.closest("[data-action]");
    if (!actionEl) return;

    switch (actionEl.dataset.action) {
      case "logout":
        e.preventDefault();
        DB.logout();
        Utils.toast("You have been logged out. See you soon!", "info", "Signed out");
        setTimeout(() => (window.location.href = "index.html"), 600);
        break;

      case "theme-toggle":
        toggleTheme();
        break;

      case "mobile-toggle":
        e.preventDefault();
        const panel = document.getElementById("mobileNav");
        if (panel) panel.style.display = panel.style.display === "none" ? "block" : "none";
        break;

      case "mark-read": {
        e.preventDefault();
        const user = DB.getCurrentUser();
        if (!user) return;
        DB.markNotifsRead(user.id);
        renderNotifs(user);
        const badge = document.querySelector(".notif-badge");
        if (badge) badge.remove();
        break;
      }

      case "fill-login": {
        e.preventDefault();
        const email = actionEl.dataset.email;
        const pass = actionEl.dataset.pass;
        const f = document.getElementById("loginForm");
        if (f) {
          f.elements["email"].value = email;
          f.elements["password"].value = pass;
          Utils.toast("Demo credentials filled — hit Sign in!", "info", "Autofill");
        }
        break;
      }
    }
  });

  window.addEventListener("scroll", () => {
    const nav = document.getElementById("siteNav");
    if (nav) nav.classList.toggle("scrolled", window.scrollY > 8);
  });

  /* ---------------- Boot ---------------- */
  async function boot() {
    applyTheme(currentTheme());
    await DB.init(); // seed LocalStorage data (first run only)
    guard();

    const navMount = document.getElementById("navbar");
    if (navMount && PAGE !== "login" && PAGE !== "register") buildNav();
    buildFooter();

    const pageInit = (window.PageScripts || {})[PAGE];
    if (pageInit && typeof pageInit.init === "function") {
      try {
        pageInit.init();
      } catch (err) {
        console.error("[SmartPark360] Page init failed:", err);
        Utils.toast("Something went wrong initializing this page.", "error");
      }
    }

    if (window.AOS) AOS.init({ duration: 650, once: true, offset: 70, easing: "ease-out-cubic" });

    const loader = document.getElementById("loader");
    if (loader) {
      loader.classList.add("done");
      setTimeout(() => loader.remove(), 600);
    }
  }

  document.addEventListener("DOMContentLoaded", boot);

  /* ======================================================================
     LOGIN PAGE LOGIC
     ====================================================================== */
  const LoginPage = {
    init() {
      const form = document.getElementById("loginForm");
      if (!form) return;

      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const email = form.elements["email"].value.trim();
        const pass = form.elements["password"].value;
        const remember = form.elements["remember"].checked;

        if (!email || !pass) {
          Utils.toast("Please enter both email and password.", "error", "Missing fields");
          form.classList.add("shake");
          setTimeout(() => form.classList.remove("shake"), 450);
          return;
        }

        const res = DB.login(email, pass, remember);
        if (!res.ok) {
          Utils.toast(res.error, "error", "Login failed");
          form.classList.add("shake");
          setTimeout(() => form.classList.remove("shake"), 450);
          return;
        }

        Utils.toast(`Welcome back, ${res.user.name.split(" ")[0]}!`, "success", "Login successful");
        const returnTo = Utils.getParam("returnTo");
        const safe = returnTo && ALLOWED_RETURN.has(returnTo) ? returnTo : res.user.role === "admin" ? "admin-dashboard.html" : "dashboard.html";
        setTimeout(() => (window.location.href = safe), 700);
      });

      /* show / hide password */
      const toggles = document.querySelectorAll(".pass-toggle");
      toggles.forEach((t) =>
        t.addEventListener("click", () => {
          const input = t.parentElement.querySelector("input");
          const isPass = input.type === "password";
          input.type = isPass ? "text" : "password";
          t.innerHTML = `<i class="fa-regular ${isPass ? "fa-eye-slash" : "fa-eye"}"></i>`;
        })
      );

      /* forgot password → verify email, then allow a reset */
      const forgotBtn = document.getElementById("forgotBtn");
      if (forgotBtn) {
        forgotBtn.addEventListener("click", () => {
          const f = document.getElementById("loginForm");
          const email = f ? f.elements["email"].value.trim() : "";
          const modal = document.getElementById("forgotModal");
          const modalEmail = document.getElementById("forgotEmail");
          const modalReset = document.getElementById("forgotReset");
          const modalDone = document.getElementById("forgotDone");
          modalEmail.value = email;
          modalReset.style.display = "none";
          modalDone.style.display = "none";
          modalEmail.closest(".mb-3").style.display = "";
          if (window.bootstrap && modal) bootstrap.Modal.getOrCreateInstance(modal).show();
        });
      }

      const forgotVerify = document.getElementById("forgotVerify");
      if (forgotVerify) {
        forgotVerify.addEventListener("click", () => {
          const email = document.getElementById("forgotEmail").value.trim();
          if (!DB.findUserByEmail(email)) {
            Utils.toast("No account found with that email.", "error", "Not found");
            return;
          }
          document.getElementById("forgotEmail").closest(".mb-3").style.display = "none";
          document.getElementById("forgotReset").style.display = "";
          document.getElementById("forgotEmailHidden").value = email;
        });
      }

      const forgotSave = document.getElementById("forgotSave");
      if (forgotSave) {
        forgotSave.addEventListener("click", () => {
          const email = document.getElementById("forgotEmailHidden").value;
          const np = document.getElementById("forgotNewPass").value;
          const cp = document.getElementById("forgotConfirmPass").value;
          if (!email) return;
          if (np.length < 6) {
            Utils.toast("Password must be at least 6 characters.", "error");
            return;
          }
          if (np !== cp) {
            Utils.toast("Passwords do not match.", "error");
            return;
          }
          const user = DB.findUserByEmail(email);
          DB.updateUser(user.id, { password: Utils.hash(np) });
          document.getElementById("forgotReset").style.display = "none";
          document.getElementById("forgotDone").style.display = "";
          Utils.toast("Password updated. You can now sign in.", "success", "All set");
          const modal = document.getElementById("forgotModal");
          setTimeout(() => bootstrap.Modal.getInstance(modal) && bootstrap.Modal.getInstance(modal).hide(), 1400);
        });
      }
    },
  };

  /* ======================================================================
     REGISTER PAGE LOGIC
     ====================================================================== */
  const RegisterPage = {
    init() {
      const form = document.getElementById("registerForm");
      if (!form) return;
      const pass = form.elements["password"];
      const meter = document.getElementById("pwMeter");
      const meterBar = document.getElementById("pwMeterBar");

      const emailOk = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

      /* live password strength meter */
      if (pass && meter) {
        pass.addEventListener("input", () => {
          const v = pass.value;
          let score = 0;
          if (v.length >= 6) score++;
          if (v.length >= 10) score++;
          if (/[A-Z]/.test(v) && /[a-z]/.test(v)) score++;
          if (/\d/.test(v) && /[^A-Za-z0-9]/.test(v)) score++;
          meter.style.display = v ? "block" : "none";
          meterBar.style.width = (score / 4) * 100 + "%";
          meterBar.style.background = score <= 1 ? "var(--red)" : score <= 2 ? "var(--amber)" : "var(--green)";
        });
      }

      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const name = form.elements["name"].value.trim();
        const email = form.elements["email"].value.trim();
        const phone = form.elements["phone"].value.trim();
        const password = pass.value;
        const confirm = form.elements["confirm"].value;
        const terms = form.elements["terms"].checked;

        if (name.length < 3) return fail("Please enter your full name.");
        if (!emailOk(email)) return fail("Please enter a valid email address.");
        if (!/^\d{10}$/.test(phone.replace(/\s/g, ""))) return fail("Please enter a valid 10-digit mobile number.");
        if (password.length < 6) return fail("Password must be at least 6 characters.");
        if (password !== confirm) return fail("Passwords do not match.");
        if (!terms) return fail("Please accept the terms to continue.");

        const res = DB.register({ name, email, phone, password });
        if (!res.ok) return fail(res.error);

        Utils.toast(`Account created. Welcome, ${res.user.name.split(" ")[0]}!`, "success", "Registration successful");
        setTimeout(() => (window.location.href = "dashboard.html"), 800);
      });

      function fail(msg) {
        Utils.toast(msg, "error", "Check your details");
        form.classList.add("shake");
        setTimeout(() => form.classList.remove("shake"), 450);
      }

      /* show / hide password */
      document.querySelectorAll(".pass-toggle").forEach((t) =>
        t.addEventListener("click", () => {
          const input = t.parentElement.querySelector("input");
          const isPass = input.type === "password";
          input.type = isPass ? "text" : "password";
          t.innerHTML = `<i class="fa-regular ${isPass ? "fa-eye-slash" : "fa-eye"}"></i>`;
        })
      );
    },
  };

  /* ======================================================================
     CONTACT PAGE LOGIC
     ====================================================================== */
  const ContactPage = {
    init() {
      const form = document.getElementById("contactForm");
      if (!form) return;
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const name = form.elements["name"].value.trim();
        const email = form.elements["email"].value.trim();
        const subject = form.elements["subject"].value.trim();
        const message = form.elements["message"].value.trim();
        if (!name || !email || !subject || !message) {
          Utils.toast("Please fill in every field of the form.", "error", "Incomplete form");
          return;
        }
        DB.addMessage({ name, email, subject, message, page: "contact" });
        form.reset();
        Utils.toast("Your message has been logged. Our team will respond within 24 hours.", "success", "Message sent");
      });
    },
  };

  /* Register page scripts for the shared shell to call */
  window.PageScripts = Object.assign(window.PageScripts || {}, {
    login: LoginPage,
    register: RegisterPage,
    contact: ContactPage,
  });
})();
