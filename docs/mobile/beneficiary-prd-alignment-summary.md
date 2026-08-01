# Beneficiary Mobile – PRD Alignment Summary

## Purpose

The Beneficiary Mobile module is the Flutter client for citizens applying for social assistance on the EHELP platform.

Beneficiaries register and authenticate through eGov identity services, complete program applications, manage authorized relationships, track application status, and authenticate for disbursement. Staff and administrator personas use the web portal; this document covers **mobile-only** scope.

This summary aligns the current Flutter implementation with EHelp PRD v1.4 (July 2026), focusing on §4.6 Beneficiary permissions and the mobile-relevant functional requirements (identity, applications, relationships, disbursement, notifications, offline forms, and AI advisory services).

---

## Mobile Persona Boundary

```
Platform / Org / Office Admin  →  Web /admin
Evaluator / Approver           →  Web /staff
Beneficiary                    →  Flutter mobile (this module)
```

Cross-persona **Can / Cannot** for all roles (including Dependent as beneficiary-class with relationship approval, platform PII deny, and admin no case-authority) is summarized in [Persona Scope & Limitations – PRD Alignment Summary](../persona-scope-prd-alignment-summary.md).

In the system, the mobile app sends `X-Client-Platform: mobile`. Nest rejects staff and admin accounts on this client with HTTP 403 (`web_required`). Beneficiary and Dependent both use mobile.

Evaluator offline field operations (PRD FR-10.1) are **not** part of the beneficiary mobile app. Legacy evaluator and approver screens may still exist in the Flutter tree but are unrouted and out of scope for this module.

---

## Roles and Responsibilities

### Beneficiary

The Beneficiary is the citizen applying for assistance. Their access is self-service and scoped to their own identity, applications, relationships, and disbursements.

**The Beneficiary can (PRD §4.6):**

- Register exactly one digital identity, verified against a National ID and face biometrics.
- Authenticate using PIN, OTP, or face biometrics (PRD); current build uses eGov SSO and face for onboarding and re-verification.
- View program options and eligibility guidance (PRD: AI-assisted recommendations).
- Complete a program’s dynamic application form and attach required documents.
- Download, complete, and later submit forms while offline (PRD FR-10.2).
- Submit an application after selecting a disbursement method following account verification.
- Track their own application status.
- Request authorized relationships (parent, child, guardian, dependent, guarantor, authorized representative) with proof documentation.
- Hold a maximum of three (3) active relationship connections.
- Complete disbursement authentication via QR code, face verification, and PIN.
- Receive mandatory SMS notification of final application outcome.
- Configure in-app and local device notification preferences.

**The Beneficiary cannot:**

- View any other beneficiary’s application, identity, or disbursement data.
- Influence or bypass Rule Engine eligibility evaluation.
- Convert an AI recommendation into an automatic approval.
- Exceed the three-active-relationship limit.
- Activate a relationship without **Office Admin** proof review and approval.
- Self-recover a lost account — recovery requires an administrator-assisted process.

---

## Current Implementation Status

### Identity and Authentication

**Implemented**

- Sign-in with Nest Core (`POST /auth/sso/exchange` or `POST /auth/dev/login` in mock mode).
- Session stored in secure storage; restore on app launch.
- First-time onboarding when eVerify is still required:
  1. Face Liveness (Nest session → in-app WebView / eVerify SDK path).
  2. National ID QR scan (or paste).
  3. Nest `POST /auth/everify/first-time`.
- Face re-verification from profile.
- Platform gate: non-beneficiary accounts cannot use the mobile client.

**Partial**

- eGov SSO currently accepts a pasted `exchange_code`. Partner deep-link ingest (`ehelp://egovph/sso?…`) is documented for Nest but not fully handled as an automatic Flutter route handler.
- Local PIN helpers exist in the auth service but are not used as a primary login UX.
- OTP screen remains as a stub (“OTP login removed”).
- Duplicate-account prevention relies on Nest upsert by eGov uniqid / email; the app does not surface a dedicated duplicate-identity explanation.

**Not implemented**

- Administrator-assisted account recovery (FR-2.4).
- Full PRD authentication matrix of PIN + OTP + face as first-class, equal login methods for every session.

### Applications and Program Forms

**Implemented**

- List own applications from Nest (`GET /applications/me`).
- Open application detail from Nest (`GET /applications/:id`).
- Submit an application to Nest (`POST /applications`) after face liveness when the backend has program templates / offices seeded.
- An alternate Nest-backed apply path exists (`/customer/apply`) using Nest templates and regions when available.

