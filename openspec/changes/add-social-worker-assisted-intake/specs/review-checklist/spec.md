## ADDED Requirements

### Requirement: Verification checklist items
A review step SHALL present the application's submitted content as a checklist: one item per form field (the answer) and one item per uploaded document. Each item SHALL show the applicant's real submitted value — the entered text, the chosen option, or the uploaded file name (openable) — so the reviewer verifies the actual input, not a placeholder. Each item can be marked *verified* by the reviewer.

#### Scenario: Items shown for review
- **WHEN** the social worker opens a 4Ps application with 8 answered fields and 2 uploaded documents at the review step
- **THEN** the review shows one verifiable item per answer displaying its real value and one per document showing its file name, covering every submitted input

### Requirement: Verifying an item
The reviewer SHALL be able to toggle each checklist item to verified (and back). Verification SHALL be recorded per application, per review step, with who verified it and when.

#### Scenario: Marking an item verified
- **WHEN** the reviewer marks the "Income proof" document as verified
- **THEN** it is recorded as verified for this application's review step

### Requirement: Progress indicator
The review SHALL show progress as verified-count over total (e.g. "7 / 10") and a percentage, updating as items are toggled.

#### Scenario: Progress updates
- **WHEN** the reviewer has verified 7 of 10 items
- **THEN** the progress shows 7 / 10 (70%)

### Requirement: Approve gated until fully verified
Approving at a review step that has checklist items SHALL be refused unless every item is verified. The engine SHALL enforce this regardless of the UI. Return and reject SHALL NOT be gated.

#### Scenario: Approve blocked below 100%
- **WHEN** the reviewer tries to approve with 9 of 10 items verified
- **THEN** the engine refuses with a message naming the remaining count, and the approve control is disabled

#### Scenario: Approve allowed at 100%
- **WHEN** all 10 items are verified
- **THEN** approve is enabled and advances the application to the next step (Disbursement)

#### Scenario: Return is never gated
- **WHEN** the reviewer returns the application with only 2 items verified
- **THEN** the return succeeds with its reason and comment

### Requirement: Checklist scoped to its application and step
Verification recorded on one application's review step SHALL NOT affect any other application, and SHALL be independent per review step so a step with no form items is satisfied at 0 / 0 (100%).

#### Scenario: A review with no items is not blocked
- **WHEN** a review step has no form fields or documents to verify
- **THEN** approve is not blocked by the checklist
