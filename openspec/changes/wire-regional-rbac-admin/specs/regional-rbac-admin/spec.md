## ADDED Requirements

### Requirement: Regional permission matrix
The system SHALL store and enforce region-scoped permission grants for roles `approver`, `evaluator`, and `satellite_admin` in `regional_rbac`.

#### Scenario: Satellite admin edits own region staff roles
- **WHEN** a validated `satellite_admin` opens `/admin/rbac`
- **THEN** the matrix shows only their `region_id` and allows toggling permissions for `approver` and `evaluator` only

#### Scenario: DSWD admin views any region read-only
- **WHEN** a `dswd_admin` selects a region on `/admin/rbac`
- **THEN** they can view permissions for `satellite_admin`, `approver`, and `evaluator` for that region but cannot toggle them

#### Scenario: DSWD admin cannot edit regional grants directly
- **WHEN** a `dswd_admin` attempts to modify a `regional_rbac` row via direct grant toggle
- **THEN** the change is rejected; regional grants are changed only by applying the global template

#### Scenario: Satellite admin cannot change satellite_admin grants
- **WHEN** a `satellite_admin` attempts to modify a `regional_rbac` row with `role = satellite_admin`
- **THEN** the change is rejected

### Requirement: Global RBAC template
The system SHALL maintain a global `rbac_templates` matrix editable only by `dswd_admin`, and SHALL support applying it to one or all regions.

#### Scenario: Edit template
- **WHEN** a `dswd_admin` toggles a grant on the RBAC template
- **THEN** the change is persisted in `rbac_templates` without immediately changing existing regions

#### Scenario: Apply template to a region
- **WHEN** a `dswd_admin` applies the template to a region
- **THEN** that region's `regional_rbac` rows are replaced with the template grants for allowed roles

#### Scenario: New region seeds from template
- **WHEN** a new `regions` row is inserted
- **THEN** the system copies `rbac_templates` into `regional_rbac` for that region

### Requirement: Live permission checks for admin shell
The system SHALL resolve the signed-in staff user's permissions from `regional_rbac` (or the fixed `dswd_admin` set) and use them to gate admin navigation and actions for RBAC, accounts, and templates.

#### Scenario: Permission-gated navigation
- **WHEN** a satellite admin lacks `manage_region_rbac`
- **THEN** the RBAC nav item is hidden and the RBAC page actions are denied
