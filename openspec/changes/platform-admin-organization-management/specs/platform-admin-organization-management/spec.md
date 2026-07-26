## ADDED Requirements

### Requirement: Platform Administrator authentication
The system SHALL authenticate Platform Administrators through the existing eGov SSO/local account resolution/JWT flow, SHALL require an active account with `PLATFORM_ADMIN`, null `organization_id`, and null `office_id`, and SHALL NOT introduce a parallel authentication provider.

#### Scenario: Active Platform Administrator signs in
- **WHEN** a provisioned active Platform Administrator completes the existing web eGov SSO exchange
- **THEN** the system resolves the local account and `PLATFORM_ADMIN` assignment and issues the existing web session

#### Scenario: Invalid Platform Administrator scope
- **WHEN** an account assigned `PLATFORM_ADMIN` has an organization or office scope
- **THEN** the system denies authentication and protected Platform Administrator operations

#### Scenario: Inactive Platform Administrator
- **WHEN** an inactive, suspended, or archived Platform Administrator attempts authentication or a protected operation
- **THEN** the system denies access with the safe message `Account is suspended`

#### Scenario: Existing suspended session is cleared
- **WHEN** a Platform Administrator account is suspended after a web JWT was issued
- **THEN** the next web session lookup clears the stale session cookie and the account cannot remain logged in

### Requirement: Platform Administrator authorization
The system SHALL enforce active, unscoped `PLATFORM_ADMIN` authorization server-side for every organization-management operation and MUST NOT trust client-supplied actor roles or scopes.

#### Scenario: Authorized list access
- **WHEN** an active unscoped Platform Administrator requests Organization Management
- **THEN** the server authorizes the request and returns the organization list

#### Scenario: Organization Administrator denial
- **WHEN** an authenticated Organization Administrator calls a Platform Administrator organization-management operation
- **THEN** the server returns the standard forbidden response and no other-tenant data

### Requirement: Organization listing
The system SHALL provide searchable, status-filtered, paginated organization listing including name, normalized code, status, primary Organization Administrator, inexpensive office count, and creation/update timestamps.

#### Scenario: Filter organizations
- **WHEN** a Platform Administrator supplies search, status, page, and page-size parameters
- **THEN** the system returns the matching authorized page and pagination metadata

#### Scenario: Archived history visibility
- **WHEN** a Platform Administrator filters for archived organizations
- **THEN** archived organizations remain visible in the history list

### Requirement: Organization creation
The system SHALL allow an authorized Platform Administrator to create an active organization with required name and unique normalized code and SHALL validate all input server-side.

#### Scenario: Valid organization
- **WHEN** a Platform Administrator submits valid organization and initial administrator details
- **THEN** the system creates an active organization with a normalized uppercase code

#### Scenario: Invalid input
- **WHEN** required organization or administrator input is missing or malformed
- **THEN** the system returns understandable field-safe validation errors and creates nothing

### Requirement: Duplicate organization-code prevention
The system SHALL enforce case-insensitive uniqueness of normalized organization codes at both service and database boundaries.

#### Scenario: Duplicate normalized code
- **WHEN** `DSWD` exists and another request submits a code that normalizes to `DSWD`
- **THEN** the system returns a conflict and no duplicate organization is created

#### Scenario: Concurrent duplicate requests
- **WHEN** concurrent requests attempt to create the same normalized organization code
- **THEN** at most one organization is committed

### Requirement: Atomic organization and initial-admin creation
The system SHALL create the organization, initial Organization Administrator account/profile, `ORG_ADMIN` assignment, activation/invitation, and audit records in one transaction and SHALL support idempotent repeated submission.

#### Scenario: Atomic success
- **WHEN** every onboarding step succeeds
- **THEN** all organization, account, role, invitation, and audit records commit together

#### Scenario: Atomic failure
- **WHEN** any required initial-administrator onboarding step fails
- **THEN** the transaction rolls back and leaves no partial organization, administrator, assignment, invitation, or audit set

#### Scenario: Repeated creation key
- **WHEN** the same successfully completed creation request is repeated with the same idempotency key
- **THEN** the system returns the original created organization and does not duplicate records

### Requirement: Initial Organization Administrator
The system SHALL create the initial administrator as an active or pending staff account with the new organization's ID, null office, and exactly one tenant-scoped `ORG_ADMIN` assignment.

#### Scenario: Initial administrator association
- **WHEN** a DSWD organization is created with its initial administrator
- **THEN** the administrator is staff scoped to DSWD with `ORG_ADMIN` and no office

#### Scenario: Existing email conflict
- **WHEN** the submitted administrator email already belongs to a local account
- **THEN** the system rejects onboarding rather than silently moving the account between tenants

### Requirement: Initial administrator activation or invitation
The system SHALL create one pending activation/invitation compatible with the existing eGov SSO account-resolution flow and MUST NOT store raw SSO tokens or introduce password-based invitation authentication.

