## ADDED Requirements

### Requirement: Regional Admin staff request submission
The system SHALL allow an authenticated, active Regional Admin (`OFFICE_ADMIN`) to submit a request for a new Officer account scoped to the actor's own `office_id`, and MUST NOT accept a client-supplied office scope that differs from the actor's assigned office.

#### Scenario: Submit a valid Officer request
- **GIVEN** an active Regional Admin assigned to an active office
- **WHEN** the admin submits a full name, email, and role of `evaluator` or `approver`
- **THEN** a new pending staff account request is created for that office and an audit record is written

#### Scenario: Request for a different office is rejected
- **GIVEN** an active Regional Admin assigned to Office A
- **WHEN** the admin submits a staff request targeting Office B
- **THEN** the request is denied and no account or audit record is created

#### Scenario: Request against an archived office is rejected
- **GIVEN** a Regional Admin whose assigned office is archived
- **WHEN** the admin submits a staff request
- **THEN** the request is rejected and no account is created

### Requirement: Requested role restricted to Evaluator/Approver
The system SHALL restrict the role of a Regional Admin-submitted staff request to `EVALUATOR` or `APPROVER` and MUST reject any request for `OFFICE_ADMIN`, `ORG_ADMIN`, or `PLATFORM_ADMIN` through this operation.

#### Scenario: Disallowed role rejected at validation
- **WHEN** a staff request is submitted with a role other than `evaluator` or `approver`
- **THEN** the request is rejected before any account is created

### Requirement: Requested accounts do not grant immediate access
The system SHALL create the requested account with a pending status that prevents authentication, and MUST NOT activate it, assign login credentials, or complete device registration as part of the request step.

#### Scenario: Pending account cannot sign in
- **GIVEN** a staff account request has been submitted and not yet approved
- **WHEN** the requested individual attempts to sign in
- **THEN** authentication is denied because the account is not active

### Requirement: Organization Administrator staff request approval
The system SHALL allow an authenticated, active Organization Administrator to approve a pending staff request only when the request's office belongs to the administrator's own organization, and SHALL activate the account and initiate the standard device-registration flow on approval.

#### Scenario: Approve a pending request
- **GIVEN** a pending Evaluator or Approver request in the administrator's organization
- **WHEN** the Organization Administrator approves the request
- **THEN** the account becomes active, a pending invitation enabling first-login device registration is created, and an audit record distinct from the request is written

#### Scenario: Cross-organization approval denied
- **GIVEN** a pending staff request belonging to Organization A
- **WHEN** an Organization Administrator of Organization B attempts to approve it
- **THEN** the approval is denied and no account state changes

#### Scenario: Approving a non-pending or non-Officer request is rejected
- **GIVEN** a staff account that is already active, or whose role assignment is not `EVALUATOR`/`APPROVER`
- **WHEN** an Organization Administrator attempts to approve it through this operation
- **THEN** the request is rejected and no state changes

### Requirement: First-login device registration for approved Officer accounts
The system SHALL require a device fingerprint on first login for any Evaluator or Approver account with a pending invitation created through staff-request approval, consistent with the existing Organization/Office Administrator first-login device-registration behavior.

#### Scenario: First login without a device fingerprint is blocked
- **GIVEN** an approved Officer account with a pending invitation and no prior device registration
- **WHEN** the account attempts to log in without presenting a device fingerprint
- **THEN** login is denied with a device-registration-required error

#### Scenario: First login with a device fingerprint completes activation
- **GIVEN** an approved Officer account with a pending invitation
- **WHEN** the account logs in and presents a device fingerprint
- **THEN** the device is registered as approved, the invitation is marked accepted, and the login proceeds

### Requirement: Distinct request and approval audit trail
The system SHALL record staff account requests and staff account approvals as separate, independently identifiable audit log actions and MUST NOT merge them into a single combined audit entry.

#### Scenario: Request and approval appear as separate audit entries
- **GIVEN** a staff request that is later approved
- **WHEN** the office's audit history is reviewed
- **THEN** a `staff_account_requested` entry and a separate `staff_account_approved` entry are both present, each with its own actor and timestamp
