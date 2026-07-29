## Context

Repository inspection found:

- `backend/src/offices/office.service.ts` already implements `requireOrgAdmin` (active `ORG_ADMIN`, `office_id` null, active organization) as the actor-scoping pattern for organization-scoped writes, and `createOfficeAdmin` as the pattern for "admin creates account, invitation row, multiple audit rows in one transaction."
- `backend/src/auth/auth.service.ts`'s generic `createStaffAccount` (`POST /auth/staff`) already lets an `OFFICE_ADMIN` create `EVALUATOR`/`APPROVER` accounts (`STAFF_CREATABLE_BY.OFFICE_ADMIN`), but always sets `status: 'active'` with no approval step — this is the gap FR-2.3 requires closing for Regional Admin-originated requests.
- `activatePendingOrganizationInvitation` (in `auth.service.ts`) already gates first login on a device fingerprint for any user with a `pending` `organization_invitations` row, but was only invoked for `ORG_ADMIN`/`OFFICE_ADMIN` erd roles.
- `rbac.policy.ts` already declares (but never consumes) `account.request_office_staff` (`OFFICE_ADMIN`, office scope) and `account.approve_org_staff` (`ORG_ADMIN`, organization scope) — these permission names anticipate exactly this feature.
- `audit_logs.action` is a Postgres CHECK constraint, rewritten wholesale by each migration that touches it (see `017_allow_office_admin_audit_action.sql`).
- The admin web console's Accounts page (`web/client/src/app/admin/accounts/page.tsx`) is already shared across `platform_admin`/`dswd_admin`/`satellite_admin` actors, gated by `useAdminAccess()`; there is no separate Office-Admin-only console page.

## Goals / Non-Goals

**Goals:**

- Let a Regional Admin request an Evaluator/Approver account for their own office without granting login access.
- Require a separate, explicit Organization Administrator approval before the account can authenticate.
- Record "requested" and "approved" as two distinct audit events.
- Reuse the existing device-registration-on-first-login mechanism rather than building a parallel one.
- Reuse the existing Accounts page and office detail page rather than building a new console.

**Non-Goals:**

- Changing the behavior of the existing `POST /auth/staff` generic staff-creation endpoint for Organization/Platform Administrators (they keep creating accounts active immediately).
- A reject/decline action for staff requests, a request-listing/notification system beyond the office detail view, or bulk approval.
- Office Admin self-service device registration UI (device fingerprint capture already happens transparently at first login for other admin account types and is reused as-is).

## Decisions

### 1. Model the request as a new office-scoped service pair, not an extension of `createStaffAccount`

`requestStaffAccount`/`approveStaffRequest` live in `office.service.ts` alongside `createOfficeAdmin`, using the same actor-scoping and transaction pattern, rather than adding a "pending" branch to `auth.service.ts#createStaffAccount`.

**Alternative considered**: add a `pending: true` flag to `createStaffAccount`. Rejected — that endpoint is intentionally generic across all `WEB_ADMIN_ERD_ROLES` and role combinations (`STAFF_CREATABLE_BY`); layering office-scoped, two-step approval semantics onto it would couple unrelated authorization models and make the "who can approve whom" question ambiguous. A dedicated pair keeps the office-scoped guard (`requireOfficeAdmin`) and the org-scoped guard (`requireOrgAdmin`) each enforcing exactly one rule.

### 2. Use `user_accounts.status = 'pending'` as the access gate, not a new table

