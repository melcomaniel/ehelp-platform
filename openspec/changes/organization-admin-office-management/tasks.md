## 1. Repository and Specification

- [x] 1.1 Inspect repository instructions, docs, frontend routing, backend modules, SQL migrations, authentication/authorization, eGov SSO, role/account/organization/office/audit models, admin UI patterns, tests, and requested terms
- [x] 1.2 Create OpenSpec proposal, delta specification, technical design with diagrams, and implementation checklist
- [x] 1.3 Validate the OpenSpec change before product-code changes

## 2. Database Schema and Migration

- [ ] 2.1 Add reversible migration extending existing `offices` with office code, normalized code, archived metadata, actor metadata, indexes, and constraints
- [ ] 2.2 Add organization-scoped normalized office-code uniqueness
- [ ] 2.3 Add hierarchy trigger/checks for self-parent, cross-tenant parent, and cycles
- [ ] 2.4 Expand audit action support for office lifecycle events
- [ ] 2.5 Update TypeORM office entity without enabling schema synchronization

## 3. Backend Authorization and Office API

- [ ] 3.1 Add office DTOs, normalization, validation, lifecycle, and hierarchy policy helpers
- [ ] 3.2 Implement active `ORG_ADMIN` actor and active organization scope resolution
- [ ] 3.3 Implement tenant-scoped office list, parent-option list, detail, create, update, archive, and reactivate service methods
- [ ] 3.4 Ensure all reads/writes include actor organization scope and never trust client `organization_id`
- [ ] 3.5 Write append-only sanitized audit records for all state-changing operations
- [ ] 3.6 Expose authenticated Nest endpoints with standard errors
- [ ] 3.7 Add focused backend unit/integration tests

## 4. Organization Administrator Web UI

- [ ] 4.1 Add typed office API helpers through the existing `/api/nest` proxy
- [ ] 4.2 Add Organization Administrator sidebar navigation for Offices only where authorized
- [ ] 4.3 Build office list UI with search, filters, pagination, status badges, actions, empty, loading, and error states
- [ ] 4.4 Build create-office UI with parent-office selector and no organization selector
- [ ] 4.5 Build office detail UI with metadata, organization name, parent, child offices, audit history, and actions
- [ ] 4.6 Build edit, archive/deactivation confirmation, and reactivation flows
- [ ] 4.7 Add supported web tests for API helpers/state handling

## 5. Documentation and Verification

- [ ] 5.1 Update backend/web documentation with routes, role rules, lifecycle, migration, rollback, and limitations
- [x] 5.2 Run OpenSpec validation
- [ ] 5.3 Run backend formatter/linter/tests/build where available
- [ ] 5.4 Run web linter/type/build/tests where available
- [ ] 5.5 Mark only verified tasks complete and document unavailable checks or pre-existing failures
