## 1. Database

- [x] 1.1 Add migration `018_office_staff_requests_audit_actions.sql` extending `audit_logs_action_check` with `staff_account_requested` and `staff_account_approved`
- [x] 1.2 Register the migration in `backend/db/init.sh`

## 2. Backend: staff request submission

- [x] 2.1 Add `CreateStaffRequestDto` (`office.dto.ts`) restricting `role` to `evaluator`/`approver`
- [x] 2.2 Add `requireOfficeAdmin` actor guard (`office.service.ts`) scoped to the actor's own active office and organization
- [x] 2.3 Implement `requestStaffAccount`: reject a different target office, reject an archived office, reject a duplicate email, create a `pending` `user_accounts` row + `EVALUATOR`/`APPROVER` role assignment, write a `staff_account_requested` audit record
- [x] 2.4 Expose `POST /admin/offices/:officeId/staff-requests` on `OfficeController`

## 3. Backend: approval

- [x] 3.1 Implement `approveStaffRequest`: reject cross-organization approval, reject a non-pending target account, reject a target whose role assignment is not `EVALUATOR`/`APPROVER`, flip `status` to `active`, create a pending `organization_invitations` row, write distinct `staff_account_approved` and `invitation_created` audit records
- [x] 3.2 Expose `POST /organizations/:organizationId/offices/:officeId/staff-requests/:userId/approve` on `OrganizationOfficeController`
- [x] 3.3 Add `listStaffRequests`/`getStaffRequest`/`staffRequestState` helpers and surface `staff_requests` on office detail

## 4. Backend: device registration for Officer accounts

- [x] 4.1 Extend `activatePendingOrganizationInvitation`'s erd-role gate in `auth.service.ts` to cover `EVALUATOR`/`APPROVER` in addition to `ORG_ADMIN`/`OFFICE_ADMIN`

## 5. Backend tests

- [x] 5.1 `office.dto.spec.ts`: valid/invalid roles for `CreateStaffRequestDto`
- [x] 5.2 `office.service.spec.ts`: request success + rejections (different office, archived office, duplicate email)
- [x] 5.3 `office.service.spec.ts`: approval success + rejections (cross-organization, not found, not pending, wrong role)

## 6. Web UI

- [x] 6.1 `lib/admin/offices.ts`: add `requestStaffAccount`/`approveStaffRequest` client calls and `StaffRequest` type
- [x] 6.2 `admin/accounts/page.tsx`: route Regional Admin submissions through the request endpoint (hide password field, pending-approval copy) instead of the immediate-active endpoint; keep Organization/Platform Admin behavior unchanged
- [x] 6.3 `admin/accounts/page.tsx`: surface staff-account submission errors inline instead of failing silently
- [x] 6.4 `admin/offices/[officeId]/page.tsx`: add an "Officer account requests" card for Organization Administrators listing pending/active requests with an Approve action

## 7. Verification

- [x] 7.1 Run backend unit tests (`cd backend && npx jest`)
- [x] 7.2 Run backend/web type checks (`npx tsc --noEmit`) and web lint (`npx eslint`)
- [x] 7.3 Run OpenSpec validation (`openspec validate office-staff-account-requests --strict`)
