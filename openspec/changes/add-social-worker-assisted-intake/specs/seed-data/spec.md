## ADDED Requirements

### Requirement: Seeded social worker
The seed SHALL include a social-worker user holding the `social_worker` role, selectable in the role-switcher.

#### Scenario: Social worker present after seeding
- **WHEN** the app starts with fresh fixtures
- **THEN** a social-worker user is available in the role-switcher

### Requirement: Seeded 4Ps program
The seed SHALL include a "4Ps" program with a published version whose workflow is Form → Identity Verify → Review → Disbursement, where the review step is assigned to the `social_worker` role.

#### Scenario: 4Ps open for applications
- **WHEN** the fixtures load
- **THEN** the 4Ps program is listed and accepting applications, with the four-step workflow and the review assigned to the social worker

### Requirement: Seeded 4Ps applications at review
The seed SHALL include several 4Ps applications submitted and waiting at the review step, each with answered fields and at least one uploaded document, so the social worker's queue and checklist have data on first run.

#### Scenario: Queue populated on first run
- **WHEN** the social worker opens the dashboard after seeding
- **THEN** multiple 4Ps applications are waiting at review, each with inputs and a document to verify
