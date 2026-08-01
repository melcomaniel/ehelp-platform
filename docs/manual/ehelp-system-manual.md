# EHELP System Manual

Operator and demo guide for personas, what each can do, and how they connect in one case journey.

For PRD policy detail, see [Persona Scope & Limitations](../persona-scope-prd-alignment-summary.md) and [Beneficiary Mobile Alignment](../mobile/beneficiary-prd-alignment-summary.md).

---

## 1. System map

| Layer | What it is | Typical URL |
|-------|------------|-------------|
| **Nest Core (API)** | Auth, RBAC, applications, offices, disbursement | Local `http://127.0.0.1:3001` · Demo `https://<your-api-host>` |
| **Web portal** | Staff & admin UI (Next.js) | Local `http://localhost:3000` · Demo on Vercel |
| **Mobile app** | Beneficiaries only (Flutter) | Default API → Render URL (see `mobile/lib/config/api_config.dart`) |
| **Postgres** | Domain data | Local Docker `:5433` · Render Managed Postgres in demo |

```
Platform Admin ─────────────► Web /admin
Org / Office Admin ─────────► Web /admin
Evaluator / Approver ───────► Web /staff
Beneficiary / Dependent ────► Flutter mobile
```

**Hard rule:** Staff/admins use **web** only. Beneficiaries use **mobile** only. Nest enforces this with `X-Client-Platform` (`web_required` / mobile deny).

---

## 2. Sign-in (all personas)

Every session follows:

```
SSO exchange code  →  pending_login_token  →  Face Liveness  →  full JWT / cookie
```

| Adapter | Env | Behavior |
|---------|-----|----------|
| SSO | `AUTH_SSO_MODE` (default = `AUTH_PROVIDER_MODE`) | `mock` = seed/fixture codes; `live` = real eGov mint |
| eVerify | `AUTH_EVERIFY_MODE` | PhilSys National ID for first-time citizens |
| Liveness | `AUTH_LIVENESS_MODE` | `mock` = simulate pass; `live` = real camera |

**Demo hybrid (mock SSO + real camera):**

```text
AUTH_PROVIDER_MODE=mock
AUTH_SSO_MODE=mock
AUTH_EVERIFY_MODE=mock
AUTH_LIVENESS_MODE=live
```

Web staff are **provisioned first** (seed or Admin → Accounts). Mobile beneficiaries are **auto-created** on first successful SSO.

---

## 3. Mock SSO cheat sheet

### Web (staff / admin) — paste on `/signin`

| Code | Persona | Lands on |
|------|---------|----------|
| `platform` | Platform Admin | `/admin` |
| `orgadmin` | Organization Admin | `/admin` |
| `officeadmin` | Office Admin | `/admin` |
| `evaluator` | Evaluator | `/staff` |
| `approver` | Approver | `/staff` |

Aliases: `ssoplatform` … `ssoapprover` if seed `003_egov_sso_hackathon_accounts.sql` is loaded.

Requires seeds `001_bootstrap.sql` + `002_staff_accounts.sql` (or equivalent rows) in the database.

**Seeded office hierarchy**

```
DSWD
 └── DSWD Central Office     ← hierarchy root
     └── NCR Field / DSWD NCR ← officeadmin, evaluator, approver / ssoofficeadmin–04
```

Org Admin (`orgadmin` / `ssoorgadmin`) is **org-scoped** (no office). Office Admin applications list is scoped to the **regional** office.

### Mobile (citizens) — paste in app SSO dialog

| Code | Persona | Notes |
|------|---------|--------|
| `beneficiary` | Primary citizen (Ana Cruz Santos) | Main demo applicant |
| `beneficiary2` | Second citizen | Relationship partner |
| `dependent` | Dependent-class citizen | Same mobile app; link approved by Office Admin |

Optional prefix: `mock:beneficiary`.

---

## 4. Personas

### 4.1 Platform Admin

**Platform:** Web → `/admin`  
**Role:** Tenant / security steward — **not** a case worker.

| Can | Cannot |
|-----|--------|
| Create / suspend / reactivate / archive organizations | See beneficiary case PII |
| Manage org admins, platform RBAC, platform audit | Evaluate, endorse, approve, or reject applications |
| View platform-scoped analytics / audit | Publish program templates or run office ops |

