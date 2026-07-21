## Context

Auth is live against Supabase (`profiles`, roles, regions). Admin domain UIs still use the client-side ehelp mock store. Supabase already has `regional_rbac` (approver/evaluator only, per region), `program_templates`, and `region_templates` with RLS that matches the intended admin split (DSWD vs satellite).

## Goals / Non-Goals

**Goals:**
- Live permission matrix for regional staff roles and satellite admins.
- Global RBAC template editable by DSWD admin, applyable to regions, auto-seeded on new regions.
- Satellite admin creates regional staff (approver/evaluator) bound to their `region_id`.
- DSWD admin approves pending internal accounts.
- Live master templates + regional customizations.

**Non-Goals:**
- Migrating remaining ehelp mock pages (applications, audit, etc.) off the demo store.
- Customer/dependent self-service RBAC.
- Mobile app UI changes (shared tables only).

## Decisions

### 1. Extend `regional_rbac` instead of a separate admin-grants table
- Allow `satellite_admin` in the role CHECK alongside `approver` / `evaluator`.
- **Why**: Same RLS pattern (`dswd_admin` any region; `satellite_admin` own region). Avoids dual permission stores.
- **Alt**: Separate `admin_rbac` — clearer separation but more join/policy surface.

### 2. Global `rbac_templates` + apply function
- Rows: `(role, permission)` for `satellite_admin` | `approver` | `evaluator`.
- `apply_rbac_template(region_id)` replaces that region's `regional_rbac` rows from the template.
- Trigger / seed on `regions` INSERT calls apply.
- DSWD UI: edit template; “Apply to region” / “Apply to all regions”.
- **Alt**: Template only as code constants — loses runtime customization.

### 3. Permission resolution in the web app
- `dswd_admin`: fixed full capability set in code (not stored in `regional_rbac`).
- Other staff: `SELECT permission FROM regional_rbac WHERE region_id = profile.region_id AND role = profile.role`.
- Map DB `snake_case` ↔ UI `kebab-case` in one helper.
- Admin sidebar / pages use a small React context loaded from Supabase for the session user.

### 4. Staff user creation via server action + service role
- Satellite admin submits email, name, role (`approver`|`evaluator`), temporary password (or invite).
- Server verifies caller has `register_accounts` for their region, then `auth.admin.createUser` + profile update (`region_id`, role, `validation_status = pending`).
- DSWD admin with `approve_accounts` sets `validation_status = validated`.
- **Alt**: Edge function — better for mobile later; server action is enough for web now.

### 5. Satellite admins cannot edit their own role’s grants
- RLS already allows satellite to write own region's `regional_rbac`, but app UI only exposes approver/evaluator columns for them.
- Optional DB trigger: reject satellite_admin updates where `role = 'satellite_admin'` — add for defense in depth.

### 6. Templates wiring
- DSWD: CRUD `program_templates`.
- Satellite: read masters; upsert `region_templates` for own `region_id` only (RLS already enforces).

## Risks / Trade-offs

- **[Risk]** Service role misuse in server actions → **Mitigation**: Always re-check caller session + permission before admin SDK calls; never expose service key to client.
- **[Risk]** Apply-template overwrites local regional tweaks → **Mitigation**: Confirm dialog; optional “apply only missing grants” later.
- **[Risk]** Mock and live `can()` diverge in sidebar for other pages → **Mitigation**: Live permission provider for admin shell; leave mock for non-wired pages’ internal gates.
- **[Trade-off]** Hardcoded `dswd_admin` perms vs DB — simpler and safer (no lock-out of super admin via bad template edits).

## Migration Plan

1. Apply Supabase migration: widen CHECK, create `rbac_templates`, seed from DEMO region + satellite defaults, `apply_rbac_template`, region INSERT trigger, seed satellite_admin rows per region, write-guard trigger.
2. Ship web lib + rewired pages.
3. Rollback: drop new objects / restore CHECK; revert UI to mock (feature-flag optional).

## Open Questions

- None blocking — invite-only vs temp password: use temp password for v1 (matches seed script style).
