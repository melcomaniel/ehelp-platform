# Workflow Engine — Step Palette & Cross-Cutting Design

Grounded in the **2020 DSWD Citizens Charter (4th Edition)** — the real, published process tables for the pilot programs. This is the spec for what our workflow engine must be able to express. Companion to `CLAUDE.md` (positioning) and `idea-validation.md` (context).

---

## 0. The core insight

Every government service in the Citizens Charter is defined by **one standardized table**:

> Office/Division · Classification · Type of Transaction · Who may avail · **Checklist of Requirements** · then rows of **`CLIENT STEPS | AGENCY ACTIONS | FEES | PROCESSING TIME | PERSON RESPONSIBLE`**

That grid *is* a workflow definition. Our engine is a digital, configurable version of it:

| Charter column | Engine concept |
|---|---|
| Classification (Simple / Complex / Highly Technical) | SLA tier (3 / 7 / 20 working days — ARTA) |
| Type of Transaction (G2C / G2G / G2B) | Applicant channel |
| Who may avail | Eligibility precondition |
| Checklist of Requirements | Required inputs / document set (varies by sub-type) |
| Client Steps | Applicant-facing actions |
| Agency Actions | Internal step + its automated/human logic |
| Processing Time | Per-step SLA timer |
| Person Responsible | Role assignment |

**If the engine can render any Citizens Charter service as a runnable workflow, it works for all 15+ agencies.** That is the product.

---

## 1. Step palette (step types)

The unit of a workflow is a **PROGRAM** (not an agency). A program is an ordered graph of these step types. Validated against AICS, Social Pension, and the disbursement leg.

| # | Step type | What it does | Typical actor | Auto / Human |
|---|---|---|---|---|
| 1 | **Intake / Form** | Capture applicant + household, assign case ID, encode (DSWD: CRiMS + spreadsheet) | Applicant / Social Worker (assisted) | Human-entered |
| 2 | **Identity Verify** | Gov ID → our PhilSys match + Face Liveness + de-dup | System (eVerify, Face Liveness) | Auto |
| 3 | **Document Intake + Extraction** | Collect checklist docs, OCR/classify, flag missing → **return-for-compliance loop** | System (eGov AI OCR) + Applicant | Auto + Human |
| 4 | **Eligibility Pre-check** | Rules filter: budget funded (Compass), program match, threshold, duplicate flag | System | Auto |
| 5 | **Assessment + Recommendation** ⚠️ | **Human social-worker judgment**: interview, Social Case Study, recommend assistance *type* + *amount*. Legally load-bearing — this is NOT the eligibility gate. | Social Worker | **Human, mandatory** |
| 6 | **Routing / Assignment** | Route instance to field office by **jurisdiction** (PSA region→prov→city→brgy) and by **amount band** | System | Auto |
| 7 | **Endorsement** | Sign-off by an actor *below/outside* the agency (barangay endorsement, LGU list) | Barangay / LGU | Human |
| 8 | **Review** | First-level check of completeness + recommendation; outcomes: approve / **return** / reject | Section Head / OIC | Human |
| 9 | **Approval** (multi-level) | Authorized officer decides. Escalates by **amount tier**. The decision always stays here. | Officer → Div Chief → ARD → RD → … | **Human, mandatory** |
| 10 | **Disbursement** | Release funds. **Payee = citizen OR service provider.** Instrument = cash / guarantee letter / check / eGovPay. ID check + claimant signs Acknowledgement Receipt. | Disbursing Officer / Cashier | Human + System |
| 11 | **Notify** | Status at every transition (SMS/email — eMessage); e.g. "guarantee letter approved" | System (eMessage) | Auto |
| 12 | **Anchor** | Write immutable record of application → assessment → approval → disbursement (eGovChain) | System | Auto |
| 13 | **Appeal / Grievance** | Reopen via redress channel (8888 / Grievance Redress System), OTP-tracked | Applicant → Auditor | Human |

⚠️ **Steps 4 vs 5 is the single most important design distinction** — see §2.1.

---

## 2. Things we must not forget (cross-cutting)

