## Why

Regional Admins (`OFFICE_ADMIN`) have no safe way to staff their own Regional Office with Evaluators/Approvers. The only existing path (`POST /auth/staff`) creates the account **active immediately**, with no admin review and no device-registration step — a Regional Admin could unilaterally grant application-processing access. Per §4.2.B "Local Staffing & Assignment" and FR-2.3, an Office Administrator may only **request** internal-personnel accounts; final approval and device registration follow the platform's standard admin-approval flow, not the Office Admin's sole discretion.

## What Changes

- Add a Regional Admin-facing "request a new Officer account" operation, scoped to the requesting admin's own office, restricted to the `EVALUATOR`/`APPROVER` roles.
- The requested account is created `pending` (no login access) instead of `active`; it does not enter the existing immediate-activation path used by `POST /auth/staff`.
- Add an Organization Administrator "approve staff request" operation, scoped to the admin's own organization, that flips the account to `active` and opens the standard first-login device-registration gate (reusing the existing `organization_invitations` + device-registration mechanism already used for Org/Office Admin accounts).
- Record the request and the approval as two distinct, separately auditable `audit_logs` actions (`staff_account_requested`, `staff_account_approved`) so the trail shows both steps rather than a single combined event.
- Extend the existing first-login device-registration gate (previously only `ORG_ADMIN`/`OFFICE_ADMIN`) to also cover `EVALUATOR`/`APPROVER`, so approved Officer accounts go through the same device check as admin accounts.
- Update the Admin → Accounts web UI so a Regional Admin submits a request (no password, no immediate activation) instead of using the generic staff-creation form, and surface submission errors inline instead of failing silently.
- Add an "Officer account requests" section to the Organization Administrator's office detail page so pending requests can be reviewed and approved.

## Capabilities

### New Capabilities

- `office-staff-account-requests`: Regional Admin request submission for Officer (Evaluator/Approver) accounts scoped to their own office, Organization Administrator approval, pending-account activation gating, and distinct request/approval audit logging.

### Modified Capabilities

None. `organization-admin-office-management` explicitly excludes "Office Administrator account creation/assignment, Evaluator/Approver management, staff reassignment" from its scope, so this is introduced as a new capability rather than a delta to it.

## Impact

- **Backend/API:** `backend/src/offices/office.controller.ts` adds `POST /admin/offices/:officeId/staff-requests` and `POST /organizations/:organizationId/offices/:officeId/staff-requests/:userId/approve`. `backend/src/offices/office.service.ts` adds actor scoping (`requireOfficeAdmin`), request/approve service methods, and staff-request listing. `backend/src/offices/office.dto.ts` adds `CreateStaffRequestDto`.
- **Database:** migration `018_office_staff_requests_audit_actions.sql` extends `audit_logs_action_check` with `staff_account_requested` and `staff_account_approved`. No new tables — reuses `user_accounts`, `user_role_assignments`, and `organization_invitations`.
- **Authentication:** `backend/src/auth/auth.service.ts`'s `activatePendingOrganizationInvitation` first-login gate is extended to cover `EVALUATOR`/`APPROVER` erd roles.
- **Frontend:** `web/client/src/app/admin/accounts/page.tsx` (Regional Admin request submission + inline error surfacing), `web/client/src/app/admin/offices/[officeId]/page.tsx` (Organization Administrator approval UI), `web/client/src/lib/admin/offices.ts` (typed API client helpers).
- **Audit:** two new append-only audit actions recorded through the existing sanitized audit-log helper; no change to audit immutability guarantees.
- **Authorization:** every operation reloads actor, role, office/organization scope, and account status; a Regional Admin cannot request staff for another office or grant `OFFICE_ADMIN`/`ORG_ADMIN`/`PLATFORM_ADMIN` privileges through this path; an Organization Administrator can only approve requests within their own organization.
