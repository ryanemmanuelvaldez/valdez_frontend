# RentEase frontend

This folder contains the React/Vite rental browser and account workspaces. It uses the RentEase API in `../BackendLL` when that backend is available. The public browse page remains visible without the backend and shows clearly labeled sample rentals in preview mode; sign-in, registration, and live data still require the API.

## Frontend structure

```text
src/
├── components/BrandLogo.jsx  # Shared RentEase logo mark and wordmark
├── data/demoListings.js      # Local-only cards for backend-free UI preview
├── lib/api.js                # Shared API, upload, and property-photo helpers
└── main.jsx                  # App routes, screens, and workspace composition
styles.css                    # Responsive application styles and brand theme
```

See the project-root [SYSTEM-DESIGN.md](../SYSTEM-DESIGN.md) for the feature requirements, sitemap, interface layouts, ER diagram, schema fields, and checking demonstration steps.

## Local setup

1. Install frontend dependencies with `npm install` from `Frontend`.
2. Start the React development server with `npm run dev` and open the URL it prints (usually `http://localhost:5173`).
3. To preview the public UI, the backend is optional: if its API is unreachable, the browse page uses sample listings. Start Apache/XAMPP and the backend database to use live listings, accounts, and workspace actions. The Vite dev server proxies `/BackendLL` API requests to the local Apache backend.
4. For Apache-only hosting, run `npm run build` and open `http://localhost/FinalProjects/Frontend/dist/`.

## Integrations

RentEase analytics use Chart.js line graphs for confirmed monthly rental income and sales forecasts. Forecasts remain estimates based on recorded payment history.

Property cards can show a Google Maps Embed API preview of the rental address. Owners can set or move saved property pins in the property forms; the owner and admin overview maps show every saved property coordinate. Copy `Frontend/.env.example` to `Frontend/.env.local`, set `VITE_GOOGLE_MAPS_API_KEY` to a Google Maps API key, enable both Maps Embed API and Maps JavaScript API for its Google Cloud project, and restart Vite or rebuild the frontend. The browser bundle includes the key, so restrict it to these APIs and the frontend's HTTP referrers in Google Cloud Console. If the JavaScript API is unavailable, the coordinate fields remain editable and the map displays the API error.

For deployment, set `VITE_API_BASE_URL` in the frontend host's build environment to the backend URL (for example, `https://your-backend.example.com` or `https://your-backend.example.com/api`); the frontend adds `/api` when it is not already present. Leave it blank for the local XAMPP/Vite setup; the app then uses the existing relative backend path. Vite environment values are embedded at build time, so rebuild/redeploy the frontend after changing this value. If frontend and backend use different origins, set the backend `API_ALLOWED_ORIGINS` to the exact frontend origin and configure credentialed CORS plus secure session cookies (`SESSION_COOKIE_SAMESITE=None` for cross-site hosting); production cookies are marked Secure automatically.

Property coordinates are saved in the `rentals` table by migration `023_add_rental_coordinates.php`. Run `C:\xampp\php\php.exe BackendLL\lava db:migrate` from the project root after pulling these changes.

## Backend setup

1. Create a MySQL database named `rentease` (or use another name in your environment settings).
2. Copy `BackendLL/.env.example` to `BackendLL/.env` and set the database connection values and the single administrator's `ADMIN_EMAIL` and `ADMIN_PASSWORD`. For Gmail code delivery, enable Google 2-Step Verification, create a Google App Password, and set `GMAIL_SMTP_USERNAME` to the app's sending Gmail address and `GMAIL_SMTP_APP_PASSWORD` to that App Password (not the Gmail sign-in password). Optionally set `GMAIL_FROM_ADDRESS` to that account or a Gmail alias. Gmail uses SMTP port 587 with STARTTLS by default. This sender account delivers reset codes to the email address submitted by an active tenant, owner, or admin account; users do not need to share the sender Gmail account. Keep `.env` private.
3. From `FinalProjects`, run `C:\xampp\php\php.exe BackendLL\lava db:migrate`. This creates the shared account, rentals, email-code, and rental-payment tables and adds the administrator as one row in `users`; there is no separate admin account store or setup command.
4. Start Apache/XAMPP and visit the frontend. Register a property owner account; an admin must verify it before that owner can submit rentals. The admin reviews rental submissions and can feature published listings.
5. To accept online payments, set `XENDIT_SECRET_KEY`, `XENDIT_WEBHOOK_TOKEN`, and `XENDIT_MODE=test` in `BackendLL/.env`, and set `FRONTEND_URL` to the public frontend URL. Register `/BackendLL/api/webhooks/xendit` in Xendit and configure the callback token. Use test-mode credentials and a publicly reachable webhook for end-to-end testing; never put gateway secrets in React or commit them.

The UI uses the backend session cookie for registration, login, session restore, and logout. Tenant and owner workspaces separate overview, rentals/listings, requests, and profile pages into their own routes. Verified property owners can submit bedspacer, room, or apartment rentals with pricing, address, room count, capacity, furnishing, availability, amenities, contact, and a JPG/JPEG selected from their device (up to 5 MB). The backend verifies the actual image type and dimensions, stores it outside the public web root with a random filename, and protects photos for pending listings so only the owner and admins can view them. Bedspacer listings require a bed count. Submissions require admin approval before appearing publicly. Admins can verify owner accounts, approve or reject listings, and feature published rentals.

