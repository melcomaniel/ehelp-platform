## 1. Database

- [x] 1.1 Widen `regional_rbac` role CHECK to include `satellite_admin`
- [x] 1.2 Create `rbac_templates` with RLS (DSWD write, authenticated read)
- [x] 1.3 Seed `rbac_templates` from DEMO grants + satellite_admin defaults
- [x] 1.4 Add `apply_rbac_template(region_id)` and region INSERT trigger
- [x] 1.5 Seed `satellite_admin` grants into every region's `regional_rbac`
- [x] 1.6 Add trigger blocking satellite_admin from mutating satellite_admin grants

## 2. Shared auth / permission lib

- [x] 2.1 Add permission enum mapping helpers (snake ↔ kebab) and DSWD fixed set
- [x] 2.2 Add admin client (service role) helper for privileged server actions
- [x] 2.3 Add `fetchStaffPermissions` + React `AdminAccessProvider` for admin shell
- [x] 2.4 Wire admin layout/sidebar to live permissions

## 3. RBAC admin UI

- [x] 3.1 Rewrite `/admin/rbac` to load/toggle live `regional_rbac`
- [x] 3.2 Region selector + satellite_admin column for DSWD admin
- [x] 3.3 Template editor + apply-to-region / apply-to-all for DSWD admin

## 4. Accounts admin UI

- [x] 4.1 Server actions: register staff (Auth + profile) and approve account
- [x] 4.2 Rewrite `/admin/accounts` to list live profiles and create/approve flows

## 5. Templates admin UI

- [x] 5.1 Server/client helpers for `program_templates` and `region_templates`
- [x] 5.2 Rewrite `/admin/templates` to use live data with master vs customize gates

## 6. Verify

- [x] 6.1 Smoke-check with demo satellite admin and DSWD paths (permissions, create user, templates)