### 2.1 Assessment is human — the engine must enforce it
DSWD eligibility is *"based on the assessment of the Social Worker."* An automated rules engine (step 4) can only **pre-filter and recommend** — it can never be the deciding node. Every money-releasing workflow must have a **mandatory human Assessment (step 5)** and a **mandatory human Approval (step 9)**, and the engine must refuse to auto-advance past them. This is not a UX nicety; it is what keeps us legally credible (each program's IRR mandates an authorized officer). Design the step type with an `auto_advance = false` hard lock.

### 2.2 SLA / timers
- **Classification sets the ceiling** (Anti-Red-Tape Act / RA 11032): **Simple = 3 days, Complex = 7 days, Highly Technical = 20 days.** Each program declares its class; the engine derives the overall SLA.
- **Per-step timers** exist too (charter lists minutes/hours per row). Model both: step-level SLA *and* end-to-end SLA.
- **Clock rules:** working days only; **pause on "returned to client for compliance"** (waiting on the citizen shouldn't burn the agency's clock — but track it separately); resume on resubmission.
- **Escalation on breach:** auto-notify the next-level approver / supervisor; surface in the agency dashboard. This is a headline COA/ARTA metric — make it visible.
- **Real reference SLAs:** AICS within-the-day = 60 min; AICS higher-amount guarantee letter = 3–5 days by tier; Social Pension pay-out = 15 min; Centenarian gift = 4 days; ESA (disaster) = **3 months**. SLAs span minutes to months — don't hard-code units.

### 2.3 Roles (RBAC) — including actors outside the agency
Observed in the charter, to seed the role model:

| Role | Does | Note |
|---|---|---|
| **Applicant** | Submits, complies, receives | Citizen self-service |
| **Social Worker** (SWO II) | Intake, encode, **assess, recommend**, sometimes release small cash | The pivotal role |
| **Section Head / OIC** | First-level review/approval | |
| **Approving Officer** | Div Chief → ARD → Regional Director → Usec → Secretary | **Tiered by amount** |
| **Disbursing Officer / Cashier** (Admin Officer III/V, SDO) | Prepares & releases funds | **Separation of duties** from approver |
| **Barangay / LGU** | Certificate of Indigency/Residency; endorsement; beneficiary lists | **External actor** — engine must support non-agency actors |
| **Auditor** | Grievance, oversight, reconciliation | |
| **Social Worker (assisted-access)** | Applies *on behalf of* offline/elderly/low-literacy citizens | Consent-first; citizen still does own liveness |

**Separation of duties is real and must be enforced:** the person who *recommends* ≠ who *approves* ≠ who *releases*. The claimant's signature on the DV Acknowledgement Receipt is the audit link tying released money to an approved voucher.

### 2.4 Actions (the verbs available on a step)
Each human step exposes a set of actions; each produces a transition + audit entry.

- **Applicant actions:** submit · comply/resubmit · withdraw · appeal · acknowledge receipt
- **Reviewer/Approver actions:** approve · **return** (for compliance, with reason) · reject (with reason) · endorse · escalate · reassign · request more info
- **Social Worker actions:** assess · recommend (type + amount) · attach Social Case Study Report
- **Disbursing actions:** verify ID · release · record instrument (cash/GL/check/eGovPay) · capture signature
- **System actions:** verify identity · OCR/extract · run eligibility · route (jurisdiction + amount) · start/pause/resume SLA clock · notify · anchor · flag duplicate

Every action must record **who, when, what, why** (reason codes for return/reject) — this is the audit trail COA wants and what we anchor.

### 2.5 Routing has two dimensions
1. **Jurisdiction** — national defines the template; the *instance* routes to the field office with authority over the applicant's location (PSA region → province → municipality → barangay; codes via eReport datasets).
2. **Amount** — bigger amount → higher approver. Model as configurable **peso bands → role** (AICS real bands: ≤₱10k Section Head; ₱25k–50k Div Chief; ₱50k–75k ARD; ₱75k–150k RD).

### 2.6 One program ≠ one workflow — variants
- **Sub-type swaps the requirements checklist.** AICS has 7 sub-types (medical / burial / educational / transportation / food / cash / PPE) sharing an intake shell but each with a different document set and eligibility proof. Model the checklist as a per-sub-type parameter.
- **A sub-type can swap the whole flow.** AICS **Emergency Shelter Assistance** is a different 9-step, list-based, disaster-triggered, Central-Office-funded, 3-month workflow. The engine must allow a sub-type to override the graph, not just the checklist.
- **Recurring / list-based programs.** Social Pension isn't per-application: eligibility is a **standing Certificate of Eligibility (CE)** list; each pay-out just validates ID against the list → disburse. Support a **validate-against-list → pay-out** shape alongside per-application intake.

### 2.7 Disbursement modalities (bigger than it looks)
- **Payee:** citizen **or** third-party **service provider** (DSWD pays the hospital/funeral parlor/school via *guarantee letter*).
- **Instrument:** cash outright · guarantee letter · check · (our addition) eGovPay / cash card / QR PH.
- **At release:** ID check + claimant signs Acknowledgement Receipt on the Disbursement Voucher.
- Implication: **eGovPay reconciliation must handle provider payees**, not only citizen payouts. Confirm eGovPay outward-disbursement direction (open question in `CLAUDE.md`).

### 2.8 Financial / audit artifacts to model (and anchor)
Certificate of Eligibility (CE) · Obligation Request & Status (ORS) · Disbursement Voucher (DV) · Guarantee Letter · Acknowledgement Receipt · Warranty/Release from Liability · Social Case Study Report. These are the paper trail; each is an **anchoring event** on eGovChain (application → assessment → approval → disbursement).

### 2.9 Template versioning
In-flight applications keep the template version they started on (audit + fairness). New submissions use the current version. Non-negotiable for a government audit trail.

### 2.10 Return-for-compliance loop
"If documents incomplete, client asked to comply" appears in nearly every service. Model as a first-class loop: **Review/Screening → Returned → (applicant resubmits) → back to Screening**, with the SLA clock paused while waiting on the citizen.

---

## 3. AICS worked example — state machine

```
Draft
  → Submitted            (applicant/social worker submits intake + docs)
  → Verifying            (identity verify + doc extraction)  ──▶ Returned (missing docs) ⟲
  → Assessed             (Social Worker interview + recommendation)   [human lock]
  → For Review           (Section Head first-level)          ──▶ Returned / Rejected
  → For Approval         (amount-tiered approver)            [human lock] ──▶ Rejected
  → Approved
  → For Disbursement     (payee = citizen | provider; instrument)
  → Disbursed            (ID check + Acknowledgement Receipt signed)
  → Closed
        Rejected / Returned / Appealed are side states; Appeal can reopen from Rejected.
Every transition → Notify (eMessage) + Anchor (eGovChain).
```

**Approval tiers (real AICS bands):** ≤₱10k → Section Head (same day) · ₱25k–50k → Division Chief (3d) · ₱50k–75k → Assistant Regional Director (5d) · ₱75k–150k → Regional Director.

---

## 4. Generalizing to the other two pilots (to confirm)

TUPAD and OWWA are **not** in the DSWD charter — they live in the DOLE and OWWA Citizens Charters. The palette above should cover them, but confirm these agency-specific shapes when we get their charters (drop the PDFs in the repo and I'll extract):

- **DOLE TUPAD** — emergency employment. Expect: **barangay/LGU endorsement + beneficiary list (batch intake)** up front (starts *below* the agency), a work-days component, then payout. Tests: step 7 (Endorsement) + batch/list intake (§2.6) + payout to worker.
- **OWWA OFW displacement aid** — expect: **OWWA membership verification** as the eligibility gate (a different verify source than PhilSys alone), possible overseas/repatriation intake channel, one-off cash aid. Tests: pluggable eligibility source + non-standard intake channel.

Each is a *different workflow shape* — which is exactly why they were chosen as pilots. The bet: same 13-step palette + the cross-cutting rules express all three. Confirm, don't assume.

---

## 5. Open questions carried from CLAUDE.md that touch the engine
- eGovPay outward-disbursement direction (affects step 10 + §2.7).
- Data-sharing basis per agency (affects what identity/eligibility sources are live).
- Cross-agency next-best-program suggestion on rejection (a new step-type candidate: **Refer-out**).
