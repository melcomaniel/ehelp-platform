## ADDED Requirements

### Requirement: Organization Administrator authentication
The system SHALL authenticate Organization Administrators through the existing eGov SSO/local account resolution/JWT flow, SHALL require an active account with `ORG_ADMIN`, a non-null `organization_id`, null `office_id` for this slice, and an active organization, and SHALL NOT introduce a parallel authentication provider.

#### Scenario: Active Organization Administrator opens Office Management
- **GIVEN** an authenticated active user with `ORG_ADMIN`
- **AND** the user belongs to an active organization
- **WHEN** the user opens Office Management
- **THEN** the system resolves the actor's organization from the server-side session and displays only that organization's offices

### Requirement: Organization Administrator authorization
The system SHALL enforce active tenant-scoped `ORG_ADMIN` authorization server-side for every office-management operation and MUST NOT trust client-supplied actor role, `organization_id`, or `office_id`.

#### Scenario: Unauthorized role denial
- **GIVEN** an authenticated Office Administrator
- **WHEN** the user attempts to create, edit, archive, reactivate, or restructure an office
- **THEN** access is denied and no office data is modified

#### Scenario: Platform Administrator denied write access
- **WHEN** a Platform Administrator calls an office write operation from this slice
- **THEN** the server returns forbidden unless an existing approved authorization model explicitly grants it

### Requirement: Office listing
The system SHALL provide tenant-scoped searchable, filterable, paginated office listing with office name, code, office type, parent office, direct child count when inexpensive, status, created date, updated date, and available actions.

#### Scenario: List own organization's offices
- **WHEN** an active Organization Administrator requests the office list
- **THEN** only offices where `organization_id` equals the actor's organization are returned

#### Scenario: Search and filter offices
- **WHEN** search, office type, status, parent, page, or page-size filters are supplied
- **THEN** the system returns the matching tenant-scoped page and pagination metadata

### Requirement: Office creation
The system SHALL allow an Organization Administrator to create one or more offices under the actor's active organization and SHALL default new offices to active status.

#### Scenario: Create first office
- **GIVEN** an organization with no office records
- **WHEN** valid office details are submitted
- **THEN** the office is created under the actor's organization, status is active, and an audit record is written

#### Scenario: Create multiple offices under one organization
- **GIVEN** an organization already has one active office
- **WHEN** its Organization Administrator submits another valid office
- **THEN** the second office is created and both offices remain associated with the same organization

### Requirement: Office detail viewing
The system SHALL show authorized Organization Administrators office information, organization name, parent office, direct child offices, current status, creation/update metadata, and relevant audit history when supported, and MUST NOT display beneficiary-level or application-level information.

#### Scenario: View own office details
- **WHEN** an Organization Administrator opens an office belonging to their organization
- **THEN** office details are displayed without beneficiary-level data

### Requirement: Office editing
The system SHALL allow Organization Administrators to edit approved office metadata including name, code, type, and parent office, SHALL reject protected-field mass assignment, and SHALL audit sanitized before and after state.

#### Scenario: Update office metadata
- **GIVEN** an office belongs to the authenticated administrator's organization
- **WHEN** allowed metadata is updated
- **THEN** changes are persisted and before/after state is written to the audit log

### Requirement: Office archive
The system SHALL implement ordinary delete as archive, MUST NOT physically delete offices through Office Management, SHALL require confirmation and a reason, SHALL preserve historical data, and SHALL reject archive when active child offices exist. Office suspension SHALL mean archive and SHALL NOT introduce a third office state.

#### Scenario: Archive office
- **GIVEN** an active office with no active child offices
- **WHEN** the Organization Administrator confirms archive with a reason
- **THEN** the office becomes archived, is excluded from active selectors, history is preserved, and the action is audited

#### Scenario: Office with active children
- **GIVEN** an office has one or more active child offices
- **WHEN** the Organization Administrator attempts to archive it
- **THEN** the request is rejected and the existing state remains unchanged

#### Scenario: Physical deletion prevention
- **WHEN** the user-facing action is labelled delete
- **THEN** the system archives the office and deletes no historical records

#### Scenario: Canonical Regional Office archive
- **GIVEN** an active Regional Office owned by the Organization Administrator's organization
- **WHEN** the administrator calls the organization-scoped archive endpoint with a reason
- **THEN** the office is archived through the shared lifecycle operation

#### Scenario: Cross-organization or non-regional archive
- **WHEN** the administrator uses the Regional Office archive endpoint for another organization or a non-regional office
- **THEN** the request is rejected and no office or audit data is changed

### Requirement: Archived office work assignment
The system SHALL exclude archived offices from new-work selectors, MUST reject new applications and draft submissions for archived offices, and MUST NOT create new workflow tasks for them.

