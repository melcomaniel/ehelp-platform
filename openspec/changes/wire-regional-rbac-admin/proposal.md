## Why

Admin RBAC, accounts, and templates UIs have been moved away from the in-memory demo store. The current implementation uses the Nest-backed organization/office model for web staff accounts and RBAC, while template management continues to use the existing Supabase `program_templates` and `region_templates` tables. Platform, Organization, and Office administrators need live, scoped control so staff creation, permission changes, and template edits actually take effect.

## What Changes

- Wire `/admin/rbac` to Nest-backed `office_rbac_grants` and `rbac_global_grants` (Office Admin: own office, approver/evaluator only; Organization Admin: organization offices + apply global defaults; Platform Admin: global defaults).
- Wire `/admin/accounts` so Organization Admins create Office Admin, Approver, and Evaluator Nest staff accounts, while Office Admins create Approver and Evaluator accounts for their own office.
- Wire `/admin/templates` to `program_templates` / `region_templates` (master vs regional customize).
- Add a global **RBAC defaults** matrix that Platform Admin edits and Organization Admins can apply to one or all offices in their organization.
- Extend office grants so Organization Admins can configure **Office Admin** permissions per office (not only approver/evaluator).
- Resolve admin UI capabilities from the live Nest/Supabase session model instead of the mock ehelp RBAC matrix for these flows.

## Capabilities

### New Capabilities
- `regional-rbac-admin`: Office-scoped permission matrix for approver, evaluator, and office admin; global defaults + apply-to-office.
- `internal-account-admin`: Scoped Nest staff registration for office and organization administrators.
- `program-template-admin`: Master program templates and per-region customizations via live tables.

### Modified Capabilities
- (none — no existing specs)

## Impact

- Backend schema: `rbac_global_grants` and `office_rbac_grants`, seeded from platform defaults into active offices.
- Backend API: Nest `/admin/rbac/*` endpoints and `/auth/staff` for scoped staff directory/provisioning.
- Web client: `/admin/rbac`, `/admin/accounts`, `/admin/templates`, admin sidebar permission checks, new lib helpers/actions against Nest and Supabase as appropriate.
- Auth: authenticated Nest path to create staff users from admin UI.
- Demo ehelp store remains for other mock admin pages until migrated separately.
