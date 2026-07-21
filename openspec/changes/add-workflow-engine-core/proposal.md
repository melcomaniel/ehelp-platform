## Why

The product bet (see `docs/design/workflow-engine-step-palette.md`) is a configurable workflow engine that can render any Citizens Charter service as a runnable workflow. Nothing is built yet — this change delivers the Iteration 1 core loop from `docs/design/workflow-engine-iterations.md`: an admin creates a workflow template, applies it to a program, a citizen submits an application, and a reviewer approves/returns/rejects it. It also ships seed data (one open program, many submitted applications) so the review flow is testable immediately without manual data entry.

## What Changes

- New admin **template library**: create/edit/archive workflow templates in a full-page builder (route-level page, not a sidebar), assembling steps from a minimal palette: **form · review · approval**.
- **Form step field builder**: text, textarea, number, date, select, checkbox, and file fields (with allowed formats, max size, required flag, labels, help text).
- **Review/approval step config**: assigned role, enabled actions (approve/return/reject), comment-required flags, admin-defined reason codes per action.
- New **program management**: create a program (name, description, classification), **apply a template** (deep copy of its step set into the program's draft version), customize, then **publish** an immutable program version. In-flight applications pin the version they started on.
- New **applicant runtime**: stepper UI rendered from field definitions, file upload, submit, status page, resubmit-on-return.
- New **review runtime**: queue of submitted applications, detail view, approve (comment optional) / return (reason code + comment required) / reject (reason code + comment required). Return re-enters the same step after resubmission; reject is terminal. Review/approval steps are hard-locked against auto-advance.
- **Append-only audit log**: every action records who, when, what, why (reason code + comment).
- **Global app shell**: root-layout shell with a dev role-switcher and a **global prompt system** — toasts and confirmation dialogs mounted once at the root so they persist across page navigation (e.g. approve → redirected to queue → success toast still visible; reject/archive/reset ask for confirmation).
- **Seed data**: deterministic fixtures that auto-load on first run — users for each role, a published "Standard Assistance Flow" template, an open "Financial Assistance" program, and ~12 applications across statuses (mostly submitted/pending review) so approve/reject can be exercised end-to-end. One-click "Reset demo data".
- **FE-first**: no backend or database in this change. Data lives in a typed in-browser store (localStorage-persisted) behind a repository interface shaped like the v1 schema, so the backend slots in later without UI rework.

## Capabilities

### New Capabilities
- `workflow-templates`: admin creates, edits, and archives reusable workflow templates; step palette (form/review/approval); form field builder; action + reason-code configuration.
- `programs`: program creation, apply-template-by-deep-copy, customization of the copied steps, publishing immutable versions, version pinning for in-flight applications.
- `applications`: applicant-facing stepper rendered from the published version's field definitions, validation, file uploads, submission, status tracking, resubmit-on-return.
- `review`: reviewer/approver queues, decision actions (approve/return/reject) with reason codes and comment rules, human-lock enforcement, append-only audit trail.
- `seed-data`: deterministic seed fixtures producing role users, a published template, an open program, and a batch of test applications in reviewable states; auto-load + reset control.
- `app-shell`: root layout shell — dev role-switcher, global toast notifications, and global confirmation dialogs that persist across route navigation.

### Modified Capabilities

(none — greenfield; `openspec/specs/` is empty)

## Impact

- `client/` (Next.js 16 / React 19 / Tailwind 4): new admin routes (template library, full-page builder, program management), applicant routes (apply/stepper/status), reviewer routes (queue/detail), root-layout shell (role-switcher + global prompts).
- In-browser data layer: typed domain model mirroring the v1 data model in `docs/design/workflow-engine-iterations.md` (templates, programs, versions, step sets, steps, fields, options, file rules, actions, reason codes, applications, answers, events, users/roles), behind a repository interface; localStorage persistence. No database, no API in this change.
- Seed fixtures wired into first-run hydration.
- Out of scope (later iterations): backend/API/database, identity verify/face liveness step, notifications, SLA timers, disbursement, variants/sub-types, endorsement, appeals.