#### Scenario: SSO activation
- **WHEN** the provisioned administrator signs in through eGov SSO using the matching government email
- **THEN** the system resolves the existing account, verifies active tenant context, marks the pending invitation accepted, and routes the user to organization-scoped administration

#### Scenario: Duplicate active invitation
- **WHEN** onboarding or activation is retried
- **THEN** the system does not create duplicate active invitations for the same account and organization

### Requirement: Organization detail viewing
The system SHALL show authorized Platform Administrators organization metadata, lifecycle state, Organization Administrators, office summary, timestamps, and relevant organization-management audit history, and MUST NOT include beneficiary or application-level data.

#### Scenario: View organization details
- **WHEN** a Platform Administrator opens a known organization
- **THEN** the system returns organization metadata, Organization Administrator accounts, summary counts, and relevant audit entries only

#### Scenario: Unknown organization
- **WHEN** a Platform Administrator requests an unknown organization ID
- **THEN** the system returns not found without leaking unrelated records

### Requirement: Organization detail tabbed UI
The organization detail page SHALL show only one primary detail section at a time, defaulting to Offices.

#### Scenario: Initial offices tab
- **WHEN** a Platform Administrator opens an organization detail page
- **THEN** the Offices tab is selected and administrators, audit history, and lifecycle controls are not shown until their tabs are selected

#### Scenario: Switch detail tabs
- **WHEN** a Platform Administrator selects Administrators or Audit history
- **THEN** the page replaces the visible detail section without navigating away from the organization detail page

### Requirement: Organization office listing
The system SHALL provide a Platform Administrator organization-scoped offices table with search, office-type filter, status filter, pagination, and links to office details.

#### Scenario: Filter organization offices
- **WHEN** a Platform Administrator supplies search, office type, status, page, and page-size parameters for an organization's offices
- **THEN** the system returns only offices for that organization with pagination metadata

#### Scenario: Open office from organization detail
- **WHEN** a Platform Administrator clicks an office row action from organization detail
- **THEN** the user is routed to that office's detail page

### Requirement: Organization editing
The system SHALL allow Platform Administrators to edit only organization name and approved metadata, SHALL prevent mass assignment of lifecycle/protected fields, and SHALL audit sanitized before and after state.

#### Scenario: Edit allowed metadata
- **WHEN** a Platform Administrator submits valid changed organization metadata
- **THEN** the system persists the allowed fields and appends an audit entry containing sanitized before and after values

#### Scenario: Protected-field mass assignment
- **WHEN** a client attempts to update organization ownership, status, or tenant business configuration through the metadata endpoint
- **THEN** the system ignores or rejects protected fields and does not change them

### Requirement: Organization suspension
The system SHALL permit an active organization to transition to suspended with explicit confirmation and a required reason, preserve all tenant data, reject tenant authentication/protected operations, and append an immutable audit entry.

#### Scenario: Suspend active organization
- **WHEN** a Platform Administrator confirms suspension of an active organization with a reason
- **THEN** status becomes suspended, tenant data remains, tenant staff operations are denied, and actor/reason/previous/new state are audited

#### Scenario: Existing session after suspension
- **WHEN** tenant staff already has a JWT and the organization becomes suspended
- **THEN** the next protected server operation revalidates tenant status and denies access

### Requirement: Organization reactivation
The system SHALL allow a suspended organization to transition to active with confirmation, preserve history, restore eligible tenant access, and append an immutable audit entry.

#### Scenario: Reactivate suspended organization
- **WHEN** a Platform Administrator confirms reactivation
- **THEN** status becomes active and active tenant users may authenticate and operate again

#### Scenario: Separately suspended account remains suspended
- **WHEN** an organization is reactivated but one administrator account is independently suspended
- **THEN** that administrator remains unable to authenticate or use protected operations

### Requirement: Organization archival
The system SHALL allow only a suspended organization to transition to terminal archived state with explicit confirmation and reason, SHALL make it read-only, and MUST NOT physically delete tenant history.

#### Scenario: Archive suspended organization
- **WHEN** a Platform Administrator confirms archive of a suspended organization with a reason
- **THEN** status becomes archived, tenant authentication and writes are denied, history is preserved, and the action is audited

#### Scenario: Reject direct active-to-archived transition
- **WHEN** a Platform Administrator attempts to archive an active organization
- **THEN** the server returns a conflict, the organization remains active, and the response explains that suspension is required

#### Scenario: Archived organization mutation
- **WHEN** any client attempts to edit or reactivate an archived organization
- **THEN** the system rejects the operation and preserves archived state

### Requirement: Organization Administrator account management
The system SHALL allow Platform Administrators to list Organization Administrators for a selected organization, edit approved profile metadata, and suspend an active Organization Administrator account without changing its tenant or role.

#### Scenario: List tenant administrators
- **WHEN** a Platform Administrator views an organization
- **THEN** only `ORG_ADMIN` accounts assigned to that organization are returned