**Flow**

1. Sign in with `platform` → liveness → `/admin`.
2. Create or manage **Organizations** and **Organization Admins**.
3. Hand off day-to-day programs and offices to Org Admin.

**Does not enter** `/staff` or case queues.

---

### 4.2 Organization Admin (`dswd_admin`)

**Platform:** Web → `/admin`  
**Role:** Owns one government tenant (e.g. DSWD): offices, programs, oversight.

| Can | Cannot |
|-----|--------|
| Manage offices in own org | Decide / endorse cases *unless also* Evaluator/Approver |
| Programs, workflows, period windows, disbursement slots | Act as Platform Admin across tenants |
| Accounts / staff provisioning (where granted) | Use `/staff` as Org Admin alone |
| Oversight lists (applications, profile changes, audit) | |

**Flow**

1. Sign in with `orgadmin` → `/admin`.
2. Ensure **Offices** exist (e.g. regional office).
3. Configure **Programs** (eligibility, cooldown, periods) and workflow templates.
4. Open **Disbursement slots** for claim scheduling (pick office when creating).
5. Provision Evaluator / Approver / Office Admin accounts as needed.

---

### 4.3 Office Admin (`satellite_admin`)

**Platform:** Web → `/admin`  
**Role:** Local office operations and relationship proof review.

| Can | Cannot |
|-----|--------|
| Office-scoped oversight, staff requests | Org-wide template publish (Org Admin) |
| Approve **relationship** requests (with proof) | Evaluate / approve applications by admin role alone |
| Local program overrides where allowed | Cross-office data |
| Claim QR validation / local disbursement ops (as granted) | |

**Flow**

1. Sign in with `officeadmin` → `/admin`.
2. Review **Profile changes** / registrations as needed.
3. Approve beneficiary↔beneficiary **relationships** after proof review.
4. Support claim day: **Validate claim QR** when citizens arrive.

---

### 4.4 Evaluator

**Platform:** Web → `/staff`  
**Role:** Case evaluation and endorsement (not final decision).

| Can | Cannot |
|-----|--------|
| Pull office evaluation queue | Approve/reject the same case they endorsed (SOD) |
| Evaluate, recommend / endorse, flag | Final approve/reject (Approver only) |
| Register / verify citizens (policy scope) | Cross office/org |

**Flow**

1. Sign in with `evaluator` → liveness → `/staff`.
2. Open queued application → review answers / docs.
3. **Recommend / endorse** (or decline path as implemented).
4. Case moves to Approver queue; Evaluator **must not** be the Approver on that case.

---

### 4.5 Approver

**Platform:** Web → `/staff`  
**Role:** Final case decision and disbursement authorization path.

| Can | Cannot |
|-----|--------|
| Approve or reject cases they did **not** personally endorse | Endorse as Evaluator without that role |
| Trigger approval messaging / claim guidance | Cross office/org |
| Authorize next steps toward claim / booking | Bypass SOD |

**Flow**

1. Sign in with `approver` → `/staff`.
2. Open recommended application.
3. **Approve** or **reject** (different user than the endorsing Evaluator).
4. On approve: SMS/in-app guidance may include claim location and disbursement window / queue booking.

---

### 4.6 Beneficiary (and Dependent)

**Platform:** Flutter mobile only  
**Role:** Self-service citizen.

| Can | Cannot |
|-----|--------|
| SSO + liveness (+ eVerify when first-time) | Use web staff/admin consoles |
| Browse/apply to programs (subject to eligibility & cooldown) | See other people’s cases |
| Track own applications; book disbursement slots | Exceed relationship limits / skip proof |
| Request relationships with proof | Claim without office validation flow |
| Claim auth (QR / liveness as implemented) | |

**Dependent** is the same mobile app and beneficiary-class account. The **link** between two citizens is approved by **Office Admin**, not by Evaluator/Approver.

**Flow (happy path)**

