/* ==========================================================================
   storage.js — SmartPark 360 Data Layer (LocalStorage "database")
   --------------------------------------------------------------------------
   Simulates the backend of the system entirely inside the browser:
   • Users, parking lots, slots, bookings, notifications & settings
   • Mock JSON seed data (data/parking-data.json) loaded on first run
   • A 5-second "real-time" simulation that randomly changes slot occupancy
     and automatically progresses bookings (upcoming → active → completed)

   Slot lifecycle:  available → reserved (booked) → occupied (entered)
                    occupied  → available (checked out)
   ========================================================================== */

const DB = (() => {
  const KEYS = {
    users: "sp_users",
    lots: "sp_lots",
    slots: "sp_slots",
    bookings: "sp_bookings",
    settings: "sp_settings",
    notifs: "sp_notifications",
    messages: "sp_messages",
    seeded: "sp_seeded_v1",
    lastUpdate: "sp_last_update",
  };

  /* ---------------- Low-level LocalStorage helpers ---------------- */
  const read = (key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  };
  const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));

  const uid = (p) => p + "-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  /* Vehicle type multipliers applied to the base hourly price */
  const TYPE_FACTOR = { "2-wheeler": 0.5, "4-wheeler": 1.0, EV: 0.85, SUV: 1.2, "Bus / Heavy": 2.0 };

  /* ---------------- Seeding (first run only) ---------------- */
  async function seed() {
    if (localStorage.getItem(KEYS.seeded)) return;

    /* --- 1. Users start empty; accounts are created through registration. --- */
    const now = new Date().toISOString();
    const users = [];

    /* --- 2. Parking lots (mock JSON) ---
       Load order:
       1. window.PARKING_DATA — embedded copy (data/parking-data.js). Always
          available, even when opened as file:// where browsers block fetch().
       2. data/parking-data.json — fetched over http(s).
       3. FALLBACK_LOTS — compact last resort if both fail. */
    let lots = window.PARKING_DATA || [];
    if (!lots.length) {
      try {
        const res = await fetch("data/parking-data.json");
        lots = await res.json();
      } catch (e) {
        lots = FALLBACK_LOTS; // file:// or offline usage
      }
    }
    if (!lots.length) lots = FALLBACK_LOTS;

    /* --- 3. Generate slots for every lot --- */
    const slots = [];
    lots.forEach((lot) => {
      const cols = 4; // bays per row block (A1–A4, B1–B4, …)
      let n = 0;
      for (let r = 0; r < Math.ceil(lot.capacity / cols) && n < lot.capacity; r++) {
        const letter = String.fromCharCode(65 + r);
        for (let c = 1; c <= cols && n < lot.capacity; c++, n++) {
          // initial distribution: mostly available, some occupied, few reserved
          const rnd = Math.random();
          const status = rnd < 0.68 ? "available" : rnd < 0.92 ? "occupied" : "reserved";
          slots.push({
            id: lot.id + "-" + letter + c,
            lotId: lot.id,
            label: letter + c,
            status,
            vehicle: status === "occupied" ? randomPlate() : null,
            updatedAt: now,
          });
        }
      }
    });

    /* --- 4. Seed a month of historical bookings (feeds charts & reports) --- */
    const bookings = buildHistory(lots, slots, users);

    /* --- 5. Notifications are created when a user registers. --- */
    const notifs = [];

    write(KEYS.users, users);
    write(KEYS.lots, lots);
    write(KEYS.slots, slots);
    write(KEYS.bookings, bookings);
    write(KEYS.notifs, notifs);
    write(KEYS.settings, { theme: "light" });
    write(KEYS.messages, []);
    write(KEYS.lastUpdate, Date.now());
    localStorage.setItem(KEYS.seeded, "1");
  }

  /* Generates realistic past bookings without embedding personal data. */
  function buildHistory(lots, slots, users) {
    const plates = [
      "DL 01 CA 4821", "KA 03 MN 9912", "MH 12 AB 3344", "TS 09 ER 1122",
      "TN 07 KL 8855", "WB 06 XY 2233", "MH 14 PZ 7766", "DL 08 QR 4411",
      "KA 05 UV 6677", "GJ 01 BC 9090", "PB 10 JK 5566", "CH 01 ST 7788",
    ];
    const types = ["2-wheeler", "4-wheeler", "EV", "SUV"];
    // Weighted peak hours: office morning + evening rush
    const hourPool = [8, 9, 9, 10, 10, 11, 12, 13, 14, 15, 16, 17, 17, 18, 18, 18, 19, 19, 20, 20, 21, 8, 9, 17];
    const bookings = [];
    const today = new Date();

    const make = (user, lot, slot, type, hours, dateISO, startHour, status, createdAt) => {
      const amount = Math.round(lot.price * (TYPE_FACTOR[type] || 1) * hours * 100) / 100;
      return {
        id: uid("b"),
        bookingId: Utils.genId("SP"),
        userId: user ? user.id : null,
        userName: user ? user.name : "Sample User",
        userEmail: user ? user.email : null,
        lotId: lot.id,
        lotName: lot.name,
        slotId: slot.id,
        vehicleNumber: pick(plates),
        vehicleType: type,
        date: dateISO,
        startTime: String(startHour).padStart(2, "0") + ":" + String(pick([5, 10, 15, 20, 25, 30, 35, 40, 45, 50])).padStart(2, "0"),
        durationHours: hours,
        amount,
        status,
        createdAt,
      };
    };

    // Past 28 days: 2–5 completed bookings per day
    for (let d = 27; d > 0; d--) {
      const day = new Date(today);
      day.setDate(day.getDate() - d);
      const dateISO = Utils.addDaysISO(Utils.todayISO(), -d);
      const count = 2 + Math.floor(Math.random() * 4);
      const usedSlots = new Set();
      for (let i = 0; i < count; i++) {
        const lot = pick(lots);
        const avail = slots.filter((s) => s.lotId === lot.id && !usedSlots.has(s.id));
        if (!avail.length) continue;
        const slot = pick(avail);
        usedSlots.add(slot.id);
        const type = pick(types);
        const hours = 1 + Math.floor(Math.random() * 4);
        const startHour = pick(hourPool);
        const created = new Date(day.getFullYear(), day.getMonth(), day.getDate(), startHour - 1, Math.floor(Math.random() * 50));
        bookings.push(make(demo, lot, slot, type, hours, dateISO, startHour, "completed", created.toISOString()));
      }
    }

    // Today: 2 completed + 1 active (so "Today's Bookings" looks alive)
    const todays = slots.filter((s) => s.status === "available");
    const tLot = lots[0];
    const tSlot = todays.find((s) => s.lotId === tLot.id) || slots.find((s) => s.lotId === tLot.id);
    const nowHour = Math.max(8, Math.min(20, new Date().getHours()));
    bookings.push(make(demo, tLot, tSlot, "4-wheeler", 2, Utils.todayISO(), Math.max(6, nowHour - 3), "completed", new Date(Date.now() - 6 * 3600e3).toISOString()));
    bookings.push(make(demo, lots[1], slots.find((s) => s.lotId === lots[1].id), "EV", 1, Utils.todayISO(), Math.max(7, nowHour - 2), "completed", new Date(Date.now() - 3 * 3600e3).toISOString()));

    const activeLot = lots[3];
    const activeSlot = slots.find((s) => s.lotId === activeLot.id && s.status === "occupied") || slots.find((s) => s.lotId === activeLot.id);
    activeSlot.status = "occupied";
    activeSlot.vehicle = "DL 01 CA 4821";
    bookings.push(make(demo, activeLot, activeSlot, "4-wheeler", 3, Utils.todayISO(), Math.max(6, nowHour - 2), "active", new Date(Date.now() - 2 * 3600e3).toISOString()));

    // Upcoming: 3 future bookings (their slots become reserved)
    const upSlots = slots.filter((s) => s.status === "available").slice(0, 3);
    upSlots.forEach((slot, i) => {
      slot.status = "reserved";
      slot.vehicle = null;
      const lot = lots.find((l) => l.id === slot.lotId);
      const type = types[i];
      bookings.push(make(demo, lot, slot, type, 2 + i, Utils.addDaysISO(Utils.todayISO(), i + 1), 10 + i * 2, "upcoming", new Date().toISOString()));
    });

    return bookings;
  }

  const randomPlate = () => {
    const st = pick(["DL", "KA", "MH", "TS", "TN", "WB", "GJ", "PB", "CH", "RJ", "AP", "UP"]);
    const d1 = String(1 + Math.floor(Math.random() * 99)).padStart(2, "0");
    const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    const l1 = letters[Math.floor(Math.random() * 25)] + letters[Math.floor(Math.random() * 25)];
    const d2 = String(1000 + Math.floor(Math.random() * 9000));
    return `${st} ${d1} ${l1} ${d2}`;
  };

  /* Compact fallback lots when data/parking-data.json cannot be fetched */
  const FALLBACK_LOTS = [
    { id: "lot-01", name: "Connaught Place Inner Circle", area: "Connaught Place", address: "Inner Circle, CP", city: "New Delhi", lat: 28.6304, lng: 77.2177, capacity: 48, price: 40, rating: 4.6, open: "06:00", close: "23:30", type: "Multilevel", theme: "ph-1", description: "Central Delhi's flagship smart parking hub.", amenities: ["CCTV Surveillance", "EV Charging"] },
    { id: "lot-02", name: "India Gate Rajpath Side", area: "Rajpath", address: "Kartavya Path", city: "New Delhi", lat: 28.6129, lng: 77.2295, capacity: 60, price: 30, rating: 4.4, open: "06:00", close: "22:00", type: "On-street", theme: "ph-2", description: "High-turnover on-street bays near the landmark.", amenities: ["CCTV Surveillance"] },
    { id: "lot-03", name: "MG Road Smart Deck", area: "MG Road", address: "MG Road, Metro Exit 2", city: "Bengaluru", lat: 12.9754, lng: 77.6061, capacity: 56, price: 45, rating: 4.5, open: "00:00", close: "23:59", type: "Multilevel", theme: "ph-4", description: "Bengaluru's automated smart deck, 24×7.", amenities: ["CCTV Surveillance", "EV Charging"] },
    { id: "lot-04", name: "Marine Drive Esplanade", area: "Marine Drive", address: "Chowpatty", city: "Mumbai", lat: 18.942, lng: 72.8239, capacity: 44, price: 35, rating: 4.7, open: "00:00", close: "23:59", type: "Waterfront", theme: "ph-6", description: "Oceanfront parking with premium evening slots.", amenities: ["CCTV Surveillance"] },
    { id: "lot-05", name: "Hitech City Metro Parking", area: "Hitech City", address: "Cyberabad Metro", city: "Hyderabad", lat: 17.4479, lng: 78.3831, capacity: 52, price: 30, rating: 4.3, open: "05:00", close: "23:30", type: "Metro", theme: "ph-5", description: "Park-and-ride for the IT corridor.", amenities: ["CCTV Surveillance"] },
    { id: "lot-06", name: "Hawa Mahal Parking Complex", area: "Walled City", address: "Badi Chaupar", city: "Jaipur", lat: 26.9239, lng: 75.8267, capacity: 40, price: 25, rating: 4.2, open: "06:00", close: "21:00", type: "Heritage", theme: "ph-7", description: "Heritage-zone parking near Hawa Mahal.", amenities: ["CCTV Surveillance"] },
  ];

  /* ---------------- Initialise (call once per page) ---------------- */
  let initPromise = null;
  function init() {
    if (!initPromise) initPromise = seed();
    return initPromise;
  }

  /* ---------------- Users & session ---------------- */
  const getUsers = () => read(KEYS.users, []);
  const saveUsers = (users) => write(KEYS.users, users);

  const findUserByEmail = (email) => getUsers().find((u) => u.email.toLowerCase() === String(email).toLowerCase());
  const findUserById = (id) => getUsers().find((u) => u.id === id);

  const getCurrentUser = () => {
    try {
      const s = JSON.parse(sessionStorage.getItem("sp_session")) || JSON.parse(localStorage.getItem("sp_session"));
      return s ? findUserById(s.id) : null;
    } catch (e) {
      return null;
    }
  };

  function login(email, password, remember) {
    const user = findUserByEmail(email);
    if (!user || user.password !== Utils.hash(password)) return { ok: false, error: "Invalid email or password." };
    const session = { id: user.id, loginAt: Date.now() };
    (remember ? localStorage : sessionStorage).setItem("sp_session", JSON.stringify(session));
    (remember ? sessionStorage : localStorage).removeItem("sp_session");
    return { ok: true, user };
  }

  function register({ name, email, phone, password }) {
    if (findUserByEmail(email)) return { ok: false, error: "An account with this email already exists." };
    const user = {
      id: uid("u"),
      name,
      email: email.toLowerCase(),
      phone,
      password: Utils.hash(password),
      role: "user",
      createdAt: new Date().toISOString(),
    };
    const users = getUsers();
    users.push(user);
    saveUsers(users);
    localStorage.setItem("sp_session", JSON.stringify({ id: user.id, loginAt: Date.now() }));
    addNotification(user.id, "fa-bell", "Welcome to SmartPark 360! Your account is ready.");
    return { ok: true, user };
  }

  const logout = () => {
    sessionStorage.removeItem("sp_session");
    localStorage.removeItem("sp_session");
  };

  function updateUser(id, patch) {
    const users = getUsers();
    const i = users.findIndex((u) => u.id === id);
    if (i === -1) return { ok: false, error: "User not found." };
    users[i] = { ...users[i], ...patch };
    saveUsers(users);
    return { ok: true, user: users[i] };
  }

  /* ---------------- Parking lots ---------------- */
  const getLots = () => read(KEYS.lots, []);
  const saveLots = (lots) => write(KEYS.lots, lots);
  const getLot = (id) => getLots().find((l) => l.id === id);

  function addLot(data) {
    const lots = getLots();
    const id = uid("lot");
    const lot = { id, ...data, rating: Number(data.rating) || 4.0 };
    lots.push(lot);
    saveLots(lots);
    // generate matching slots
    const slots = getSlots();
    const cols = 4;
    let n = 0;
    for (let r = 0; r < Math.ceil(lot.capacity / cols) && n < lot.capacity; r++) {
      const letter = String.fromCharCode(65 + r);
      for (let c = 1; c <= cols && n < lot.capacity; c++, n++) {
        slots.push({ id: id + "-" + letter + c, lotId: id, label: letter + c, status: "available", vehicle: null, updatedAt: new Date().toISOString() });
      }
    }
    saveSlots(slots);
    return lot;
  }

  function updateLot(id, patch) {
    const lots = getLots();
    const i = lots.findIndex((l) => l.id === id);
    if (i === -1) return null;
    lots[i] = { ...lots[i], ...patch };
    saveLots(lots);
    return lots[i];
  }

  function deleteLot(id) {
    saveLots(getLots().filter((l) => l.id !== id));
    saveSlots(getSlots().filter((s) => s.lotId !== id));
    // cancel any open bookings for that lot
    const bookings = getBookings();
    bookings.forEach((b) => {
      if (b.lotId === id && (b.status === "upcoming" || b.status === "active")) b.status = "cancelled";
    });
    saveBookings(bookings);
  }

  /* ---------------- Slots ---------------- */
  const getSlots = () => read(KEYS.slots, []);
  const saveSlots = (slots) => write(KEYS.slots, slots);
  const getSlotsForLot = (lotId) => getSlots().filter((s) => s.lotId === lotId);
  const getSlot = (id) => getSlots().find((s) => s.id === id);

  function setSlotStatus(slotId, status, meta = {}) {
    const slots = getSlots();
    const s = slots.find((x) => x.id === slotId);
    if (!s) return;
    s.status = status;
    s.vehicle = status === "occupied" ? meta.vehicle || randomPlate() : null;
    s.updatedAt = new Date().toISOString();
    saveSlots(slots);
    bump();
  }

  /* ---------------- Bookings ---------------- */
  const getBookings = () => read(KEYS.bookings, []);
  const saveBookings = (bookings) => write(KEYS.bookings, bookings);
  const getBookingsForUser = (userId) => getBookings().filter((b) => b.userId === userId);

  function createBooking({ userId, lotId, slotId, vehicleNumber, vehicleType, date, startTime, durationHours }) {
    const lot = getLot(lotId);
    const slot = getSlot(slotId);
    if (!lot || !slot) return { ok: false, error: "Parking lot or slot not found." };
    if (slot.status !== "available") return { ok: false, error: "That slot was just taken. Please pick another." };

    const user = findUserById(userId);
    const amount = Math.round(lot.price * (TYPE_FACTOR[vehicleType] || 1) * Number(durationHours) * 100) / 100;
    const booking = {
      id: uid("b"),
      bookingId: Utils.genId("SP"),
      userId,
      userName: user ? user.name : "Guest",
      userEmail: user ? user.email : "",
      lotId,
      lotName: lot.name,
      slotId,
      vehicleNumber,
      vehicleType,
      date,
      startTime,
      durationHours: Number(durationHours),
      amount,
      status: "upcoming",
      createdAt: new Date().toISOString(),
    };
    const bookings = getBookings();
    bookings.push(booking);
    saveBookings(bookings);

    // reserve the slot immediately
    const slots = getSlots();
    const s = slots.find((x) => x.id === slotId);
    if (s) {
      s.status = "reserved";
      s.updatedAt = new Date().toISOString();
    }
    saveSlots(slots);

    // notify user + admin
    addNotification(userId, "fa-circle-check", `Booking ${booking.bookingId} confirmed at ${lot.name}.`);
    addNotification("u-admin", "fa-calendar-check", `${user.name} booked slot ${slot.label} at ${lot.name}.`);
    bump();
    return { ok: true, booking };
  }

  function cancelBooking(bookingId, userId) {
    const bookings = getBookings();
    const b = bookings.find((x) => x.id === bookingId);
    if (!b) return { ok: false, error: "Booking not found." };
    if (userId && b.userId !== userId) return { ok: false, error: "You cannot cancel this booking." };
    if (b.status !== "upcoming") return { ok: false, error: "Only upcoming bookings can be cancelled." };
    b.status = "cancelled";
    saveBookings(bookings);
    // release the slot
    setSlotStatus(b.slotId, "available");
    addNotification(b.userId, "fa-circle-xmark", `Booking ${b.bookingId} was cancelled. Your slot is released.`);
    bump();
    return { ok: true };
  }

  function updateBookingStatus(id, status) {
    const bookings = getBookings();
    const b = bookings.find((x) => x.id === id);
    if (!b) return;
    b.status = status;
    saveBookings(bookings);
  }

  /* ---------------- Statistics ---------------- */
  function getLotStats(lotId) {
    const slots = getSlotsForLot(lotId);
    return {
      total: slots.length,
      available: slots.filter((s) => s.status === "available").length,
      reserved: slots.filter((s) => s.status === "reserved").length,
      occupied: slots.filter((s) => s.status === "occupied").length,
    };
  }

  function getGlobalStats() {
    const slots = getSlots();
    return {
      lots: getLots().length,
      slots: slots.length,
      available: slots.filter((s) => s.status === "available").length,
      reserved: slots.filter((s) => s.status === "reserved").length,
      occupied: slots.filter((s) => s.status === "occupied").length,
    };
  }

  /* Bookings whose booking-date falls on `dateISO`, counting revenue statuses */
  function bookingsOn(dateISO) {
    return getBookings().filter((b) => b.date === dateISO && b.status !== "cancelled");
  }
  function revenueOn(dateISO) {
    return bookingsOn(dateISO).filter((b) => b.status === "completed" || b.status === "active").reduce((s, b) => s + b.amount, 0);
  }

  /* Revenue per day for the last `days` days (oldest first) */
  function revenueSeries(days) {
    const out = [];
    for (let i = days - 1; i >= 0; i--) {
      const iso = Utils.addDaysISO(Utils.todayISO(), -i);
      out.push({ date: iso, revenue: Math.round(revenueOn(iso) * 100) / 100, bookings: bookingsOn(iso).length });
    }
    return out;
  }

  /* Bookings grouped by start hour (peak-hours analysis) */
  function bookingsByHour() {
    const hours = new Array(24).fill(0);
    getBookings().filter((b) => b.status !== "cancelled").forEach((b) => {
      const h = parseInt(b.startTime, 10);
      if (h >= 0 && h < 24) hours[h]++;
    });
    return hours;
  }

  /* Bookings per lot (most-used parking analysis) */
  function bookingsByLot(limit = 8) {
    const map = {};
    getBookings().filter((b) => b.status !== "cancelled").forEach((b) => {
      map[b.lotName] = map[b.lotName] || { lotName: b.lotName, count: 0, revenue: 0 };
      map[b.lotName].count++;
      if (b.status === "completed" || b.status === "active") map[b.lotName].revenue += b.amount;
    });
    return Object.values(map).sort((a, b) => b.count - a.count).slice(0, limit);
  }

  /* ---------------- Notifications ---------------- */
  const getNotifications = (userId) => read(KEYS.notifs, []).filter((n) => n.userId === userId).sort((a, b) => new Date(b.time) - new Date(a.time));
  const unreadCount = (userId) => getNotifications(userId).filter((n) => !n.read).length;

  function addNotification(userId, icon, message) {
    const notifs = read(KEYS.notifs, []);
    notifs.push({ id: uid("n"), userId, icon, message, time: new Date().toISOString(), read: false });
    write(KEYS.notifs, notifs);
  }
  function markNotifsRead(userId) {
    const notifs = read(KEYS.notifs, []);
    notifs.forEach((n) => {
      if (n.userId === userId) n.read = true;
    });
    write(KEYS.notifs, notifs);
  }

  /* ---------------- Settings & messages ---------------- */
  const getSettings = () => read(KEYS.settings, { theme: "light" });
  const saveSettings = (s) => write(KEYS.settings, s);
  const addMessage = (msg) => {
    const msgs = read(KEYS.messages, []);
    msgs.push({ id: uid("m"), ...msg, time: new Date().toISOString() });
    write(KEYS.messages, msgs);
  };

  /* ---------------- REAL-TIME SIMULATION ----------------
     Every tick (5s):
     1. Progress bookings: upcoming → active (slot occupied) at start time,
        active → completed (slot released) after duration ends.
     2. Randomly churn slot occupancy (cars arriving / leaving).
     3. Dispatch a global "sp:updated" event so open pages refresh live.
  ---------------------------------------------------------- */
  let simTimer = null;

  function bump() {
    write(KEYS.lastUpdate, Date.now());
    document.dispatchEvent(new CustomEvent("sp:updated", { detail: { at: Date.now() } }));
  }

  function simulate() {
    const slots = getSlots();
    const bookings = getBookings();
    const now = Date.now();
    let changed = false;

    /* 1. Booking lifecycle */
    bookings.forEach((b) => {
      const slot = slots.find((s) => s.id === b.slotId);
      if (!slot) return;
      const start = new Date(b.date + "T" + b.startTime + ":00").getTime();
      const end = start + b.durationHours * 3600e3;

      if (b.status === "upcoming" && start <= now) {
        b.status = "active";
        slot.status = "occupied";
        slot.vehicle = b.vehicleNumber;
        changed = true;
      } else if (b.status === "active" && end <= now) {
        b.status = "completed";
        slot.status = "available";
        slot.vehicle = null;
        changed = true;
      }
    });

    /* 2. Random occupancy churn (skip reserved/booked slots) */
    const live = slots.filter((s) => s.status === "available");
    const taken = slots.filter((s) => s.status === "occupied");
    const arrivals = Math.min(live.length, 1 + Math.floor(Math.random() * 3));
    const departures = Math.min(taken.length, Math.floor(Math.random() * 3));
    for (let i = 0; i < arrivals; i++) {
      const s = live[Math.floor(Math.random() * live.length)];
      s.status = "occupied";
      s.vehicle = randomPlate();
      s.updatedAt = new Date().toISOString();
      changed = true;
    }
    for (let i = 0; i < departures; i++) {
      const s = taken[Math.floor(Math.random() * taken.length)];
      s.status = "available";
      s.vehicle = null;
      s.updatedAt = new Date().toISOString();
      changed = true;
    }

    if (changed) {
      saveSlots(slots);
      saveBookings(bookings);
      bump();
    }
  }

  function startSimulation(intervalMs = 5000) {
    if (simTimer) return;
    simTimer = setInterval(simulate, intervalMs);
  }
  function stopSimulation() {
    if (simTimer) clearInterval(simTimer);
    simTimer = null;
  }

  /* ---------------- Public API ---------------- */
  return {
    init,
    KEYS,
    TYPE_FACTOR,
    // users & session
    getUsers, saveUsers, findUserByEmail, findUserById, getCurrentUser,
    login, register, logout, updateUser,
    // lots
    getLots, saveLots, getLot, addLot, updateLot, deleteLot,
    // slots
    getSlots, saveSlots, getSlotsForLot, getSlot, setSlotStatus,
    // bookings
    getBookings, saveBookings, getBookingsForUser, createBooking, cancelBooking, updateBookingStatus,
    // stats
    getLotStats, getGlobalStats, bookingsOn, revenueOn, revenueSeries, bookingsByHour, bookingsByLot,
    // notifications
    getNotifications, unreadCount, addNotification, markNotifsRead,
    // settings
    getSettings, saveSettings, addMessage,
    // simulation
    startSimulation, stopSimulation, simulate, bump,
    uid,
  };
})();

window.DB = DB;
