## ADDED Requirements

### Requirement: Program discovery and application start
An applicant SHALL see the list of programs with a published version and SHALL be able to start an application. The application SHALL pin the program's current published version at start time.

#### Scenario: Starting an application
- **WHEN** an applicant starts an application for "Financial Assistance"
- **THEN** a draft application is created referencing the current published version

### Requirement: Stepper rendering from field definitions
The applicant UI SHALL render the pinned version's form step as a stepper, generating inputs from the stored field definitions: `text` and `textarea` as text inputs, `number` and `date` with matching input types, `select` from its stored options, `checkbox` as a toggle, `file` as an upload control showing the allowed formats and size limit.

#### Scenario: Rendering a form step
- **WHEN** the applicant opens the form step
- **THEN** every configured field renders in its configured order with label, help text, and required marker

### Requirement: Answer validation
On submit, the engine SHALL validate answers before accepting the submission: required fields present, numbers numeric, dates valid, select values among the stored options.

#### Scenario: Missing required field
- **WHEN** the applicant submits with a required field empty
- **THEN** submission is refused and the field is flagged with an error

### Requirement: File upload rules enforcement
File uploads SHALL be validated by the engine against the field's stored rules: mime type in the allowed list, size within the max, and count within min/max.

#### Scenario: Wrong file type
- **WHEN** the applicant uploads a `.docx` to a field allowing only PDF and JPEG
- **THEN** the upload is refused with the allowed formats named in the error

### Requirement: Submission
Submitting a valid application SHALL set its status to `submitted`, move it to the first decision step, and record a `submit` event with the acting user and timestamp.

#### Scenario: Successful submit
- **WHEN** the applicant submits a complete, valid application
- **THEN** status becomes `submitted`, the application enters the first review step's queue, and a submit event is logged

### Requirement: Status tracking
The applicant SHALL see the application's current status and step, and the history of decisions on it, including return reasons and comments.

#### Scenario: Viewing status after a return
- **WHEN** a reviewer has returned the application with reason "Missing document" and a comment
- **THEN** the applicant's status page shows status `returned`, the reason code, and the comment

### Requirement: Resubmit after return
A returned application SHALL be editable by the applicant. Resubmitting SHALL re-enter the same step it was returned from and record a `resubmit` event.

#### Scenario: Resubmission loop
- **WHEN** the applicant fixes the answers and resubmits a returned application
- **THEN** the application re-enters the step that returned it and the reviewer sees it again in the queue

### Requirement: Rejection is terminal
A rejected application SHALL NOT be editable or resubmittable. The status page SHALL show the rejection reason and comment.

#### Scenario: No resubmit after reject
- **WHEN** the applicant opens a rejected application
- **THEN** no edit or resubmit action is available and the rejection reason is displayed