The request creates the `user_accounts` row immediately (so it's visible in listings and email-uniqueness checks apply), but with `status: 'pending'`. The existing `assertActiveContext` in `auth.service.ts` already rejects login when `status !== 'active'`, so no new login-blocking logic is needed.

**Alternative considered**: a separate `staff_account_requests` table, only materializing `user_accounts` on approval. Rejected — it would duplicate email-uniqueness and role-assignment logic, and `user_accounts.status` already exists as exactly this kind of lifecycle flag elsewhere in the codebase.

### 3. Approval creates an `organization_invitations` row to reuse the device-registration gate

On approval, `status` flips to `active` and a `pending` `organization_invitations` row is created — the same shape `createOfficeAdmin` produces. `activatePendingOrganizationInvitation`'s erd-role gate is widened from `{ORG_ADMIN, OFFICE_ADMIN}` to also include `{EVALUATOR, APPROVER}`, so the very next login for this user is blocked until a device fingerprint is presented, exactly like a newly provisioned Office Admin.

**Alternative considered**: build a separate device-approval endpoint/table for Evaluator/Approver accounts. Rejected — `device_registrations` and the invitation-acceptance audit trail already exist and are erd-role-agnostic; only the gating condition needed to be widened.

### 4. Two audit rows, not one combined row, at both request and approval

`staff_account_requested` is written at request time; `staff_account_approved` (plus a separate `invitation_created`) at approval time — mirroring how `createOfficeAdmin` already writes three distinct audit rows (`office_admin_created`, `role_assigned`, `invitation_created`) instead of one composite row. This keeps each audit action independently filterable and matches the ticket's explicit requirement to separate "request" from "approve" in the trail.

### 5. Reuse the existing Accounts page instead of a new Office Admin console

The Accounts page already renders for `satellite_admin` with role options pre-filtered to Evaluator/Approver. Its submit handler branches: when the actor is a Regional Admin (and not also an Org/Platform Admin), it calls the new request endpoint (no password field, pending-approval copy) instead of `registerStaffAccount`. Approval is surfaced on the existing Organization Administrator office detail page as a new "Officer account requests" card, alongside the existing Regional Administrator assignment card.

**Alternative considered**: a new `/admin/office-console` route dedicated to Office Admins. Rejected as unnecessary scope for this change — the existing Accounts page already has the right authorization gating and role-aware rendering; a new console can be proposed separately if Office Admins need a broader dedicated workspace.

## Risks / Trade-offs

- **[Risk] Widening the device-registration gate to EVALUATOR/APPROVER changes login behavior for any Evaluator/Approver account provisioned through the old immediate-active `createStaffAccount` path with a stray pending invitation.** → Mitigation: the gate only activates when a `pending` `organization_invitations` row exists for that user; accounts created through the unchanged `createStaffAccount` path never get one, so their login behavior is unaffected.
- **[Risk] A Regional Admin could attempt to approve their own request if given `ORG_ADMIN` by mistake, or an Org Admin could approve a request in an office outside their organization.** → Mitigation: `approveStaffRequest` requires `requireOrgAdmin` (which asserts `office_id IS NULL`, i.e. never an Office Admin) and explicitly checks `organizationId === actor.organization_id` before starting the transaction, matching the existing `createOfficeAdmin`/`archiveRegionalOffice` cross-tenant guard pattern.
- **[Risk] A pending account with a taken email blocks a legitimate Org Admin's direct provisioning attempt for the same person.** → Mitigation: unchanged from existing behavior — `user_accounts.email` is already globally unique; this is an existing constraint, not new risk introduced by this change.

## Migration Plan

- Ship `018_office_staff_requests_audit_actions.sql` (idempotent `DROP CONSTRAINT IF EXISTS` / `ADD CONSTRAINT`, matching the pattern of every prior `audit_logs_action_check` migration) ahead of or alongside the application code; the new actions are additive to the CHECK constraint and do not affect existing audit rows.
- No backfill required — no existing data needs to move into the new `pending` staff-request state.
- Rollback: revert the application code (routes stop being called) before rolling back the migration; the CHECK constraint change is safe to leave in place indefinitely since it only adds allowed values.

## Open Questions

- Should there be an explicit "reject" action (vs. leaving a request `pending` indefinitely) for Organization Administrators? Left out of this change; can be proposed as a follow-up once real usage shows whether silent non-approval is sufficient.
- Should Regional Admins see the status of their own past requests directly (not just via the Org Admin's office detail page)? Deferred pending a decision on whether Office Admins get a dedicated console (see Decision 5).
