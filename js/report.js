/* ==========================================================================
   report.js — Reports & Analytics
   ========================================================================== */

(function () {
  "use strict";
  window.PageScripts = window.PageScripts || {};

  const ReportsPage = {
    period: "today",
    from: Utils.todayISO(),
    to: Utils.todayISO(),
    charts: {},

    init() {
      if (!window.Chart) {
        Utils.toast("Chart.js failed to load — check your connection.", "error");
        return;
      }
      const inkSoft = getComputedStyle(document.documentElement).getPropertyValue("--ink-soft").trim();
      const border = getComputedStyle(document.documentElement).getPropertyValue("--border").trim();
      Chart.defaults.color = inkSoft;
      Chart.defaults.borderColor = border;
      Chart.defaults.font.family = "'Inter', sans-serif";

      this.bindPeriod();
      this.buildCharts();
      this.refresh();

      DB.startSimulation(5000);
      document.addEventListener("sp:updated", () => this.refresh(false));
    },

    /* ---------- period ---------- */
    bindPeriod() {
      document.querySelectorAll(".chip[data-period]").forEach((chip) =>
        chip.addEventListener("click", () => {
          this.period = chip.dataset.period;
          document.querySelectorAll(".chip[data-period]").forEach((c) => c.classList.toggle("active", c === chip));
          const custom = document.getElementById("customRange");
          custom.classList.toggle("d-none", this.period !== "custom");
          if (this.period === "custom") {
            document.getElementById("fromDate").value = this.from;
            document.getElementById("toDate").value = this.to;
          } else {
            this.applyPeriod();
          }
        })
      );
      document.getElementById("applyCustom").addEventListener("click", () => {
        const f = document.getElementById("fromDate").value;
        const t = document.getElementById("toDate").value;
        if (!f || !t || f > t) return Utils.toast("Choose a valid date range.", "error");
        this.from = f;
        this.to = t;
        this.refresh(true);
      });
      document.getElementById("exportBtn").addEventListener("click", () => this.exportCSV());
      document.getElementById("printBtn").addEventListener("click", () => window.print());
    },

    applyPeriod() {
      const today = Utils.todayISO();
      if (this.period === "today") { this.from = today; this.to = today; }
      if (this.period === "week") { this.from = Utils.addDaysISO(today, -6); this.to = today; }
      if (this.period === "month") { this.from = Utils.addDaysISO(today, -29); this.to = today; }
      this.refresh(true);
    },

    periodBookings() {
      return DB.getBookings().filter((b) => b.date >= this.from && b.date <= this.to && b.status !== "cancelled");
    },

    daysInRange() {
      const days = [];
      let d = this.from;
      let guard = 0;
      while (d <= this.to && guard++ < 120) {
        days.push(d);
        d = Utils.addDaysISO(d, 1);
      }
      return days;
    },

    /* ---------- charts ---------- */
    buildCharts() {
      const series = DB.revenueSeries(7);
      this.charts.trend = new Chart(document.getElementById("trendChart"), {
        type: "line",
        data: {
          labels: series.map((d) => Utils.formatDate(d.date).split(",")[0]),
          datasets: [{
            label: "Revenue (₹)",
            data: series.map((d) => d.revenue),
            borderColor: "#0e9f8e",
            backgroundColor: "rgba(14,159,142,0.12)",
            fill: true, tension: 0.4, pointRadius: 4, pointBackgroundColor: "#0e9f8e", borderWidth: 2.5,
          }],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { y: { beginAtZero: true, ticks: { callback: (v) => "₹" + v } } },
        },
      });

      this.charts.peak = new Chart(document.getElementById("peakChart"), {
        type: "bar",
        data: {
          labels: Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0")),
          datasets: [{ label: "Bookings", data: DB.bookingsByHour(), backgroundColor: "rgba(245,165,36,0.8)", borderRadius: 5, maxBarThickness: 14 }],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
        },
      });

      this.charts.topLots = new Chart(document.getElementById("topLotsChart"), {
        type: "bar",
        data: {
          labels: DB.bookingsByLot(8).map((x) => x.lotName),
          datasets: [{ label: "Bookings", data: DB.bookingsByLot(8).map((x) => x.count), backgroundColor: "rgba(47,111,237,0.75)", borderRadius: 6, maxBarThickness: 20 }],
        },
        options: {
          indexAxis: "y",
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { x: { beginAtZero: true, ticks: { precision: 0 } } },
        },
      });

      const g = DB.getGlobalStats();
      this.charts.mix = new Chart(document.getElementById("mixChart"), {
        type: "doughnut",
        data: {
          labels: ["Available", "Reserved", "Occupied"],
          datasets: [{ data: [g.available, g.reserved, g.occupied], backgroundColor: ["#2fa36b", "#f5a524", "#e5484d"], borderWidth: 0, hoverOffset: 8 }],
        },
        options: {
          responsive: true, maintainAspectRatio: false, cutout: "62%",
          plugins: { legend: { position: "bottom", labels: { usePointStyle: true, padding: 14 } } },
        },
      });
    },

    /* ---------- refresh ---------- */
    refresh(animate) {
      const bookings = this.periodBookings();
      const revenue = bookings.filter((b) => b.status === "completed" || b.status === "active").reduce((s, b) => s + b.amount, 0);
      const avg = bookings.length ? revenue / Math.max(1, bookings.length) : 0;
      const g = DB.getGlobalStats();
      const occPct = g.slots ? Math.round((g.occupied / g.slots) * 100) : 0;

      const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
      set("kpiRevenue", Utils.formatINR(revenue));
      set("kpiBookings", bookings.length);
      set("kpiAvg", Utils.formatINR(avg));
      set("kpiOccupancy", occPct + "%");
      set("periodLabel", `${Utils.formatDate(this.from)} – ${Utils.formatDate(this.to)} · ${bookings.length} bookings`);
      set("tableCount", `${bookings.length} bookings`);
      set("tableSub", `All bookings from ${Utils.formatDate(this.from)} to ${Utils.formatDate(this.to)}`);

      /* revenue trend per day in range */
      const days = this.daysInRange();
      const series = days.map((d) => ({ d, revenue: DB.revenueOn(d) }));
      this.charts.trend.data.labels = series.map((x) => Utils.formatDate(x.d).split(",")[0]);
      this.charts.trend.data.datasets[0].data = series.map((x) => x.revenue);
      this.charts.trend.update();

      /* peak hours within the period */
      const hours = new Array(24).fill(0);
      bookings.forEach((b) => {
        const h = parseInt(b.startTime, 10);
        if (h >= 0 && h < 24) hours[h]++;
      });
      this.charts.peak.data.datasets[0].data = hours;
      this.charts.peak.update();

      /* most used lots (period) */
      const map = {};
      bookings.forEach((b) => { map[b.lotName] = (map[b.lotName] || 0) + 1; });
      const top = Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 8);
      this.charts.topLots.data.labels = top.map(([name]) => name);
      this.charts.topLots.data.datasets[0].data = top.map(([, n]) => n);
      this.charts.topLots.update();

      /* occupancy mix (live) */
      const gg = DB.getGlobalStats();
      this.charts.mix.data.datasets[0].data = [gg.available, gg.reserved, gg.occupied];
      this.charts.mix.update();

      /* table */
      const tbody = document.getElementById("bookingsTable");
      const STATUS = {
        upcoming: ["sb-info", "Upcoming"], active: ["sb-warn", "Active"],
        completed: ["sb-success", "Completed"], cancelled: ["sb-muted", "Cancelled"],
      };
      tbody.innerHTML = bookings.length
        ? bookings.slice().sort((a, b) => (b.date + b.startTime).localeCompare(a.date + a.startTime)).map((b) => {
            const [cls, label] = STATUS[b.status] || STATUS.cancelled;
            return `<tr>
              <td class="fw-bold">${b.bookingId}</td>
              <td>${Utils.esc(b.userName)}</td>
              <td class="text-truncate" style="max-width:170px">${Utils.esc(b.lotName)}</td>
              <td>${b.slotId ? b.slotId.split("-").pop() : "—"}</td>
              <td>${Utils.esc(b.vehicleNumber)}</td>
              <td>${Utils.formatDate(b.date)} · ${b.startTime}</td>
              <td class="fw-semibold">${Utils.formatINR(b.amount)}</td>
              <td><span class="status-badge ${cls}">${label}</span></td>
            </tr>`;
          }).join("")
        : `<tr><td colspan="8" class="text-center text-muted-sp py-4">No bookings in this period</td></tr>`;
    },

    /* ---------- CSV export ---------- */
    exportCSV() {
      const bookings = this.periodBookings();
      if (!bookings.length) return Utils.toast("Nothing to export for this period.", "warn");
      const head = "Booking ID,Citizen,Lot,Bay,Vehicle,Date,Time,Hours,Amount,Status";
      const rows = bookings.map((b) =>
        [b.bookingId, `"${b.userName}"`, `"${b.lotName}"`, b.slotId ? b.slotId.split("-").pop() : "", `"${b.vehicleNumber}"`, b.date, b.startTime, b.durationHours, b.amount.toFixed(2), b.status].join(",")
      );
      const blob = new Blob([head + "\n" + rows.join("\n")], { type: "text/csv;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `SmartPark360-report-${this.from}-to-${this.to}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);
      Utils.toast(`Exported ${bookings.length} bookings to CSV.`, "success", "Download started");
    },
  };

  window.PageScripts["reports"] = ReportsPage;
})();
