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

### Password (provisioned accounts)

Works for accounts that already have a password (seeded staff / Admin → Accounts), including when Nest is in `live` mode.

| Email | Password | Lands on |
|-------|----------|----------|
| `platform@ehelp.local` | `PlatformAdmin123!` | `/admin` |
| `orgadmin@ehelp.local` | `OrgAdmin123!` | `/admin` |
| `officeadmin@ehelp.local` | `OfficeAdmin123!` | `/admin` |
| `evaluator@ehelp.local` | `Evaluator123!` | `/staff` |
| `approver@ehelp.local` | `Approver123!` | `/staff` |

### eGov SSO

1. Admin provisions the staff account first (`/admin/accounts` → Nest `POST /auth/staff`), **or** use a seeded email.
2. On `/signin`, choose SSO and paste `exchange_code`, **or** partner redirects to Nest:
   `GET /auth/egovph/sso?client=web&exchange_code=…`
   → `{WEB_APP_URL}/auth/sso?exchange_code=…`
3. Nest exchanges the code with `client_platform=web` and sets the session cookie.

Web SSO **does not** auto-create staff. Missing account → “not provisioned”.

`/signup` is informational only (no public self-registration).

---

## Routes & Nest proxy

| Path | Who | Notes |
|------|-----|--------|
| `/` | Public | Landing (staff/admin portal + mobile CTA) |
| `/signin` | Public | Password or SSO |
| `/auth/sso` | Public | Completes web SSO exchange |
| `/staff` | Evaluator / Approver | Nest case queue via cookie |
| `/admin` | Admins | Console (role-gated) |
| `/admin/accounts` | Admins with `register_accounts` | Create Nest staff |
| `/admin/organizations` | Platform Admin only | Search and manage government tenants |
| `/admin/organizations/new` | Platform Admin only | Atomically create tenant + initial Organization Administrator |
| `/admin/organizations/:id` | Platform Admin only | Tenant details, lifecycle, admins, and management audit history |
| `/get-app` | Beneficiaries | Mobile app CTA |

Browser → Nest goes through Next:

| Next route | Nest |
|------------|------|
| `POST /api/auth/login` | `POST /auth/dev/login` + set httpOnly cookie |
| `POST /api/auth/sso` | `POST /auth/sso/exchange` + cookie |
| `GET /api/auth/session` | `GET /auth/me` |
| `POST /api/auth/logout` | Clear cookie |
| `/api/nest/*` | Proxies to Nest with `Authorization` from cookie |

Middleware guards `/admin`, `/staff`, `/dashboard` and redirects by role.

Organization Management is also authorized by Nest on every request; sidebar
visibility and Next middleware are not the security boundary. New Organization
Administrators activate through the same eGov SSO exchange as existing staff,
using the government email provisioned with the tenant. Suspend/archive actions
preserve data and require confirmation; archive is available only after
suspension and is terminal in the UI.

---

## Troubleshooting

| Symptom | Check |
|---------|--------|
| Sign-in fails / “Nest request failed” | Nest up on `:3001`; `NEXT_PUBLIC_API_BASE_URL` in `.env.local`; restart `npm run dev` after env change |
| Seeded login fails | Postgres seeded (`002_staff_accounts`); email/password exact; Nest restarted |
| 403 / sent to wrong home | Role platform gate — beneficiaries → mobile; staff → web |
| Staff SSO “not provisioned” | Create account under Admin → Accounts first |
| No Nest `[HTTP]` logs | Request never hit Nest (proxy/env); or Nest not running |
| Port 3001 in use | Stop other Nest processes; `lsof -iTCP:3001 -sTCP:LISTEN` |

---

## Related

- Mobile (beneficiaries): [`mobile/README.md`](../../mobile/README.md)
- Nest API: [`backend/README.md`](../../backend/README.md)
