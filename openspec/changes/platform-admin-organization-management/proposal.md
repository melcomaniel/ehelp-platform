## Why

EHELP already models organizations, staff accounts, role assignments, and audit logs, but it has no safe Platform Administrator workflow for onboarding and governing tenants. This change establishes Organization as the tenant boundary and gives the shared-platform operator a narrowly scoped, server-enforced organization lifecycle without granting access to tenant business operations or beneficiary data.

## What Changes

- Add Platform Administrator-only organization list, detail, create, edit, suspend, reactivate, and archive capabilities.
- Atomically create each organization with its initial Organization Administrator, tenant-scoped `ORG_ADMIN` role assignment, and SSO-compatible activation/invitation state.
- Add Platform Administrator management of Organization Administrator metadata and account suspension.
- Reuse the existing Nest eGov SSO exchange, local-account resolution, JWT, and web cookie/proxy flow; do not add a second authentication system.
- Revalidate account and organization status on protected server operations so suspended accounts and suspended or archived tenants cannot use existing sessions.
- Enforce tenant isolation and explicitly deny Platform Administrators beneficiary, application, evaluation, approval, workflow-authoring, and disbursement operations.
- Extend the SQL schema with reversible lifecycle, invitation, idempotency, integrity, and append-only audit support while preserving historical tenant data.
- Add focused Nest APIs/services, Next.js Platform Administration pages, navigation, validation, confirmation states, and automated tests.
- Correct the development Platform Administrator seed so its `organization_id` and `office_id` are null, matching the platform-scoped role invariant.
- Ordinary administrative actions never physically delete organizations or audit history.

### Scope

In scope are the Platform Administrator-to-Organization Administrator connection, tenant lifecycle management, initial Organization Administrator onboarding, Organization Administrator account metadata/status management, SSO/session enforcement, audit logging, tenant isolation, and the required admin web UI.

Explicitly excluded are Office CRUD, Office Administrator/Evaluator/Approver management, beneficiary registration or data access, applications and documents, program/rule/workflow authoring, evaluations, approvals, disbursements, AI recommendations, permanent tenant deletion, and a full Organization Administrator dashboard.

## Capabilities

### New Capabilities

- `platform-admin-organization-management`: Platform Administrator authentication and authorization, organization lifecycle CRUD, initial Organization Administrator onboarding, administrator account management, tenant isolation, audit behavior, validation, errors, and prohibited business-data access.

### Modified Capabilities

None. The repository has no mainline specs under `openspec/specs/`; this is introduced as a new capability.

## Impact

- **Backend/API:** NestJS auth enforcement plus a new organization-management module using the existing TypeORM/Postgres architecture and standard HTTP exceptions.
- **Database:** a forward SQL migration for archived organization state, lifecycle metadata, organization invitations, idempotent creation, role/scope constraints, and append-only audit logging; existing organization, account, role, and audit tables remain the source of truth.
- **Web:** Next.js App Router pages below `/admin/organizations`, built with the existing components and `/api/nest` authenticated proxy.
- **Authentication:** existing mobile/web eGov SSO provider, exchange endpoint, local staff provisioning model, JWT validation, and httpOnly cookie integration are reused. No SSO URLs, secrets, or tokens move to browser code.
- **Authorization/security:** all organization-management handlers require an active, unscoped `PLATFORM_ADMIN`; protected operations reload the account and tenant lifecycle state. Platform Administrator access to tenant business endpoints is denied server-side.
- **Tenant isolation:** `organization_id` remains the boundary for tenant staff; `ORG_ADMIN` accounts are required to be staff assigned to exactly one organization and no office for this slice.
- **Audit:** privileged changes append sanitized before/after records. Database triggers prevent audit update/delete through ordinary database roles.
- **Migration/rollback:** apply the new ordered SQL migration after existing migrations. Rollback removes new triggers/tables/columns/constraints only after application rollback; organization history must be exported or retained before removing lifecycle/audit structures.
- **Risks and mitigations:** legacy platform seed scope is corrected idempotently; status checks may invalidate existing sessions by design; unique normalized code/email/idempotency constraints prevent duplicates; transactions prevent partial onboarding; restrictive route policies and tests mitigate privilege expansion.
