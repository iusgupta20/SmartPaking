# SmartPark 360

SmartPark 360 is a browser-based smart street-parking prototype for the SIH1515 problem. It provides parking discovery, live slot availability, booking, QR-code generation, administration, analytics, and support workflows.

This repository is a static frontend prototype:

- HTML5 pages provide the screens and forms.
- CSS3 and Bootstrap 5 provide layout and responsive styling.
- Vanilla JavaScript provides application behavior.
- LocalStorage and SessionStorage act as a temporary browser database.
- There is no production server, API, payment gateway, or shared database.

## 1. Prerequisites

Install one of the following:

- A modern browser: Chrome, Edge, Firefox, or Safari.
- Optional local server: VS Code Live Server, Python, or Node.js.
- Internet access for Bootstrap, Font Awesome, Leaflet, Chart.js, QRCode.js, and Google Fonts loaded from CDNs.

The application can open directly from `index.html`, but a local HTTP server is recommended because browsers may block some `fetch()` requests from `file://` pages.

## 2. Installation And First Run

### Stage 1: Get the source

```text
git clone https://github.com/iusgupta20/SmartPaking.git
cd SmartParking
```

### Stage 2: Start a local server

With VS Code Live Server, open `index.html` and choose **Open with Live Server**.

With Python:

```text
python -m http.server 8000
```

Then open `http://localhost:8000`.

With Node.js, any static server can be used, for example:

```text
npx serve .
```

### Stage 3: Initialise browser data

The first page load calls `DB.init()`. It loads the parking-lot dataset, creates slot records, creates historical sample bookings, and stores the result in LocalStorage. Later visits reuse the stored data.

### Stage 4: Create an account

Open **Create an account** from the sign-in page. Registration stores a locally hashed password and creates a local session. No account or personal data is sent to a server by this prototype.

There are intentionally no committed demo credentials or seeded personal accounts in this repository.

## 3. Citizen Workflow

### Stage 1: Landing page

`index.html` presents the product overview, feature sections, summary statistics, and navigation to the live map and contact page.

### Stage 2: Registration and sign-in

`register.html` validates a name, email, phone number, and password. `login.html` validates the stored account and supports:

- Remember-me sessions.
- Password visibility toggle.
- Forgot-password flow for the current local account.
- Redirect back to a protected page after authentication.

### Stage 3: Find parking

`dashboard.html` displays parking cards and supports search/filter interactions. `map.html` displays parking lots on a Leaflet/OpenStreetMap map. Selecting a lot opens `parking-details.html`.

### Stage 4: Inspect a parking lot

`parking-details.html` shows the lot address, hours, price, amenities, rating, capacity, and slot grid. Slot states are:

- Available: can be selected for booking.
- Reserved: currently assigned to a booking.
- Occupied: currently in use.

### Stage 5: Make a booking

`booking.html` accepts vehicle type, vehicle number, date, start time, duration, and selected slot. The storage layer calculates the amount using the lot price and vehicle multiplier, then creates the booking.

### Stage 6: View or cancel bookings

`my-bookings.html` separates upcoming, active, and completed bookings. A booking can display its QR code, download the QR image, or be cancelled when the current status allows it.

### Stage 7: Update profile

`profile.html` allows a signed-in user to edit profile information, change the local password, switch theme, reset local demo data, and sign out.

## 4. Administrator Workflow

Admin pages are protected by the role check in `js/main.js`. A user must have `role: "admin"` to access them.

The current static prototype creates new registrations with the `user` role and does not include a committed administrator account. A production backend or a controlled provisioning process must assign administrator roles. Do not add administrator passwords to source code.

### Stage 1: Admin dashboard

`admin-dashboard.html` shows KPI cards, recent bookings, occupancy information, and charts based on the local data layer.

### Stage 2: Manage parking

`parking-management.html` supports adding, editing, and deleting parking lots. It also supports changing individual slot states. New lots generate their slot records automatically.

### Stage 3: Review reports

`reports.html` provides daily, weekly, and monthly summaries, including booking counts, revenue, occupancy, popular locations, and CSV export.

### Stage 4: Monitor simulation

`js/storage.js` runs a five-second simulation that updates slot occupancy and progresses bookings. Open multiple pages to see the same browser-local state reflected across the interface.

## 5. Project Structure

```text
index.html                 Public landing page
login.html                 Sign-in and password recovery
register.html              Account registration
dashboard.html             Citizen dashboard
parking-details.html       Lot information and slot grid
booking.html               Booking form and QR code
my-bookings.html           Booking history and cancellation
map.html                   Leaflet parking map
admin-dashboard.html       Admin KPIs and charts
parking-management.html   Lot and slot administration
reports.html               Analytics and CSV export
profile.html               Profile, password, theme, and reset actions
contact.html               Support form, FAQ, and emergency contacts
css/style.css              Shared styling and dark theme
js/main.js                 Boot, navigation, authentication guards, theme
js/storage.js              LocalStorage database and simulation
js/utils.js                Hashing, identifiers, dates, formatting, toasts
js/dashboard.js            Dashboard and profile page logic
js/booking.js              Details, booking, and booking-history logic
js/map.js                  Map rendering and map filters
js/admin.js                Admin dashboard and parking management logic
js/report.js               Reports and CSV export logic
data/parking-data.json     Editable parking-lot source dataset
data/parking-data.js       Offline mirror used by file:// mode
assets/logo.svg            Application logo
```

## 6. Application Architecture

### Startup sequence

Every page loads shared dependencies and then `js/main.js`. The startup sequence is:

