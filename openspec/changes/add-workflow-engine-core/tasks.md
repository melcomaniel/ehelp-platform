## 1. Foundation (data layer + engine)

- [x] 1.1 Domain types in `src/domain/`: templates, programs, versions, step sets, steps, form fields, options, file rules, step actions, reason codes, applications, answers, events, users/roles — mirroring the v1 model in `docs/design/workflow-engine-iterations.md`
- [x] 1.2 Repository interface + in-browser store implementation: hydrate from fixtures when empty, persist to localStorage, all reads/writes through the interface
- [x] 1.3 Engine module `src/engine/`: allowed-actions resolver, transition function (submit/resubmit/approve/return/reject), guards (human lock, role, comment-required, disabled action, terminal states), event append + status denormalization in one store transaction
- [x] 1.4 `copyStepSet()` deep copy (steps → fields → options → file rules → actions → reason codes, new IDs); unit test asserting per-collection counts match source
- [x] 1.5 Engine unit tests: each guard refuses correctly; approve advances; last-step approve → `approved`; return → `returned`; reject terminal

## 2. App shell (global)

- [x] 2.1 Root layout shell: navigation for admin/applicant/reviewer areas, mounted once
- [x] 2.2 Role-switcher in shell header: lists seeded users, selection persisted, acting user context available everywhere
- [x] 2.3 Global toast provider in root layout: success/error variants, stacking, auto-dismiss, dismissible, survives post-action route navigation
- [x] 2.4 Global confirmation dialog provider: used by reject, archive template, publish version, reset demo data; cancel = no state change
- [x] 2.5 "Reset demo data" control (behind confirmation) wired to fixture re-hydration

## 3. Template library & builder (admin)

- [x] 3.1 Template library page: list, create, archive (archive behind confirmation)
- [x] 3.2 Full-page builder route `/admin/templates/[id]/builder`: step list with add/reorder/delete (form, review, approval)
- [x] 3.3 Form step config panel: field builder for text, textarea, number, date, select (+options), checkbox, file (+mime/size/count rules), required flag, labels, help text
- [x] 3.4 Decision step config panel: assigned role, action toggles, comment-required flags, reason-code editor; no auto-advance option rendered
- [x] 3.5 Builder mutations through repository; refuse edits to archived templates; toast on save/publish outcomes

## 4. Programs (admin)

- [x] 4.1 Program list + create form (name, description, classification) with "apply template" (published templates only) or "start blank"
- [x] 4.2 Apply template → `copyStepSet()` into program draft version
- [x] 4.3 Reuse the full-page builder against the program's draft version
- [x] 4.4 Publish (behind confirmation): freeze version, repository refuses further edits, program open for applications; "edit published" creates new draft via deep copy
- [x] 4.5 Program detail shows template provenance (informational)

## 5. Applicant runtime

- [x] 5.1 Program list page for applicants (published programs only); start application pinning current published version
- [x] 5.2 Stepper form renderer from field definitions (all 7 field types, order, labels, help, required markers)
- [x] 5.3 Engine validation on submit: required, number, date, select-in-options — errors inline at fields
- [x] 5.4 File upload as object URLs + metadata; engine enforces mime/size/count from stored rules
- [x] 5.5 Submit → status `submitted`, enter first decision step, append submit event, success toast, redirect to status page
- [x] 5.6 Status page: current status/step, decision history with reason codes + comments
- [x] 5.7 Returned-application edit + resubmit → re-enter same step, append resubmit event; rejected applications read-only with reason shown

## 6. Review runtime

- [x] 6.1 Queue page per acting user's role: applications waiting at steps assigned to that role, with applicant, program, waiting time
- [x] 6.2 Detail view: answers rendered against pinned version, file downloads, full event history
- [x] 6.3 Decision UI: approve (optional comment) / return / reject with reason-code select + comment; only enabled actions shown; reject behind confirmation
- [x] 6.4 Decision handlers delegate to engine (role, comment-required, human lock, terminal, disabled-action guards); outcome toast + redirect to queue
- [x] 6.5 Approve-at-last-step → status `approved`; reject → terminal

## 7. Seed fixtures

- [x] 7.1 Fixture module with fixed IDs: admin, reviewer, approver, 6+ applicants with roles
- [x] 7.2 Fixture: published "Standard Assistance Flow" template — form (all 7 field types incl. select options + file rules) → review → approval, actions + comment flags + reason codes
- [x] 7.3 Fixture: "Financial Assistance" program, published version deep-copied from the template fixture
- [x] 7.4 Fixture: 12+ applications with realistic answers (≥1 with file metadata): ≥6 at review, ≥2 at approval, ≥1 returned, ≥1 approved, ≥1 rejected — each with coherent event history
- [x] 7.5 First-run auto-hydration wired; reset control restores fixtures exactly

## 8. Verification

- [x] 8.1 Engine + deep-copy unit tests green
- [ ] 8.2 Manual E2E pass: build template → create program → apply → publish → submit as applicant → return → resubmit → approve; audit log complete; toasts visible after each redirect
- [x] 8.3 Fresh-seed check: reviewer queue ≥6, approver queue ≥2, returned/approved/rejected examples present
- [x] 8.4 Navigation sweep: shell, role-switcher state, and toasts persist across all routes; reload keeps data (localStorage)
