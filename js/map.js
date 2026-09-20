/* ==========================================================================
   map.js — Live Parking Map (Leaflet + OpenStreetMap)
   ========================================================================== */

(function () {
  "use strict";
  window.PageScripts = window.PageScripts || {};

  const MapPage = {
    map: null,
    markers: {}, // lotId -> Leaflet marker
    userMarker: null,
    userCircle: null,

    init() {
      const el = document.getElementById("map");
      if (!el) return;
      if (!window.L) {
        Utils.toast("Leaflet failed to load — check your internet connection.", "error", "Map unavailable");
        document.getElementById("map").innerHTML =
          '<div class="d-flex align-items-center justify-content-center h-100 text-muted-sp"><i class="fa-solid fa-map me-2"></i>Map tiles require internet access.</div>';
        return;
      }

      this.map = L.map(el, { scrollWheelZoom: true }).setView([21.16, 78.0], 5);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(this.map);

      this.renderMarkers();
      this.renderList();

      /* user location (stored from a previous visit, else ask) */
      try {
        const c = JSON.parse(localStorage.getItem("sp_coords"));
        if (c && c.lat && c.lng) this.placeUser(c.lat, c.lng, false);
      } catch (e) {}

      this.bindLocate();

      /* live refresh every 5 seconds */
      DB.startSimulation(5000);
      document.addEventListener("sp:updated", () => {
        this.updateMarkers();
        this.renderList();
      });
    },

    /* ---------- markers ---------- */
    pinIcon(full) {
      return L.divIcon({
        className: "",
        html: `<div class="marker-pin ${full ? "full" : ""}"><div class="pulse"></div><div class="pin"><i class="fa-solid fa-car"></i></div></div>`,
        iconSize: [34, 34],
        iconAnchor: [17, 34],
        popupAnchor: [0, -34],
      });
    },

    popupHtml(lot) {
      const stats = DB.getLotStats(lot.id);
      const full = stats.available === 0;
      return `
        <div class="map-pop">
          <h6>${Utils.esc(lot.name)}</h6>
          <div class="mp-row"><i class="fa-solid fa-location-dot"></i> ${Utils.esc(lot.address)}, ${Utils.esc(lot.city)}</div>
          <div class="mp-row"><i class="fa-solid fa-indian-rupee-sign"></i> ₹${lot.price}/hr · ★ ${lot.rating.toFixed(1)}</div>
          <div class="mp-avail ${full ? "full" : ""}">${stats.available} / ${stats.total} bays available</div>
          <a class="btn btn-soft btn-sm" href="parking-details.html?id=${lot.id}"><i class="fa-solid fa-eye me-1"></i>View Details</a>
        </div>`;
    },

    renderMarkers() {
      DB.getLots().forEach((lot) => {
        const stats = DB.getLotStats(lot.id);
        const m = L.marker([lot.lat, lot.lng], { icon: this.pinIcon(stats.available === 0) })
          .addTo(this.map)
          .bindPopup(this.popupHtml(lot), { closeButton: false });
        this.markers[lot.id] = m;
      });
      /* fit bounds to all markers, respecting stored user position roughly */
      const all = DB.getLots();
      if (all.length) this.map.fitBounds(all.map((l) => [l.lat, l.lng]), { padding: [40, 40] });
    },

    updateMarkers() {
      DB.getLots().forEach((lot) => {
        const m = this.markers[lot.id];
        if (!m) return;
        const stats = DB.getLotStats(lot.id);
        const full = stats.available === 0;
        if (m._lastFull !== full) {
          m.setIcon(this.pinIcon(full));
          m._lastFull = full;
        }
        m.setPopupContent(this.popupHtml(lot));
      });
    },

    /* ---------- sidebar ---------- */
    renderList() {
      const list = document.getElementById("lotList");
      const count = document.getElementById("mapZoneCount");
      if (!list) return;
      const lots = DB.getLots();
      if (count) count.textContent = `${lots.length} zones online · ${DB.getGlobalStats().available} bays free`;

      list.innerHTML = lots
        .map((lot) => {
          const stats = DB.getLotStats(lot.id);
          const full = stats.available === 0;
          return `
            <div class="map-lot-item" data-lot="${lot.id}">
              <div class="lot-thumb ${lot.theme || "ph-1"}"><i class="fa-solid fa-square-parking"></i></div>
              <div class="ml-info">
                <div class="ml-name">${Utils.esc(lot.name)}</div>
                <div class="ml-sub">${Utils.esc(lot.city)} · ₹${lot.price}/hr · ★ ${lot.rating.toFixed(1)}</div>
              </div>
              <div class="ml-avail ${full ? "full" : ""}">${stats.available}/${stats.total}</div>
            </div>`;
        })
        .join("");

      list.querySelectorAll(".map-lot-item").forEach((item) =>
        item.addEventListener("click", () => {
          const m = this.markers[item.dataset.lot];
          if (!m) return;
          this.map.flyTo(m.getLatLng(), Math.max(this.map.getZoom(), 14), { duration: 0.7 });
          setTimeout(() => m.openPopup(), 750);
        })
      );
    },

    /* ---------- locate ---------- */
    bindLocate() {
      document.getElementById("locateBtn").addEventListener("click", () => {
        if (!navigator.geolocation) {
          Utils.toast("Geolocation is not supported by this browser.", "warn");
          return;
        }
        Utils.toast("Finding your location…", "info", "GPS");
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            this.placeUser(pos.coords.latitude, pos.coords.longitude, true);
            Utils.toast("You are now on the map.", "success", "Location found");
          },
          () => Utils.toast("Location access denied — using demo origin instead.", "warn")
        );
      });
    },

    placeUser(lat, lng, fly) {
      localStorage.setItem("sp_coords", JSON.stringify({ lat, lng }));
      if (!this.userMarker) {
        this.userMarker = L.marker([lat, lng], {
          icon: L.divIcon({ className: "", html: `<div class="marker-pin"><div class="pulse"></div><div class="pin"><i class="fa-solid fa-location-crosshairs"></i></div></div>`, iconSize: [34, 34], iconAnchor: [17, 34] }),
        }).addTo(this.map).bindPopup("<div class='map-pop'><h6>You are here</h6></div>", { closeButton: false });
        this.userCircle = L.circle([lat, lng], { radius: 600, color: "#0e9f8e", weight: 1.5, fillColor: "#0e9f8e", fillOpacity: 0.12 }).addTo(this.map);
      } else {
        this.userMarker.setLatLng([lat, lng]);
        this.userCircle.setLatLng([lat, lng]);
      }
      if (fly) this.map.flyTo([lat, lng], 13, { duration: 0.8 });
    },
  };

  window.PageScripts["map"] = MapPage;
})();
