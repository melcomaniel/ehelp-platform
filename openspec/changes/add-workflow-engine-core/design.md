## Context

Greenfield. The repo has a Next.js 16 / React 19 / Tailwind 4 client (`client/`) and design docs (`docs/design/workflow-engine-step-palette.md`, `docs/design/workflow-engine-iterations.md`) that lock the v1 decisions: linear stepper, template→program deep copy, versioned programs, human-locked review/approval, reason codes, full-page builder. This change implements Iteration 1 plus seed data.

**FE-first constraint:** we are iterating the frontend. No backend, no database in this change — all data lives in a mocked in-browser data layer shaped like the real v1 schema, so screens and flows can be exercised end-to-end and the backend can be slotted in later without UI rework.

## Goals / Non-Goals

**Goals:**
- Admin can create a workflow template, apply it to a program, customize, and publish.
- Applicant can submit an application against a published program and resubmit after a return.
- Reviewer/approver can approve / return / reject with reason codes and comments, from a queue pre-populated with many submitted applications.
- Every state change lands in an append-only audit log (in the mock store).
- Seed fixtures load automatically so the review flow is testable on first run; one-click reset restores them.

**Non-Goals:**
- Any backend, database, or API layer (deferred; the data-layer interface is designed for the swap).
- Real authentication/SSO, identity verify / face liveness, notifications, SLA timers, disbursement, sub-type variants, endorsement, appeals, OCR (Iterations 2–5).

## Decisions

1. **Data layer: typed in-browser store mirroring the v1 schema, behind a repository interface.**
   Plain TypeScript domain types matching the entities in `docs/design/workflow-engine-iterations.md` (templates, programs, versions, step sets, steps, fields, actions, reason codes, applications, answers, events, users/roles). State held in a client store (React context or Zustand), hydrated from seed fixtures, persisted to `localStorage` so manual testing survives reloads. All reads/writes go through a `repository` interface — the future backend implements the same interface; UI components never touch storage directly. Alternatives: SQLite/Drizzle now (rejected — backend explicitly deferred), MSW-mocked REST (rejected — API shape not designed yet; heavier than needed for FE iteration).

2. **Engine rules live in a pure TypeScript module (`src/engine/`), UI-free and storage-free.**
   Allowed-actions resolver, transition function (submit/resubmit/approve/return/reject), and guards (human lock, role check, comment-required, disabled-action, terminal states). The store calls the engine; components never encode rules. This module moves to the server unchanged when the backend arrives.

3. **Apply template = deep copy, in the store.**
   One `copyStepSet()` function clones steps → fields → options → file rules → actions → reason codes with new IDs. Programs stay independent of later template edits. Same function reused for publish-then-edit (new draft from published version).

4. **Auth: seeded users + a header role-switcher.**
   Dropdown selects the acting user (admin / applicants / reviewer / approver); guards run against the acting user so separation-of-duties behavior is visible in the UI even though it's all client-side.

5. **File uploads: kept in memory as object URLs with name/size/mime metadata in the answer.**
   Validation (mime, size, count) enforced by the engine from the field's stored rules. No disk, no persistence of blobs across reload (metadata persists; acceptable for FE iteration).

6. **Append-only audit inside the store.**
   No update/delete path for events. `application.status` is denormalized for queue rendering but always written in the same store transaction as its event.

7. **Publish = freeze.**
   Repository refuses mutations to published versions; editing a published program creates a new draft via deep copy. Applications pin `programVersionId`.

8. **Seed: static fixture module, auto-loaded on first run; "Reset demo data" control re-applies it.**
   Fixed IDs, deterministic content. Replaces the `npm run seed` script until a backend exists.

## Risks / Trade-offs

- [localStorage cleared → data gone] → Fixtures auto-reload on empty store; reset is one click.
- [Client-only guards are not real security] → Accepted for FE iteration; engine module is the artifact that moves server-side later.
- [Deep copy fan-out easy to miss a child collection] → Single `copyStepSet()` with a unit test asserting per-collection counts match source.
- [Blob loss on reload] → Metadata persists; re-upload needed only if testing file download after reload. Acceptable.

## Open Questions

- None blocking. Backend/API design happens when FE iteration stabilizes; repository interface is the contract to implement.
