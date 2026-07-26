## Context

Auth and staff administration for the web console are live against the Nest backend (`user_accounts`, `roles`, `user_role_assignments`, `staff_profiles`, `organizations`, and `offices`). RBAC for admin surfaces is stored in backend-owned grant tables. Template administration still uses Supabase `program_templates` and `region_templates` with existing RLS and server-action permission checks.

## Goals / Non-Goals

**Goals:**
- Live permission matrix for office staff roles and office admins.
- Global RBAC defaults editable by Platform Admin and applyable by Organization Admins to one or all offices in their organization.
- Office Admin creates office staff (approver/evaluator) bound to their `office_id`.
- Organization Admin creates Office Admin, Approver, and Evaluator accounts inside their organization.
- Live master templates + regional customizations.

**Non-Goals:**
- Migrating remaining ehelp mock pages (applications, audit, etc.) off the demo store.
- Customer/dependent self-service RBAC.
- Mobile app UI changes (shared tables only).

## Decisions

### 1. Use backend-owned office grant tables
- `rbac_global_grants` stores platform-level defaults for `satellite_admin`, `approver`, and `evaluator`.
- `office_rbac_grants` stores effective grants for one office.
- **Why**: The current web admin model uses Nest organizations/offices as the tenant and staff boundary, so RBAC enforcement belongs next to the Nest-authenticated staff endpoints.
- **Alt**: Keep Supabase `regional_rbac` as the grant source. Rejected for this slice because it would duplicate the office model and require translating Nest office IDs back into legacy region rows.

### 2. Global defaults + apply operations
- Rows: `(role, permission)` for `satellite_admin` | `approver` | `evaluator`.
- `Platform Admin` edits `rbac_global_grants`.
- `Organization Admin` applies defaults to one office or all active offices in their organization.
- Applying defaults replaces the target office's `office_rbac_grants` rows from `rbac_global_grants`.
- **Alt**: Template only as code constants — loses runtime customization.

### 3. Permission resolution in the web app
- `platform_admin`: fixed platform capability set in code.
- `dswd_admin` / Organization Admin: fixed organization capability set in code.
- Office Admin: current implementation allows the fixed Office Admin set when no Supabase regional grants are present, and the Nest RBAC API enforces office scope for grant writes.
- Evaluator/Approver: fixed staff-console capability set.
- Map DB `snake_case` ↔ UI `kebab-case` in one helper.
- Admin sidebar / pages use a small React context loaded from the current session profile.

### 4. Staff user creation via Nest
- Organization Admin submits email, name, role (`satellite_admin` | `approver` | `evaluator`), and temporary password.
- Office Admin submits email, name, role (`approver` | `evaluator`), and temporary password.
- Nest verifies the authenticated actor, reloads persisted account/tenant state, derives `organization_id` and `office_id` from the actor unless explicitly provided by an authorized Organization Admin, creates an active `user_accounts` row, creates `staff_profiles`, and assigns the role.
- Staff are active on create in this implementation; `approveStaffAccount` remains a compatibility no-op in the web client.

### 5. Office admins cannot edit their own role's grants
- The UI only exposes approver/evaluator columns for Office Admins.
- The Nest RBAC service rejects `satellite_admin` grant writes by an Office Admin for defense in depth.

### 6. Templates wiring
- Organization Admin: CRUD `program_templates` when they have `manage_templates`.
- Office Admin: read masters; upsert `region_templates` for their mapped `region_id` when they have `customize_templates`.

## Risks / Trade-offs

- **[Risk]** Staff provisioning over-grants roles → **Mitigation**: Nest uses persisted actor role and `STAFF_CREATABLE_BY` server-side; client role options are only convenience.
- **[Risk]** Apply defaults overwrites local office tweaks → **Mitigation**: Confirm dialog for apply-all; optional “apply only missing grants” later.
- **[Risk]** Mock and live `can()` diverge in sidebar for other pages → **Mitigation**: Live permission provider for admin shell; leave mock for non-wired pages’ internal gates.
- **[Trade-off]** Hardcoded admin perms vs DB — simpler and safer for top-level operators; role-specific office grants remain configurable.

## Migration Plan

1. Apply backend migration: create `rbac_global_grants`, create `office_rbac_grants`, seed defaults into active offices.
2. Ship Nest `/admin/rbac/*` and `/auth/staff` endpoints plus rewired web pages.
3. Rollback: drop backend grant tables and revert UI to mock (feature-flag optional).

## Open Questions

- None blocking — staff are active on create for v1 and use temporary password or web SSO email matching.
