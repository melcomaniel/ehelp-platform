## Why

The 4Ps financial-aid program needs a **social worker** who reviews applications item by item. In the demo, the worker opens a specific person's 4Ps application at the Review step, sees every input and uploaded document, **verifies each one** (a checklist that fills to 100%), then approves — sending the application to disbursement. This adds a social-worker role scoped to 4Ps and a per-item verification checklist on the review step.

## What Changes

- New **social worker** role (`social_worker`) + seeded user, in the role model and dev role-switcher. The worker is the reviewer for the **4Ps** program.
- New **`/social-worker/dashboard`** area (own layout + sidebar, sharing the workflow store, prompts, and role-switcher):
  - **4Ps review queue**: applications for 4Ps waiting at the review step assigned to the social worker.
  - **Application detail**: the person's inputs and uploaded documents, each shown as a **verification checklist item**.
- New **per-item review checklist**: on a review step, the reviewer marks each answer/document as *verified*. A progress indicator shows verified/total (e.g. 7/10 = 70%). **Approve is disabled until 100%** (every item verified). Return and reject remain available at any point.
- On approve at the review step, the application advances to the next step (Disbursement) exactly as before.
- New seeded **4Ps program** with Form → Identity Verify → Review → Disbursement and seeded applications (several waiting at review) so the demo has data immediately. The social worker is the assigned reviewer.

## Capabilities

### New Capabilities
- `social-worker-dashboard`: the `/social-worker/dashboard` area — 4Ps review queue and per-application review with the verification checklist.
- `review-checklist`: per-item verification on a review step — verify each input/document, progress to 100%, approve gated until complete.

### Modified Capabilities
- `seed-data`: add the `social_worker` role + user, the 4Ps program (Form → Identity → Review → Disbursement) assigned to the social worker for review, and its seeded applications; keep existing fixtures.
- `review`: approving at a review step that has a verification checklist SHALL require all items verified.

## Impact

- `client/src/lib/workflow/types.ts`: add `social_worker` to `RoleKey`; add a per-application review-item verification record (checklist state).
- `client/src/lib/workflow/engine.ts`: helper to compute checklist items from the form answers/documents; `decide(approve)` on a review step blocks unless every item is verified; store action to toggle an item.
- `client/src/lib/workflow/store.tsx`: verify-item toggle; selectors for checklist progress.
- `client/src/lib/workflow/seed.ts`: social-worker user, 4Ps program + version + step set + seeded review-waiting applications.
- `client/src/app/social-worker/…`: new route group (layout, dashboard, review queue, application review).
- `client/src/components/workflow/…`: social-worker sidebar; verification-checklist component; reuse form renderer, stepper, history, prompts.
- Out of scope: real auth, the worker filing on behalf of citizens, the worker acting on programs other than 4Ps, notifications, SLA.
