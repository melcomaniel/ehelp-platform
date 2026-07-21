## 1. Data model + engine

- [x] 1.1 Add `social_worker` to `RoleKey` + `ROLE_LABEL`
- [x] 1.2 Add `reviewChecks` to state: { id, applicationId, stepId, itemKey, checkedBy, at }
- [x] 1.3 Engine `reviewItemsOf(state, app, step)`: derive items from pinned version form fields (answer items) + uploaded documents (doc items), each with a stable itemKey
- [x] 1.4 Engine `reviewProgress(state, app, step) → { verified, total }`; helper `isReviewFullyVerified`
- [x] 1.5 Engine `decide(approve)` on a review step refuses unless every item verified (message names remaining count); return/reject never gated; empty checklist = satisfied
- [x] 1.6 Engine unit tests: gating blocks below 100%, allows at 100%; return not gated; no-item review not blocked; verification scoped per application/step

## 2. Store

- [x] 2.1 `toggleReviewItem(applicationId, stepId, itemKey)`: add/remove a check attributed to acting user (guarded to the step's assigned role)
- [x] 2.2 Selectors: `reviewItems`, `reviewProgress` exposed for the UI
- [x] 2.3 `reviewChecks: []` in fixtures hydration; reset restores

## 3. Seed: social worker + 4Ps

- [x] 3.1 Seed social-worker user with `social_worker` role
- [x] 3.2 Seed 4Ps program: Form → Identity Verify → Review (assigned `social_worker`) → Disbursement
- [x] 3.3 Seed 4Ps applications waiting at review, each with answers + at least one uploaded document

## 4. Social-worker area

- [x] 4.1 `/social-worker/dashboard` layout: WorkflowProvider + PromptsProvider + social-worker sidebar (shared store + role-switcher)
- [x] 4.2 Access gate: only `social_worker`; otherwise prompt to switch role
- [x] 4.3 Dashboard = 4Ps review queue: applicant, current step, time waiting
- [x] 4.4 Application review page: stepper + inputs/uploads rendered as a verification checklist
- [x] 4.5 Checklist UI: toggle each item, progress bar X/N (%), Approve disabled until 100%; Return/Reject always available (reason + comment)
- [x] 4.6 Approve → advances to Disbursement; event history + reason/comment shown

## 5. Verify

- [x] 5.1 Engine + store tests green
- [x] 5.2 tsc + build clean; `/social-worker/dashboard` + review routes serve
- [x] 5.3 Fresh-seed check: worker queue shows 4Ps applications at review with items to verify
- [x] 5.4 Manual demo pass: social worker → open 4Ps person's application at review → verify each item 1→10 → 100% → approve → application at Disbursement
