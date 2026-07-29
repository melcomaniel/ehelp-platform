## 1. Repository and Specification

- [x] 1.1 Inspect repository instructions, architecture, frontend routing, backend modules, SQL migrations, authentication/authorization, mobile eGov SSO, role/account/organization/audit models, admin UI patterns, tests, and requested documentation terms
- [x] 1.2 Create proposal, delta specification, technical design with diagrams, and this implementation checklist
- [x] 1.3 Validate the OpenSpec change and resolve all specification errors before product-code changes

## 2. Database Schema and Migration

- [x] 2.1 Add reversible migration for archived lifecycle state, normalized code uniqueness, lifecycle metadata, creation idempotency, and indexes
- [x] 2.2 Add invitation/activation persistence with duplicate-active-invitation prevention
- [x] 2.3 Extend audit schema and add database enforcement that audit records are append-only
- [x] 2.4 Add database scope invariants for Platform Administrator and Organization Administrator roles and repair the existing Platform Administrator seed scope
- [x] 2.5 Add/update TypeORM entities and register them without enabling schema synchronization

## 3. Authorization and Authentication

- [x] 3.1 Implement reusable active account, role-scope, and tenant-status resolution for protected requests
- [x] 3.2 Reuse existing eGov SSO staff resolution and mark matching organization invitations accepted without duplicating OAuth logic
- [x] 3.3 Enforce suspended/archived account and organization denial at login, session lookup, and protected operations
- [x] 3.4 Enforce Platform Administrator denial from beneficiary/application/evaluation/approval/program/workflow/disbursement business operations
- [x] 3.5 Add unit tests for permission, role/scope resolution, existing-session status enforcement, and tenant isolation

## 4. Organization Service and API

- [x] 4.1 Add organization DTOs, normalization, validation, pagination, lifecycle transition, error-mapping, and audit-sanitization utilities
- [x] 4.2 Implement Platform Administrator organization list and detail queries with Organization Administrator, office-count, and relevant audit summaries
- [x] 4.3 Implement transactional, idempotent organization plus initial Organization Administrator, role, invitation, and audit creation
- [x] 4.4 Implement allowed organization metadata editing with normalized-code conflict protection and before/after audit
- [x] 4.5 Implement reasoned suspend, explicit reactivate, and active-or-suspended archive/decommission state transitions
- [x] 4.6 Implement Organization Administrator list, allowed metadata editing, and independent account suspension with path tenant checks
- [x] 4.7 Expose authenticated Nest organization-management endpoints with server-derived actor identity and safe standard errors
- [x] 4.8 Add service/controller unit and integration tests for access, transaction rollback, duplicates, lifecycle, cross-tenant denial, invitation, and audit behavior
- [x] 4.9 Add Platform Administrator paginated Organization Admin directory endpoint
- [x] 4.10 Add Platform Administrator organization-scoped offices endpoint with filters and pagination

## 5. Platform Administration Web UI

- [x] 5.1 Read the repository-bundled Next.js 16 guidance relevant to App Router pages, dynamic parameters, and server/client data access
- [x] 5.2 Add typed organization API client/actions through the existing authenticated `/api/nest` proxy
- [x] 5.3 Add Platform Administrator-only sidebar navigation and organization route breadcrumb titles
- [x] 5.4 Build responsive organization list UI with search, status filtering, pagination, status badges, loading, empty, and error states
- [x] 5.5 Build combined organization and initial Organization Administrator creation UI with accessible validation, idempotency, and success feedback
- [x] 5.6 Build organization detail UI with metadata, office summary, Organization Administrators, creation metadata, and relevant audit history only
- [x] 5.7 Build allowed organization editing UI and understandable duplicate/validation errors
- [x] 5.8 Build accessible confirmation flows for suspend, reactivate, and active-or-suspended archive with invalid actions disabled
- [x] 5.9 Build Organization Administrator metadata editing and account-suspension UI
- [x] 5.10 Add Organization Admins directory page with table, search, filters, pagination, and organization detail links
- [x] 5.11 Convert organization detail sections to local tabs, defaulting to Offices
- [x] 5.12 Render organization offices and audit history as tables and keep lifecycle controls collapsed by default
- [x] 5.13 Hide admin sidebar navigation for suspended sessions and clear stale web sessions
- [x] 5.14 Add supported UI/unit tests for API error mapping, state helpers, forbidden navigation, and validation

## 6. Documentation and Verification

- [x] 6.1 Update backend/web technical documentation with routes, role rules, SSO onboarding, lifecycle, migration, and rollback notes
- [ ] 6.2 Run and pass OpenSpec validation plus backend formatter, linter, unit tests, integration/e2e tests where available, and production build
- [ ] 6.3 Run and pass web formatter/linter, type checking, unit tests, and production build
- [x] 6.4 Apply and smoke-test the migration against local PostgreSQL where available, including constraints, transaction rollback, and append-only audit enforcement
- [x] 6.5 Reconcile the OpenSpec artifacts and mark only verified tasks complete; document any unavailable environment checks or pre-existing failures

### Verification notes

- Tasks 6.2 and 6.3 remain open only because the repository-wide lint commands fail on pre-existing code outside this vertical slice. Backend failures are existing unsafe-`any`/mock async/filter issues in auth providers, the legacy domain service, exception filter, and bootstrap. Web failures are existing React hook/immutability issues in accounts, templates, SSO, staff, landing constellation, shared navigation/mobile hooks, and the access provider.
- Focused lint checks for every new organization-management file and directly changed authorization/UI file pass.
- Backend unit tests and build pass. The database-backed e2e suite passed after adding the organization vertical; a requested final rerun after a small invitation-transaction hardening was not authorized.
- Web unit tests, TypeScript checking, and the production build pass. The build retains Next.js's existing middleware-to-proxy deprecation warning.
