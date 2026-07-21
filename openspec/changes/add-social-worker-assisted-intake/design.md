## Context

The workflow engine (Form → Verify → Review → Disbursement) lives entirely in the FE: a typed in-browser store (`client/src/lib/workflow`), a pure engine module, and role-scoped dashboard areas under `/dashboard`. Roles today: admin, applicant, reviewer, approver. This change adds a `social_worker` role scoped to reviewing the **4Ps** program, a `/social-worker/dashboard`, and a **per-item verification checklist** on the review step. Demo flow: open a 4Ps application at Review → verify each input/document (checklist to 100%) → approve → Disbursement.

## Goals / Non-Goals

**Goals:**
- A social worker sees 4Ps applications waiting at review, opens one, and sees every input and uploaded document as a checklist item.
- The worker verifies items one by one; a progress indicator fills to 100%; **approve is disabled until every item is verified**.
- Approving advances the application to Disbursement, unchanged from the existing engine.
- Seeded 4Ps program + review-waiting applications so the demo works on first run.

**Non-Goals:**
- Real auth, the worker filing on behalf of citizens, the worker acting on non-4Ps programs, notifications, SLA.

## Decisions

1. **Checklist items are derived, verification is stored.** The items for an application come from the pinned version's form fields (one per answer) plus each uploaded document. We do not duplicate the answers; we store only a set of *verified item keys* per application per review step: `reviewChecks: { applicationId, stepId, itemKey, checkedBy, at }`. Item key = the field id (documents keyed as `fieldId#index`). This keeps the checklist honest against whatever the form contains.

2. **Approve-gating lives in the engine.** `decide()` with `action: "approve"` on a review step computes required items and refuses if any is unverified: `"Verify all items before approving (7/10)"`. Return and reject are never gated. This keeps the rule server-portable and out of the UI.

3. **Progress is a pure selector.** `reviewProgress(state, app, step) → { verified, total }`. The UI renders the bar and disables Approve from it; the engine independently enforces it (UI can't bypass).

4. **`/social-worker` is its own route group**, mirroring `/dashboard`: layout wrapping `WorkflowProvider` + `PromptsProvider` + a social-worker sidebar, sharing the same store (same localStorage key) and role-switcher. Gated to `social_worker`.

5. **Social worker is the assigned reviewer for 4Ps.** The 4Ps review step's `assignedRole` is `social_worker`. The worker's queue = 4Ps applications submitted at a review step assigned to `social_worker`. No engine change to role checks — the existing role guard already handles it.

6. **The checklist attaches to review steps generally**, but only the 4Ps review is assigned to the social worker in the seed. Any review step gets the checklist; it is empty-satisfied (0/0 → 100%) when there are no form items, so existing non-4Ps reviews are unaffected.

7. **Engine stays pure.** Item derivation, verification toggle result, progress, and gating all live in the engine module; store and pages call it.

## Risks / Trade-offs

- [Gating could deadlock if a required item can't be verified] → Return/reject are always available, so the worker is never stuck; they can send it back.
- [Deriving items from answers means a document field with 0 uploads yields 0 doc items] → Field-level item still exists (the answer item), so every field contributes at least one checklist row; empty optional fields are marked not-applicable and count as satisfied.
- [Two dashboards share one store] → Same storage key keeps them consistent; role-switcher drives "who is acting."

## Open Questions

- None blocking. A later iteration could let the admin mark specific fields as "must verify" vs "optional," rather than all-items-required.
