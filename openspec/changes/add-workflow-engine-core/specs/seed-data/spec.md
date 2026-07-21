## ADDED Requirements

### Requirement: Deterministic seed fixtures
Seed data SHALL live in a static fixture module with stable IDs. The store SHALL hydrate from the fixtures automatically when empty (first run or cleared storage), and a "Reset demo data" control (behind confirmation) SHALL restore the exact fixture state, discarding prior test mutations.

#### Scenario: First run auto-seeds
- **WHEN** the app starts with an empty store
- **THEN** the fixtures load and all seeded data is immediately available

#### Scenario: Reset restores fixtures
- **WHEN** a developer approves two applications and then uses "Reset demo data"
- **THEN** the store returns to the original fixture state

### Requirement: Seeded users per role
The seed SHALL create at least: one admin, one reviewer, one approver, and several applicants — each selectable in the dev role-switcher.

#### Scenario: Switching roles
- **WHEN** the developer opens the role-switcher
- **THEN** admin, reviewer, approver, and applicant users are all selectable

### Requirement: Seeded template
The seed SHALL create a published "Standard Assistance Flow" template with three steps — form → review → approval — where the form step has a representative field mix (text, textarea, number, date, select with options, checkbox, and a file field with rules) and both decision steps have enabled actions, comment-required flags, and reason codes configured.

#### Scenario: Template visible in library
- **WHEN** the admin opens the template library after seeding
- **THEN** "Standard Assistance Flow" appears with its three steps configured

### Requirement: Seeded open program
The seed SHALL create a "Financial Assistance" program with a published version whose step set was deep-copied from the seeded template, open for applications.

#### Scenario: Program open for applications
- **WHEN** an applicant user views available programs after seeding
- **THEN** "Financial Assistance" is listed and accepting applications

### Requirement: Seeded applications across statuses
The seed SHALL create at least 12 applications against the program with realistic answers (and at least one uploaded file among them), distributed so every review path is testable immediately:
- at least 6 waiting at the review step (status `submitted`),
- at least 2 waiting at the approval step,
- at least 1 `returned` (with reason code and comment),
- at least 1 `approved`,
- at least 1 `rejected` (with reason code and comment).

#### Scenario: Reviewer queue populated
- **WHEN** the reviewer opens their queue after seeding
- **THEN** at least 6 applications are waiting to be approved, returned, or rejected

#### Scenario: Approver queue populated
- **WHEN** the approver opens their queue after seeding
- **THEN** at least 2 applications are waiting at the approval step

### Requirement: Coherent seeded histories
Every seeded application SHALL have an event history consistent with its status (e.g. a `returned` application has submit + return events with reason code and comment; an `approved` application has submit + approve events through each decision step).

#### Scenario: Inspecting a seeded returned application
- **WHEN** the reviewer opens the seeded returned application
- **THEN** its event log shows the submission and the return with its reason code and comment
