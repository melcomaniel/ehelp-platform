## ADDED Requirements

### Requirement: Program creation
The system SHALL allow an admin to create a program with a name, description, and classification (`simple`, `complex`, or `highly_technical`). A new program starts with one draft version.

#### Scenario: Admin creates a program
- **WHEN** an admin creates "Financial Assistance" with classification `simple`
- **THEN** the program exists with a draft version and no published version

### Requirement: Apply template by deep copy
When creating a program, the admin SHALL be able to apply a published template. Applying SHALL deep-copy the template's entire step set — steps, form fields, field options, file rules, step actions, and reason codes — into the program's draft version in a single transaction. The copy SHALL be independent: later edits to the template SHALL NOT affect the program.

#### Scenario: Applying a template
- **WHEN** an admin creates a program and applies the "Standard Assistance Flow" template
- **THEN** the program's draft version contains copies of all the template's steps, fields, options, file rules, actions, and reason codes

#### Scenario: Template edited after apply
- **WHEN** the template is modified after a program was created from it
- **THEN** the program's steps remain exactly as copied

### Requirement: Start blank
The admin SHALL be able to create a program without a template, starting from an empty step set.

#### Scenario: Blank program
- **WHEN** an admin creates a program and chooses "start blank"
- **THEN** the draft version has an empty step set editable in the builder

### Requirement: Customize draft version
The admin SHALL be able to edit a program's draft version in the same full-page builder used for templates — renaming steps, editing fields, and changing actions/reason codes — before publishing.

#### Scenario: Renaming a copied step
- **WHEN** the admin renames the copied "Review" step to "Section Head Review" in the program's draft
- **THEN** the draft version reflects the change and the source template is untouched

### Requirement: Publish immutable version
The admin SHALL be able to publish a draft version. Publishing SHALL freeze the version: the system SHALL refuse any edit to a published version's step set. Once a program has a published version, it is open for applications.

#### Scenario: Publishing a draft
- **WHEN** the admin publishes the draft version
- **THEN** the version status becomes `published` and the program accepts applications

#### Scenario: Editing a published version is refused
- **WHEN** any edit is attempted against a published version's steps or fields
- **THEN** the system rejects the edit with an error

### Requirement: Version pinning for in-flight applications
Applications SHALL reference the program version they were started on. Publishing a newer version SHALL NOT change the steps, fields, or actions of applications already in flight; new applications SHALL use the latest published version.

#### Scenario: New version published mid-flight
- **WHEN** version 2 is published while an application on version 1 is still in review
- **THEN** the in-flight application continues rendering and routing against version 1, and a newly started application uses version 2

### Requirement: Template provenance
A program created from a template SHALL record which template it came from, for display only. The reference SHALL NOT create any live behavioral link.

#### Scenario: Provenance display
- **WHEN** an admin views a program created from "Standard Assistance Flow"
- **THEN** the UI shows the source template name as informational metadata
