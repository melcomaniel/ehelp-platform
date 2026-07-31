# Persona Scope & Limitations – PRD Alignment Summary

## Purpose

This document aligns **who may do what** (and who is denied) with EHelp PRD v1.4 §§4.1–4.6. It covers scope and explicit restrictions for Platform Admin, Organization Admin, Office Admin, Evaluator, Approver, and Beneficiary — not full feature build-out (offline evaluator, AI, LandBank, Dependent login, etc.).

Canonical policy lives in Nest `backend/src/auth/rbac.policy.ts` (`ROLE_GRANTS`, `PLATFORM_ADMIN_EXPLICIT_DENIES`, SOD in `decideRbac`). Runtime enforcement goes through `RbacAccessService` (`decideAnyRole` over **all** role assignments) for case actions, relationship workflow, application create/submit/queue, and org/office admin gates. Web UI permissions and route gates mirror those boundaries (including dual-role via JWT `erd_roles`).

For beneficiary mobile detail, see [Beneficiary Mobile – PRD Alignment Summary](./mobile/beneficiary-prd-alignment-summary.md).

---

## Platform map

```
Platform Admin              →  Web /admin (tenants, org admins, platform audit)
Organization / Office Admin →  Web /admin (oversight; no case decide/endorse by default)
Evaluator / Approver        →  Web /staff (case queue; dual-role also opens /staff)
Beneficiary / Dependent     →  Flutter mobile (Dependent = beneficiary-class + relationship approval)
```

Client platform gates (`X-Client-Platform: mobile|web`) remain in Nest `platform-policy.ts`: beneficiary-class roles are mobile-only; staff/admins are web-only.

---

## Platform Admin (PRD §4.1)

**Can**

- Create / update / suspend / reactivate / archive tenant organizations.
- Manage platform security baseline, role catalog, integration credentials, disbursement channel enablement.
- Revoke devices and force-logout at platform scope.
- View and export **platform-scoped** audit and aggregate analytics.

**Cannot**

- Access beneficiary case PII (applications, evaluations, approvals, disbursement own-data).
- Create, publish, retire, or customize program templates / workflows / rule sets.
- Evaluate, endorse, approve, or reject applications.
- Register or verify beneficiaries.

**Current enforcement**

| Layer | Pointer |
| --- | --- |
| Policy | `PLATFORM_ADMIN` grants + `PLATFORM_ADMIN_EXPLICIT_DENIES` in `rbac.policy.ts` |
| Domain API | `DomainService.requireUser` rejects `PLATFORM_ADMIN` for tenant business ops |
| Web nav | Sidebar: Organizations, Org Admins, RBAC, Audit — no Applications / Templates / Programs |
| Web middleware | Deep-link deny: `/admin/applications`, recommendations, templates, workflows, programs |
| Web perms | `PLATFORM_ADMIN_PERMISSIONS`: `manage_rbac`, `view_audit` only |

---

## Organization Admin (PRD §4.2)

**Can**

- Manage offices in own organization; approve org staff accounts.
- Create / publish / retire program templates; define override bounds; manage workflows and rule sets.
- View org analytics and org audit.
- Oversight-view applications in admin UI (read-oriented mock / Nest lists as available).

**Cannot**

- Evaluate, endorse, approve, or reject applications **unless separately assigned Evaluator or Approver**.
- Act on Recommendations as a case actor by virtue of admin role alone.
- Access platform tenant lifecycle or another organization’s data.
- Use the `/staff` case console (admin home is `/admin`).

**Current enforcement**

| Layer | Pointer |
| --- | --- |
| Policy | `ORG_ADMIN` grants — no `application.*` case permissions |
| Domain | `assertEvaluator` / `assertApprover` are role-exact; `recommend` / `decide` → 403 for org admin |
| Web perms | `DSWD_ADMIN_PERMISSIONS` stripped of evaluate / approve / recommend act/submit |
| Web middleware | `/staff` → staff roles only |

---

## Office Admin (PRD §4.3)

**Can**

- Customize allowed template fields and local requirements for own office.
- Assign office staff; request office staff accounts.
- View office analytics / office audit (policy); register accounts in UI where granted.
- Oversight-view applications for own office scope in admin UI.

**Cannot**

- Evaluate / endorse / approve / reject cases by default admin role.
- Manage org-wide templates, workflows, or other offices.
- Enter `/staff` without Evaluator/Approver assignment.

