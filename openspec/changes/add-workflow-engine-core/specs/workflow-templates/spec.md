## ADDED Requirements

### Requirement: Template creation
The system SHALL allow an admin to create a workflow template with a name and description. New templates start in `draft` status and appear in the template library list.

#### Scenario: Admin creates a template
- **WHEN** an admin submits a new template named "Standard Assistance Flow"
- **THEN** the template is created in `draft` status and appears in the template library

### Requirement: Full-page builder
The template builder SHALL be a dedicated full-page route (e.g. `/admin/templates/[id]/builder`), not a sidebar or modal panel.

#### Scenario: Opening the builder
- **WHEN** an admin opens a template from the library
- **THEN** the builder occupies the full page with the step list, step configuration, and a preview area

### Requirement: Step palette
The builder SHALL let the admin add, reorder, and delete steps of the v1 palette types: `form`, `review`, `approval`. Step order defines the linear execution order.

#### Scenario: Assembling a pipeline
- **WHEN** the admin adds a form step, then a review step, then an approval step
- **THEN** the template's step set contains the three steps in positions 1, 2, 3

#### Scenario: Reordering steps
- **WHEN** the admin moves the approval step before the review step
- **THEN** step positions update to reflect the new order

### Requirement: Form field builder
For a `form` step, the builder SHALL let the admin define fields of types `text`, `textarea`, `number`, `date`, `select`, `checkbox`, and `file`, each with a label, optional help text, and a required flag. `select` fields SHALL have admin-defined options. `file` fields SHALL have admin-defined allowed formats (mime types), max size, and min/max count.

#### Scenario: Adding a text field
- **WHEN** the admin adds a required text field labeled "Full name"
- **THEN** the field is stored on the form step with type `text` and `required = true`

#### Scenario: Adding a file field with rules
- **WHEN** the admin adds a file field allowing only `application/pdf` and `image/jpeg`, max 5 MB, min 1 file
- **THEN** the field stores those file rules and they are enforced at application time

#### Scenario: Adding a select field
- **WHEN** the admin adds a select field "Assistance type" with options Medical, Burial, Educational
- **THEN** the three options are stored in order and offered to applicants

### Requirement: Decision step configuration
For `review` and `approval` steps, the builder SHALL let the admin set the assigned role, enable/disable the actions `approve`, `return`, and `reject`, set the comment-required flag per action, and define an ordered list of reason codes per action.

#### Scenario: Configuring a review step
- **WHEN** the admin assigns role `reviewer`, enables all three actions, marks return and reject as comment-required, and adds reject reason codes "Not eligible" and "Duplicate application"
- **THEN** the step stores the role, action flags, and reason codes, and reviewers see exactly those options

### Requirement: Human lock on decision steps
`review` and `approval` steps SHALL be created with `auto_advance = false`, and the builder SHALL NOT offer any way to enable auto-advance on them.

#### Scenario: No auto-advance toggle
- **WHEN** the admin configures a review or approval step
- **THEN** no auto-advance option is presented and the stored step has `auto_advance = false`

### Requirement: Template archiving
The system SHALL allow an admin to archive a template. Archived templates SHALL NOT be offered when creating a program, and archiving SHALL NOT affect programs previously created from the template.

#### Scenario: Archiving a template
- **WHEN** an admin archives a template that was previously applied to a program
- **THEN** the template no longer appears in the apply-template list and the existing program's steps are unchanged