1. Open app → paste `beneficiary` → Face Liveness → (eVerify if new) → home.
2. Choose program → fill form → submit (may require liveness).
3. Wait while Evaluator endorses and Approver decides.
4. If approved → book a **disbursement slot** (Schedule) when window/slots allow.
5. On claim day → present claim QR; office validates; liveness/claim completion as configured.
6. After claim, **cooldown** may block re-apply until the program’s cooldown elapses.

---

## 5. End-to-end connection (one case)

How personas hand off work for a single assistance application:

```mermaid
sequenceDiagram
  participant B as Beneficiary (mobile)
  participant OA as Org Admin (web)
  participant Off as Office Admin (web)
  participant E as Evaluator (web)
  participant A as Approver (web)

  OA->>OA: Programs, periods, slots
  B->>B: SSO + liveness, apply
  E->>E: Evaluate & endorse
  A->>A: Approve or reject
  A-->>B: Notify + claim guidance
  B->>B: Book disbursement slot
  Off->>Off: Validate claim QR / claim ops
  B->>B: Complete claim
```

| Step | Who | Where | Outcome |
|------|-----|-------|---------|
| 1. Configure program & slots | Org Admin | `/admin/programs`, `/admin/disbursement-slots` | Program open; claim windows/slots exist |
| 2. Citizen applies | Beneficiary | Mobile | Application in evaluation |
| 3. Endorse | Evaluator | `/staff` | Recommended for decision |
| 4. Decide | Approver | `/staff` | Approved / rejected; SMS/in-app |
| 5. Book claim | Beneficiary | Mobile Schedule | Slot booking |
| 6. Claim day | Office Admin + Beneficiary | Web validate + mobile | Disbursed / claimed |
| 7. Relationships (optional) | Two citizens + Office Admin | Mobile request → `/admin` approve | Dependent / guardian link active |

**Separation of duties:** the user who **endorses** cannot **approve** that same application.

---

## 6. Admin vs staff surfaces (web)

| Area | Typical personas | Purpose |
|------|------------------|---------|
| `/admin` Overview | Platform / Org / Office | Dashboards |
| Organizations | Platform | Tenants |
| Offices | Org Admin | Hierarchy & office lifecycle |
| Accounts | Org / Office (as granted) | Provision staff |
| Programs & Workflows | Org Admin | Templates, periods, mobile forms |
| Applications (oversight) | Org / Office | Read-oriented lists |
| Profile changes | Org / Office | Approve citizen profile edits |
| Disbursement slots | Org / Office | Schedule claim capacity |
| Validate claim QR | Office | Counter claim |
| Audit / RBAC | Platform (and scoped admins) | Governance |
| `/staff` | Evaluator / Approver | Live case work |

---

## 7. Quick demo script

1. **Org Admin** (`orgadmin`): confirm program disbursement window + create an open slot.
2. **Beneficiary** (`beneficiary`): apply to that program.
3. **Evaluator** (`evaluator`): endorse the application.
4. **Approver** (`approver`): approve (not the same person as step 3).
5. **Beneficiary**: book slot / follow claim instructions.
6. **Office Admin** (`officeadmin`): validate claim QR on claim day.
7. Optional: `beneficiary` + `dependent` request relationship → Office Admin approves with proof.

---

## 8. Troubleshooting

| Symptom | Check |
|---------|--------|
| Web “not provisioned” | Seed `002` / Accounts; use fixture codes that match staff emails |
| Mobile 403 `web_required` | That account is staff — use web |
| Mock SSO but fake camera | Set `AUTH_LIVENESS_MODE=live` and restart Nest |
| Live SSO when you wanted mock codes | Keep `AUTH_SSO_MODE=mock` |
| Empty Render DB | Run migrations `001`–`026` + seeds on Postgres |
| App not hitting demo API | Release defaults to Render; local override needs `--dart-define` |

---

## 9. Related docs

| Doc | Use |
|-----|-----|
| [`backend/README.md`](../../backend/README.md) | Nest, DB, migrations |
| [`web/client/README.md`](../../web/client/README.md) | Web portal setup |
| [`mobile/README.md`](../../mobile/README.md) | Flutter setup |
| [Persona PRD alignment](../persona-scope-prd-alignment-summary.md) | Policy Can/Cannot |
| [Beneficiary mobile alignment](../mobile/beneficiary-prd-alignment-summary.md) | Mobile feature depth |
