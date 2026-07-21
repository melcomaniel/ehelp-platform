## ADDED Requirements

### Requirement: Register regional staff
A `satellite_admin` with `register_accounts` SHALL be able to create an internal staff account for their own region with role `approver` or `evaluator`.

#### Scenario: Create approver in own region
- **WHEN** a satellite admin submits name, email, password, and role `approver` on `/admin/accounts`
- **THEN** the system creates a Supabase Auth user and a `profiles` row with that role, `region_id` equal to the admin's region, and `validation_status = pending`

#### Scenario: Cannot create outside own region
- **WHEN** a satellite admin attempts to create a staff profile with a different `region_id`
- **THEN** the system rejects the request

#### Scenario: Role limited to regional staff
- **WHEN** a satellite admin attempts to register a user as `dswd_admin` or `satellite_admin`
- **THEN** the system rejects the request

### Requirement: Approve internal accounts
A `dswd_admin` with `approve_accounts` SHALL be able to activate pending internal staff accounts.

#### Scenario: Approve pending staff
- **WHEN** a DSWD admin approves a pending staff profile
- **THEN** `validation_status` becomes `validated` and the account may use staff surfaces

### Requirement: List accounts by scope
The accounts page SHALL list internal staff profiles scoped to the caller's authority.

#### Scenario: Satellite admin sees own region
- **WHEN** a satellite admin opens `/admin/accounts`
- **THEN** only staff profiles for their `region_id` with roles `approver` or `evaluator` (and optionally themselves) are listed

#### Scenario: DSWD admin sees all pending and staff
- **WHEN** a DSWD admin opens `/admin/accounts`
- **THEN** they can view staff across regions and act on pending approvals
