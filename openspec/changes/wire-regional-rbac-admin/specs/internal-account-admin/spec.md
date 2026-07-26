## ADDED Requirements

### Requirement: Register regional staff
A `satellite_admin` with `register_accounts` SHALL be able to create an internal staff account for their own office with role `approver` or `evaluator`.

#### Scenario: Create approver in own office
- **WHEN** a satellite admin submits name, email, password, and role `approver` on `/admin/accounts`
- **THEN** the system creates an active Nest `user_accounts` row, `staff_profiles` row, and role assignment with `office_id` equal to the admin's office

#### Scenario: Cannot create outside own office
- **WHEN** a satellite admin attempts to create a staff account with a different `office_id`
- **THEN** the system rejects the request

#### Scenario: Role limited to regional staff
- **WHEN** a satellite admin attempts to register a user as `dswd_admin` or `satellite_admin`
- **THEN** the system rejects the request

### Requirement: Register office administrators
A `dswd_admin` with `register_accounts` SHALL be able to create internal staff accounts in their organization with role `satellite_admin`, `approver`, or `evaluator`.

#### Scenario: Create office admin in organization
- **WHEN** a DSWD admin submits name, email, password, role `satellite_admin`, and an office in their organization
- **THEN** the system creates an active Nest staff account scoped to the DSWD admin's organization and selected office

### Requirement: Staff accounts are active on create
Internal staff accounts created through the current Nest implementation SHALL be active immediately after creation.

#### Scenario: Created staff can sign in
- **WHEN** an authorized admin creates a staff account
- **THEN** the account is active and may use the appropriate web staff surfaces without a separate approval step

### Requirement: List accounts by scope
The accounts page SHALL list internal staff profiles scoped to the caller's authority.

#### Scenario: Satellite admin sees own office
- **WHEN** a satellite admin opens `/admin/accounts`
- **THEN** staff profiles for their `office_id` are listed according to server-side scope

#### Scenario: DSWD admin sees organization staff
- **WHEN** a DSWD admin opens `/admin/accounts`
- **THEN** they can view staff across offices in their organization
