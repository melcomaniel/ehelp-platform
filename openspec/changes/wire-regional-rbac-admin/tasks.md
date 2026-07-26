## 1. Database

- [x] 1.1 Create `rbac_global_grants` for platform-owned defaults
- [x] 1.2 Create `office_rbac_grants` for office-scoped effective grants
- [x] 1.3 Seed `rbac_global_grants` with satellite_admin, approver, and evaluator defaults
- [x] 1.4 Seed `office_rbac_grants` for active offices from global defaults
- [x] 1.5 Enforce Office Admin write restrictions in the Nest RBAC service

## 2. Shared auth / permission lib

- [x] 2.1 Add permission enum mapping helpers (snake ↔ kebab) and DSWD fixed set
- [x] 2.2 Add Nest client/server helpers for authenticated admin API calls
- [x] 2.3 Add `fetchStaffAccess` + React `AdminAccessProvider` for admin shell
- [x] 2.4 Wire admin layout/sidebar to live permissions

## 3. RBAC admin UI

- [x] 3.1 Rewrite `/admin/rbac` to load/toggle Nest-backed `office_rbac_grants`
- [x] 3.2 Office selector + satellite_admin column for Organization Admin
- [x] 3.3 Global defaults editor for Platform Admin
- [x] 3.4 Apply-to-office / apply-to-all for Organization Admin

## 4. Accounts admin UI

- [x] 4.1 Server actions: register staff through Nest `/auth/staff`
- [x] 4.2 Rewrite `/admin/accounts` to list live Nest staff accounts and create flows

## 5. Templates admin UI

- [x] 5.1 Server/client helpers for `program_templates` and `region_templates`
- [x] 5.2 Rewrite `/admin/templates` to use live data with master vs customize gates

## 6. Verify

- [x] 6.1 Smoke-check with demo Platform, Organization, and Office admin paths (permissions, create user, templates)
