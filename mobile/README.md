# EHELP Mobile (Flutter)

Flutter mobile client for Approver, Evaluator, Customer, and Dependent roles.

This package lives in the `egov-app-ground` monorepo under `mobile/`.

## Setup

```bash
cd mobile
flutter pub get
flutter run
```

## Auth & backend

- Supabase Auth + Postgres (project configured in `lib/config/supabase_config.dart`)
- Edge functions under `supabase/functions/`
  - `register-customer`
  - `liveness-create-session`
  - `liveness-verify-result`

Set Face Liveness secrets in Supabase (never commit keys):

```
FACE_LIVENESS_API_KEY=...
FACE_LIVENESS_BASE_URL=https://hackathon-face-liveness-api.e.gov.ph
FACE_LIVENESS_MIN_CONFIDENCE=80
```

## Roles

| Role | Capabilities |
|------|----------------|
| Approver | Approve/decline applications, act on recommendations |
| Evaluator | Register customers, submit applications, recommend priority |
| Customer | Apply, records, disbursement preference, dependents |
| Dependent/Guarantor | Linked-only access after validation |
