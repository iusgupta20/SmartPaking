/* ==========================================================================
   admin.js — Admin Command Center + Parking Management
   ========================================================================== */

(function () {
  "use strict";
  window.PageScripts = window.PageScripts || {};

  const STATUS_BADGE = {
    upcoming: ["sb-info", "fa-clock", "Upcoming"],
    active: ["sb-warn", "fa-car-side", "Active"],
    completed: ["sb-success", "fa-circle-check", "Completed"],
    cancelled: ["sb-muted", "fa-ban", "Cancelled"],
  };

  /* Theme-aware Chart.js defaults */
  function chartSetup() {
    if (!window.Chart) return;
    const inkSoft = getComputedStyle(document.documentElement).getPropertyValue("--ink-soft").trim();
    const border = getComputedStyle(document.documentElement).getPropertyValue("--border").trim();
    Chart.defaults.color = inkSoft;
    Chart.defaults.borderColor = border;
    Chart.defaults.font.family = "'Inter', sans-serif";
    Chart.defaults.font.size = 12;
  }

  /* ===================== ADMIN DASHBOARD ===================== */
  const AdminDashboardPage = {
    charts: {},

    init() {
      if (!window.Chart) {
        Utils.toast("Chart.js failed to load — check your connection.", "error");
        return;
      }
      chartSetup();
      this.buildCharts();
      this.refresh();

      document.getElementById("refreshBtn").addEventListener("click", () => {
        this.refresh(true);
        Utils.toast("Dashboard refreshed.", "info", "Live");
      });
      DB.startSimulation(5000);
      document.addEventListener("sp:updated", () => this.refresh());
    },

    buildCharts() {
      /* revenue line — last 7 days */
      const series = DB.revenueSeries(7);
      this.charts.revenue = new Chart(document.getElementById("revenueChart"), {
        type: "line",
        data: {
          labels: series.map((d) => Utils.formatDate(d.date).split(",")[0]),
          datasets: [{
            label: "Revenue (₹)",
            data: series.map((d) => d.revenue),
            borderColor: "#0e9f8e",
            backgroundColor: "rgba(14,159,142,0.12)",
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointBackgroundColor: "#0e9f8e",
            borderWidth: 2.5,
          }],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { y: { beginAtZero: true, ticks: { callback: (v) => "₹" + v } } },
        },
      });

      /* occupancy doughnut */
      const g = DB.getGlobalStats();
      this.charts.occupancy = new Chart(document.getElementById("occupancyChart"), {
        type: "doughnut",
        data: {
          labels: ["Available", "Reserved", "Occupied"],
          datasets: [{ data: [g.available, g.reserved, g.occupied], backgroundColor: ["#2fa36b", "#f5a524", "#e5484d"], borderWidth: 0, hoverOffset: 8 }],
        },
        options: {
          responsive: true, maintainAspectRatio: false, cutout: "64%",
          plugins: { legend: { position: "bottom", labels: { usePointStyle: true, padding: 16 } } },
        },
      });

      /* bookings bar — last 14 days */
      const b14 = DB.revenueSeries(14);
      this.charts.bookings = new Chart(document.getElementById("bookingsChart"), {
        type: "bar",
        data: {
          labels: b14.map((d) => Utils.formatDate(d.date).split(",")[0]),
          datasets: [{
            label: "Bookings",
            data: b14.map((d) => d.bookings),
            backgroundColor: "rgba(47,111,237,0.75)",
            borderRadius: 6,
            maxBarThickness: 22,
          }],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
        },
      });
    },

    refresh(animate) {
      const g = DB.getGlobalStats();
      const today = Utils.todayISO();
      const todays = DB.bookingsOn(today);
      const revenue = DB.revenueOn(today);
      const occPct = g.slots ? Math.round((g.occupied / g.slots) * 100) : 0;
      const availPct = g.slots ? Math.round((g.available / g.slots) * 100) : 0;

      const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
      if (animate) {
        Utils.countUp(document.getElementById("kpiLots"), g.lots);
        Utils.countUp(document.getElementById("kpiSlots"), g.slots);
      } else {
        set("kpiLots", g.lots);
        set("kpiSlots", g.slots);
      }
      set("kpiOccupied", g.occupied);
      set("kpiAvailable", g.available);
      set("kpiOccupiedPct", occPct + "% occupancy");
      set("kpiAvailablePct", availPct + "% free");
      set("kpiTodayBookings", todays.length);
      set("kpiTodayRevenue", Utils.formatINR(revenue));

      /* charts */
      if (this.charts.revenue) {
        const s = DB.revenueSeries(7);
        this.charts.revenue.data.labels = s.map((d) => Utils.formatDate(d.date).split(",")[0]);
        this.charts.revenue.data.datasets[0].data = s.map((d) => d.revenue);
        this.charts.revenue.update();
      }
      if (this.charts.occupancy) {
        const gg = DB.getGlobalStats();
        this.charts.occupancy.data.datasets[0].data = [gg.available, gg.reserved, gg.occupied];
        this.charts.occupancy.update();
      }
      if (this.charts.bookings) {
        const b14 = DB.revenueSeries(14);
        this.charts.bookings.data.labels = b14.map((d) => Utils.formatDate(d.date).split(",")[0]);
        this.charts.bookings.data.datasets[0].data = b14.map((d) => d.bookings);
        this.charts.bookings.update();
      }

      /* recent bookings table */
      const tbody = document.getElementById("recentTable");
      if (tbody) {
        const recent = DB.getBookings().slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 8);
        tbody.innerHTML = recent.length
          ? recent.map((b) => {
              const [cls, icon, label] = STATUS_BADGE[b.status] || STATUS_BADGE.cancelled;
              return `<tr>
                <td class="fw-bold">${b.bookingId}</td>
                <td>${Utils.esc(b.userName)}</td>
                <td class="text-truncate" style="max-width:150px">${Utils.esc(b.lotName)}</td>
                <td class="fw-semibold">${Utils.formatINR(b.amount)}</td>
                <td><span class="status-badge ${cls}"><i class="fa-solid ${icon}"></i>${label}</span></td>
              </tr>`;
            }).join("")
          : `<tr><td colspan="5" class="text-center text-muted-sp py-4">No bookings yet</td></tr>`;
      }
    },
  };

  /* ===================== PARKING MANAGEMENT ===================== */
  const ParkingManagementPage = {
    editId: null, // lot being edited (null = adding)
    deleteId: null,
    slotsLotId: null, // lot whose bays are open in the modal
    slotTarget: null, // slot being status-changed

    init() {
      this.render();
      this.bindActions();

      DB.startSimulation(5000);
      document.addEventListener("sp:updated", () => {
        this.updateLive();
        if (this.slotsLotId) this.renderSlotsModal();
      });
    },

    /* ---------- table ---------- */
    rowHtml(lot) {
      const stats = DB.getLotStats(lot.id);
      const hours = lot.open === "00:00" ? "24×7" : `${lot.open}–${lot.close}`;
      return `
        <tr data-lot="${lot.id}">
          <td>
            <div class="d-flex align-items-center gap-2">
              <div class="lot-thumb ${lot.theme || "ph-1"}"><i class="fa-solid fa-square-parking"></i></div>
              <div><div class="fw-bold">${Utils.esc(lot.name)}</div><small class="text-muted-sp">${Utils.esc(lot.type)} · ${Utils.esc(lot.city)}</small></div>
            </div>
          </td>
          <td class="text-truncate" style="max-width:220px">${Utils.esc(lot.address)}</td>
          <td class="fw-semibold">${stats.total}</td>
          <td><span class="row-avail fw-bold" style="color:${stats.available ? "var(--green)" : "var(--red)"}">${stats.available}</span> <span class="text-muted-sp small">free</span></td>
          <td class="fw-semibold">₹${lot.price}</td>
          <td><i class="fa-solid fa-star" style="color:var(--amber)"></i> ${lot.rating.toFixed(1)}</td>
          <td class="small">${hours}</td>
          <td style="text-align:right;white-space:nowrap">
            <button class="btn btn-soft btn-sm" data-action="manage" data-id="${lot.id}"><i class="fa-solid fa-table-cells me-1"></i>Bays</button>
            <button class="btn btn-ghost btn-sm" data-action="edit" data-id="${lot.id}"><i class="fa-solid fa-pen me-1"></i>Edit</button>
            <button class="btn btn-danger-soft btn-sm" data-action="del" data-id="${lot.id}"><i class="fa-solid fa-trash"></i></button>
          </td>
        </tr>`;
    },

    render() {
      const tbody = document.getElementById("lotsTable");
      if (!tbody) return;
      const lots = DB.getLots();
      tbody.innerHTML = lots.map((l) => this.rowHtml(l)).join("");
      const count = document.getElementById("lotCount");
      if (count) count.textContent = `${lots.length} zones`;
      this.updateLive();
    },

    updateLive() {
      const g = DB.getGlobalStats();
      const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
      set("kpiLots", g.lots);
      set("kpiSlots", g.slots);
      set("kpiOccupied", g.occupied);
      set("kpiAvailable", g.available);

      document.querySelectorAll("tr[data-lot]").forEach((tr) => {
        const stats = DB.getLotStats(tr.dataset.lot);
        const cell = tr.querySelector(".row-avail");
        if (cell) {
          cell.textContent = stats.available;
          cell.style.color = stats.available ? "var(--green)" : "var(--red)";
        }
      });
    },

    /* ---------- actions ---------- */
    bindActions() {
      document.getElementById("addLotBtn").addEventListener("click", () => this.openLotModal());
      document.getElementById("lotForm").addEventListener("submit", (e) => this.saveLot(e));
      document.getElementById("deleteConfirm").addEventListener("click", () => this.doDelete());

      /* delegated table actions */
      document.getElementById("lotsTable").addEventListener("click", (e) => {
        const btn = e.target.closest("[data-action]");
        if (!btn) return;
        const id = btn.dataset.id;
        if (btn.dataset.action === "manage") this.openSlotsModal(id);
        if (btn.dataset.action === "edit") this.openLotModal(id);
        if (btn.dataset.action === "del") {
          this.deleteId = id;
          const lot = DB.getLot(id);
          document.getElementById("deleteLotName").textContent = lot ? lot.name : "This lot";
          bootstrap.Modal.getOrCreateInstance(document.getElementById("deleteModal")).show();
        }
      });

      /* slot grid interactions inside the manage modal */
      document.getElementById("slotsGrid").addEventListener("click", (e) => {
        const cell = e.target.closest(".slot");
        if (!cell) return;
        this.slotTarget = cell.dataset.slot;
        const slot = DB.getSlot(cell.dataset.slot);
        const chip = document.getElementById("statusSlotChip");
        if (slot && chip) {
          chip.innerHTML = `<i class="fa-solid fa-car s-ico"></i>${slot.label}`;
          chip.className = "slot " + slot.status;
          chip.style.cssText = "cursor:default;min-width:76px;display:inline-block";
        }
        bootstrap.Modal.getOrCreateInstance(document.getElementById("statusModal")).show();
      });

      /* status choices */
      document.querySelectorAll("#statusModal [data-status]").forEach((btn) =>
        btn.addEventListener("click", () => {
          DB.setSlotStatus(this.slotTarget, btn.dataset.status);
          Utils.toast(`Bay updated to "${btn.dataset.status}".`, "success", "Slot updated");
          bootstrap.Modal.getInstance(document.getElementById("statusModal")).hide();
          this.renderSlotsModal();
        })
      );

      /* add bays */
      document.getElementById("addSlotsBtn").addEventListener("click", () => {
        const lot = DB.getLot(this.slotsLotId);
        const n = Math.max(1, Math.min(20, Number(document.getElementById("addSlotsCount").value || 4)));
        const slots = DB.getSlots();
        const cols = 4;
        let count = slots.filter((s) => s.lotId === this.slotsLotId).length;
        for (let i = 0; i < n; i++) {
          const row = Math.floor(count / cols);
          const col = (count % cols) + 1;
          const letter = String.fromCharCode(65 + row);
          slots.push({ id: this.slotsLotId + "-" + letter + col, lotId: this.slotsLotId, label: letter + col, status: "available", vehicle: null, updatedAt: new Date().toISOString() });
          count++;
        }
        DB.saveSlots(slots);
        DB.updateLot(this.slotsLotId, { capacity: count });
        Utils.toast(`${n} bay(s) added to ${lot.name}.`, "success", "Capacity extended");
        this.renderSlotsModal();
        this.render();
      });
    },

    /* ---------- add / edit lot ---------- */
    openLotModal(id) {
      const lot = id ? DB.getLot(id) : null;
      this.editId = id || null;
      const form = document.getElementById("lotForm");
      const title = document.getElementById("lotModalTitle");
      title.innerHTML = lot
        ? '<i class="fa-solid fa-pen me-2 text-accent"></i>Edit parking lot'
        : '<i class="fa-solid fa-plus me-2 text-accent"></i>Add parking lot';

      form.reset();
      if (lot) {
        ["name", "type", "address", "city", "lat", "lng", "capacity", "price", "rating", "open", "close", "theme", "description"].forEach((k) => {
          if (form.elements[k] && lot[k] != null) form.elements[k].value = lot[k];
        });
      } else {
        form.elements["capacity"].value = 40;
        form.elements["price"].value = 30;
        form.elements["rating"].value = 4.2;
        form.elements["open"].value = "06:00";
        form.elements["close"].value = "23:00";
      }
      bootstrap.Modal.getOrCreateInstance(document.getElementById("lotModal")).show();
    },

    saveLot(e) {
      e.preventDefault();
      const form = e.target;
      const data = {
        name: form.elements["name"].value.trim(),
        type: form.elements["type"].value,
        address: form.elements["address"].value.trim(),
        city: form.elements["city"].value.trim(),
        lat: parseFloat(form.elements["lat"].value) || 28.63,
        lng: parseFloat(form.elements["lng"].value) || 77.21,
        capacity: parseInt(form.elements["capacity"].value, 10),
        price: parseInt(form.elements["price"].value, 10),
        rating: parseFloat(form.elements["rating"].value) || 4.0,
        open: form.elements["open"].value || "06:00",
        close: form.elements["close"].value || "23:00",
        theme: form.elements["theme"].value,
        description: form.elements["description"].value.trim() || "Smart parking zone.",
        amenities: ["CCTV Surveillance", "Digital Payment"],
      };

      if (!data.name || !data.address || !data.city) return Utils.toast("Name, address and city are required.", "error");
      if (!data.capacity || data.capacity < 4) return Utils.toast("Capacity must be at least 4 bays.", "error");
      if (!data.price || data.price < 5) return Utils.toast("Price must be at least ₹5/hour.", "error");

      if (this.editId) {
        DB.updateLot(this.editId, data);
        Utils.toast(`"${data.name}" updated.`, "success", "Lot updated");
      } else {
        DB.addLot(data);
        Utils.toast(`"${data.name}" added with ${data.capacity} bays.`, "success", "Lot created");
      }
      bootstrap.Modal.getInstance(document.getElementById("lotModal")).hide();
      this.render();
    },

    doDelete() {
      const lot = DB.getLot(this.deleteId);
      DB.deleteLot(this.deleteId);
      this.deleteId = null;
      bootstrap.Modal.getInstance(document.getElementById("deleteModal")).hide();
      Utils.toast(lot ? `"${lot.name}" deleted.` : "Lot deleted.", "success", "Deleted");
      this.render();
    },

    /* ---------- manage bays ---------- */
    openSlotsModal(id) {
      this.slotsLotId = id;
      const lot = DB.getLot(id);
      document.getElementById("slotsModalTitle").innerHTML = `<i class="fa-solid fa-table-cells me-2 text-accent"></i>Manage bays — ${Utils.esc(lot.name)}`;
      this.renderSlotsModal();
      bootstrap.Modal.getOrCreateInstance(document.getElementById("slotsModal")).show();
    },

    renderSlotsModal() {
      const grid = document.getElementById("slotsGrid");
      const statsBox = document.getElementById("slotsModalStats");
      if (!grid || !this.slotsLotId) return;
      const slots = DB.getSlotsForLot(this.slotsLotId);
      const stats = DB.getLotStats(this.slotsLotId);
      const icons = { available: "fa-car", reserved: "fa-clock", occupied: "fa-car-side" };

      grid.innerHTML = slots
        .map((s) => `<div class="slot ${s.status}" data-slot="${s.id}"><span class="s-ico"><i class="fa-solid ${icons[s.status]}"></i></span>${s.label}</div>`)
        .join("");

      statsBox.innerHTML = `
        <span class="status-badge sb-success"><i class="fa-solid fa-circle-check"></i>${stats.available} free</span>
        <span class="status-badge sb-warn"><i class="fa-solid fa-clock"></i>${stats.reserved} reserved</span>
        <span class="status-badge sb-danger"><i class="fa-solid fa-car-side"></i>${stats.occupied} occupied</span>
        <span class="status-badge sb-info"><i class="fa-solid fa-layer-group"></i>${stats.total} total</span>`;
    },
  };

  window.PageScripts["admin-dashboard"] = AdminDashboardPage;
  window.PageScripts["parking-management"] = ParkingManagementPage;
})();
