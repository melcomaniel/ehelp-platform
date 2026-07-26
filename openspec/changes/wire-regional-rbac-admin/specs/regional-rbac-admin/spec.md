## ADDED Requirements

### Requirement: Regional permission matrix
The system SHALL store and enforce office-scoped permission grants for roles `approver`, `evaluator`, and `satellite_admin` in `office_rbac_grants`.

#### Scenario: Office admin edits own office staff roles
- **WHEN** a validated `satellite_admin` opens `/admin/rbac`
- **THEN** the matrix shows only their assigned `office_id` and allows toggling permissions for `approver` and `evaluator` only

#### Scenario: Organization admin views organization offices
- **WHEN** a `dswd_admin` selects an office on `/admin/rbac`
- **THEN** they can view permissions for `satellite_admin`, `approver`, and `evaluator` for offices in their organization

#### Scenario: Organization admin edits organization office grants
- **WHEN** a `dswd_admin` toggles an office grant for an office in their organization
- **THEN** the change is persisted in `office_rbac_grants`

#### Scenario: Office admin cannot change satellite_admin grants
- **WHEN** a `satellite_admin` attempts to modify an `office_rbac_grants` row with `role = satellite_admin`
- **THEN** the change is rejected

### Requirement: Global RBAC defaults
The system SHALL maintain a global `rbac_global_grants` matrix editable only by `platform_admin`, and SHALL support applying it to one or all offices by `dswd_admin`.

#### Scenario: Edit global defaults
- **WHEN** a `platform_admin` toggles a grant on the global defaults matrix
- **THEN** the change is persisted in `rbac_global_grants` without immediately changing existing offices

#### Scenario: Apply defaults to an office
- **WHEN** a `dswd_admin` applies the defaults to an office in their organization
- **THEN** that office's `office_rbac_grants` rows are replaced with the global grants for allowed roles

#### Scenario: Active offices seed from defaults
- **WHEN** the RBAC migration is applied
- **THEN** the system copies `rbac_global_grants` into `office_rbac_grants` for active offices

### Requirement: Live permission checks for admin shell
The system SHALL resolve the signed-in staff user's permissions from the live session profile and configured role grants, and SHALL use them to gate admin navigation and actions for RBAC, accounts, and templates.

#### Scenario: Permission-gated navigation
- **WHEN** a satellite admin lacks `manage_region_rbac`
- **THEN** the RBAC nav item is hidden and the RBAC page actions are denied
