# EHELP Mobile (Flutter)

Flutter client for **Beneficiaries only**. Staff and administrators use the web portal (`web/client`).

| Persona | Platform |
|---------|----------|
| Beneficiary | **This app** |
| Evaluator / Approver | Web → `/staff` |
| Platform / Org / Office Admin | Web → `/admin` |

Auth talks to Nest Core with header `X-Client-Platform: mobile`. Non-beneficiary accounts get HTTP **403** (`web_required`).

---

## Prerequisites

- Flutter SDK (stable)
- Docker Desktop (Postgres)
- Node.js 20+ (Nest Core)
- iOS Simulator, Android emulator, or a physical phone on the same Wi‑Fi as your Mac

---

## Configure

### 1. Backend (required)

```bash
cd egov-app-ground
cp backend/.env.example backend/.env
```

Edit `backend/.env` as needed:

| Variable | Default | Notes |
|----------|---------|--------|
| `PORT` | `3001` | Nest listen port |
| `DATABASE_HOST` / `DATABASE_PORT` | `localhost` / `5433` | Must match Docker Compose |
| `DATABASE_USER` / `PASSWORD` / `NAME` | `ehelp` | Match `docker-compose.yml` |
| `JWT_SECRET` | dev default | Change before shared/staging use |
| `AUTH_PROVIDER_MODE` | `mock` | `mock` = offline MVP; `live` = real eGov SSO + Face Liveness + PhilSys |
| `CORS_ORIGINS` | `*` | Fine for local |
| `PUBLIC_API_BASE_URL` | _(optional)_ | Set to `http://<LAN_IP>:3001` if mock liveness still opens `127.0.0.1` on a physical phone |
| Live credentials | empty | Only when `AUTH_PROVIDER_MODE=live` — never commit secrets |

**Important:** Changing `.env` does not always hot-reload. Stop Nest (Ctrl+C) and run `npm run start:dev` again. Confirm the boot line shows the expected `AUTH_PROVIDER_MODE`.

Full Nest docs: [`backend/README.md`](../backend/README.md).

### 2. Mobile API URL (per device / network)

There is no required committed `.env` for Flutter. Pass the Nest base URL at run time:

```bash
flutter run --dart-define=API_BASE_URL=<url>
```

Optional local reference: copy `mobile/.env.example` → notes only (Flutter still needs `--dart-define`).

| Device | `API_BASE_URL` |
|--------|----------------|
| iOS Simulator / desktop | `http://127.0.0.1:3001` |
| Android emulator | `http://10.0.2.2:3001` |
| Physical phone (same Wi‑Fi) | `http://<YOUR_LAN_IP>:3001` |

```bash
# macOS — current LAN IP
ipconfig getifaddr en0
```

After Wi‑Fi or IP changes, **re-run** with a new `--dart-define` (hot reload does not update compile-time defines).

Config is read in `lib/config/api_config.dart`.

### 3. Android cleartext (debug)

Debug builds allow HTTP to the LAN host via `android/app/src/debug/AndroidManifest.xml` (`usesCleartextTraffic`). Release builds should use HTTPS.

---

## How to run

Use **three terminals** from the repo root.

### Terminal 1 — Postgres

```bash
cd egov-app-ground
docker compose up -d
```

Default host port: **5433**. First boot applies migrations + seeds (`001_bootstrap`, `002_staff_accounts`).

Reset DB (wipes data):

```bash
docker compose down -v && docker compose up -d
```

### Terminal 2 — Nest Core

```bash
cd egov-app-ground/backend
npm install
npm run start:dev
```

Expect:

```text
EHELP Core listening on http://0.0.0.0:3001
AUTH_PROVIDER_MODE=mock|live …
HTTP request + error logging enabled …
```

Smoke-test: open `http://127.0.0.1:3001/auth/provider-mode` (or from the phone: `http://<LAN_IP>:3001/auth/provider-mode`).

### Terminal 3 — Flutter

```bash
cd egov-app-ground/mobile
flutter pub get

# Pick ONE for your device:
flutter run --dart-define=API_BASE_URL=http://127.0.0.1:3001
# flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3001
# flutter run --dart-define=API_BASE_URL=http://192.168.x.x:3001
```

---

## Auth flows (beneficiary)

| Mode | How to sign in |
|------|----------------|
| `mock` | Dev email/password on the login screen, **or** paste any long enough `exchange_code` (mock SSO synthesizes a profile) |
| `live` | Real eGov SSO → `exchange_code` → Nest `POST /auth/sso/exchange` with `client_platform=mobile` |

| Path | Flow |
|------|------|
| New citizen | SSO → onboarding → Face Liveness → eVerify → home |
| Returning (eVerified) | SSO → home |

Supabase is **not** used by the mobile app.

Partner callback (mobile deep link): Nest `GET /auth/egovph/sso?exchange_code=…` → `ehelp://egovph/sso?…`.

---

## Troubleshooting

| Symptom | Check |
|---------|--------|
| App can't reach API | Correct `API_BASE_URL` for device; Nest bound to `0.0.0.0`; firewall allows `:3001` |
| 403 `web_required` | Account is staff/admin — use the web portal |
| No Nest logs for a “failure” | Request never reached Nest (wrong host/offline), or Nest not restarted after `.env` change |
| Live SSO / camera fails | `AUTH_PROVIDER_MODE=live`, credentials in `backend/.env`, full Nest restart; mock codes fail in live mode |
| Cleartext blocked on Android | Use debug build, or HTTPS |

Backend HTTP traffic is logged as `[HTTP]` (method, path, status, `X-Client-Platform`).

---

## Related

- Web portal: [`web/client/README.md`](../web/client/README.md)
- Nest API: [`backend/README.md`](../backend/README.md)
