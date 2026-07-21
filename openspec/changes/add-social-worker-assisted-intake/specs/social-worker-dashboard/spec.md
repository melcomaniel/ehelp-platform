## ADDED Requirements

### Requirement: Social worker role
The system SHALL include a `social_worker` role with a seeded social-worker user, selectable in the dev role-switcher. The social worker is the assigned reviewer for the 4Ps program.

#### Scenario: Switching to the social worker
- **WHEN** the user selects the seeded social worker in the role-switcher
- **THEN** the social-worker dashboard becomes available

### Requirement: Dashboard route and access
The system SHALL provide a `/social-worker/dashboard` area with its own layout and sidebar, sharing the workflow store, global prompts, and role-switcher. The area SHALL be available only to users holding the `social_worker` role.

#### Scenario: Access as a social worker
- **WHEN** a social worker opens `/social-worker/dashboard`
- **THEN** the dashboard renders with the 4Ps review queue

#### Scenario: Access without the role
- **WHEN** a user without the `social_worker` role opens the area
- **THEN** they are shown a message to switch to a social worker instead of the review tools

### Requirement: 4Ps review queue
The dashboard SHALL list 4Ps applications waiting at a review step assigned to the social worker, showing the applicant, current step, and time waiting, most recent first.

#### Scenario: Queue populated
- **WHEN** the social worker opens the dashboard with seeded 4Ps applications at review
- **THEN** each waiting application appears with applicant and time in queue

### Requirement: Open a specific application
The social worker SHALL be able to open a specific application from the queue and see its stepper progress, the applicant's inputs, uploaded documents, and the full append-only event history.

#### Scenario: Opening an application
- **WHEN** the social worker opens a queued 4Ps application
- **THEN** the stepper shows the current Review step, and the applicant's answers, uploads, and history are visible