1. Read and apply the saved theme.
2. Start the loading state.
3. Initialise LocalStorage data through `DB.init()`.
4. Apply the authentication and role guard for the page.
5. Build shared navigation, notifications, and common UI.
6. Run the page-specific script registered in `window.PageScripts`.

### Storage layer

`js/storage.js` exposes the `DB` object. It stores users, parking lots, slots, bookings, notifications, messages, settings, and update timestamps in the browser.

Important keys include:

```text
sp_users          Registered local users
sp_lots           Parking lots
sp_slots          Parking slots
sp_bookings       Bookings and generated history
sp_settings       Theme and application settings
sp_notifications  User notifications
sp_messages       Contact messages
sp_seeded_v1      First-run seed marker
sp_session        Current login session
```

### Booking price calculation

The base price comes from the selected parking lot. Vehicle multipliers are defined in `js/storage.js`:

```text
2-wheeler   0.50
4-wheeler   1.00
EV          0.85
SUV         1.20
Bus / Heavy 2.00
```

The final amount is rounded to two decimal places after multiplying the lot price, vehicle factor, and duration.

## 7. Managing Parking Data

Edit `data/parking-data.json` when changing the initial parking catalogue. Keep `data/parking-data.js` synchronised because it is the offline fallback for direct `file://` usage.

Each lot should contain:

```text
id, name, area, address, city, lat, lng, capacity, price,
rating, open, close, type, theme, description, amenities
```

After changing the seed data, clear the existing LocalStorage for the site or use the reset action in the profile page. Otherwise the application will continue using the previously seeded records.

## 8. Resetting Local Data

Use the reset action on the profile page, or clear site data in browser developer tools. A manual browser-console reset is:

```javascript
localStorage.clear();
sessionStorage.clear();
location.reload();
```

This deletes all local accounts, bookings, settings, and messages for the current site origin. It does not delete files from the repository.

## 9. External Dependencies

The pages currently load these libraries from CDNs:

- Bootstrap 5.3.3 for layout and components.
- Font Awesome 6.5.2 for icons.
- Leaflet for maps.
- Chart.js for dashboard and report charts.
- QRCode.js for booking QR codes.
- Google Fonts for typography.
- OpenStreetMap tiles for map imagery.

An internet connection is required for all externally hosted assets. For offline or production use, vendor approved versions locally and update the script and stylesheet references.

## 10. Security And Privacy

This is a demonstration frontend, not a secure production service.

- LocalStorage is readable and editable by the user and must not hold real secrets.
- The local password hash is not a substitute for server-side authentication.
- There is no server-side authorization; client-side role checks can be bypassed.
- Do not put API keys, payment secrets, administrator passwords, or real customer data in this repository.
- Use environment variables and a backend secret store for production credentials.
- Use HTTPS, server-side validation, secure cookies, audit logs, and database access controls in a production implementation.
- Replace the LocalStorage data layer with authenticated API endpoints before handling real bookings or payments.

## 11. Testing Checklist

Run this checklist after changes:

1. Open the landing page on desktop and mobile widths.
2. Register a new account and sign out.
3. Sign in and verify the dashboard and protected-page redirect.
4. Search for a lot, open its details, and select an available slot.
5. Create a booking and verify amount, status, QR code, and booking history.
6. Cancel an eligible booking and confirm the slot becomes available.
7. Toggle the theme and reload the page.
8. Submit the contact form and verify the success message.
9. Clear browser data and confirm first-run seeding works.
10. Check the browser console for network or JavaScript errors.

For a syntax-only JavaScript check with Node.js:

```text
node --check js/storage.js
node --check js/main.js
node --check js/dashboard.js
node --check js/booking.js
node --check js/admin.js
node --check js/report.js
```

## 12. Deployment

Because this is a static site, it can be hosted by GitHub Pages, Netlify, Vercel static hosting, Azure Static Web Apps, or any web server that serves HTML, CSS, JavaScript, JSON, and SVG files.

Before deployment:

1. Confirm no `.env`, key, credential, or private data file is staged.
2. Verify all CDN URLs and map tiles are permitted for the deployment domain.
3. Test under the final HTTPS origin.
4. Configure a backend before enabling real authentication, payments, or bookings.
5. Add a privacy policy and terms appropriate to the deployment jurisdiction.

## 13. Troubleshooting

### The parking list is empty

Run the site through a local HTTP server and check that both data files are present. Clear LocalStorage and reload.

### The map is blank

Check internet access, browser console errors, Leaflet CSS loading, and the OpenStreetMap tile request. Confirm the lot latitude and longitude values are valid.

### A page redirects to login

The page is protected and no valid local session exists. Register or sign in first.

### Updated parking data is not visible

Existing LocalStorage takes precedence over seed files. Reset site data, then reload.

### Charts or QR codes do not render

Confirm the corresponding CDN library loaded successfully and that content-security or network policies are not blocking it.

## 14. Future Production Stages

1. Create a backend API and database.
2. Add server-side authentication and role management.
3. Replace mock occupancy simulation with IoT/sensor ingestion.
4. Add booking conflict checks and transactional slot locking.
5. Integrate a payment provider without exposing payment secrets in the browser.
6. Add automated unit, integration, accessibility, and end-to-end tests.
7. Add monitoring, audit logs, backups, rate limiting, and privacy controls.
8. Deploy separate development, staging, and production environments.

## 15. License And Data Notice

This repository contains prototype code and mock parking data for demonstration and educational use. Verify all external library licenses, map-attribution requirements, and local data-protection requirements before production deployment.
