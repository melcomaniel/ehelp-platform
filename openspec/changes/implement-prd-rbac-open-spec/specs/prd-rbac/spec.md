## ADDED Requirements

### Requirement: Canonical PRD roles
The system SHALL expose a canonical RBAC policy for `PLATFORM_ADMIN`,
`ORG_ADMIN`, `OFFICE_ADMIN`, `EVALUATOR`, `APPROVER`, and `BENEFICIARY`.

#### Scenario: Compatibility aliases resolve to PRD roles
- **WHEN** the web app displays `dswd_admin`, `satellite_admin`, or `customer`
- **THEN** those roles map to `ORG_ADMIN`, `OFFICE_ADMIN`, and `BENEFICIARY`
  respectively for PRD RBAC documentation and policy alignment

### Requirement: Scoped grants
Every RBAC grant SHALL include both a permission and a scope.

#### Scenario: Organization admin manages own organization only
- **WHEN** an `ORG_ADMIN` requests `program_template.create` for their own
  organization
- **THEN** the request is allowed with `organization` scope

#### Scenario: Organization admin is blocked across tenants
- **WHEN** an `ORG_ADMIN` requests `program_template.create` for another
  organization
- **THEN** the request is denied

#### Scenario: Office admin customizes own office only
- **WHEN** an `OFFICE_ADMIN` requests
  `program_template.override_allowed_fields` for their own office
- **THEN** the request is allowed with `office` scope

#### Scenario: Beneficiary views own account only
- **WHEN** a `BENEFICIARY` requests `application.view_own` for their own
  beneficiary record
- **THEN** the request is allowed with `own_account` scope

### Requirement: Explicit platform administrator restrictions
The system SHALL deny platform administrators from beneficiary case data and
business decisions even though they have platform-wide administrative authority.

#### Scenario: Platform admin cannot approve application
- **WHEN** a `PLATFORM_ADMIN` requests `application.approve`
- **THEN** the request is denied because platform administrators have no
  case-level authority

### Requirement: Evaluator and approver separation of duties
The system SHALL prevent the same user from both evaluating and approving an
application.

#### Scenario: Approver evaluated the same application
- **WHEN** an `APPROVER` requests `application.approve`
- **AND** the application was evaluated by the same user
- **THEN** the request is denied