**Partial**

- Home program cards may still use a **local catalog** helper alongside Nest templates.
- Dynamic form fields are driven by that catalog; file “uploads” may store filenames only — no object-storage upload.
- Liveness is required in the apply UX; create-application payload may not yet fully pass liveness session identifiers to Nest in all paths.

**Not implemented**

- Offline download / complete / later submit of application forms (FR-10.2).
- Enforcing disbursement-method selection as a hard gate before submit (FR-7.1) with a successful preference save.

### Relationships

**Implemented**

- Dependents / relationships screen lists Nest relationships.
- Beneficiary can create a relationship request through Nest relationship APIs.

**Partial**

- Relationship types and listing work for basic dependent registration UX.

**Not implemented**

- Proof documentation upload for relationship requests (FR-3.2).
- Mobile UX for Evaluator validation and Approver approval status before activation.
- Hard enforcement of the maximum of three active connections in the UI (FR-3.3).
- Relationship revocation with re-verification (PRD appendix gap; not mobile-delivered).

### AI advisory and eReport

**Implemented**

- **Ask eGov AI** (`/customer/assistant`) → Nest `POST /integrations/egov-ai/assistant`.
- Mock answers when `EGOV_AI_ACCESS_CODE` is unset; live upstream when configured.
- Scoped guidance: navigation, eligible programs, period windows, queue slots, application status, cooldown — **read-only** (no apply / book / decide).
- **Report a problem** (`/customer/report`) → Nest eReport submit + list own cases; categories for aid / account / mobile issues.
- Entry from home tile and from the assistant banner.

**Partial**

- AI is advisory FAQ / status guidance, not a full eligibility recommender that ranks every program against a rule engine.
- eReport has no evidence-upload UI; geo on submit uses Nest env defaults; tracking is local case number (no rich upstream status history in-app).

**Not implemented**

- Converting an AI answer into an automatic application or approval (explicitly denied).
- OTP on citizen report submit; linking a report to a specific application ID for reopen.

### Disbursement

**Implemented**

- **Schedule** (`/customer/schedule`): list open slots, book / rebook (subject to 2-day lead).
- Program **Disbursement QR** (`/customer/programs/:id/disbursement`): booking-backed unique claim token (`EHELP|claim=…|action=disburse_claim`).
- Office Admin validates QR on web with claimant face liveness; claim completion updates Nest status.
- Program cooldown badges after claim (`disbursement_cooldown_days`).

**Partial**

- Disbursement **preference** screen (`/customer/disbursement`) exists; saving profile preference may fail because Nest treats the verified profile as locked.
- Claim auth is QR + office-side face liveness; mobile PIN as a third factor is not required in the current counter flow.

**Not implemented**

- LandBank (or Nest) disbursement channel integration (FR-7.2).
- Full PRD three-factor release of QR + face + PIN entirely on-device without office validate.

### Notifications

**Not implemented on mobile**

- Mandatory SMS of final outcome is a platform/backend concern; the app does not own or configure SMS delivery (FR-9.1).
- In-app and device notification preference settings (FR-9.2).

### Offline-First (Beneficiary)

**Not implemented**

- No local domain cache, sync queue, or conflict handling for beneficiary forms (FR-10.2).
- The app requires a reachable Nest API base URL for all beneficiary domain operations.

---

## Main User Flow (Current Build)

1. Beneficiary opens the Flutter app.
2. Beneficiary signs in with eGov SSO exchange code (mock fixtures or live).
3. If National ID eVerify is incomplete, the app opens onboarding.
4. Beneficiary completes Face Liveness (every sign-in).
5. New citizens scan or paste National ID QR; Nest completes first-time eVerify.
6. Beneficiary lands on customer home.
7. Optional: Ask eGov AI for status / programs / open slots.
8. Beneficiary views Nest-backed application list and opens details.
9. Beneficiary may open a program card and complete the apply wizard (liveness on submit).
10. After Approver decision: Schedule → book a disbursement slot.
11. Open program Disbursement QR (requires booking); Office Admin validates + liveness on claim day.
12. Cooldown may block re-apply; optional eReport grievance via Report a problem.
13. Beneficiary may open dependents and create relationship records in Nest (Office Admin approves proof).

---

## Navigation (Beneficiary)

Typical beneficiary destinations in the current router:

