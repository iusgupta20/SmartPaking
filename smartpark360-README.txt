================================================================
 SmartPark 360 — SIH 2024 Problem SIH1515 (Smart Street Parking)
================================================================
 A pure HTML5 + CSS3 + Bootstrap 5 + Vanilla JS prototype.
 No frameworks. No server. Data lives in your browser's LocalStorage.


 WHAT TO SHOW AT THE DEMO
 1. Landing page (index.html) — hero, stats, live map preview.
 2. Create an account -> dashboard -> search + book a slot.
 3. Parking details -> click an AVAILABLE bay -> booking form.
 4. Booking -> QR code generated -> check "My Bookings".
 5. Log in as admin -> dashboard (live charts) -> parking
    management (add/edit/delete lots, change slot status) ->
    Reports (daily/weekly/monthly + CSV export).
 6. Watch the occupancy change by itself every 5 seconds
    (the "real-time" simulation) — dashboards, maps and slot
    grids update live with no page reload.

----------------------------------------------------------------
 PROJECT STRUCTURE
----------------------------------------------------------------
 index.html            Landing page
 login.html            Login (validation, remember me, forgot password)
 register.html         Create account
 dashboard.html        User dashboard (search, filter, parking cards)
 parking-details.html  Lot details + clickable live slot grid
 booking.html          Booking form + QR code + summary
 my-bookings.html      Upcoming / past bookings, cancel, QR download
 map.html              Leaflet + OpenStreetMap parking map
 admin-dashboard.html  Admin KPIs + charts + recent bookings
 parking-management.html  Add / edit / delete lots + manage bays
 reports.html          Daily / weekly / monthly analytics + export
 profile.html          Edit profile, change password, dark mode, logout
 contact.html          Support form, FAQ, emergency contacts
 css/style.css         All styling (Modern theme + dark mode)
 js/utils.js           Helpers, toasts, hashing, date utils
 js/storage.js         LocalStorage "database" + 5s real-time engine
 js/main.js            Boot, nav, auth guards, theme
 js/dashboard.js       User dashboard + profile logic
 js/booking.js         Booking + QR + details + my-bookings
 js/map.js             Leaflet map
 js/admin.js           Admin dashboard + parking management
 js/report.js          Reports + charts + CSV
 data/parking-data.json   Mock dataset (20 lots) — editable
 data/parking-data.js     Offline mirror of the same data (keep in sync)
 assets/logo.svg       Brand logo

----------------------------------------------------------------
 TIPS
----------------------------------------------------------------
 - Reset the demo data: Profile page -> "Reset demo data",
   or clear the browser's LocalStorage for this site.
 - To change parking lots, edit data/parking-data.json AND copy the
   same array into data/parking-data.js, then clear LocalStorage.
 - The map, charts and QR codes load from CDNs — stay online during
   the presentation, or download those libraries and link them locally.
================================================================
