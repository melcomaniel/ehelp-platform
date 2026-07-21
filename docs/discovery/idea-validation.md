# Idea Validation — A Single Front Door to Philippine Government Financial Aid

> **For:** eGovHackathon 2026, DICT · **Venue:** SMX Convention Center Aura, Taguig · **Window:** Jul 21–22, 2026

Validating the pitch — a citizen-facing app that unifies discovery, application, and status tracking across DOLE, DSWD, and other agencies' cash and livelihood programs — against the realities of what's already being built, what's legally possible, and what actually breaks for citizens today.

## At a glance

| | |
|---|---|
| **Pain point** | Real, and independently evidenced by COA/PSA findings |
| **Biggest risk** | Overlaps DICT's own eGovPay + SuperApp roadmap |
| **Legal role** | Discovery + intake + orchestration, **not** the approving authority |
| **Demo scope** | 3 flagship programs, not "all agencies" |

---

## 1. Competition context — who you're pitching to

**The organizer is already building the two pieces you'd normally have to build yourself.**

eGovHackathon 2026 is run by DICT's eGovernment Office. DICT is, at the same time, the co-developer (with LandBank and the Bureau of the Treasury) of:

- **eGovPay** — the centralized government payment gateway, already live for 1,500+ billers, with full PhilSys-linked e-money disbursement via QR PH targeted for rollout this year.
- **eGovPH SuperApp** — explicitly meant to become the citizen's single mobile entry point to government services, with eGovPay as its payment layer underneath.

> **What this means for the pitch**
> A team that shows up proposing to build its own payment rail and its own "everything app" is competing with the host. A team that proposes the missing layer *on top of* eGovPay/PhilSys — cross-agency **eligibility discovery and intake orchestration** — is proposing a feature DICT can actually adopt. That reframing is most of the validation work here.

---

## 2. Pain points — does the problem actually exist?

Yes — and it's better documented than most hackathon pitches get to claim.

| Status | Pain point | Detail |
|---|---|---|
| ✅ Validated | **Fragmentation across agencies** | 15+ national agencies run overlapping but separately-administered cash, livelihood, and subsidy programs, each with distinct forms, eligibility rules, and payout channels (LandBank cash cards, GCash, checks, over-the-counter). No agency tells a citizen what they qualify for *across* agencies. |
| ✅ Validated | **Duplicate & ineligible disbursement at scale** | COA flagged **≈₱926 million** in DSWD AKAP funds paid to unqualified recipients and double payments. PSA's match of the old Listahanan-3 database against PhilSys turned up **50,443** probable duplicate beneficiary records. |
| ✅ Validated | **Targeting infrastructure is mid-migration** | DSWD retired Listahanan in favor of PSA's CBMS (per RA 11315), but agencies report mismatches between CBMS and PhilSys records — different surname spellings, stale addresses — that still require manual reconciliation. |
| ⚠️ Partially addressable | **Awareness gap** | Discretionary programs like AICS are demand-driven: citizens must know to ask. A discovery layer helps — but not the discretionary judgment that decides who receives AICS (that stays human). |
| ⚠️ Not solved by an app | **Delay is often the budget, not the paperwork** | Rollouts (AKAP tranches, 4Ps top-ups) are frequently gated by GAA allocation and DBM fund-release schedules, not application processing time. Say this explicitly so judges don't expect the app to fix something outside its control. |

### Citizen-centric pain points (the human cost)

- **Lost wages to get aid** — a full day queuing means skipping work and losing pay.
- **Back-and-forth trips** — unclear requirements send applicants home to return again and again.
- **Long waits** — hours in line, weeks for a result, no visibility in between.

**The throughline:** the people the programs exist for pay the highest price to reach them — in time, income, and effort.

### Government / oversight pain points

- **COA audits after the fact** — findings surface months later; there's no real-time control that stops a duplicate or ineligible release *before* the money moves.
- **Budget-release status is opaque** — whether a program is actually funded and releasing (SARO / NCA issued) is invisible to the frontline and the citizen, so "delays" get blamed on paperwork when the real bottleneck is fund release.

---

## 3. Agency landscape — financial-support programs beyond DOLE & DSWD

Grouped by the kind of need they cover, to show this isn't only a poverty-alleviation app — it's a livelihood, crisis, and financial-inclusion app.