#### Scenario: Complete pre-archive work
- **GIVEN** a pending workflow task created before its office was archived
- **WHEN** its assigned evaluator or approver completes the task
- **THEN** the completion is retained and no successor task is created while the office remains archived

#### Scenario: Resume deferred workflow
- **GIVEN** an in-flight application whose next task was deferred by office archival
- **WHEN** the office is reactivated
- **THEN** the system idempotently creates the missing task for the application's current stage

### Requirement: Office reactivation
The system SHALL allow eligible archived or inactive offices to be reactivated when the organization is active and SHALL append an audit entry without reactivating separately suspended users or dependent records.

#### Scenario: Reactivate office
- **GIVEN** an archived office and an active organization
- **WHEN** the Organization Administrator confirms reactivation
- **THEN** the office becomes active and the action is recorded in the audit log

### Requirement: Parent-child office hierarchy
The system SHALL support optional parent offices and zero or more child offices, SHALL require parent offices to belong to the same organization, and MUST prevent self-parenting and circular hierarchy.

#### Scenario: Parent office assignment
- **GIVEN** two offices belong to the same organization
- **WHEN** the Organization Administrator assigns one as the parent of the other
- **THEN** the hierarchy is saved within the organization

#### Scenario: Cross-tenant parent denial
- **GIVEN** a parent office belongs to another organization
- **WHEN** an Organization Administrator attempts to assign it as a parent
- **THEN** the request is denied and no relationship is created

#### Scenario: Circular hierarchy prevention
- **GIVEN** Office A is an ancestor of Office B
- **WHEN** the administrator attempts to make Office B the parent of Office A
- **THEN** the request is rejected and the existing hierarchy remains unchanged

### Requirement: Cross-tenant office access prevention
The system MUST scope every office read and write by actor organization and MUST NOT perform office lookup by ID alone.

#### Scenario: Cross-tenant access denial
- **GIVEN** an Organization Administrator belongs to Organization A
- **WHEN** the administrator attempts to view or modify an office from Organization B
- **THEN** access is denied and no Organization B office data is returned

### Requirement: Duplicate office-code prevention
The system SHALL normalize office codes, SHALL enforce uniqueness of normalized code within an organization, and SHALL allow the same code in another organization unless an existing global constraint prevents it.

#### Scenario: Duplicate office code
- **GIVEN** an organization already contains an office with normalized code `CAR`
- **WHEN** another office in the same organization is submitted with normalized code `CAR`
- **THEN** the request is rejected and no duplicate office is created

#### Scenario: Tenant-scoped office code
- **GIVEN** Organization A contains an office with code `CENTRAL`
- **WHEN** Organization B creates an office with code `CENTRAL`
- **THEN** the request may succeed and each office remains isolated in its own organization

### Requirement: Organization-status enforcement
The system SHALL reject state-changing office operations when the actor account is inactive, the actor lacks `ORG_ADMIN`, the actor has no organization, the organization does not exist, or the organization is suspended or archived.

#### Scenario: Suspended organization restriction
- **GIVEN** an Organization Administrator has an existing authenticated session
- **AND** the administrator's organization becomes suspended
- **WHEN** the administrator attempts to create or modify an office
- **THEN** the operation is denied server-side

### Requirement: Server-side permission enforcement
The system SHALL derive actor identity from the authenticated session, reload persisted account/role/tenant status, use parameterized database access, follow existing CSRF/proxy protections, and return sanitized data.

#### Scenario: Forged organization scope
- **WHEN** a client submits a forged `organization_id`
- **THEN** the server ignores it and uses the actor's persisted organization scope

### Requirement: Append-only audit logging
The system SHALL append immutable sanitized audit entries for office creation, update, parent change, archive/deactivation, reactivation, and failed privileged operations when supported by existing audit design.

#### Scenario: Office operation audit
- **WHEN** a state-changing office operation succeeds
- **THEN** actor, action, entity type, office ID, organization ID, safe before/after state, timestamp, reason where relevant, and available request metadata are recorded

#### Scenario: Sensitive audit payload
- **WHEN** audit payloads are built
- **THEN** secrets, tokens, passwords, biometric data, and sensitive credentials are excluded

### Requirement: Validation and error handling
The system SHALL validate required fields server-side and SHALL return safe errors for malformed input, duplicates, invalid parents, hierarchy cycles, inactive organizations, unauthorized roles, and missing tenant-scoped resources.

#### Scenario: Validation failure
- **WHEN** office name, code, type, or parent input is missing or invalid
- **THEN** the system returns an understandable bad-request or conflict response and creates or changes nothing
