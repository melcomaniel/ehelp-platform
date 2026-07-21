## ADDED Requirements

### Requirement: Root layout shell
The app SHALL have a single root layout shell containing the navigation, the dev role-switcher, and the global prompt providers (toasts + confirmation dialog). The shell SHALL wrap every route so these elements are mounted exactly once.

#### Scenario: Shell present on every page
- **WHEN** the user navigates between admin, applicant, and reviewer pages
- **THEN** the same shell (navigation, role-switcher, prompt providers) remains mounted without remounting

### Requirement: Dev role-switcher
The shell SHALL show a role-switcher listing the seeded users with their roles. Selecting a user makes them the acting user everywhere; the selection SHALL persist across navigation and reloads.

#### Scenario: Switching acting user
- **WHEN** the user switches from the admin to the reviewer in the role-switcher
- **THEN** all pages immediately reflect the reviewer's permissions and queues

### Requirement: Global toast notifications
Action results (submit, approve, return, reject, publish, apply template, reset) SHALL surface as toast notifications from a single global provider in the root layout. Toasts SHALL survive route navigation triggered by the action, SHALL be dismissible, SHALL auto-dismiss after a timeout, and multiple toasts SHALL stack without replacing each other.

#### Scenario: Toast survives post-action navigation
- **WHEN** a reviewer approves an application and is redirected back to the queue
- **THEN** the success toast is visible on the queue page

#### Scenario: Error toast on refused action
- **WHEN** an action is refused by the engine (e.g. missing required comment)
- **THEN** an error toast states the reason

#### Scenario: Stacked toasts
- **WHEN** two actions complete in quick succession
- **THEN** both toasts are visible simultaneously

### Requirement: Global confirmation dialog
Destructive or terminal actions — reject application, archive template, reset demo data, and publish version (freezes it) — SHALL require confirmation via a single global dialog stating the consequence. Cancelling SHALL make no change.

#### Scenario: Reject asks for confirmation
- **WHEN** a reviewer triggers reject
- **THEN** a confirmation dialog states that rejection is final before the reason/comment form is committed

#### Scenario: Cancel makes no change
- **WHEN** the user cancels a confirmation dialog
- **THEN** no state change occurs and no event is logged

### Requirement: Inline validation stays inline
Field-level validation errors SHALL render inline next to the offending field, not as toasts. Toasts are reserved for action-level outcomes.

#### Scenario: Required field error placement
- **WHEN** an applicant submits with a required field empty
- **THEN** the error appears at the field, and no toast is fired for it
