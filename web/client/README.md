# EHELP Web Client

Next.js portal for **staff and admin** personas. Beneficiaries use the Flutter mobile app (`/get-app`).

| Persona | Nest role | Home after sign-in |
|---------|-----------|--------------------|
| Platform Admin | `PLATFORM_ADMIN` | `/admin` |
| Organization Admin | `ORG_ADMIN` | `/admin` |
| Office Admin | `OFFICE_ADMIN` | `/admin` |
| Evaluator / Approver | `EVALUATOR` / `APPROVER` | `/staff` |
| Beneficiary | `BENEFICIARY` | `/get-app` (mobile CTA — not a web console) |

Auth uses Nest JWT (`X-Client-Platform: web`). Supabase Auth is **not** used for sessions.

---

## Prerequisites

- Node.js 20+
- Docker Desktop (Postgres)
- Nest Core running (`backend` on port **3001** by default)

---

## Configure

### 1. Backend (required)

```bash
cd egov-app-ground
cp backend/.env.example backend/.env
```

| Variable | Notes |
|----------|--------|
| `PORT` | Nest port (default `3001`) — web must point here |
| `DATABASE_*` | Match Docker Compose (host port **5433**) |
| `AUTH_PROVIDER_MODE` | `mock` or `live` (live credentials in private `.env` only) |
| `WEB_APP_URL` | Default `http://localhost:3000` — used when SSO callback has `?client=web` |
| `CORS_ORIGINS` | `*` is fine locally; or `http://localhost:3000` |

Staff demo users come from seed `backend/db/seed/002_staff_accounts.sql` (applied on first Postgres boot). See [`backend/README.md`](../../backend/README.md).

### 2. Web env

```bash
cd web/client
cp .env.example .env.local
```

| Variable | Required | Example |
|----------|----------|---------|
| `NEXT_PUBLIC_API_BASE_URL` | **Yes** | `http://127.0.0.1:3001` |
| `API_BASE_URL` | No | Server-side override; defaults to `NEXT_PUBLIC_API_BASE_URL` |

Do **not** put Nest secrets or JWT keys in the web `.env.local` — only the public API base URL.

If Nest runs on another host/port, update `NEXT_PUBLIC_API_BASE_URL` and restart `npm run dev`.

---

## How to run

Use **three terminals** from the repo root.

### Terminal 1 — Postgres

```bash
cd egov-app-ground
docker compose up -d
```

First boot runs migrations + seeds (org/roles + demo staff). Reset:

```bash
docker compose down -v && docker compose up -d
```

### Terminal 2 — Nest Core

```bash
cd egov-app-ground/backend
npm install
npm run start:dev
```

Confirm: `http://127.0.0.1:3001/auth/provider-mode`.

### Terminal 3 — Next.js

