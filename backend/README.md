# EHELP Core (NestJS) — local MVP

Auth for **mobile** uses NestJS + Docker Postgres. Supabase Auth is no longer used.

## Stack

| Piece | Detail |
|-------|--------|
| API | NestJS on `http://localhost:3001` |
| DB | Postgres 16 via Docker Compose (**host port 5433**); domain ERD in `backend/db/migrations` |
| Auth modes | `AUTH_PROVIDER_MODE=mock` (default) or `live` |
| Mobile providers | eGov SSO · NationalID eVerify · Face Liveness |

## Per-machine local config (update on every new machine / network)

These values are **not** the same for every developer. Refresh them whenever you clone on a new laptop, change Wi‑Fi, or switch between emulator and a physical phone.

| What | Where | When to change | How |
|------|--------|----------------|-----|
| Mac / host **LAN IP** | Flutter `API_BASE_URL` | Physical phone or tablet on Wi‑Fi | `ipconfig getifaddr en0` (macOS) → e.g. `192.168.100.195` |
| Mobile API base URL | `flutter run --dart-define=API_BASE_URL=...` | Every device type / IP change | See table below |
| Optional public API URL | `backend/.env` → `PUBLIC_API_BASE_URL` | Only if mock liveness still opens `127.0.0.1` | Same LAN IP as above, e.g. `http://192.168.100.195:3001` |
| Postgres host port | `docker-compose.yml` + `backend/.env` `DATABASE_PORT` | Port **5433** already taken on that machine | Pick a free port and keep Compose + `.env` in sync |
| Nest listen port | `backend/.env` `PORT` | **3001** taken | Change `PORT` and every `API_BASE_URL` |
| Auth secrets / live gateways | `backend/.env` | Using `AUTH_PROVIDER_MODE=live` | Fill partner / eVerify / liveness keys (never commit real secrets) |
| JWT secret | `backend/.env` `JWT_SECRET` | Shared or production-like env | Replace the default before any non-local use |

### `API_BASE_URL` by device

| Device | `API_BASE_URL` |
|--------|----------------|
| iOS Simulator / desktop | `http://127.0.0.1:3001` |
| Android emulator | `http://10.0.2.2:3001` |
| Physical phone (same Wi‑Fi as host) | `http://<YOUR_LAN_IP>:3001` |

Checklist on a new machine:

1. Copy env: `cp backend/.env.example backend/.env`
2. Confirm Docker Postgres is up on the port in `.env` (`docker compose up -d`)
3. Start API: `cd backend && npm run start:dev` (binds `0.0.0.0` so phones can connect)
4. Resolve LAN IP if using a physical device
5. Run Flutter with the matching `--dart-define=API_BASE_URL=...`
6. Smoke-test from the phone browser: `http://<LAN_IP>:3001/auth/me` (expect JSON / 401, not “unreachable”)
7. If the host firewall blocks inbound connections, allow Node on port `3001`

Do **not** hard-code a teammate’s LAN IP in committed files. Prefer `dart-define` (and optional local-only `PUBLIC_API_BASE_URL` in your private `.env`).

**Important:** changing `backend/.env` (including `AUTH_PROVIDER_MODE`) does **not** always reload under `start:dev`. Fully stop Nest (Ctrl+C) and run `npm run start:dev` again. Confirm the boot line says `AUTH_PROVIDER_MODE=live` before testing the camera.

## Quick start

```bash
# 1. Start Postgres (Docker Desktop must be running)
cd "/path/to/egov-app-ground"
docker compose up -d

# 2. Backend
cd backend
cp .env.example .env   # per-machine: adjust ports / PUBLIC_API_BASE_URL if needed
npm install
npm run start:dev

# 3. Mobile — pick the URL for THIS machine + device (see table above)
cd ../mobile
# iOS Simulator / desktop
flutter run --dart-define=API_BASE_URL=http://127.0.0.1:3001
# Android emulator
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3001
# Physical Android/iOS (same Wi‑Fi) — replace with YOUR current LAN IP
flutter run --dart-define=API_BASE_URL=http://192.168.x.x:3001
```

Prefer **in-app WebView** for National ID registration liveness. Nest returns the
official HTTPS URL `https://hackathon-everify-face-liveness.e.gov.ph/?awst=…`
(top-level secure context). The app injects a bridge to capture `session_id` for
PhilSys `/api/query`. Nest HTTP pages / nested iframes will fail the camera.

### First-time vs returning

| Path | Flow |
|------|------|
| New citizen | SSO → `/onboarding` → Face Liveness → eVerify → home |
| Returning (eVerified) | SSO → home |

Dev email/password login skips PhilSys onboarding.

## Database (domain ERD)

Local Postgres schema is the **domain ERD** under `backend/db/migrations/`, applied on **first Docker boot** by `backend/db/init.sh`.

| Path | Purpose |
|------|---------|
| `backend/db/migrations/*.sql` | Ordered DDL (org → identity → programs → applications → disbursement → platform) |
| `backend/db/seed/001_bootstrap.sql` | DSWD org, central office, role catalog (auth only — no program seed) |
| `backend/db/seed/002_staff_accounts.sql` | Demo web staff (platform / org / office / evaluator / approver) |
| `backend/db/init.sh` | Orchestrator mounted into `/docker-entrypoint-initdb.d` |

**Reset schema (wipes all local data):**

```bash
docker compose down -v
docker compose up -d
```

TypeORM uses `synchronize: false` — schema changes go in SQL migrations, not entity sync.

Auth maps to `user_accounts` + `beneficiaries` / `staff_profiles` (+ `roles` / `user_role_assignments`). Supabase is **not** the source of truth for this Nest stack.

