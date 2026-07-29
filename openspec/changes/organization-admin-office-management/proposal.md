## Why

EHELP already treats `organization_id` as the tenant boundary and has an `offices` table, but Organization Administrators do not have a safe way to manage their own office structure. Government tenants such as DSWD need one or more offices under the same organization so regional, provincial, municipal, city, and central operations can be represented without creating separate tenants.

Offices belong to exactly one Organization because programs, applications, staff, workflow customizations, and audit history are tenant-scoped. Organization Administrators own this lifecycle because they are the tenant-level role created by Platform Administrators and should manage tenant structure without accessing other organizations or platform lifecycle operations.

## What Changes

- Add Organization Administrator office listing, detail, creation, editing, archive/deactivation, and reactivation.
- Reuse the existing `offices` table and add only the missing fields and constraints needed for office codes, archived lifecycle metadata, and hierarchy integrity.
- Enforce server-side `ORG_ADMIN` authorization, active account status, active organization status, and tenant-scoped office access on every operation.
- Resolve `organization_id` from the authenticated actor; browser-supplied organization scope is ignored.
- Support parent-child offices within one organization and prevent self-parenting, cross-tenant parents, inactive parents, and hierarchy cycles.
- Add append-only sanitized audit records for state-changing office operations.
- Add Next.js admin UI routes under the existing `/admin` console using the established `/api/nest` proxy and component system.
- Add focused backend and web tests.

### Scope

In scope are happy-path Organization Administrator office lifecycle management, search/filter/pagination, parent-office selection, tenant isolation, validation, audit logging, SQL migration, backend APIs, web UI, tests, docs, and the narrow application/workflow guards required to prevent archived offices from receiving new work.

Explicitly excluded are Platform Administrator Organization CRUD, Office Administrator account creation/assignment, Evaluator/Approver management, staff reassignment, program-office customization, analytics dashboards, beneficiary registration, broader application or workflow redesign, rule configuration, disbursement, permanent office deletion, cross-organization office management, automatic central-office creation, and new authentication providers.

## Capabilities

### New Capabilities

- `organization-admin-office-management`: Organization Administrator authentication/authorization, tenant-scoped office lifecycle, office hierarchy, validation, duplicate code prevention, audit logging, UI behavior, and error handling.

### Modified Capabilities

None. The repository has no mainline specs under `openspec/specs/`; this is introduced as a new capability.

## Impact

- **Frontend:** Next.js App Router pages below `/admin/offices`, admin sidebar navigation for `ORG_ADMIN`, office forms/tables/details/actions using existing UI components.
- **Backend/API:** NestJS offices module/controller/service/DTO/policy helpers using the existing JWT guard, TypeORM, `DataSource.transaction`, and standard exceptions.
- **Authentication:** existing Nest JWT/eGov SSO/session flow is reused. No new provider or browser-side tenant selector is introduced.
- **Authorization:** every operation reloads actor, role, account status, and organization status. Only active tenant-scoped `ORG_ADMIN` users may write offices in their own organization.
- **Database:** migration adds office code fields, organization-scoped normalized-code uniqueness, lifecycle metadata, indexes, hierarchy integrity triggers, and office audit action support.
- **Audit:** state changes append sanitized audit rows in the same transaction where supported. Audit rows remain append-only through the existing audit trigger.
- **Tenant isolation:** reads and writes always include `office.organization_id = authenticated_organization_id`; client-provided `organization_id` is not accepted.
- **Office hierarchy:** parent offices are optional, same-tenant, active, not self, and not descendants of the child.
- **Data integrity:** one Organization to many Offices; every Office has one Organization; ordinary deletes are soft archive/deactivation only.
- **Migration/rollback:** apply the next ordered SQL migration after existing migrations. Roll back application code first; preserve/export new audit and office lifecycle history before dropping new columns/indexes/triggers if schema rollback is required.
- **Security risks and mitigations:** stale JWT claims are mitigated by server-side revalidation; forged tenant IDs are ignored; duplicate codes are constrained in the database; hierarchy cycles are blocked by service and trigger; audit payloads are sanitized.