**Current enforcement**

| Layer | Pointer |
| --- | --- |
| Policy | `OFFICE_ADMIN` grants — oversight / envelope only |
| Domain | Same as org admin: recommend/decide require EVALUATOR/APPROVER |
| Web perms | `OFFICE_ADMIN_PERMISSIONS` without case-acting permissions |
| Nav | Recommendations hidden when `submit-` / `act-recommendations` absent |

---

## Evaluator (PRD §4.4)

**Can**

- View and act on office-pool (or assigned) evaluation tasks: evaluate, endorse, flag.
- Register / verify beneficiaries and validate relationships (policy scope).
- Use web `/staff` evaluator queue.

**Cannot**

- Approve or reject the same application they endorsed (separation of duties).
- Decide applications (Approver permission).
- Cross office / organization boundaries.

**Current enforcement**

| Layer | Pointer |
| --- | --- |
| Policy | `application.evaluate` / `endorse` / `flag` at `assigned_task`; office pool when assignee is null |
| Domain | `recommend` → `decideRbac(..., 'application.endorse')`; completes evaluation task with `assigneeUserId` |
| SOD | `decide` loads prior evaluation assignee; blocks if `evaluatedByUserId === actor` |
| Web | Staff page mode from Nest session `role` (no free Evaluator/Approver toggle) |

---

## Approver (PRD §4.5)

**Can**

- View and act on office-pool (or assigned) approval tasks: approve, reject, authorize disbursement (policy).
- Use web `/staff` approver queue for cases they did not endorse.

**Cannot**

- Approve/reject a case they personally endorsed.
- Endorse as Evaluator without that role assignment.
- Cross office / organization boundaries.

**Current enforcement**

| Layer | Pointer |
| --- | --- |
| Policy | `application.approve` / `reject` + SOD on both |
| Domain | `decide` → `decideRbac` with prior `evaluatedByUserId` |
| Web | Approver-only actions when session role is `approver` |

---

## Beneficiary (PRD §4.6)

**Can** — own-account applications, relationships, disbursement auth, notifications (see mobile summary).

**Cannot** — other beneficiaries’ data; staff/admin web surfaces; case authority.

**Current enforcement** — mobile platform gate + `BENEFICIARY` `own_account` grants; web home `/get-app`.

---

## Dependent (beneficiary-class, Office Admin–approved link)

Dependent is **not** a separate product client. It is a beneficiary account on mobile. Links are **beneficiary ↔ beneficiary only** (mutual and one-to-many allowed), with proof documents required.

1. Either beneficiary requests the link → status `requested` + `relationship_documents`
2. **Office Admin** reviews proof → `relationship.approve` → status `approved` (activated)

Evaluator / Approver do **not** approve relationships (those roles are for case workflow only).

**Current enforcement**

| Layer | Pointer |
| --- | --- |
| Platform | `DEPENDENT` ∈ `MOBILE_ERD_ROLES` (same as Beneficiary) |
| Policy | `OFFICE_ADMIN` → `relationship.approve` @ office; parties → `relationship.request` |
| Domain | Proof required on create; approve blocked without documents |
| Mobile | Request link + notarized proof flag |

---

## Workflow engine (template vs engine instance)

| Concept | Cardinality | Notes |
| --- | --- | --- |
| Workflow **template** | Reusable per organization | `workflow_templates` + `workflow_template_steps` |
| Program version **engine** | Exactly **one** per `program_template_version` | `workflow_definitions.program_template_version_id UNIQUE` |
| Apply template | Copy steps into a new engine | `POST /program-versions/:id/workflow` — fails if an engine already exists |
| Sharing | Template reusable; **engine never shared** across programs | `source_workflow_template_id` is lineage only |

---

## Acceptance checklist (this alignment pass)

- [x] Seeded org/office admin Nest `recommend` / `decide` → **403**
- [x] Evaluator can recommend; same user `decide` on that case → **403** (SOD)
- [x] Approver can decide cases they did not endorse
- [x] Platform admin JWT cannot open `/admin/applications` (middleware redirect); domain APIs reject platform admin
- [x] Beneficiary mobile-only / staff web-only (unchanged platform policy)
- [x] Admin Recommendations / staff entry no longer act as Approver without Approver role

---

## Out of scope (this pass)

Offline evaluator field ops, AI advisory, LandBank integration, full Nest template/workflow migration, Dependent login client.
