# EHELP Web Client

Next.js web app for EHELP (citizen dashboard, admin, social worker).

## Setup

```bash
cd web/client
cp .env.example .env.local
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Auth & backend

Uses the same Supabase project as the mobile app:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Client helpers live in `src/lib/supabase/`:

- `client.ts` — browser / Client Components
- `server.ts` — Server Components / Route Handlers
- `middleware.ts` — session refresh + route guards

Auth mirrors mobile (`signInWithPassword`, email OTP, `signUp` with `full_name` / `role` / `phone` metadata, `profiles` lookup, sign out):

| Path | Purpose |
|------|---------|
| `/signin` | Password or email OTP |
| `/signup` | Self-register (customer, dependent, evaluator, approver) |
| `/otp` | Verify email OTP |
| `/auth/callback` | Email confirmation redirect |

Protected: `/dashboard`, `/admin`, `/social-worker`. After login, users are sent to a role home (`customer`/`dependent` → dashboard, `evaluator`/`approver` → social worker, admin roles → admin).

Add `http://localhost:3000/auth/callback` to Supabase Auth redirect URLs for local email confirmation.

### Seed a tenant admin (regions + Auth)

Tenants are rows in `regions`. A tenant admin is a Supabase Auth user with `profiles.role = satellite_admin` and `profiles.region_id` set to that region.

1. Add `SUPABASE_SERVICE_ROLE_KEY` to `.env.local` (Project Settings → API).
2. Run:

```bash
npm run seed:tenant-admin
```

Defaults: region `DEMO` / `Demo Tenant`, login `admin@demo.local` / `DemoAdmin123!`. Override with `SEED_REGION_CODE`, `SEED_REGION_NAME`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SEED_ADMIN_NAME`.

For a super admin (template + cross-region RBAC):

```bash
npm run seed:dswd-admin
```

Defaults: `dswd@demo.local` / `DswdAdmin123!`.

### Live admin surfaces

These admin pages use Supabase (not the ehelp mock store):

| Path | Who | Behavior |
|------|-----|----------|
| `/admin/rbac` | Satellite Admin | Edit `approver` / `evaluator` grants for own `region_id` |
| `/admin/rbac` | DSWD Admin | Edit any region (incl. `satellite_admin` grants); edit global `rbac_templates`; apply template to region(s) |
| `/admin/accounts` | Satellite Admin | Create Auth user + profile (`approver`/`evaluator`, pending) |
| `/admin/accounts` | DSWD Admin | Approve pending staff |
| `/admin/templates` | DSWD / Satellite | Master `program_templates` vs regional `region_templates` |

Requires `SUPABASE_SERVICE_ROLE_KEY` for staff registration from `/admin/accounts`.

Other admin pages may still use local demo state; auth sessions are live against Supabase.