### Poverty & crisis cash transfer
| Agency | Program | Who it's for |
|---|---|---|
| DSWD | 4Ps (Pantawid Pamilyang Pilipino Program) | Poor households, conditional cash transfer, up to 7 yrs |
| DSWD | AICS (Assistance to Individuals in Crisis Situations) | Families facing medical, burial, transport, or crisis emergencies |
| DSWD | AKAP (Ayuda para sa Kapos ang Kita Program) | Low/near-minimum-wage earners not covered by 4Ps, inflation relief |
| DSWD | Social Pension for Indigent Senior Citizens | Indigent seniors 60+ |
| DSWD | Walang Gutom / Supplementary Feeding Program | Food-insecure households and children |
| LGUs | Local "ayuda" cash/relief programs | Constituents — highest volume, least standardized |

### Employment & livelihood
| Agency | Program | Who it's for |
|---|---|---|
| DOLE | TUPAD | Informal, underemployed, displaced workers — short-term emergency employment |
| DOLE | DILP (DOLE Integrated Livelihood Program) | Self-employment starter kits/capital for vulnerable workers |
| DOLE | JobStart Philippines | Young jobseekers — training + job-matching allowance |
| DSWD | SLP (Sustainable Livelihood Program) | Household/community microenterprise & employment grants |

### Overseas Filipino Workers
| Agency | Program | Who it's for |
|---|---|---|
| DOLE / OWWA | AKAP for displaced OFWs *(different agency & purpose from DSWD's AKAP)* | OFWs displaced by crises abroad |
| OWWA | EDLP (Enterprise Development & Loan Program) | OFWs and families starting a business on return |
| OWWA | OFW dependents' education/scholarship program | Children of active OWWA members |

### Agriculture & fisheries
| Agency | Program | Who it's for |
|---|---|---|
| DA | RFFA / fertilizer & cash subsidy | Rice farmers affected by tariff/price shifts |
| DA–ACPC | SURE Aid, KAYA (Kapital Access for Young Agripreneurs) | Farmers, fisherfolk, young agri-entrepreneurs — microfinance |
| PCIC | Agricultural insurance premium subsidy | Farmers/fisherfolk, crop and life cover |

### MSME & entrepreneurship
| Agency | Program | Who it's for |
|---|---|---|
| DTI | P3 (Pondo sa Pagbabago at Pag-asenso) | Micro/small enterprises needing affordable financing |
| SB Corp (DTI) | Bayanihan CARES / RESET lending | MSMEs recovering from shocks |
| DTI | Negosyo Center advisory + registration | Walk-in MSME founders (physical one-stop model) |

### Education & training allowances
| Agency | Program | Who it's for |
|---|---|---|
| TESDA | TWSP (Training-for-Work Scholarship Program) | Trainees — free training + daily allowance |
| CHED | TES / UniFAST | College students from low-income households |
| DepEd | ESC vouchers | Students in private JHS under the voucher scheme |
| DSWD | Tulong Eskwela | Senior high students needing back-to-school assistance |

### Insurance, loans & financial inclusion
| Agency | Program | Who it's for |
|---|---|---|
| SSS | Unemployment insurance, sickness/maternity, calamity loans | Private-sector members |
| GSIS | Emergency & calamity loans, benefits | Government employees |
| Pag-IBIG | Multi-Purpose & calamity loans, housing loans | Fund members |
| PhilHealth | Konsulta package, Z Benefits | All members — coverage rather than cash, but offsets burden |

### Health, housing & other crisis aid
| Agency | Program | Who it's for |
|---|---|---|
| DOH | Malasakit Center medical financial assistance | Indigent patients (pooled DOH/PCSO/PhilHealth funding) |
| PCSO | Individual medical/burial assistance | Indigent individuals |
| NHA | Housing/resettlement financial assistance | Informal settler families, disaster-displaced households |
| DOTr / LTFRB | Pantawid Pasada fuel subsidy | PUV/PUJ drivers and operators |

> ⚠️ **Acronym collision to flag in your deck:** "AKAP" refers to *two different programs* — DOLE/OWWA's OFW cash aid and DSWD's low-income-earner inflation relief. Naming clarity in your app's program catalog matters.

---

## 4. Adjacent infrastructure — integrate, don't rebuild

| Rail | Role in your product |
|---|---|
| **PhilSys** | National ID as identity anchor — use it for applicant verification and de-duplication instead of building your own KYC. |
| **CBMS (PSA)** | Successor to Listahanan for household targeting/means data. Your eligibility pre-check should query this, not re-collect income data. |
| **eGovPay** | DICT/LandBank/BTr's live payment gateway. Disbursement should be a call to eGovPay, not a feature you build. |
| **eGovPH SuperApp** | DICT's planned single citizen entry point. Best-case outcome: becoming a module inside it, not a competing download. |

---

## 5. Critique

### Strengths
- **The core insight is correct.** Fragmentation and duplicate-payment problems are real, current, and publicly documented — you're not inventing a problem to fit a solution.
- **Configurable workflow engine is the right architecture.** Letting each agency define its own stages (documents → verification → approval) instead of hardcoding one flow is what makes onboarding agency #4 through #15 tractable without a rewrite.
- **Natural fit for the host's stated priorities.** DICT is visibly investing in this kind of interoperability layer, so the pitch aligns with where the buyer is already headed.

### Risks to address head-on
- **You cannot legally "approve" on an agency's behalf.** Approval authority is vested in each agency's own officials under their program's IRR (e.g. a DSWD social worker's case validation for AICS). Your workflow engine can route, remind, and log the approval step — the decision itself must be executed by the agency's authorized user or system, even inside your UI.
- **Interoperability is the real project, and it's not small.** Getting even 3 agencies to expose or accept structured data (vs. PDF/paper) is a multi-month integration effort each, often gated by legacy systems and data-sharing agreements (Data Privacy Act compliance, NPC registration).
- **Aggregating PII + income + payout data is a high-value target.** A breach here is category-different — PhilSys IDs plus financial-need data plus disbursement records in one place. Security/privacy architecture must be part of the pitch, not an afterthought.
- **Mobile-only excludes the people the programs are for.** Many beneficiaries are informal workers, elderly, or in low-connectivity areas. Without an assisted channel (barangay kiosk, SMS updates, agent-assisted intake), the app serves the digitally-included subset best, not the neediest.
- **An app can't fix a funding delay.** Faster intake ≠ faster money when the bottleneck is GAA allocation or DBM release timing — judges with agency experience will ask this.

