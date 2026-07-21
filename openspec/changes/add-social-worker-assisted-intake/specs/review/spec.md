## ADDED Requirements

### Requirement: Checklist gating on approve
When a review step has verification checklist items, the engine SHALL refuse an approve action until all items are verified, and SHALL allow approve once all are verified. This gating applies only to approve; return and reject are unaffected. Review steps without checklist items behave exactly as before.

#### Scenario: Approve refused with unverified items
- **WHEN** an approve is attempted on a review step whose application has unverified checklist items
- **THEN** the engine refuses and reports how many items remain

#### Scenario: Approve proceeds when complete
- **WHEN** every checklist item is verified and the reviewer approves
- **THEN** the application advances to the next step as normal
