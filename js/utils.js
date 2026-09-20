/* ==========================================================================
   utils.js — Shared helpers used by every page
   --------------------------------------------------------------------------
   Everything in this file is framework-free vanilla ES6 so it is easy to
   explain and extend during the SIH presentation.
   ========================================================================== */

const Utils = {
  /* ---------- Small DOM helpers ---------- */
  qs: (sel, root = document) => root.querySelector(sel),
  qsa: (sel, root = document) => Array.from(root.querySelectorAll(sel)),

  /* Escape user input before injecting into HTML (prevents XSS) */
  esc(str) {
    const div = document.createElement("div");
    div.textContent = str == null ? "" : String(str);
    return div.innerHTML;
  },

  /* ---------- Toast notifications ---------- */
  toast(message, type = "success", title = "") {
    let stack = document.getElementById("toast-stack");
    if (!stack) {
      stack = document.createElement("div");
      stack.id = "toast-stack";
      stack.className = "toast-stack";
      stack.setAttribute("aria-live", "polite");
      document.body.appendChild(stack);
    }

    const icons = { success: "fa-circle-check", error: "fa-circle-xmark", warn: "fa-triangle-exclamation", info: "fa-circle-info" };
    const titles = { success: "Success", error: "Error", warn: "Heads up", info: "Info" };
    const icon = icons[type] || icons.info;

    const item = document.createElement("div");
    item.className = `toast-item ${type}`;
    item.innerHTML = `
      <div class="toast-ico"><i class="fa-solid ${icon}"></i></div>
      <div class="toast-body">
        <div class="toast-title">${Utils.esc(title || titles[type])}</div>
        <div class="toast-msg">${Utils.esc(message)}</div>
      </div>`;
    stack.appendChild(item);

    // Auto-dismiss after 3.8s with a slide-out animation
    setTimeout(() => {
      item.classList.add("out");
      item.addEventListener("animationend", () => item.remove());
    }, 3800);
  },

  /* ---------- Number / currency formatting ---------- */
  formatINR(n) {
    return "₹" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
  },
  formatNum(n) {
    return Number(n || 0).toLocaleString("en-IN");
  },

  /* ---------- Date helpers ---------- */
  todayISO() {
    const d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  },
  addDaysISO(baseISO, days) {
    const d = new Date(baseISO + "T00:00:00");
    d.setDate(d.getDate() + days);
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  },
  formatDate(iso) {
    if (!iso) return "—";
    const d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  },
  formatDateTime(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }) + ", " + d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  },
  timeAgo(iso) {
    const s = Math.floor((Date.now() - new Date(iso)) / 1000);
    if (s < 60) return "just now";
    if (s < 3600) return Math.floor(s / 60) + "m ago";
    if (s < 86400) return Math.floor(s / 3600) + "h ago";
    return Math.floor(s / 86400) + "d ago";
  },

  /* ---------- Random id / hash (demo only — real apps hash server-side) ---------- */
  genId(prefix = "SP") {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let s = "";
    for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return prefix + "-" + s;
  },
  hash(str) {
    // djb2 style hash — good enough to keep plain passwords out of storage in a demo
    let h = 5381;
    for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
    return "h" + (h >>> 0).toString(36);
  },

  /* ---------- URL helpers ---------- */
  getParam(name) {
    return new URLSearchParams(window.location.search).get(name);
  },

  /* ---------- Distance (haversine, km) ---------- */
  distanceKm(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  },

  /* ---------- Animated number counter (for stat cards) ---------- */
  countUp(el, end, opts = {}) {
    const { duration = 1200, suffix = "", decimals = 0, start = 0 } = opts;
    const t0 = performance.now();
    const ease = (t) => 1 - Math.pow(1 - t, 3); // ease-out cubic

    function frame(t) {
      const p = Math.min(1, (t - t0) / duration);
      const val = start + (end - start) * ease(p);
      el.textContent = val.toLocaleString("en-IN", { maximumFractionDigits: decimals, minimumFractionDigits: decimals }) + suffix;
      if (p < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  },

  /* ---------- Download a rendered canvas (QR images) ---------- */
  downloadCanvas(canvas, filename) {
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  },

  /* ---------- Debounce (search inputs) ---------- */
  debounce(fn, ms = 250) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  },

  /* ---------- Initials avatar color (stable per string) ---------- */
  avatarColor(str) {
    const colors = ["#0e9f8e", "#2f6fed", "#7c5cf0", "#d97c0b", "#c23f74", "#0ea5c9"];
    let h = 0;
    for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
    return colors[Math.abs(h) % colors.length];
  },

  initials(name) {
    return String(name || "U").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  },
};

window.Utils = Utils;
