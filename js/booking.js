/* ==========================================================================
   booking.js — Parking Details, Booking & My Bookings page logic
   ========================================================================== */

(function () {
  "use strict";
  window.PageScripts = window.PageScripts || {};

  const STATUS_BADGE = {
    upcoming: ["sb-info", "fa-clock", "Upcoming"],
    active: ["sb-warn", "fa-car-side", "Active · In parking"],
    completed: ["sb-success", "fa-circle-check", "Completed"],
    cancelled: ["sb-muted", "fa-ban", "Cancelled"],
  };
  const statusBadge = (status) => {
    const [cls, icon, label] = STATUS_BADGE[status] || STATUS_BADGE.cancelled;
    return `<span class="status-badge ${cls}"><i class="fa-solid ${icon}"></i>${label}</span>`;
  };

  /* ===================== PARKING DETAILS ===================== */
  const DetailsPage = {
    init() {
      const lotId = Utils.getParam("id");
      const lot = DB.getLot(lotId);
      const empty = document.getElementById("noSlots");
      const hero = document.getElementById("detailHero");
      if (!lot) {
        if (empty) empty.classList.remove("d-none");
        if (hero) hero.style.display = "none";
        return;
      }

      this.lot = lot;
      this.renderHero();
      this.renderInfo();
      this.renderAmenities();
      this.renderSlots();
      this.bindSlots();

      DB.startSimulation(5000);
      document.addEventListener("sp:updated", () => {
        this.updateInfo();
        this.updateSlotCells();
      });
    },

    renderHero() {
      const hero = document.getElementById("detailHero");
      const stats = DB.getLotStats(this.lot.id);
      const hours = this.lot.open === "00:00" ? "24×7" : `${this.lot.open} – ${this.lot.close}`;
      hero.style.display = "block";
      hero.className = `detail-hero ${this.lot.theme || "ph-1"}`;
      hero.innerHTML = `
        <div class="inner">
          <div class="d-flex align-items-center gap-3 flex-wrap">
            <span class="status-badge sb-success" style="background:rgba(255,255,255,.2);color:#fff;border:1px solid rgba(255,255,255,.3)">
              <i class="fa-solid fa-circle-check"></i>${stats.available} bays free now
            </span>
            <span class="status-badge" style="background:rgba(255,255,255,.2);color:#fff;border:1px solid rgba(255,255,255,.3)">
              <i class="fa-solid fa-star"></i>${this.lot.rating.toFixed(1)} rating
            </span>
          </div>
          <h1 class="mt-3">${Utils.esc(this.lot.name)}</h1>
          <div class="sub">
            <span><i class="fa-solid fa-location-dot"></i>${Utils.esc(this.lot.address)}, ${Utils.esc(this.lot.city)}</span>
            <span><i class="fa-solid fa-clock"></i>${hours}</span>
            <span><i class="fa-solid fa-tag"></i>${Utils.esc(this.lot.type)} Parking</span>
          </div>
          <div class="mt-3 d-flex gap-2 flex-wrap">
            <a class="btn btn-white btn-sm" href="https://www.google.com/maps?q=${this.lot.lat},${this.lot.lng}" target="_blank" rel="noopener">
              <i class="fa-solid fa-diamond-turn-right me-1"></i>Get Directions
            </a>
            <a class="btn btn-sm" style="background:rgba(255,255,255,.18);color:#fff;border:1px solid rgba(255,255,255,.35)" href="#slotGrid">
              <i class="fa-solid fa-angles-down me-1"></i>View Slots
            </a>
          </div>
        </div>`;
    },

    renderInfo() {
      const stats = DB.getLotStats(this.lot.id);
      const hours = this.lot.open === "00:00" ? "24×7" : `${this.lot.open} – ${this.lot.close}`;
      const row = document.getElementById("infoCards");
      if (!row) return;
      const card = (icon, num, label, stat) => `
        <div class="col-6 col-md-3 col-lg-2"><div class="info-card">
          <div class="info-icon"><i class="fa-solid ${icon}"></i></div>
          <div class="info-num ${stat ? "live" : ""}" ${stat ? `data-stat="${stat}"` : ""}>${num}</div>
          <div class="info-label">${label}</div>
        </div></div>`;
      row.innerHTML =
        card("fa-layer-group", stats.total, "Capacity") +
        card("fa-circle-check", stats.available, "Available now", "available") +
        card("fa-car-side", stats.occupied, "Occupied", "occupied") +
        card("fa-clock", hours, "Working hours") +
        card("fa-indian-rupee-sign", "₹" + this.lot.price, "Per hour") +
        card("fa-star", this.lot.rating.toFixed(1), "Rating");
    },

    renderAmenities() {
      const row = document.getElementById("amenitiesRow");
      const chips = (this.lot.amenities || []).map((a) => `<span class="amenity-chip"><i class="fa-solid fa-circle-check" style="color:var(--green)"></i>${Utils.esc(a)}</span>`).join("");
      row.innerHTML = `<div class="d-flex flex-wrap gap-2 align-items-center"><span class="fw-bold small text-muted-sp me-1" style="text-transform:uppercase;letter-spacing:.06em">Amenities</span>${chips}</div>`;
    },

    slotCellHtml(slot) {
      const icons = { available: "fa-car", reserved: "fa-clock", occupied: "fa-car-side" };
      return `<div class="slot ${slot.status}" data-slot="${slot.id}" data-label="${slot.label}" ${slot.status === "available" ? 'role="button" tabindex="0"' : ""}>
        <span class="s-ico"><i class="fa-solid ${icons[slot.status]}"></i></span>${slot.label}
      </div>`;
    },

    renderSlots() {
      const grid = document.getElementById("slotGrid");
      const empty = document.getElementById("noSlots");
      const slots = DB.getSlotsForLot(this.lot.id);
      if (!grid) return;
      grid.innerHTML = slots.map((s) => this.slotCellHtml(s)).join("");
      if (empty) empty.classList.add("d-none");
    },

    updateSlotCells() {
      const grid = document.getElementById("slotGrid");
      if (!grid) return;
      grid.querySelectorAll(".slot").forEach((el) => {
        const slot = DB.getSlot(el.dataset.slot);
        if (!slot) return;
        el.className = `slot ${slot.status}`;
        el.querySelector(".s-ico").innerHTML = `<i class="fa-solid ${{ available: "fa-car", reserved: "fa-clock", occupied: "fa-car-side" }[slot.status]}"></i>`;
      });
    },

    updateInfo() {
      const stats = DB.getLotStats(this.lot.id);
      document.querySelectorAll(".info-num[data-stat='available']").forEach((el) => (el.textContent = stats.available));
      document.querySelectorAll(".info-num[data-stat='occupied']").forEach((el) => (el.textContent = stats.occupied));
    },

    bindSlots() {
      const grid = document.getElementById("slotGrid");
      const modal = document.getElementById("slotModal");
      if (!grid || !modal || !window.bootstrap) return;

      const openModal = (slotId) => {
        const slot = DB.getSlot(slotId);
        if (!slot || slot.status !== "available") return;
        const chip = document.getElementById("slotModalChip");
        const lot = document.getElementById("slotModalLot");
        const info = document.getElementById("slotModalInfo");
        if (chip) chip.innerHTML = `<i class="fa-solid fa-car s-ico"></i>${slot.label}`;
        if (lot) lot.textContent = this.lot.name;
        if (info) info.textContent = `Slot ${slot.label} · ₹${this.lot.price}/hr`;
        const go = document.getElementById("slotModalGo");
        go.dataset.href = `booking.html?lotId=${this.lot.id}&slot=${slot.id}`;
        bootstrap.Modal.getOrCreateInstance(modal).show();
      };

      grid.addEventListener("click", (e) => {
        const cell = e.target.closest(".slot");
        if (cell) openModal(cell.dataset.slot);
      });
      document.getElementById("slotModalGo").addEventListener("click", () => {
        const href = document.getElementById("slotModalGo").dataset.href;
        if (href) window.location.href = href;
      });
    },
  };

  /* ===================== BOOKING ===================== */
  const BookingPage = {
    init() {
      const lotId = Utils.getParam("lotId");
      const lot = DB.getLot(lotId);
      if (!lot) {
        Utils.toast("No parking lot selected — redirecting to dashboard.", "error");
        setTimeout(() => (window.location.href = "dashboard.html"), 900);
        return;
      }
      this.lot = lot;
      this.prefilledSlot = Utils.getParam("slot");

      const form = document.getElementById("bookingForm");
      if (!form) return;

      /* defaults: today, next full hour, 2 hours */
      form.elements["date"].min = Utils.todayISO();
      form.elements["date"].value = Utils.todayISO();
      const d = new Date();
      form.elements["time"].value = String(d.getHours() + 1).padStart(2, "0") + ":00";

      document.getElementById("summaryLotName").textContent = lot.name;
      document.getElementById("sumLot").textContent = lot.name;
      document.getElementById("sumRate").textContent = "₹" + lot.price + " / hr";

      this.fillSlots();
      form.querySelectorAll("input, select").forEach((el) => el.addEventListener("change", () => this.updateSummary()));
      document.getElementById("vehicleTypes").addEventListener("change", () => this.updateSummary());
      this.updateSummary();

      /* live slot availability */
      DB.startSimulation(5000);
      document.addEventListener("sp:updated", () => this.fillSlots());

      document.getElementById("confirmBtn").addEventListener("click", () => this.confirm());

      /* success overlay actions */
      document.getElementById("downloadQr").addEventListener("click", () => {
        const canvas = document.querySelector("#qrBox canvas");
        if (canvas) Utils.downloadCanvas(canvas, `SmartPark360-${this.lastBookingId}.png`);
      });
      document.getElementById("sbClose").addEventListener("click", () => document.getElementById("successOverlay").classList.remove("show"));
    },

    fillSlots() {
      const select = document.getElementById("slotSelect");
      const available = DB.getSlotsForLot(this.lot.id).filter((s) => s.status === "available");
      const current = select.value;
      select.innerHTML = available.length
        ? available.map((s) => `<option value="${s.id}">Bay ${s.label} — available</option>`).join("")
        : `<option value="">No bays available right now</option>`;
      /* keep previous choice if still free, else the preselect or first */
      if (current && available.some((s) => s.id === current)) select.value = current;
      else if (this.prefilledSlot && available.some((s) => s.id === this.prefilledSlot)) select.value = this.prefilledSlot;
      this.updateSummary();
    },

    updateSummary() {
      const form = document.getElementById("bookingForm");
      const slotId = form.elements["slotId"].value;
      const slot = DB.getSlot(slotId);
      const type = form.elements["vehicleType"] ? document.querySelector('input[name="vehicleType"]:checked').value : "4-wheeler";
      const factor = DB.TYPE_FACTOR[type] || 1;
      const duration = Number(form.elements["duration"].value || 1);
      const total = Math.round(this.lot.price * factor * duration * 100) / 100;

      document.getElementById("sumSlot").textContent = slot ? "Bay " + slot.label : "—";
      document.getElementById("sumVehicle").textContent = type;
      document.getElementById("sumWhen").textContent = form.elements["date"].value ? Utils.formatDate(form.elements["date"].value) + " · " + form.elements["time"].value : "—";
      document.getElementById("sumDuration").textContent = duration + " hr" + (duration > 1 ? "s" : "");
      document.getElementById("sumFactor").textContent = "×" + factor;
      document.getElementById("sumTotal").textContent = Utils.formatINR(total);
    },

    confirm() {
      const form = document.getElementById("bookingForm");
      const user = DB.getCurrentUser();
      const slotId = form.elements["slotId"].value;
      const vehicle = form.elements["vehicleNumber"].value.trim().toUpperCase();
      const type = document.querySelector('input[name="vehicleType"]:checked').value;
      const date = form.elements["date"].value;
      const time = form.elements["time"].value;
      const duration = Number(form.elements["duration"].value);

      /* --- validation --- */
      if (!slotId) return Utils.toast("Please pick an available bay from the list.", "error");
      if (vehicle.length < 6) return Utils.toast("Please enter a valid vehicle number (e.g. DL 01 CA 4821).", "error");
      if (!date || !time) return Utils.toast("Please choose a date and entry time.", "error");
      const start = new Date(date + "T" + time + ":00");
      if (start.getTime() < Date.now() - 60000) return Utils.toast("Entry time must be in the future.", "error");

      const res = DB.createBooking({ userId: user.id, lotId: this.lot.id, slotId, vehicleNumber: vehicle, vehicleType: type, date, startTime: time, durationHours: duration });
      if (!res.ok) {
        Utils.toast(res.error, "error", "Booking failed");
        this.fillSlots();
        return;
      }

      this.lastBookingId = res.booking.bookingId;
      this.showSuccess(res.booking);
    },

    showSuccess(booking) {
      const overlay = document.getElementById("successOverlay");
      document.getElementById("sbBookingId").textContent = booking.bookingId;

      const qrBox = document.getElementById("qrBox");
      qrBox.innerHTML = "";
      const qrText = JSON.stringify({
        app: "SmartPark360",
        bookingId: booking.bookingId,
        lot: booking.lotName,
        slot: booking.slotId.split("-").pop(),
        vehicle: booking.vehicleNumber,
        date: booking.date,
        time: booking.startTime,
        hours: booking.durationHours,
        amount: booking.amount,
      });
      new QRCode(qrBox, { text: qrText, width: 180, height: 180, correctLevel: QRCode.CorrectLevel.M });

      document.getElementById("sbSummary").innerHTML = `
        <div class="summary-row"><span class="k">Parking lot</span><span class="v">${Utils.esc(booking.lotName)}</span></div>
        <div class="summary-row"><span class="k">Bay</span><span class="v">${booking.slotId.split("-").pop()}</span></div>
        <div class="summary-row"><span class="k">Vehicle</span><span class="v">${Utils.esc(booking.vehicleNumber)} · ${booking.vehicleType}</span></div>
        <div class="summary-row"><span class="k">Entry</span><span class="v">${Utils.formatDate(booking.date)} · ${booking.startTime}</span></div>
        <div class="summary-row"><span class="k">Duration</span><span class="v">${booking.durationHours} hour(s)</span></div>
        <div class="summary-total"><span class="k">Total paid</span><span class="v">${Utils.formatINR(booking.amount)}</span></div>`;

      overlay.classList.add("show");
      Utils.toast(`Booking ${booking.bookingId} confirmed at ${booking.lotName}.`, "success", "Reserved!");
    },
  };

  /* ===================== MY BOOKINGS ===================== */
  const MyBookingsPage = {
    tab: "upcoming",
    pendingCancelId: null,

    init() {
      const user = DB.getCurrentUser();
      if (!user) return;

      document.getElementById("tabUpcoming").addEventListener("click", () => this.switchTab("upcoming"));
      document.getElementById("tabPast").addEventListener("click", () => this.switchTab("past"));
      document.getElementById("cancelConfirm").addEventListener("click", () => this.doCancel());

      this.render();
      DB.startSimulation(5000);
      document.addEventListener("sp:updated", () => this.render());
    },

    switchTab(tab) {
      this.tab = tab;
      document.getElementById("tabUpcoming").classList.toggle("active", tab === "upcoming");
      document.getElementById("tabPast").classList.toggle("active", tab === "past");
      this.render();
    },

    bookingCardHtml(b) {
      const slotLabel = b.slotId ? b.slotId.split("-").pop() : "—";
      const cancelled = b.status === "cancelled";
      return `
        <article class="parking-card" data-bid="${b.id}">
          <div class="parking-body">
            <div class="d-flex justify-content-between align-items-start gap-2 mb-1">
              <h3 class="parking-name mb-0">${Utils.esc(b.lotName)}</h3>
              ${statusBadge(b.status)}
            </div>
            <div class="parking-addr mb-3"><i class="fa-solid fa-location-dot"></i>Bay ${slotLabel} · ${Utils.esc(b.vehicleNumber)}</div>
            <div class="d-flex gap-3 mb-3">
              <div class="qr-box" style="padding:8px;border-radius:12px" data-qr="${b.bookingId}"></div>
              <div class="flex-grow-1">
                <div class="summary-row"><span class="k">Date</span><span class="v">${Utils.formatDate(b.date)}</span></div>
                <div class="summary-row"><span class="k">Entry</span><span class="v">${b.startTime}</span></div>
                <div class="summary-row"><span class="k">Duration</span><span class="v">${b.durationHours} hr</span></div>
                <div class="summary-row" style="border-bottom:none"><span class="k">Amount</span><span class="v">${Utils.formatINR(b.amount)}</span></div>
              </div>
            </div>
            <div class="d-flex gap-2 flex-wrap">
              ${b.status === "upcoming" ? `<button class="btn btn-danger-soft btn-sm" data-action="cancel" data-bid="${b.id}" data-ref="${b.bookingId}"><i class="fa-solid fa-ban me-1"></i>Cancel</button>` : ""}
              ${!cancelled ? `<button class="btn btn-ghost btn-sm" data-action="dlqr" data-bid="${b.id}"><i class="fa-solid fa-qrcode me-1"></i>Download QR</button>` : ""}
              <a class="btn btn-soft btn-sm" href="parking-details.html?id=${b.lotId}"><i class="fa-solid fa-eye me-1"></i>View lot</a>
            </div>
          </div>
        </article>`;
    },

    render() {
      const user = DB.getCurrentUser();
      const grid = document.getElementById("bookingsGrid");
      const empty = document.getElementById("emptyState");
      const emptyTitle = document.getElementById("emptyTitle");
      const emptySub = document.getElementById("emptySub");
      if (!grid) return;

      let bookings = DB.getBookingsForUser(user.id);
      const upcoming = bookings.filter((b) => b.status === "upcoming" || b.status === "active").sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));
      const past = bookings.filter((b) => b.status === "completed" || b.status === "cancelled").sort((a, b) => (b.date + b.startTime).localeCompare(a.date + a.startTime));

      const list = this.tab === "upcoming" ? upcoming : past;
      grid.innerHTML = list.map((b) => this.bookingCardHtml(b)).join("");

      const hasAny = upcoming.length || past.length;
      empty.classList.toggle("d-none", hasAny);
      if (emptyTitle) emptyTitle.textContent = this.tab === "upcoming" ? "No upcoming bookings" : "No past bookings yet";
      if (emptySub) emptySub.textContent = this.tab === "upcoming" ? "Find a parking spot and your reservations will appear here." : "Completed and cancelled bookings will appear here.";

      /* render QR thumbnails (only for non-cancelled) */
      if (window.QRCode) {
        grid.querySelectorAll("[data-qr]").forEach((el) => {
          const b = bookings.find((x) => x.bookingId === el.dataset.qr);
          if (!b) return;
          new QRCode(el, {
            text: JSON.stringify({ app: "SmartPark360", bookingId: b.bookingId, lot: b.lotName, slot: b.slotId, vehicle: b.vehicleNumber, date: b.date }),
            width: 108,
            height: 108,
            correctLevel: QRCode.CorrectLevel.M,
          });
        });
      }
    },

    doCancel() {
      const user = DB.getCurrentUser();
      if (!this.pendingCancelId) return;
      const res = DB.cancelBooking(this.pendingCancelId, user.id);
      this.pendingCancelId = null;
      const modalEl = document.getElementById("cancelModal");
      if (modalEl && window.bootstrap && bootstrap.Modal.getInstance(modalEl)) bootstrap.Modal.getInstance(modalEl).hide();
      if (res.ok) {
        Utils.toast("Booking cancelled and the bay has been released.", "success", "Cancelled");
        this.render();
      } else {
        Utils.toast(res.error, "error");
      }
    },
  };

  /* delegated card actions for MyBookings */
  document.addEventListener("click", (e) => {
    const page = window.PageScripts["my-bookings"];
    if (!page) return;

    const cancelBtn = e.target.closest('[data-action="cancel"]');
    if (cancelBtn) {
      e.preventDefault();
      page.pendingCancelId = cancelBtn.dataset.bid;
      document.getElementById("cancelBookingRef").textContent = cancelBtn.dataset.ref;
      bootstrap.Modal.getOrCreateInstance(document.getElementById("cancelModal")).show();
      return;
    }

    const dlBtn = e.target.closest('[data-action="dlqr"]');
    if (dlBtn) {
      e.preventDefault();
      const card = dlBtn.closest(".parking-card");
      const canvas = card.querySelector("[data-qr] canvas");
      const booking = DB.getBookings().find((b) => b.id === dlBtn.dataset.bid);
      if (canvas && booking) Utils.downloadCanvas(canvas, `SmartPark360-${booking.bookingId}.png`);
    }
  });

  window.PageScripts["parking-details"] = DetailsPage;
  window.PageScripts["booking"] = BookingPage;
  window.PageScripts["my-bookings"] = MyBookingsPage;
})();
