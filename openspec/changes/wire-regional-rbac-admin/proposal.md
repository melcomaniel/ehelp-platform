## Why

Admin RBAC, accounts, and templates UIs still run on an in-memory demo store while Supabase already has `regional_rbac`, `profiles`, `program_templates`, and `region_templates`. Regional admins and DSWD admins need live, region-scoped control so staff creation and permission changes actually take effect.

## What Changes

- Wire `/admin/rbac` to live `regional_rbac` (satellite admin: own region, approver/evaluator only; DSWD admin: any region view-only + global template).
- Wire `/admin/accounts` so satellite admins create Auth users + `profiles` (approver/evaluator, `region_id` from session) and DSWD admins approve activation.
- Wire `/admin/templates` to `program_templates` / `region_templates` (master vs regional customize).
- Add a global **RBAC template** that DSWD admin edits and can push to one or all regions (seeded into new regions on create).
- Extend regional grants so DSWD admin can configure **satellite_admin** permissions per region (not only approver/evaluator).
- Resolve admin UI capabilities from live grants instead of the mock ehelp RBAC matrix for these flows.

## Capabilities

### New Capabilities
- `regional-rbac-admin`: Region-scoped permission matrix for approver, evaluator, and satellite_admin; global template + apply-to-region.
- `internal-account-admin`: Regional staff registration (Auth + profile) and DSWD approval of internal accounts.
- `program-template-admin`: Master program templates and per-region customizations via live tables.

### Modified Capabilities
- (none — no existing specs)

## Impact

- Supabase schema: `rbac_templates` table; widen `regional_rbac` role check; seed/apply helpers; RLS for new table.
- Web client: `/admin/rbac`, `/admin/accounts`, `/admin/templates`, admin sidebar permission checks, new lib helpers/actions against Supabase.
- Auth: service-role (or privileged) path to create staff users from admin UI.
- Demo ehelp store remains for other mock admin pages until migrated separately.