```bash
cd egov-app-ground/web/client
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

| Script | Purpose |
|--------|---------|
| `npm run dev` | Local portal |
| `npm run build` / `npm start` | Production build |
| `npm run lint` | ESLint |

---

## Sign in

Go to [`/signin`](http://localhost:3000/signin).

### Flow (all staff / admin personas)

1. Paste an eGov SSO `exchange_code` (or open `/auth/sso?exchange_code=…` from the partner redirect).
2. Nest returns a short-lived **`pending_login_token`** — no session cookie yet.
3. Browser opens `/auth/liveness` → Face Liveness (human presence only; not PhilSys match).
4. On pass, `POST /api/auth/login/complete` sets the httpOnly Nest cookie and routes by role.

With Nest `AUTH_PROVIDER_MODE=mock`, any exchange code works for **provisioned** staff; mock liveness auto-passes but the gate steps stay mandatory.

**Hybrid (fixture codes + real camera):** keep `AUTH_SSO_MODE=mock` and set `AUTH_LIVENESS_MODE=live` in Nest `.env`, then restart the API.

### Seeded staff (for SSO provisioning / Admin → Accounts)

| Email | Typical password (dev/login tests only) | Lands on |
|-------|------------------------------------------|----------|
| `platform@ehelp.local` | `PlatformAdmin123!` | `/admin` |
| `orgadmin@ehelp.local` | `OrgAdmin123!` | `/admin` |
| `officeadmin@ehelp.local` | `OfficeAdmin123!` | `/admin` |
| `evaluator@ehelp.local` | `Evaluator123!` | `/staff` |
| `approver@ehelp.local` | `Approver123!` | `/staff` |

Password is **not** shown in the product UI. Automated tests may still call Nest `POST /auth/dev/login` (proxied as `POST /api/auth/login`).

### eGov SSO

1. Admin provisions the staff account first (`/admin/accounts` → Nest `POST /auth/staff`), **or** use a seeded email that matches the SSO profile.
2. On `/signin`, paste `exchange_code`, **or** partner redirects to Nest:
   `GET /auth/egovph/sso?client=web&exchange_code=…`
   → `{WEB_APP_URL}/auth/sso?exchange_code=…` → `/auth/liveness` → session cookie.
3. Nest exchanges the code with `client_platform=web` and issues a pending token until liveness completes.

Web SSO **does not** auto-create staff. Missing account → “not provisioned”.

Hackathon eGov sample identities are pre-seeded (`003_egov_sso_hackathon_accounts.sql`):

| Mint test account | Nest role | After liveness |
|-------------------|-----------|----------------|
| `ssoplatform@ehelp.local` | Platform Admin | `/admin` |
| `ssoorgadmin@ehelp.local` | Org Admin | `/admin` |
| `ssoofficeadmin@ehelp.local` | Office Admin | `/admin` |
| `ssoevaluator@ehelp.local` | Evaluator | `/staff` |
| `ssoapprover@ehelp.local` | Approver | `/staff` |

Partner code when minting: **`{{partner_code}}`**. These five are web-only.

Mobile beneficiaries use Nest mock fixture codes (`beneficiary`, `beneficiary2`, `dependent`) — they work while Nest stays on `AUTH_PROVIDER_MODE=live` for ssoplatform staff SSO. See [`mobile/README.md`](../../mobile/README.md).

`/signup` is informational only (no public self-registration).

---

## Routes & Nest proxy

| Path | Who | Notes |
|------|-----|--------|
| `/` | Public | Landing (staff/admin portal + mobile CTA) |
| `/signin` | Public | SSO only → face liveness |
| `/auth/sso` | Public | SSO exchange → stores pending token → `/auth/liveness` |
| `/auth/liveness` | Public | Face liveness gate → session cookie |
| `/staff` | Evaluator / Approver | Nest case queue via cookie |
| `/admin` | Admins | Console (role-gated) |
| `/admin/accounts` | Admins with `register_accounts` | Create Nest staff |
| `/admin/organizations` | Platform Admin only | Search and manage government tenants |
| `/admin/organizations/new` | Platform Admin only | Atomically create tenant + initial Organization Administrator |
| `/admin/organizations/:id` | Platform Admin only | Tenant details, lifecycle, admins, and management audit history |
| `/admin/offices` | Organization Admin only | Search, filter, and manage offices in the admin's organization |
| `/admin/offices/new` | Organization Admin only | Create an office under the admin's organization |
| `/admin/offices/:id` | Organization Admin only | Office details, edit, hierarchy, archive, reactivation, and audit history |
| `/admin/disbursement-slots` | Org / Office Admin | Create / manage claim queue slots (≥ 2-day lead) |
| `/admin/disbursement-validate` | Office Admin | Validate claim QR + claimant face liveness |
| `/admin/appeals` | Organization Admin only | Read-only eReport grievance ledger |
| `/get-app` | Beneficiaries | Mobile app CTA |

Browser → Nest goes through Next:

| Next route | Nest |
|------------|------|
| `POST /api/auth/login` | `POST /auth/dev/login` + cookie (tests / tooling only) |
| `POST /api/auth/sso` | `POST /auth/sso/exchange` → `pending_login_token` (no cookie) |
| `POST /api/auth/liveness/session` | `POST /auth/liveness/session/login` |
| `POST /api/auth/login/complete` | `POST /auth/login/complete` + set httpOnly cookie |
| `GET /api/auth/session` | `GET /auth/me` |
| `POST /api/auth/logout` | Clear cookie |
| `/api/nest/*` | Proxies to Nest with `Authorization` from cookie |

Middleware guards `/admin`, `/staff`, `/dashboard` and redirects by role. Pending login tokens are treated as logged-out.

Organization Management is also authorized by Nest on every request; sidebar
visibility and Next middleware are not the security boundary. New Organization
Administrators activate through the same eGov SSO exchange as existing staff,
using the government email provisioned with the tenant. The browser supplies a
stable device registration identifier during that first activation. Organization
creation also submits an initial policy constrained by the mandatory MFA/device
controls and 30-minute maximum session timeout. Suspend/archive actions preserve
data and require confirmation; archive is available only after suspension and is
terminal in the UI.

Organization Administrators manage offices through Nest `/admin/offices`.
The web UI never exposes an organization selector for this flow; Nest resolves
tenant scope from the session. Office archive is soft, requires a reason, and is
disabled when active child offices exist. Reactivation restores the office to
active selectors only while the organization remains active.

---

## Troubleshooting

| Symptom | Check |
|---------|--------|
| Sign-in fails / “Nest request failed” | Nest up on `:3001`; `NEXT_PUBLIC_API_BASE_URL` in `.env.local`; restart `npm run dev` after env change |
| Stuck after SSO | Complete `/auth/liveness`; pending token expires in ~15 minutes |
| Seeded `dev/login` fails | Postgres seeded (`002_staff_accounts`); email/password exact; Nest restarted |
| 403 / sent to wrong home | Role platform gate — beneficiaries → mobile; staff → web |
| Staff SSO “not provisioned” | Create account under Admin → Accounts first |
| No Nest `[HTTP]` logs | Request never hit Nest (proxy/env); or Nest not running |
| Port 3001 in use | Stop other Nest processes; `lsof -iTCP:3001 -sTCP:LISTEN` |

---

## Related

- Mobile (beneficiaries): [`mobile/README.md`](../../mobile/README.md)
- Nest API: [`backend/README.md`](../../backend/README.md)
- Operator manual: [`docs/manual/ehelp-system-manual.md`](../../docs/manual/ehelp-system-manual.md)