Signed-in tenants can send a rental request from an approved listing using a move-in date, occupant count, rental term, and optional note to the owner; a move-out date is not required. Owners can approve or decline pending requests. After approval, the tenant can pay the first month plus security deposit or later installments through Xendit using GCash or Maya; only a server-verified successful payment callback marks an online payment paid. For an in-person wallet transfer, the owner generates/downloads their official GCash or Maya QR in the wallet app and saves it in the owner workspace. Tenants only scan the owner's saved QR and report the transfer; it stays pending until the owner confirms receipt. The owner can also record cash received. A browser return URL alone is not treated as proof of online payment. Online checkout remains unavailable until Xendit credentials and a webhook are configured.

Tenant workspace pages have separate routes: `#tenant/dashboard`, `#tenant/browse`, `#tenant/requests`, `#tenant/payments`, `#tenant/updates`, and `#tenant/profile`. Tenants can view current and upcoming installments, confirmed payment history, and review completed rentals. Owner workspace pages use `#owner/dashboard`, `#owner/listings`, `#owner/requests`, `#owner/updates`, and `#owner/profile`. Both roles can read audience-specific announcements and submit support tickets; admin replies and ticket status are visible in the same page.

Before submitting a rental request, tenants review the read-only rental request and privacy agreement, which summarizes the selected property, listed rent and deposit, requested term, request approval/payment conditions, and personal-data handling under the Philippines Data Privacy Act (RA 10173). The required checkbox is validated by the backend, which records the agreement version and acceptance timestamp on the request. This request-stage notice is not a substitute for a final lease between the tenant and property owner.

Admins can create, edit, and delete tenant/owner accounts and property listings from the admin workspace. Admin-created owners are verified; the sole administrator account cannot be edited or deleted there. Accounts or listings with an active or completed payment cannot be deleted, preserving transaction history.

The remaining admin screens are connected to the database: reservation monitoring and decisions, review moderation, support ticket replies/status/priority, announcement publishing and editing, audit history, platform analytics, payment/reservation CSV exports, and platform settings. Monthly rent installment checkouts use the same Xendit verification flow as the initial move-in payment. A return from checkout alone never marks a payment as paid.

Confirmed sales analytics use `BackendLL/app/models/Sales_model.php`. Its `rental_payments` base table is created by migration `010_create_rental_payments_table.php`, and its paid installment queries use `rental_installments` created by migration `011_create_admin_tools_and_rent_schedule.php`. Admin sales cover all owners; `GET /BackendLL/api/owner/sales-analytics` is restricted to the signed-in, verified owner's own payments. `GET /BackendLL/api/admin/sales-analytics` returns platform-wide sales, owner totals, and a three-month linear-trend projection from the previous six completed months. Projections are estimates, not guaranteed income.

The main endpoints are:

- `POST /BackendLL/api/auth/register`
- `POST /BackendLL/api/auth/login`
- `GET /BackendLL/api/auth/me`
- `POST /BackendLL/api/auth/logout`
- `POST /BackendLL/api/auth/send-code` with `{ "email": "user@gmail.com" }` (send verification code)
- `POST /BackendLL/api/auth/verify` with `{ "email": "user@gmail.com", "code": "123456" }`
- `POST /BackendLL/api/auth/forgot-password` with `{ "email": "user@gmail.com" }` (send a reset code to the registered address of an active tenant, owner, or admin account)
- `POST /BackendLL/api/auth/reset-password` with email, code, `password`, and `password_confirmation`
- `GET /BackendLL/api/listings` (optional `?type=bedspacer|room|apartment`)
- `POST /BackendLL/api/listings` and `GET /BackendLL/api/owner/listings` (verified owner)
- `POST /BackendLL/api/listings/{id}/requests` and `GET /BackendLL/api/tenant/requests` (tenant)
- `POST /BackendLL/api/tenant/requests/{id}/checkout` and `GET /BackendLL/api/tenant/payments` (tenant; online checkout requires Xendit configuration)
- `GET /BackendLL/api/tenant/installments` and `POST /BackendLL/api/tenant/installments/{id}/checkout` (tenant; monthly rent schedule and online checkout)
- `POST /BackendLL/api/tenant/requests/{id}/physical-payment` and `/api/tenant/installments/{id}/physical-payment` (tenant; report an owner-QR GCash/Maya transfer)
- `GET/POST /BackendLL/api/owner/payment-profile` and `GET /BackendLL/api/owner/payments` (verified owner; manage official wallet QR images and review payments)
- `POST /BackendLL/api/owner/payments/{id}/settle` (verified owner; confirm/reject wallet transfer or record cash)
- `GET/POST /BackendLL/api/tenant/reviews` and `/BackendLL/api/tenant/tickets` (tenant)
- `GET /BackendLL/api/tenant/announcements` and `/BackendLL/api/owner/announcements` (role-targeted updates)
- `POST /BackendLL/api/webhooks/xendit` (Xendit callback-token checked and payment verified server-to-server)
- `GET /BackendLL/api/owner/requests` and `POST /BackendLL/api/owner/requests/{id}/review` (owner)
- `/BackendLL/api/admin/users` and `/BackendLL/api/admin/listings` (admin only; create, update, delete)
- `/BackendLL/api/admin/owners` (admin only; owner verification)
- `/BackendLL/api/admin/reservations`, `/reviews`, `/support-tickets`, `/announcements`, `/audit-logs`, `/analytics`, `/reports`, and `/settings` (admin only)

Verification and password-reset codes expire after 10 minutes, allow at most five guesses, and can be requested once per minute for the same account and purpose. Unknown account emails receive generic success responses for code-sending requests. Configure Gmail SMTP before using these endpoints; Gmail requires 2-Step Verification and an App Password. The user profile displays email verification separately from property-owner verification.
