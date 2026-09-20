/* ==========================================================================
   dashboard.js — User Dashboard + Profile page logic
   ========================================================================== */

(function () {
  "use strict";
  window.PageScripts = window.PageScripts || {};

  /* Icon per parking-lot type (shown in card headers) */
  const TYPE_ICONS = {
    Multilevel: "fa-building",
    "On-street": "fa-car",
    Market: "fa-store",
    Metro: "fa-train-subway",
    Waterfront: "fa-water",
    Mall: "fa-bag-shopping",
    Heritage: "fa-landmark",
    Park: "fa-tree",
    "IT Park": "fa-building",
    Premium: "fa-gem",
    Plaza: "fa-city",
  };
  const typeIcon = (t) => TYPE_ICONS[t] || "fa-square-parking";

  const DEFAULT_COORDS = { lat: 28.6304, lng: 77.2177 }; // Connaught Place, New Delhi

  /* ===================== DASHBOARD ===================== */
  const DashboardPage = {
    state: { q: "", onlyAvailable: false, onlyOpen: false, price: 0, sort: "distance", coords: null, cardEls: {} },

    init() {
      const user = DB.getCurrentUser();
      if (!user) return;

      /* welcome message by time of day */
      const h = new Date().getHours();
      const greet = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
      const hello = document.getElementById("helloLine");
      const title = document.getElementById("welcomeTitle");
      if (hello) hello.textContent = `${greet}, ${user.name.split(" ")[0]}!`;
      if (title) title.textContent = "Where would you like to park today?";

      /* stored user coords from a previous locate (or default) */
      try {
        const c = JSON.parse(localStorage.getItem("sp_coords"));
        if (c && c.lat && c.lng) this.state.coords = c;
      } catch (e) {}
      if (!this.state.coords) this.state.coords = { ...DEFAULT_COORDS };

      this.bindEvents();
      this.render();

      /* live simulation: refresh this page every 5 seconds */
      DB.startSimulation(5000);
      document.addEventListener("sp:updated", () => {
        this.updateLiveNumbers();
        if (this.state.onlyAvailable) this.render(); // availability filter may change visibility
      });
    },

    bindEvents() {
      /* --- search + suggestions --- */
      const input = document.getElementById("searchInput");
      const box = document.getElementById("suggestBox");
      const showSuggestions = () => {
        const q = (input.value || "").trim().toLowerCase();
        if (!q) { box.classList.remove("show"); return; }
        const lots = DB.getLots()
          .filter((l) => (l.name + " " + l.area + " " + l.city).toLowerCase().includes(q))
          .slice(0, 6);
        if (!lots.length) { box.classList.remove("show"); return; }
        box.innerHTML = lots
          .map(
            (l) => `<div class="suggest-item" data-lot="${l.id}">
              <i class="fa-solid ${typeIcon(l.type)}"></i>
              <div><div class="s-name">${Utils.esc(l.name)}</div><div class="s-sub">${Utils.esc(l.area)}, ${Utils.esc(l.city)}</div></div>
            </div>`
          )
          .join("");
        box.classList.add("show");
      };

      input.addEventListener("input", Utils.debounce(showSuggestions, 180));
      input.addEventListener("focus", showSuggestions);
      document.addEventListener("click", (e) => {
        const item = e.target.closest(".suggest-item");
        if (item) {
          this.state.q = DB.getLot(item.dataset.lot).name;
          input.value = this.state.q;
          box.classList.remove("show");
          this.render();
          return;
        }
        if (!e.target.closest(".search-input-wrap")) box.classList.remove("show");
      });
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          this.state.q = input.value.trim();
          box.classList.remove("show");
          this.render();
        }
      });

      /* --- locate me --- */
      const locateBtn = document.getElementById("locateBtn");
      if (locateBtn) {
        locateBtn.addEventListener("click", () => {
          if (!navigator.geolocation) {
            Utils.toast("Geolocation is not supported by this browser.", "warn");
            return;
          }
          Utils.toast("Locating you…", "info", "GPS");
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              this.state.coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
              localStorage.setItem("sp_coords", JSON.stringify(this.state.coords));
              Utils.toast("Distances updated from your location.", "success", "Location found");
              this.render();
            },
            () => Utils.toast("Could not access your location — using New Delhi as the demo origin.", "warn")
          );
        });
      }

      /* --- filter chips & selects --- */
      const chipAvailable = document.getElementById("chipAvailable");
      const chipOpen = document.getElementById("chipOpen");
      const priceFilter = document.getElementById("priceFilter");
      const sortFilter = document.getElementById("sortFilter");
      chipAvailable.addEventListener("click", () => {
        this.state.onlyAvailable = !this.state.onlyAvailable;
        chipAvailable.classList.toggle("active", this.state.onlyAvailable);
        this.render();
      });
      chipOpen.addEventListener("click", () => {
        this.state.onlyOpen = !this.state.onlyOpen;
        chipOpen.classList.toggle("active", this.state.onlyOpen);
        this.render();
      });
      priceFilter.addEventListener("change", () => { this.state.price = Number(priceFilter.value); this.render(); });
      sortFilter.addEventListener("change", () => { this.state.sort = sortFilter.value; this.render(); });
    },

    /* a lot counts as "open now" */
    isOpen(lot) {
      if (lot.open === "00:00" && lot.close === "23:59") return true;
      const d = new Date();
      const mins = d.getHours() * 60 + d.getMinutes();
      const [oh, om] = (lot.open || "00:00").split(":").map(Number);
      const [ch, cm] = (lot.close || "23:59").split(":").map(Number);
      const o = oh * 60 + om, c = ch * 60 + cm;
      return o <= c ? mins >= o && mins < c : mins >= o || mins < c;
    },

    distanceTo(lot) {
      return Utils.distanceKm(this.state.coords.lat, this.state.coords.lng, lot.lat, lot.lng);
    },

    visibleLots() {
      const q = this.state.q.trim().toLowerCase();
      let lots = DB.getLots().map((lot) => {
        const stats = DB.getLotStats(lot.id);
        return { ...lot, stats, dist: this.distanceTo(lot) };
      });

      if (q) lots = lots.filter((l) => (l.name + " " + l.area + " " + l.city).toLowerCase().includes(q));
      if (this.state.onlyAvailable) lots = lots.filter((l) => l.stats.available > 0);
      if (this.state.onlyOpen) lots = lots.filter((l) => this.isOpen(l));
      if (this.state.price) lots = lots.filter((l) => l.price <= this.state.price);

      const s = this.state.sort;
      lots.sort((a, b) =>
        s === "rating" ? b.rating - a.rating
        : s === "price-asc" ? a.price - b.price
        : s === "price-desc" ? b.price - a.price
        : s === "name" ? a.name.localeCompare(b.name)
        : a.dist - b.dist
      );
      return lots;
    },

    cardHtml(lot) {
      const { stats, dist } = lot;
      const pct = stats.total ? Math.round((stats.available / stats.total) * 100) : 0;
      return `
        <article class="parking-card" data-lot-id="${lot.id}">
          <div class="parking-media ${lot.theme || "ph-1"}">
            <i class="fa-solid ${typeIcon(lot.type)} big-ico"></i>
            <span class="rating-pill"><i class="fa-solid fa-star"></i> ${lot.rating.toFixed(1)}</span>
            <span class="type-pill"><i class="fa-solid fa-location-dot"></i> ${Utils.esc(lot.type)}</span>
          </div>
          <div class="parking-body">
            <h3 class="parking-name">${Utils.esc(lot.name)}</h3>
            <div class="parking-addr"><i class="fa-solid fa-location-dot"></i>${Utils.esc(lot.address)}, ${Utils.esc(lot.city)}</div>
            <div class="parking-meta">
              <div class="meta-chip"><div class="v live avail-num">${stats.available}<span style="font-size:11px;color:var(--muted)">/${stats.total}</span></div><div class="l">Free bays</div></div>
              <div class="meta-chip"><div class="v">${dist.toFixed(1)} km</div><div class="l">Distance</div></div>
              <div class="meta-chip"><div class="v">₹${lot.price}</div><div class="l">Per hour</div></div>
            </div>
            <div class="avail-bar"><div class="avail-fill" style="width:${pct}%"></div></div>
            <div class="parking-foot">
              <div class="price-tag"><strong>₹${lot.price}</strong> <span class="per">/ hour</span></div>
              <a class="btn btn-primary btn-sm" href="parking-details.html?id=${lot.id}"><i class="fa-solid fa-bookmark me-1"></i>Book Now</a>
            </div>
          </div>
        </article>`;
    },

    render() {
      const grid = document.getElementById("parkingGrid");
      const empty = document.getElementById("emptyState");
      const count = document.getElementById("filterCount");
      if (!grid) return;

      const lots = this.visibleLots();
      grid.innerHTML = lots.map((l) => this.cardHtml(l)).join("");
      empty.classList.toggle("d-none", lots.length > 0);
      if (count) count.textContent = `${lots.length} zone${lots.length === 1 ? "" : "s"} found`;

      /* keep a live map of card elements for targeted updates */
      this.state.cardEls = {};
      grid.querySelectorAll(".parking-card").forEach((el) => (this.state.cardEls[el.dataset.lotId] = el));

      this.updateLiveNumbers(lots);
    },

    /* refresh counters & mini stats without rebuilding the whole grid */
    updateLiveNumbers(lots) {
      const grid = document.getElementById("parkingGrid");
      if (grid) {
        grid.querySelectorAll(".parking-card").forEach((el) => {
          const stats = DB.getLotStats(el.dataset.lotId);
          const num = el.querySelector(".avail-num");
          if (num) num.innerHTML = stats.available + `<span style="font-size:11px;color:var(--muted)">/${stats.total}</span>`;
          const bar = el.querySelector(".avail-fill");
          if (bar) bar.style.width = stats.total ? Math.round((stats.available / stats.total) * 100) + "%" : "0%";
        });
      }

      const g = DB.getGlobalStats();
      const avg = (() => {
        const ls = DB.getLots();
        return ls.length ? Math.round(ls.reduce((s, l) => s + l.price, 0) / ls.length) : 0;
      })();
      const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
      if (lots) set("statNearby", lots.length);
      set("statAvailable", g.available);
      set("statAvgPrice", "₹" + avg);
    },
  };

  /* ===================== PROFILE ===================== */
  const ProfilePage = {
    init() {
      const user = DB.getCurrentUser();
      if (!user) return;

      /* left panel */
      const avatar = document.getElementById("pfAvatar");
      const name = document.getElementById("pfName");
      const email = document.getElementById("pfEmail");
      const role = document.getElementById("pfRole");
      const joined = document.getElementById("pfJoined");
      const bookings = document.getElementById("pfBookings");

      if (avatar) avatar.textContent = Utils.initials(user.name);
      if (name) name.textContent = user.name;
      if (email) email.textContent = user.email;
      if (role) {
        role.textContent = user.role === "admin" ? "City Administrator" : "Citizen";
        role.className = "status-badge " + (user.role === "admin" ? "sb-info" : "sb-success");
      }
      if (joined) joined.textContent = "Joined " + Utils.formatDate(user.createdAt.slice(0, 10));
      if (bookings) bookings.textContent = String(DB.getBookingsForUser(user.id).length);
      const roleTag = document.getElementById("pfRoleTag");
      if (roleTag) roleTag.textContent = user.role === "admin" ? "Admin" : "User";

      /* prefill the edit form */
      const f = document.getElementById("profileForm");
      if (f) {
        f.elements["name"].value = user.name;
        f.elements["email"].value = user.email;
        f.elements["phone"].value = user.phone || "";
      }

      /* --- save profile --- */
      f.addEventListener("submit", (e) => {
        e.preventDefault();
        const name = f.elements["name"].value.trim();
        const email = f.elements["email"].value.trim();
        const phone = f.elements["phone"].value.trim();

        if (name.length < 3) return Utils.toast("Name must be at least 3 characters.", "error");
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return Utils.toast("Please enter a valid email.", "error");
        const clash = DB.findUserByEmail(email);
        if (clash && clash.id !== user.id) return Utils.toast("That email is already in use.", "error");
        if (phone && !/^\d{10}$/.test(phone.replace(/\s/g, ""))) return Utils.toast("Please enter a valid 10-digit mobile number.", "error");

        DB.updateUser(user.id, { name, email, phone });
        Utils.toast("Profile updated successfully.", "success", "Saved");
        setTimeout(() => location.reload(), 900);
      });

      /* --- change password --- */
      const pf = document.getElementById("passForm");
      if (pf) {
        pf.addEventListener("submit", (e) => {
          e.preventDefault();
          const cur = pf.elements["current"].value;
          const np = pf.elements["new"].value;
          const cp = pf.elements["confirm"].value;
          const fresh = DB.findUserById(user.id);

          if (Utils.hash(cur) !== fresh.password) return Utils.toast("Current password is incorrect.", "error");
          if (np.length < 6) return Utils.toast("New password must be at least 6 characters.", "error");
          if (np !== cp) return Utils.toast("New passwords do not match.", "error");

          DB.updateUser(user.id, { password: Utils.hash(np) });
          pf.reset();
          Utils.toast("Password changed successfully.", "success", "Done");
        });
      }

      /* --- theme switch --- */
      const themeSwitch = document.getElementById("themeSwitch");
      if (themeSwitch) {
        themeSwitch.addEventListener("click", () => {
          const settings = DB.getSettings();
          settings.theme = settings.theme === "dark" ? "light" : "dark";
          DB.saveSettings(settings);
          document.documentElement.setAttribute("data-theme", settings.theme);
          document.documentElement.setAttribute("data-bs-theme", settings.theme);
          Utils.toast(settings.theme === "dark" ? "Dark mode enabled" : "Light mode enabled", "info", "Theme");
        });
      }

      /* --- reset demo data (for presentations) --- */
      const resetBtn = document.getElementById("resetDataBtn");
      if (resetBtn) {
        resetBtn.addEventListener("click", () => {
          if (!confirm("Reset all demo data? This clears users, bookings and settings, then re-seeds a fresh database.")) return;
          localStorage.clear();
          sessionStorage.clear();
          Utils.toast("Demo database reset. Reloading…", "success", "Reset");
          setTimeout(() => (window.location.href = "login.html"), 900);
        });
      }

      /* --- logout --- */
      const logoutBtn = document.getElementById("logoutBtn");
      if (logoutBtn) {
        logoutBtn.addEventListener("click", () => {
          DB.logout();
          Utils.toast("Logged out successfully.", "info", "See you soon");
          setTimeout(() => (window.location.href = "index.html"), 700);
        });
      }
    },
  };

  window.PageScripts["dashboard"] = DashboardPage;
  window.PageScripts["profile"] = ProfilePage;
})();