#### Scenario: Directory lists all Organization Administrators
- **WHEN** a Platform Administrator opens `/admin/organization-admins`
- **THEN** the system shows a paginated table of `ORG_ADMIN` accounts across organizations with organization, account, invitation, and creation metadata

#### Scenario: Directory filters Organization Administrators
- **WHEN** a Platform Administrator supplies search text, account status, invitation status, page, and page-size parameters
- **THEN** the system returns the matching Organization Administrators and pagination metadata

#### Scenario: Edit administrator metadata
- **WHEN** a Platform Administrator changes an Organization Administrator's approved name, email, or phone fields
- **THEN** the system preserves its organization, office, account type, and role and audits sanitized before/after metadata

#### Scenario: Suspend administrator
- **WHEN** a Platform Administrator confirms suspension of an active Organization Administrator
- **THEN** the account becomes suspended, login/session access is denied with `Account is suspended`, the organization remains unchanged, and the action is audited

#### Scenario: Cross-organization administrator ID
- **WHEN** an administrator ID does not belong to the organization in the request path
- **THEN** the system returns not found or forbidden and changes nothing

### Requirement: Tenant isolation
The system SHALL treat `organization_id` as the tenant boundary, require every `ORG_ADMIN` to reference one existing organization, and enforce organization scope in server queries and writes.

#### Scenario: Organization Administrator cross-tenant access
- **WHEN** a DSWD Organization Administrator attempts to access a DOLE resource
- **THEN** the server denies access and returns no DOLE data

#### Scenario: Missing tenant on Organization Administrator
- **WHEN** an `ORG_ADMIN` account has no organization
- **THEN** authentication and protected operations are denied as an invalid account scope

### Requirement: Server-side permission enforcement
The system SHALL derive the current actor from the authenticated session, revalidate account/role/tenant status for protected operations, follow existing CSRF/proxy protections, and use parameterized database access.

#### Scenario: Forged client role or organization
- **WHEN** a client submits a forged `PLATFORM_ADMIN` role or organization identifier
- **THEN** the server ignores it for actor authorization and uses persisted account and role state

#### Scenario: Revoked existing session
- **WHEN** an account is suspended after a JWT was issued
- **THEN** the next protected operation is denied despite the JWT's unexpired role claim and the web session cookie is cleared on session lookup

### Requirement: Append-only audit logging
The system SHALL append immutable, sanitized audit entries for organization creation/update/suspend/reactivate/archive, initial administrator creation, administrator update/suspend, role assignment, and invitation creation.

#### Scenario: Privileged operation audit
- **WHEN** a privileged organization-management operation succeeds
- **THEN** its transaction appends actor, action, entity, organization, safe before/after state, time, reason where relevant, outcome, and available correlation/IP metadata

#### Scenario: Audit mutation attempt
- **WHEN** application code or an ordinary database role attempts to update or delete an audit row
- **THEN** the database rejects the mutation

#### Scenario: Sensitive audit payload
- **WHEN** an audit payload is built
- **THEN** passwords, hashes, raw tokens, secrets, biometrics, beneficiary data, and private documents are excluded

### Requirement: Audit history table
The organization detail UI SHALL display organization-management audit history in a table.

#### Scenario: View audit history
- **WHEN** a Platform Administrator selects the Audit history tab
- **THEN** audit events are shown in table columns for action, entity, outcome, reason, and occurred time

#### Scenario: Sensitive lifecycle controls
- **WHEN** the Audit history tab is shown
- **THEN** organization lifecycle controls are collapsed by default and require explicit expansion before suspend, reactivate, or archive controls are visible

### Requirement: Prevention of unauthorized beneficiary and application access
The system MUST NOT authorize `PLATFORM_ADMIN` for beneficiary, biometric, application, document, evaluation, approval/rejection, program/rule/workflow authoring, recommendation, or disbursement operations.

#### Scenario: Platform Administrator requests application
- **WHEN** a Platform Administrator calls an application detail or queue endpoint
- **THEN** the server returns forbidden and no beneficiary-level data

#### Scenario: Platform Administrator attempts a decision
- **WHEN** a Platform Administrator attempts evaluation, approval, rejection, or disbursement authorization
- **THEN** the server returns forbidden and performs no business mutation

### Requirement: Error handling
The system SHALL return consistent safe errors for validation, authentication, authorization, missing resources, duplicates, and invalid lifecycle transitions and SHALL NOT expose stack traces, SQL details, secrets, or cross-tenant existence information.

#### Scenario: Validation failure
- **WHEN** submitted data violates a validation rule
- **THEN** the system returns a bad-request response with understandable safe details

#### Scenario: Duplicate conflict
- **WHEN** database uniqueness detects a duplicate code, email, invitation, or creation key
- **THEN** the system returns a stable conflict response without internal database details

#### Scenario: Unauthorized request
- **WHEN** an unauthenticated or unauthorized user calls organization management
- **THEN** the system returns the project's unauthorized or forbidden response and no protected data
