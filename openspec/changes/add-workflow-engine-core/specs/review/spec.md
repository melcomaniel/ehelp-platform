## ADDED Requirements

### Requirement: Review queue
A user holding a decision step's assigned role SHALL see a queue of applications currently waiting at that step, newest submissions first, showing applicant, program, and time in queue.

#### Scenario: Reviewer opens queue
- **WHEN** a reviewer opens their queue and five seeded applications are waiting at the review step
- **THEN** all five are listed with applicant name, program, and submitted time

### Requirement: Application detail view
The reviewer SHALL see the application's answers rendered against the pinned version's field definitions, its uploaded files (downloadable), and its full event history.

#### Scenario: Inspecting before deciding
- **WHEN** the reviewer opens an application from the queue
- **THEN** all answers, files, and prior events (submit, returns, resubmits) are visible

### Requirement: Approve action
Approving SHALL advance the application to the next step in the version's step order. Approval comment is optional. If the approved step is the last step, the application status SHALL become `approved`.

#### Scenario: Approve at review step
- **WHEN** the reviewer approves an application at the review step
- **THEN** the application moves to the approval step and appears in the approver's queue

#### Scenario: Approve at final step
- **WHEN** the approver approves an application at the last step
- **THEN** the application status becomes `approved`

### Requirement: Return action
Returning SHALL require a reason code (from the step's configured list) and a comment. The application status becomes `returned` and it goes back to the applicant for compliance; on resubmit it re-enters the same step.

#### Scenario: Return without comment refused
- **WHEN** the reviewer attempts to return without entering a comment
- **THEN** the action is refused with a validation error

#### Scenario: Successful return
- **WHEN** the reviewer returns with reason "Missing document" and a comment
- **THEN** status becomes `returned`, the applicant is shown the reason and comment, and the event is logged

### Requirement: Reject action
Rejecting SHALL require a reason code and a comment, and SHALL be terminal: status becomes `rejected` and no further transitions are possible.

#### Scenario: Successful reject
- **WHEN** the approver rejects with reason "Not eligible" and a comment
- **THEN** status becomes `rejected` and the application accepts no further actions

### Requirement: Only configured actions available
Only the actions enabled on the step SHALL be offered in the UI, and the engine SHALL refuse any action not enabled on the step regardless of how it is invoked.

#### Scenario: Disabled action refused by the engine
- **WHEN** a `return` is attempted on a step where return is disabled
- **THEN** the engine refuses the action

### Requirement: Human lock enforcement
The engine SHALL never auto-advance an application past a `review` or `approval` step. Advancement past a decision step SHALL only occur through an explicit human `approve` action by a user holding the step's assigned role.

#### Scenario: No auto-advance
- **WHEN** an application arrives at a decision step
- **THEN** it stays there until a qualified human acts, regardless of any other condition

### Requirement: Role enforcement
The engine SHALL refuse a decision action from an acting user who does not hold the step's assigned role.

#### Scenario: Wrong role refused
- **WHEN** a user with only the `applicant` role attempts to approve an application
- **THEN** the engine refuses the action

### Requirement: Append-only audit trail
Every action (submit, resubmit, approve, return, reject) SHALL append an event recording actor, timestamp, action, from-step, to-step, reason code, and comment. Events SHALL never be updated or deleted.

#### Scenario: Audit completeness
- **WHEN** an application has been submitted, returned, resubmitted, and approved
- **THEN** the event log contains all four events in order with actor, timestamp, and the return's reason code and comment
