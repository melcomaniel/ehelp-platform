## 1. Data model + engine

- [ ] 1.1 Add `social_worker` to `RoleKey` + `ROLE_LABEL`
- [ ] 1.2 Add `reviewChecks` to state: { id, applicationId, stepId, itemKey, checkedBy, at }
- [ ] 1.3 Engine `reviewItemsOf(state, app, step)`: derive items from pinned version form fields (answer items) + uploaded documents (doc items), each with a stable itemKey
- [ ] 1.4 Engine `reviewProgress(state, app, step) → { verified, total }`; helper `isReviewFullyVerified`
- [ ] 1.5 Engine `decide(approve)` on a review step refuses unless every item verified (message names remaining count); return/reject never gated; empty checklist = satisfied
- [ ] 1.6 Engine unit tests: gating blocks below 100%, allows at 100%; return not gated; no-item review not blocked; verification scoped per application/step

## 2. Store

- [ ] 2.1 `toggleReviewItem(applicationId, stepId, itemKey)`: add/remove a check attributed to acting user (guarded to the step's assigned role)
- [ ] 2.2 Selectors: `reviewItems`, `reviewProgress` exposed for the UI
- [ ] 2.3 `reviewChecks: []` in fixtures hydration; reset restores

## 3. Seed: social worker + 4Ps

- [ ] 3.1 Seed social-worker user with `social_worker` role
- [ ] 3.2 Seed 4Ps program: Form → Identity Verify → Review (assigned `social_worker`) → Disbursement
- [ ] 3.3 Seed 4Ps applications waiting at review, each with answers + at least one uploaded document

## 4. Social-worker area

- [ ] 4.1 `/social-worker/dashboard` layout: WorkflowProvider + PromptsProvider + social-worker sidebar (shared store + role-switcher)
- [ ] 4.2 Access gate: only `social_worker`; otherwise prompt to switch role
- [ ] 4.3 Dashboard = 4Ps review queue: applicant, current step, time waiting
- [ ] 4.4 Application review page: stepper + inputs/uploads rendered as a verification checklist
- [ ] 4.5 Checklist UI: toggle each item, progress bar X/N (%), Approve disabled until 100%; Return/Reject always available (reason + comment)
- [ ] 4.6 Approve → advances to Disbursement; event history + reason/comment shown

## 5. Verify

- [ ] 5.1 Engine + store tests green
- [ ] 5.2 tsc + build clean; `/social-worker/dashboard` + review routes serve
- [ ] 5.3 Fresh-seed check: worker queue shows 4Ps applications at review with items to verify
- [ ] 5.4 Manual demo pass: social worker → open 4Ps person's application at review → verify each item 1→10 → 100% → approve → application at Disbursement
