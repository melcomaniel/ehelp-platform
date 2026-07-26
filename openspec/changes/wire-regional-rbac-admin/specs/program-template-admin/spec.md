## ADDED Requirements

### Requirement: Master program templates
A staff admin with `manage_templates` SHALL be able to create and update master rows in `program_templates`.

#### Scenario: Create master template
- **WHEN** an authorized admin saves a new template name, program metadata, cooldown, and requirements
- **THEN** a `program_templates` row is inserted and visible to staff

### Requirement: Regional template customization
A `satellite_admin` with `customize_templates` SHALL be able to create or update `region_templates` for their mapped region without modifying master templates.

#### Scenario: Customize eligibility for own region
- **WHEN** a satellite admin saves local eligibility rules / cooldown override for a master template
- **THEN** a `region_templates` row is upserted for their `region_id` and that `template_id`

#### Scenario: Cannot customize other regions
- **WHEN** a satellite admin attempts to write `region_templates` for another region
- **THEN** RLS or the application rejects the write

### Requirement: Templates UI uses live data
The `/admin/templates` page SHALL load and mutate Supabase template tables instead of the ehelp mock store.

#### Scenario: Live list
- **WHEN** an authorized admin opens `/admin/templates`
- **THEN** master templates and the current region's customizations (if any) are loaded from Supabase