## Auth API

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/auth/egovph/sso?exchange_code=` | Partner landing → mobile deep link; `?client=web` → `{WEB_APP_URL}/auth/sso` |
| `POST` | `/auth/sso/exchange` | `{ exchange_code, client_platform }` → JWT + profile |
| `POST` | `/auth/staff` | JWT (admin) — provision staff account |
| `GET` | `/auth/staff` | JWT (admin) — list staff accounts |
| `POST` | `/auth/liveness/session` | JWT — create liveness session |
| `POST` | `/auth/liveness/session/public` | First-time before full session |
| `POST` | `/auth/liveness/verify` | JWT — verify result (≥ 95) |
| `POST` | `/auth/everify/first-time` | JWT — PhilSys verify after liveness |
| `GET` | `/auth/me` | JWT — current profile |
| `POST` | `/auth/dev/login` | Email/password for provisioned accounts (`X-Client-Platform`) |

## Platform organization management

An active, unscoped `PLATFORM_ADMIN` (`organization_id = NULL`,
`office_id = NULL`) can manage tenant lifecycle through:

| Method | Path | Purpose |
|--------|------|---------|
| `GET`, `POST` | `/admin/organizations` | List/search tenants; atomically create a tenant and initial `ORG_ADMIN` |
| `GET`, `PATCH` | `/admin/organizations/:id` | View or edit approved organization metadata |
| `POST` | `/admin/organizations/:id/suspend` | Preserve data and block tenant access; reason required |
| `POST` | `/admin/organizations/:id/reactivate` | Restore the tenant without reactivating suspended accounts |
| `POST` | `/admin/organizations/:id/archive` | Archive a suspended tenant; reason required |
| `PATCH` | `/admin/organizations/:id/admins/:adminId` | Edit approved Organization Administrator metadata |
| `POST` | `/admin/organizations/:id/admins/:adminId/suspend` | Suspend an Organization Administrator account |

Migration `010_platform_admin_organization_management.sql` adds archived
lifecycle state, SSO-compatible invitation records, normalized code/idempotency
constraints, administrative audit actions, append-only audit triggers, and admin
scope constraints. Apply it after migrations 001–009. The migration header
contains rollback DDL; roll application code back first and retain/export new
history before dropping lifecycle or audit structures.

Organization creation does not issue a password or duplicate SSO. It provisions
the government email, staff profile, `ORG_ADMIN` assignment, and a pending
invitation in one PostgreSQL transaction. Signing in through the existing eGov
SSO flow with that email accepts the invitation. Suspended accounts and staff in
suspended/archived organizations are rejected at token issuance, `/auth/me`, and
protected tenant operations, including requests using an existing JWT.

`PLATFORM_ADMIN` is explicitly denied from tenant business APIs such as
applications, beneficiary relationships, evaluation, approval, programs, and
workflows. The generic `/auth/staff` endpoint cannot be used by a Platform
Administrator to bypass atomic tenant onboarding or grant tenant business roles.

### Platform gates

Send `X-Client-Platform: mobile` or `web` (or `client_platform` on the body). Beneficiaries are mobile-only; staff/admin are web-only.

Web SSO **does not** auto-create staff — admins must `POST /auth/staff` (or use seed `002_staff_accounts.sql`) before SSO.

### Password login (staff)

Works for accounts that already have `password_hash` (seeded staff / admin-created), including when `AUTH_PROVIDER_MODE=live`. Auto-create of new beneficiary accounts via password remains **mock + mobile** only.

Demo staff (after seed): `evaluator@ehelp.local` / `Evaluator123!` with `X-Client-Platform: web`.

### Mock SSO

```bash
curl -s -X POST http://localhost:3001/auth/sso/exchange \
  -H 'Content-Type: application/json' \
  -H 'X-Client-Platform: mobile' \
  -d '{"exchange_code":"test-code-123456","client_platform":"mobile"}'
```

### Live mode (real face scan + PhilSys)

With `AUTH_PROVIDER_MODE=mock` (default), **Face Liveness does not use the camera** and **eVerify does not check a National ID** — both adapters auto-pass so local MVP works without partner credentials.

To exercise the real gateways:

1. Put staging/production credentials in `backend/.env`
2. Set `AUTH_PROVIDER_MODE=live`
3. Restart Nest (`npm run start:dev`)
4. Use a real eGov `exchange_code` from the SSO widget (mock codes will fail)

```
AUTH_PROVIDER_MODE=live
WEB_APP_URL=http://localhost:3000
EGOV_SSO_BASE_URL=...
EGOV_PARTNER_CODE=...
EGOV_PARTNER_SECRET=...
EVERIFY_BASE_URL=...
EVERIFY_CLIENT_ID=...
EVERIFY_CLIENT_SECRET=...
FACE_LIVENESS_BASE_URL=https://hackathon-face-liveness-api.e.gov.ph
FACE_LIVENESS_API_KEY=...
```

Partner SSO Base URL example:

`https://<your-host>/auth/egovph/sso?exchange_code=...`

Web: add `&client=web`. Mobile deep link: `ehelp://egovph/sso?exchange_code=...`

## Mobile notes

- **Beneficiaries only** — send `X-Client-Platform: mobile` (or `client_platform` on login body). Staff tokens get `403` with `platform: web_required`.
- Login screen can still use **password login** for accounts with a hash; mock mode also auto-creates beneficiaries.
- Production UX: hide manual login; open eGov SSO and handle `exchange_code`.
- Profile updates are locked (eGovPH source of truth).
- Domain APIs (`/applications`, `/templates`, …) are available; program seed is optional.

## Web notes

- Staff/admin portal uses the same Nest JWT (`web/client` cookie + `/api/nest` proxy).
- See `web/client/README.md` for seeded passwords and routes (`/admin`, `/staff`, `/get-app`).
