# Workflow Engine — Iteration Plan

Companion to `workflow-engine-step-palette.md` (the full spec). This doc locks the v1 decisions and slices the build into iterations. Each iteration ends in something demoable.

---

## Locked decisions (v1)

| # | Decision | Choice | Rationale |
|---|---|---|---|
| 1 | Workflow shape | **Linear stepper** + two built-in edges: **return loop** (back to applicant, resubmit, re-enters same step) and **reject terminal** | Covers AICS happy path (§2.10 spec). Full graph / branching deferred. |
| 2 | "Result" step | **Not a step.** Auto-notify fires on every transition; applicant sees status page | Result is a state, not work. Palette #11 Notify is a system side-effect, not a pipeline position. |
| 3 | Human lock | Review/Approval step types carry `auto_advance = false`, engine refuses to skip | §2.1 — legally load-bearing. Non-negotiable. |
| 4 | Actions per human step | **approve** (comment optional) · **return** (reason code + comment required) · **reject** (reason code + comment required) | §2.4. Return ≠ reject: return is recoverable, reject is terminal. |
| 5 | Preset approve/reject data | **Reason codes**, admin-defined per step. Reviewer picks code + comment. Notify outcome templates per action too. | Structured "why" for audit; free-text alone doesn't aggregate. |
| 6 | Form field storage | **Normalized tables** (field defs own table, FK to step), not JSON blob in step row | CLAUDE.md DB rules; queryable, migratable. |
| 7 | Roles v1 | **applicant · reviewer · approver · admin** (+ implicit system) | Minimum for separation of duties (recommend ≠ approve). Full §2.3 role table later. |
| 8 | Template versioning | **In from day one.** Publishing a template snapshots a version; in-flight applications pin their version | §2.9 — retrofitting versioning onto live data is the most painful migration there is. |
| 9 | Variants / sub-types | **Deferred to v2+** | One program = one linear template in v1. AICS sub-type checklists come later. |
| 10 | Builder UI | **Full page** (dedicated route, e.g. `/admin/templates/[id]/builder`), not a sidebar panel | Field builder + step config + preview need real estate; sidebar can't hold it. |
| 11 | Templates vs programs | **Template = reusable blueprint** in a template library. Creating a program **applies** a template via **copy** (deep-copy of steps + fields + actions into the program's draft version). After apply, program is independent — template edits don't propagate. | Copy keeps in-flight programs stable and versioning simple; live-linked templates would leak edits into published programs. |

---

## Templates vs programs

Two-level model:

```
Workflow Template  (reusable blueprint — "Standard Financial Assistance flow")
      │  apply = deep copy
      ▼
Program            ("AICS Medical Assistance") — owns its copied steps, customizes freely
      │  publish = snapshot
      ▼
Program Version    (immutable; in-flight applications pin this)
      │
      ▼
Application        (citizen instance walking the steps)
```

Admin flow:
1. **Create template** — full-page builder; assemble steps from the palette, configure defaults (fields, actions, reason codes, roles). Save to template library.
2. **Apply template** — create program → pick template from library (or start blank) → engine deep-copies the template's step set into the program's draft version → admin customizes (rename steps, tweak fields, swap reason codes) → publish.

Rules:
- Apply is **copy, not link**. Editing a template later never touches programs already created from it.
- A program can also be **saved back as a template** ("save as template") — deep copy in the other direction.
- Templates are versionless in v1 (only programs version); a template edit simply changes what future applies copy.

---

## v1 data model sketch

```
workflow_templates       id, name, description, category, status (draft|published|archived), step_set_id FK, created_by
programs                 id, name, description, classification (simple|complex|highly_technical),
                         created_from_template_id FK NULL, created_by
program_versions         id, program_id FK, version_no, status (draft|published|archived), step_set_id FK, published_at

step_sets                id                                              -- a step graph; owned by a template OR a program version
steps                    id, step_set_id FK, position, step_type (form|verify|review|approval|disbursement),
                         name, assigned_role, auto_advance
form_fields              id, step_id FK, position, field_type (text|textarea|number|date|select|checkbox|file),
                         label, help_text, required
form_field_options       id, form_field_id FK, position, value, label          -- select/checkbox choices
form_field_file_rules    id, form_field_id FK, allowed_mime, max_size_mb, min_count, max_count
step_actions             id, step_id FK, action (approve|return|reject), comment_required, notify_template
reason_codes             id, step_action_id FK, code, label, position

applications             id, program_version_id FK, applicant_id FK, current_step_id FK,
                         status (draft|submitted|in_progress|returned|approved|rejected|closed), submitted_at
application_answers      id, application_id FK, form_field_id FK, value_text, file_ref
application_events       id, application_id FK, actor_id FK, action, from_step_id, to_step_id,
                         reason_code_id FK NULL, comment NULL, created_at      -- append-only audit log

users                    id, name, email, ...
roles                    id, key (applicant|reviewer|approver|admin)
user_roles               user_id FK, role_id FK
```

Notes:
- `step_sets` exists so one `steps`-tree shape serves both owners: a template owns a step set, and each program version owns its own. **Apply template = deep-copy the step set** (steps + fields + options + file rules + actions + reason codes) into the program's new draft version. No polymorphic/nullable double-FK on `steps`.
- `programs.created_from_template_id` is provenance only — informational, never a live link.
- `application_events` is append-only — the who/when/what/why audit trail (§2.4). Never update or delete rows.
- `program_versions` split from `programs` so publish = snapshot; editing a published program creates a new draft version.
- Answers link to `form_field_id` of the pinned version — old applications always render against the fields they answered.

---

## Iterations

### Iteration 1 — Template builder + apply + linear runtime (the core loop)
**Goal:** admin creates a template, applies it to a program; applicant runs it; reviewer decides. Everything else hangs off this.

- Admin — template library:
  - Template list page (create / edit / archive).
  - Full-page builder per template: add/reorder/delete steps from minimal palette: **form · review · approval**.
  - Form step config: field builder (text, textarea, number, date, select, checkbox, file w/ format + size rules), required flag, labels.
  - Review/approval step config: assigned role, actions on/off, comment-required flags, reason-code list editor.
- Admin — programs:
  - Create program (name, description, classification) → **apply template** from library (or start blank) → deep-copied steps land in draft version.
  - Customize the copied steps in the same full-page builder, then **publish** → immutable version.
- Applicant: stepper UI renders form step from field defs, upload files, submit, see status, resubmit on return.
- Reviewer/approver: queue of pending applications, detail view, approve / return (code + comment) / reject (code + comment).
- Engine: linear advance, return loop, reject terminal, human lock, append-only event log.
- **Demo:** build "Standard Assistance Flow" template (form → review → approval), create "Financial Assistance" program from it, submit as applicant, return it, resubmit, approve.

### Iteration 2 — Identity verify step + notifications
**Goal:** your face-liveness stepper area + status pings.

- New step type **verify**: config toggles (PhilSys match, face liveness, de-dup). Applicant-facing widget slot in stepper.
- Provider behind an interface — **mock provider first** (pass/fail switch), real eVerify/Face Liveness API later. Auto step: pass → advance, fail → return loop with system reason code.
- Notify on every transition: template per step action (from `step_actions.notify_template`), delivery = email first, eMessage/SMS adapter later.
- **Demo:** Financial Assistance now form → verify (mock liveness) → review → approval; applicant gets notified at each transition.

### Iteration 3 — SLA clock + escalation
**Goal:** the ARTA metric.

- Classification → end-to-end ceiling (3/7/20 working days). Per-step SLA field on `steps`.
- Clock: working days only; **pause while status = returned**, resume on resubmit; track citizen-wait separately.
- Breach → notify assignee's supervisor + flag in reviewer queue (overdue badge, sorted first).
- **Demo:** dashboard shows per-application elapsed vs SLA, paused clocks, overdue list.

### Iteration 4 — Disbursement + audit hardening
**Goal:** money leg + trail COA would accept.

- Step type **disbursement**: payee (citizen | provider), instrument (cash | guarantee letter | check | eGovPay), ID-check confirm, acknowledgement capture. Disbursing role added; **enforce separation of duties** (approver of an application cannot disburse it).
- Anchor adapter: emit hash of each `application_events` row to eGovChain (stub interface first).
- **Demo:** approved application flows to disbursing queue, released with instrument + acknowledgement, full event trail viewable.

### Iteration 5 — Variants + routing
**Goal:** one program, many shapes (§2.5, §2.6).

- Sub-types: per-sub-type requirements checklist swap (shared intake shell).
- Amount-band routing: peso bands → approver role (AICS tiers).
- Jurisdiction field on application → field-office assignment.
- Stretch: sub-type overrides whole graph (ESA shape); list-based validate-and-pay shape (Social Pension).

---

## Deliberately out of v1

Endorsement (external barangay/LGU actors) · Appeal/Grievance · OCR document extraction · batch/list intake · eligibility rules engine · cross-agency refer-out. All in the palette spec; none block the core loop.