---

## 6. Recommended positioning — orchestration layer, not payer

Keep the ambitious per-agency workflow engine while staying inside what's legally and technically credible.

```
Citizen: eligibility check
   → Citizen: submit documents
      → [Agency: verify & approve]      ← stays under agency authority
         → Platform: trigger payout via eGovPay
            → Citizen: status + receipt
```

Each agency configures its own sequence of stages (which documents, how many review steps, who signs off), but the **approve** stage always resolves to an action taken by that agency's authorized staff or system. Your platform makes that step visible, timed, and auditable to the citizen — it does not perform it. That distinction turns "an app that disburses government money" (a hard sell to any public-finance judge) into "a shared front door and case-management layer" (a credible, fundable proposal).

---

## 7. API integrations — eGov Developer Portal

All nine platform APIs map onto the flow. Two of them (eGovChain, Compass) are direct answers to critiques above.

### Tier 1 — core flow (commit to these)
| API | Where it lives in your flow | Why it matters |
|---|---|---|
| **eGov SSO** | Citizen login — the "single front door" | OAuth 2.0 auth-code flow via drop-in widget. The entry point to the whole ecosystem. |
| **eVerify** | Identity + de-duplication before an application is accepted | Real-time PhilSys verification with built-in consent. Direct answer to the COA ₱926M duplicate finding. |
| **Face Liveness** | Biometric step inside eVerify | Required companion — the eVerify `/api/query` call needs a `face_liveness_session_id`. Threshold: status `SUCCEEDED` + confidence ≥ 95. |
| **eMessage** | Status updates at every stage | SMS/email/in-app. The SMS channel is also the answer to the "mobile-only excludes people" critique. |
| **eGovPay** | Payout / settlement stage | ⚠️ Documented as fee *collection*; confirm with organizers whether it disburses outward — if not, present it as the reconciliation/settlement rail. |

### Tier 2 — differentiators (these win the pitch)
| API | Where it lives in your flow | Why it matters |
|---|---|---|
| **eGovChain** | Anchor application → approval → disbursement records | Zero-fee Hyperledger Besu. Turns every case into an immutable, auditable trail — the structural answer to ghost/duplicate beneficiaries. |
| **Compass** | Program discovery + "is this actually funded?" | Live DBM budget data (SARO/NCA/SAAODB). Directly answers the "an app can't fix a funding delay" critique. |
| **eGov AI** | Document intake, language, and discovery | Document Extractor (OCR requirements), Translator (Filipino/regional languages), AI Assistant (conversational "what do I qualify for"). |