| Destination | Purpose |
|-------------|---------|
| Login / Register | Nest SSO |
| Onboarding | Face Liveness + National ID eVerify |
| Customer home | Greeting, programs, Nest applications list |
| Ask eGov AI | Guidance-only assistant |
| Report a problem | eReport file + own cases |
| Program apply | Form → Nest submit |
| Application detail | Nest application status |
| Schedule | Book / rebook disbursement slots |
| Program disbursement QR | Booking-backed claim token |
| Dependents | Nest relationships |
| Profile | View / face re-verify (profile field save limited) |
| Disbursement preference | Preference UI (save may be blocked) |

Routes for evaluator, approver, and dependent-home personas redirect away from staff surfaces; mobile remains beneficiary-only.

---

## Scope

### Included in current mobile delivery (or partially delivered)

- Beneficiary-only platform gate against Nest.
- eGov SSO / mock login and session restore.
- Face Liveness and National ID eVerify onboarding.
- Nest application list, detail, and create (when backend templates exist).
- Nest relationship list and create.
- Face re-verification from profile.
- eGov AI assistant (mock or live) — guidance only.
- eReport grievance file + own case list.
- Disbursement slot booking and booking-backed claim QR.
- Program cooldown awareness after claim.
- Runbooks for `API_BASE_URL` and Nest Core (`mobile/README.md`).

### Not included (PRD gaps or intentional non-mobile scope)

- PIN and OTP as primary, production login methods.
- SSO deep-link auto-exchange in Flutter.
- Administrator-assisted account recovery.
- Live Nest program template catalog fully replacing demo home cards (where still static).
- Real document upload to object storage.
- Offline form download / fill / sync submit.
- LandBank disbursement channel.
- On-device QR + face + PIN without office counter validation.
- eReport evidence upload and rich upstream status history.
- Relationship proof document upload UX and hard UI cap of three active relationships.
- Mandatory SMS and in-app notification preferences.
- Evaluator / Approver / Admin features on mobile.
- Provincial / municipal office hierarchy management (admin domain).
- Program template authoring, workflow design, and rule configuration (web admin).

---

## Access Control

The system checks the Nest JWT role and platform header for the logged-in user.

This ensures that:

- Only Beneficiary (`customer` / `BENEFICIARY`) accounts continue into customer routes.
- Staff and admin accounts receive a platform error and must use the web portal.
- Beneficiaries only see their own applications and relationships through Nest-scoped APIs.
- Verified profile fields remain locked after eVerify; the app cannot treat the profile as freely editable personal registry data.

Suspended or invalid Nest sessions clear local tokens and return the user to sign-in.

---

## Sample End-to-End Path (Aligned vs Demo)

**Aligned path (identity + Nest cases + claim)**

```
Beneficiary
└── Nest user_accounts + beneficiaries
    ├── Face Liveness session
    ├── National ID eVerify (first-time)
    ├── Applications (list / detail / create)
    ├── Schedule booking → claim QR
    ├── Office validate + claim liveness (web)
    ├── eGov AI guidance (optional)
    ├── eReport grievance (optional)
    └── Relationships (list / create → Office Admin approve)
```

**Still demo / partial**

```
Beneficiary home
└── Program cards may still use catalog helpers
    ├── File “uploads” may store filenames only
    └── Preference save may be blocked on verified profile
```

---

## PRD Alignment Summary

The Beneficiary Mobile module follows this product structure:

- The Flutter app is the **Beneficiary** client only.
- Identity verification is delegated to eGov SSO, Face Liveness, and National ID eVerify through Nest — matching the PRD direction to avoid harvesting PhilSys data outside eGov services.
- Application tracking, slot booking, claim QR, AI guidance, and eReport grievances are Nest-backed.
- Offline forms, LandBank channel, notification preferences, and some catalog/upload polish remain **open gaps** relative to PRD FR-7.2 / FR-9 / FR-10.2.
- Evaluator offline work and all admin personas remain on **web**, not mobile.

Example:

```
eGov SSO / Nest
└── Beneficiary (Flutter)
    ├── Onboarding (Liveness + National ID eVerify)     ← delivered
    ├── Applications list / detail / submit             ← delivered / partial
    ├── Schedule + claim QR (office validate)           ← delivered
    ├── eGov AI guidance                                ← delivered (advisory)
    ├── eReport grievance                               ← delivered (file + list)
    ├── Relationships                                   ← partial
    ├── Offline forms                                   ← gap
    ├── LandBank channel                                ← gap
    └── SMS + notification preferences                  ← gap
```

This setup keeps citizen self-service on mobile while Organization, Office, Evaluator, and Approver responsibilities stay in the web portal, consistent with the platform’s persona split.