### Tier 3 — optional / supporting
| API | Where it lives in your flow | Why it matters |
|---|---|---|
| **eReport** | Grievance/appeal channel + address data | Lets a citizen dispute a rejection with OTP-verified tracking. Also ships free PSA geographic datasets (region → province → municipality → barangay) for address forms. |

**End-to-end API sequence:**

1. **eGov SSO** — sign in (citizen / social worker)
2. **Face Liveness** — prove a live person is present → `session_id`
3. **eVerify** — match demographics + liveness against PhilSys, de-duplicate
4. **Compass** + **eGov AI** — discover funded & eligible programs; OCR + translate documents
5. **Workflow Engine** — route through the agency's configured stages (our engine, not an external API)
6. **eGovChain** — anchor the record immutably
7. **eGovPay** — disburse & reconcile
8. **eMessage** + **eReport** — notify throughout; appeal channel if rejected

> **One-line pitch:** log in once (SSO), get verified against PhilSys (eVerify + Face Liveness), see only programs you qualify for that are actually funded (Compass + eGov AI), upload requirements that are auto-read (eGov AI), get routed through each agency's own approval with every step anchored immutably (eGovChain), be paid and reconciled through one rail (eGovPay), and stay informed by SMS even without a smartphone (eMessage). Seven of nine platform APIs in service of one coherent flow.

---

## 8. Pilot scope — three flagship programs

Chosen for maximum overlap in target beneficiary (informal/displaced worker households) and because each represents a different workflow shape.

| Agency | Program | Workflow shape it demonstrates |
|---|---|---|
| **DSWD** | AICS or AKAP | Discretionary, means-tested: eligibility pre-check against CBMS, document upload, case-officer approval. |
| **DOLE** | TUPAD | Multi-stage, batch-oriented: barangay endorsement → DOLE field-office validation → payroll. |
| **OWWA** | OFW displacement cash aid | Agency with its own separate identity check (OWWA membership) layered on top of PhilSys. |

---

## 9. Open questions to resolve on the floor

- **Data-sharing basis:** demo with a signed data-sharing agreement/MOU concept per agency, or mocked data? Judges will ask how you get real access.
- **Who owns a rejected application?** If DSWD rejects but the same documents qualify for a DOLE program, does your engine suggest the next-best program automatically? Strong demo moment if you have it.
- **Assisted-channel plan:** what's the answer for the citizen with no smartphone? Even a one-slide answer (barangay kiosk / LGU desk on the same backend) closes a predictable gap.
- **Live vs. mocked:** be upfront about which of the 3 pilot flows are live end-to-end versus scripted — credibility holds up better than overclaiming.

---

## Sources consulted

1. [Rappler — COA audit: ₱926M in AKAP funds to unqualified/duplicate recipients](https://www.rappler.com/philippines/audit-dswd-akap-program-2024-unqualified-recipients-double-payments/)
2. [PhilSys — PSA/DSWD working group on CBMS–PhilSys matching, 50,443 duplicate records](https://philsys.gov.ph/psa-dswd-forms-a-working-group-to-utilize-cbms-and-philsys-towards-strengthened-social-protection-programs/)
3. [PNA — Listahanan sunset, CBMS takes over per RA 11315](https://www.pna.gov.ph/articles/1201622)
4. [eGovPay — official platform overview](https://egovpay.gov.ph/)
5. [Rappler — single platform for all government payments (eGovPay/QR PH/PhilSys)](https://www.rappler.com/business/philippines-developing-single-platform-all-government-payments/)
6. [Malasakit Center — one-stop medical financial assistance model](https://en.wikipedia.org/wiki/Malasakit_Center)
7. [BitDigest — eGovHackathon 2026 details (DICT, SMX Aura, Jul 21–22)](https://www.bitdigest.io/posts/bettergov-ph-egovph-teases-egovhackathon-2026)
8. [DSWD — Ayuda Para sa Kapos ang Kita Program (AKAP)](https://www.dswd.gov.ph/akap/)
9. [DOLE-CAR — CAMP, TUPAD, and AKAP overview](https://car.dole.gov.ph/news/camp-tupad-and-akap/)

> Program names, budgets, and agency ownership shift year to year with the GAA — verify current status of any figure here before it goes in a final pitch deck.
