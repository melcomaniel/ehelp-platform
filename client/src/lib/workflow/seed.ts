import type {
  Answer,
  ApplicationEvent,
  FieldOption,
  FileRule,
  FormField,
  ReasonCode,
  Step,
  StepAction,
  WorkflowState,
} from "./types"

// ---------------------------------------------------------------------------
// Deterministic fixtures — fixed IDs, fixed timestamps. The store hydrates
// from this when empty; "Reset demo data" restores it exactly.
// ---------------------------------------------------------------------------

/**
 * Builds one full step set (form → verify → review → director review → disbursement) with the given id
 * prefix. Used twice: once for the template ("T") and once for the program
 * version ("P") — the program's copy is what a real `copyStepSet` produces.
 */
function buildStepSet(p: string) {
  const stepSetId = `SS-${p}`
  const formId = `ST-${p}-FORM`
  const verifyId = `ST-${p}-VER`
  const reviewId = `ST-${p}-REV`
  const approvalId = `ST-${p}-APPR`
  const disburseId = `ST-${p}-DSB`

  const steps: Step[] = [
    { id: formId, stepSetId, position: 1, type: "form", name: "Application Form", assignedRole: null, autoAdvance: true },
    { id: verifyId, stepSetId, position: 2, type: "verify", name: "Face Verification", assignedRole: null, autoAdvance: false, verifyConfig: { provider: "eVerify", faceLiveness: true, philsysMatch: false } },
    { id: reviewId, stepSetId, position: 3, type: "review", name: "Section Head Review", assignedRole: "reviewer", autoAdvance: false },
    { id: approvalId, stepSetId, position: 4, type: "review", name: "Director Review", assignedRole: "approver", autoAdvance: false },
    { id: disburseId, stepSetId, position: 5, type: "disbursement", name: "Cashier Disbursement", assignedRole: "admin", autoAdvance: false },
  ]

  const fields: FormField[] = [
    { id: `FLD-${p}-1`, stepId: formId, position: 1, type: "text", label: "Full name", helpText: "As it appears on your government ID", required: true },
    { id: `FLD-${p}-2`, stepId: formId, position: 2, type: "date", label: "Date of birth", helpText: "", required: true },
    { id: `FLD-${p}-3`, stepId: formId, position: 3, type: "number", label: "Monthly household income (PHP)", helpText: "Combined income of all household members", required: true },
    { id: `FLD-${p}-4`, stepId: formId, position: 4, type: "select", label: "Assistance type", helpText: "", required: true },
    { id: `FLD-${p}-5`, stepId: formId, position: 5, type: "textarea", label: "Reason for request", helpText: "Describe your situation briefly", required: true },
    { id: `FLD-${p}-6`, stepId: formId, position: 6, type: "file", label: "Supporting documents", helpText: "Barangay certificate, medical abstract, or similar proof", required: true },
    { id: `FLD-${p}-7`, stepId: formId, position: 7, type: "checkbox", label: "I certify that the information provided is true and correct", helpText: "", required: true },
  ]

  const options: FieldOption[] = [
    { id: `OPT-${p}-1`, fieldId: `FLD-${p}-4`, position: 1, value: "medical", label: "Medical" },
    { id: `OPT-${p}-2`, fieldId: `FLD-${p}-4`, position: 2, value: "burial", label: "Burial" },
    { id: `OPT-${p}-3`, fieldId: `FLD-${p}-4`, position: 3, value: "educational", label: "Educational" },
    { id: `OPT-${p}-4`, fieldId: `FLD-${p}-4`, position: 4, value: "food", label: "Food" },
  ]

  const fileRules: FileRule[] = [
    { id: `FR-${p}-1`, fieldId: `FLD-${p}-6`, allowedMime: ["application/pdf", "image/jpeg", "image/png"], maxSizeMb: 5, minCount: 1, maxCount: 3 },
  ]

  const stepActions: StepAction[] = [
    { id: `ACT-${p}-REV-APPROVE`, stepId: reviewId, action: "approve", enabled: true, commentRequired: false },
    { id: `ACT-${p}-REV-RETURN`, stepId: reviewId, action: "return", enabled: true, commentRequired: true },
    { id: `ACT-${p}-REV-REJECT`, stepId: reviewId, action: "reject", enabled: true, commentRequired: true },
    { id: `ACT-${p}-APPR-APPROVE`, stepId: approvalId, action: "approve", enabled: true, commentRequired: false },
    { id: `ACT-${p}-APPR-RETURN`, stepId: approvalId, action: "return", enabled: true, commentRequired: true },
    { id: `ACT-${p}-APPR-REJECT`, stepId: approvalId, action: "reject", enabled: true, commentRequired: true },
  ]

  const reasonCodes: ReasonCode[] = [
    { id: `RC-${p}-REV-RET-1`, stepActionId: `ACT-${p}-REV-RETURN`, position: 1, code: "missing-document", label: "Missing document" },
    { id: `RC-${p}-REV-RET-2`, stepActionId: `ACT-${p}-REV-RETURN`, position: 2, code: "incomplete-info", label: "Incomplete information" },
    { id: `RC-${p}-REV-REJ-1`, stepActionId: `ACT-${p}-REV-REJECT`, position: 1, code: "not-eligible", label: "Not eligible" },
    { id: `RC-${p}-REV-REJ-2`, stepActionId: `ACT-${p}-REV-REJECT`, position: 2, code: "duplicate", label: "Duplicate application" },
    { id: `RC-${p}-APPR-RET-1`, stepActionId: `ACT-${p}-APPR-RETURN`, position: 1, code: "needs-clarification", label: "Needs clarification" },
    { id: `RC-${p}-APPR-REJ-1`, stepActionId: `ACT-${p}-APPR-REJECT`, position: 1, code: "not-eligible", label: "Not eligible" },
    { id: `RC-${p}-APPR-REJ-2`, stepActionId: `ACT-${p}-APPR-REJECT`, position: 2, code: "budget-exhausted", label: "Budget exhausted" },
  ]

  return { stepSetId, formId, verifyId, reviewId, approvalId, disburseId, steps, fields, options, fileRules, stepActions, reasonCodes }
}

const U = {
  admin: "U-ADMIN",
  reviewer: "U-REV",
  approver: "U-APPR",
  socialWorker: "U-SW",
  a1: "U-APP-1",
  a2: "U-APP-2",
  a3: "U-APP-3",
  a4: "U-APP-4",
  a5: "U-APP-5",
  a6: "U-APP-6",
}

const T = buildStepSet("T") // owned by the template
const P = buildStepSet("P") // the Financial Assistance program version's copy

/**
 * 4Ps program step set: Form → Identity Verify → Review → Disbursement.
 * The review is assigned to the social worker, who verifies each submitted
 * item (checklist) before approving.
 */
function build4Ps() {
  const stepSetId = "SS-F"
  const formId = "ST-F-FORM"
  const verifyId = "ST-F-VER"
  const reviewId = "ST-F-REV"
  const disburseId = "ST-F-DSB"

  const steps: Step[] = [
    { id: formId, stepSetId, position: 1, type: "form", name: "Application Form", assignedRole: null, autoAdvance: true },
    { id: verifyId, stepSetId, position: 2, type: "verify", name: "Identity Verification", assignedRole: null, autoAdvance: false, verifyConfig: { provider: "eVerify", faceLiveness: true, philsysMatch: true } },
    { id: reviewId, stepSetId, position: 3, type: "review", name: "Social Worker Review", assignedRole: "social_worker", autoAdvance: false },
    { id: disburseId, stepSetId, position: 4, type: "disbursement", name: "Cash Grant Disbursement", assignedRole: "admin", autoAdvance: false },
  ]

  const fields: FormField[] = [
    { id: "FLD-F-1", stepId: formId, position: 1, type: "text", label: "Household head full name", helpText: "As it appears on the PhilSys ID", required: true },
    { id: "FLD-F-2", stepId: formId, position: 2, type: "date", label: "Date of birth", helpText: "", required: true },
    { id: "FLD-F-3", stepId: formId, position: 3, type: "number", label: "Number of children (0–18)", helpText: "Qualified household members", required: true },
    { id: "FLD-F-4", stepId: formId, position: 4, type: "number", label: "Monthly household income (PHP)", helpText: "Combined income of all members", required: true },
    { id: "FLD-F-5", stepId: formId, position: 5, type: "select", label: "Grant component", helpText: "", required: true },
    { id: "FLD-F-6", stepId: formId, position: 6, type: "textarea", label: "Household situation", helpText: "Brief description for the case record", required: true },
    { id: "FLD-F-7", stepId: formId, position: 7, type: "file", label: "Proof of residence", helpText: "Barangay certificate or utility bill", required: true },
    { id: "FLD-F-8", stepId: formId, position: 8, type: "file", label: "Children's school enrolment", helpText: "Enrolment form or school ID", required: true },
    { id: "FLD-F-9", stepId: formId, position: 9, type: "checkbox", label: "I certify the information is true and consent to verification", helpText: "", required: true },
  ]

  const options: FieldOption[] = [
    { id: "OPT-F-1", fieldId: "FLD-F-5", position: 1, value: "health", label: "Health grant" },
    { id: "OPT-F-2", fieldId: "FLD-F-5", position: 2, value: "education", label: "Education grant" },
    { id: "OPT-F-3", fieldId: "FLD-F-5", position: 3, value: "both", label: "Health + Education" },
  ]

  const fileRules: FileRule[] = [
    { id: "FR-F-1", fieldId: "FLD-F-7", allowedMime: ["application/pdf", "image/jpeg", "image/png"], maxSizeMb: 5, minCount: 1, maxCount: 2 },
    { id: "FR-F-2", fieldId: "FLD-F-8", allowedMime: ["application/pdf", "image/jpeg", "image/png"], maxSizeMb: 5, minCount: 1, maxCount: 3 },
  ]

  const stepActions: StepAction[] = [
    { id: "ACT-F-REV-APPROVE", stepId: reviewId, action: "approve", enabled: true, commentRequired: false },
    { id: "ACT-F-REV-RETURN", stepId: reviewId, action: "return", enabled: true, commentRequired: true },
    { id: "ACT-F-REV-REJECT", stepId: reviewId, action: "reject", enabled: true, commentRequired: true },
  ]

  const reasonCodes: ReasonCode[] = [
    { id: "RC-F-RET-1", stepActionId: "ACT-F-REV-RETURN", position: 1, code: "missing-document", label: "Missing document" },
    { id: "RC-F-RET-2", stepActionId: "ACT-F-REV-RETURN", position: 2, code: "unclear-scan", label: "Unclear document scan" },
    { id: "RC-F-REJ-1", stepActionId: "ACT-F-REV-REJECT", position: 1, code: "not-eligible", label: "Not eligible" },
    { id: "RC-F-REJ-2", stepActionId: "ACT-F-REV-REJECT", position: 2, code: "duplicate", label: "Duplicate household" },
  ]

  return { stepSetId, formId, verifyId, reviewId, disburseId, steps, fields, options, fileRules, stepActions, reasonCodes }
}

const F = build4Ps()

interface FourPsAnswerSpec {
  name: string
  dob: string
  children: string
  income: string
  component: string
  situation: string
}

function fourPsAnswers(appId: string, spec: FourPsAnswerSpec): Answer[] {
  const mk = (n: number, patch: Partial<Answer>): Answer => ({
    id: `ANS-${appId}-${n}`,
    applicationId: appId,
    fieldId: `FLD-F-${n}`,
    value: "",
    checked: false,
    files: [],
    ...patch,
  })
  return [
    mk(1, { value: spec.name }),
    mk(2, { value: spec.dob }),
    mk(3, { value: spec.children }),
    mk(4, { value: spec.income }),
    mk(5, { value: spec.component }),
    mk(6, { value: spec.situation }),
    mk(7, { files: [{ name: "barangay-certificate.pdf", sizeBytes: 260_000, mime: "application/pdf" }] }),
    mk(8, { files: [{ name: "enrolment-form.jpg", sizeBytes: 480_000, mime: "image/jpeg" }] }),
    mk(9, { checked: true }),
  ]
}

interface FourPsAppSpec {
  id: string
  applicantId: string
  status: WorkflowState["applications"][number]["status"]
  currentStepId: string | null
  createdAt: string
  answers: FourPsAnswerSpec
  events: Omit<ApplicationEvent, "applicationId">[]
}

// all 4Ps apps are filed and submitted; the social worker reviews them
const FOURPS_APPS: FourPsAppSpec[] = [
  {
    id: "FPS-001", applicantId: U.a1, status: "submitted", currentStepId: F.reviewId,
    createdAt: "2026-07-16T01:00:00.000Z",
    answers: { name: "Maria Reyes", dob: "1988-03-12", children: "3", income: "8500", component: "both", situation: "Solo parent of three school-age children; irregular laundry income." },
    events: [
      { id: "EFPS-001-1", actorId: U.a1, action: "submit", fromStepId: null, toStepId: F.verifyId, reasonCodeId: null, comment: null, at: "2026-07-16T01:00:00.000Z" },
      { id: "EFPS-001-2", actorId: U.a1, action: "verify", fromStepId: F.verifyId, toStepId: F.reviewId, reasonCodeId: null, comment: "Face check passed (94%)", at: "2026-07-16T01:05:00.000Z" },
    ],
  },
  {
    id: "FPS-002", applicantId: U.a2, status: "submitted", currentStepId: F.reviewId,
    createdAt: "2026-07-16T03:20:00.000Z",
    answers: { name: "Jose Bautista", dob: "1979-08-21", children: "2", income: "9200", component: "education", situation: "Two children in elementary; seasonal farm worker." },
    events: [
      { id: "EFPS-002-1", actorId: U.a2, action: "submit", fromStepId: null, toStepId: F.verifyId, reasonCodeId: null, comment: null, at: "2026-07-16T03:20:00.000Z" },
      { id: "EFPS-002-2", actorId: U.a2, action: "verify", fromStepId: F.verifyId, toStepId: F.reviewId, reasonCodeId: null, comment: "Face check passed (91%)", at: "2026-07-16T03:24:00.000Z" },
    ],
  },
  {
    id: "FPS-003", applicantId: U.a3, status: "submitted", currentStepId: F.reviewId,
    createdAt: "2026-07-17T05:10:00.000Z",
    answers: { name: "Ana Dela Cruz", dob: "1991-12-02", children: "4", income: "7600", component: "health", situation: "Four children; spouse unemployed after factory closure." },
    events: [
      { id: "EFPS-003-1", actorId: U.a3, action: "submit", fromStepId: null, toStepId: F.verifyId, reasonCodeId: null, comment: null, at: "2026-07-17T05:10:00.000Z" },
      { id: "EFPS-003-2", actorId: U.a3, action: "verify", fromStepId: F.verifyId, toStepId: F.reviewId, reasonCodeId: null, comment: "Face check passed (96%)", at: "2026-07-17T05:15:00.000Z" },
    ],
  },
  {
    id: "FPS-004", applicantId: U.a4, status: "verifying", currentStepId: F.verifyId,
    createdAt: "2026-07-18T02:30:00.000Z",
    answers: { name: "Liza Moreno", dob: "1985-05-19", children: "1", income: "10100", component: "education", situation: "One child entering senior high; single income." },
    events: [
      { id: "EFPS-004-1", actorId: U.a4, action: "submit", fromStepId: null, toStepId: F.verifyId, reasonCodeId: null, comment: null, at: "2026-07-18T02:30:00.000Z" },
    ],
  },
  {
    id: "FPS-005", applicantId: U.a5, status: "approved", currentStepId: F.disburseId,
    createdAt: "2026-07-14T04:00:00.000Z",
    answers: { name: "Carlo Aquino", dob: "1983-02-27", children: "3", income: "8800", component: "both", situation: "Three children; recovering from illness, reduced work hours." },
    events: [
      { id: "EFPS-005-1", actorId: U.a5, action: "submit", fromStepId: null, toStepId: F.verifyId, reasonCodeId: null, comment: null, at: "2026-07-14T04:00:00.000Z" },
      { id: "EFPS-005-2", actorId: U.a5, action: "verify", fromStepId: F.verifyId, toStepId: F.reviewId, reasonCodeId: null, comment: "Face check passed (93%)", at: "2026-07-14T04:05:00.000Z" },
      { id: "EFPS-005-3", actorId: U.socialWorker, action: "approve", fromStepId: F.reviewId, toStepId: F.disburseId, reasonCodeId: null, comment: "All items verified; endorsing for disbursement.", at: "2026-07-15T02:00:00.000Z" },
    ],
  },
  {
    id: "FPS-006", applicantId: U.a6, status: "disbursed", currentStepId: null,
    createdAt: "2026-07-12T06:00:00.000Z",
    answers: { name: "Nena Flores", dob: "1970-10-08", children: "2", income: "6900", component: "health", situation: "Grandmother caring for two grandchildren." },
    events: [
      { id: "EFPS-006-1", actorId: U.a6, action: "submit", fromStepId: null, toStepId: F.verifyId, reasonCodeId: null, comment: null, at: "2026-07-12T06:00:00.000Z" },
      { id: "EFPS-006-2", actorId: U.a6, action: "verify", fromStepId: F.verifyId, toStepId: F.reviewId, reasonCodeId: null, comment: "Face check passed (90%)", at: "2026-07-12T06:05:00.000Z" },
      { id: "EFPS-006-3", actorId: U.socialWorker, action: "approve", fromStepId: F.reviewId, toStepId: F.disburseId, reasonCodeId: null, comment: "Verified.", at: "2026-07-13T01:00:00.000Z" },
      { id: "EFPS-006-4", actorId: U.admin, action: "disburse", fromStepId: F.disburseId, toStepId: null, reasonCodeId: null, comment: "Released ₱4,400 to Nena Flores", at: "2026-07-13T03:00:00.000Z" },
    ],
  },
]

interface AnswerSpec {
  name: string
  dob: string
  income: string
  type: string
  reason: string
  file?: { name: string; sizeBytes: number; mime: string }
}

function answersFor(appId: string, spec: AnswerSpec): Answer[] {
  const mk = (n: number, patch: Partial<Answer>): Answer => ({
    id: `ANS-${appId}-${n}`,
    applicationId: appId,
    fieldId: `FLD-P-${n}`,
    value: "",
    checked: false,
    files: [],
    ...patch,
  })
  return [
    mk(1, { value: spec.name }),
    mk(2, { value: spec.dob }),
    mk(3, { value: spec.income }),
    mk(4, { value: spec.type }),
    mk(5, { value: spec.reason }),
    mk(6, { files: [spec.file ?? { name: "barangay-certificate.pdf", sizeBytes: 240_000, mime: "application/pdf" }] }),
    mk(7, { checked: true }),
  ]
}

interface AppSpec {
  id: string
  applicantId: string
  answers: AnswerSpec
  /** coherent history; last event decides status/currentStep */
  events: Omit<ApplicationEvent, "applicationId">[]
  status: WorkflowState["applications"][number]["status"]
  currentStepId: string | null
  createdAt: string
}

const APPS: AppSpec[] = [
  // -- waiting at review (≥6) ------------------------------------------------
  {
    id: "APP-001", applicantId: U.a1, status: "submitted", currentStepId: P.reviewId,
    createdAt: "2026-07-14T08:05:00.000Z",
    answers: { name: "Maria Reyes", dob: "1988-03-12", income: "9500", type: "medical", reason: "Hospitalization of my youngest child; need help with hospital bill balance.", file: { name: "medical-abstract.pdf", sizeBytes: 1_240_000, mime: "application/pdf" } },
    events: [{ id: "EVT-001-1", actorId: U.a1, action: "submit", fromStepId: null, toStepId: P.reviewId, reasonCodeId: null, comment: null, at: "2026-07-14T08:05:00.000Z" }],
  },
  {
    id: "APP-002", applicantId: U.a2, status: "submitted", currentStepId: P.reviewId,
    createdAt: "2026-07-15T02:40:00.000Z",
    answers: { name: "Jose Bautista", dob: "1975-11-02", income: "8200", type: "burial", reason: "Funeral expenses for my late father; family has no savings left." },
    events: [{ id: "EVT-002-1", actorId: U.a2, action: "submit", fromStepId: null, toStepId: P.reviewId, reasonCodeId: null, comment: null, at: "2026-07-15T02:40:00.000Z" }],
  },
  {
    id: "APP-003", applicantId: U.a3, status: "submitted", currentStepId: P.reviewId,
    createdAt: "2026-07-15T09:12:00.000Z",
    answers: { name: "Ana Dela Cruz", dob: "1992-06-24", income: "11000", type: "educational", reason: "School fees for two children this semester after losing my market stall." },
    events: [{ id: "EVT-003-1", actorId: U.a3, action: "submit", fromStepId: null, toStepId: P.reviewId, reasonCodeId: null, comment: null, at: "2026-07-15T09:12:00.000Z" }],
  },
  {
    id: "APP-004", applicantId: U.a4, status: "submitted", currentStepId: P.reviewId,
    createdAt: "2026-07-16T04:55:00.000Z",
    answers: { name: "Liza Moreno", dob: "1983-01-30", income: "7800", type: "food", reason: "Household food support while recovering from surgery and unable to work." },
    events: [{ id: "EVT-004-1", actorId: U.a4, action: "submit", fromStepId: null, toStepId: P.reviewId, reasonCodeId: null, comment: null, at: "2026-07-16T04:55:00.000Z" }],
  },
  {
    id: "APP-005", applicantId: U.a5, status: "submitted", currentStepId: P.reviewId,
    createdAt: "2026-07-17T01:20:00.000Z",
    answers: { name: "Carlo Aquino", dob: "1990-09-08", income: "10200", type: "medical", reason: "Dialysis sessions for my mother, twice weekly; income cannot cover them." },
    events: [{ id: "EVT-005-1", actorId: U.a5, action: "submit", fromStepId: null, toStepId: P.reviewId, reasonCodeId: null, comment: null, at: "2026-07-17T01:20:00.000Z" }],
  },
  {
    id: "APP-006", applicantId: U.a6, status: "submitted", currentStepId: P.reviewId,
    createdAt: "2026-07-17T10:47:00.000Z",
    answers: { name: "Nena Flores", dob: "1968-12-15", income: "6400", type: "medical", reason: "Maintenance medication for hypertension and diabetes; senior with no pension." },
    events: [{ id: "EVT-006-1", actorId: U.a6, action: "submit", fromStepId: null, toStepId: P.reviewId, reasonCodeId: null, comment: null, at: "2026-07-17T10:47:00.000Z" }],
  },
  {
    id: "APP-012", applicantId: U.a3, status: "submitted", currentStepId: P.reviewId,
    createdAt: "2026-07-20T07:30:00.000Z",
    answers: { name: "Ana Dela Cruz", dob: "1992-06-24", income: "11000", type: "food", reason: "Food assistance while waiting for the educational grant decision." },
    events: [{ id: "EVT-012-1", actorId: U.a3, action: "submit", fromStepId: null, toStepId: P.reviewId, reasonCodeId: null, comment: null, at: "2026-07-20T07:30:00.000Z" }],
  },
  // -- waiting at the second review (≥2) -------------------------------------
  {
    id: "APP-007", applicantId: U.a1, status: "submitted", currentStepId: P.approvalId,
    createdAt: "2026-07-13T03:15:00.000Z",
    answers: { name: "Maria Reyes", dob: "1988-03-12", income: "9500", type: "educational", reason: "Enrollment fees for my eldest entering senior high school." },
    events: [
      { id: "EVT-007-1", actorId: U.a1, action: "submit", fromStepId: null, toStepId: P.reviewId, reasonCodeId: null, comment: null, at: "2026-07-13T03:15:00.000Z" },
      { id: "EVT-007-2", actorId: U.reviewer, action: "approve", fromStepId: P.reviewId, toStepId: P.approvalId, reasonCodeId: null, comment: "Documents complete, recommending approval.", at: "2026-07-14T06:00:00.000Z" },
    ],
  },
  {
    id: "APP-008", applicantId: U.a5, status: "submitted", currentStepId: P.approvalId,
    createdAt: "2026-07-13T08:44:00.000Z",
    answers: { name: "Carlo Aquino", dob: "1990-09-08", income: "10200", type: "burial", reason: "Burial assistance for my brother; funeral parlor bill attached." },
    events: [
      { id: "EVT-008-1", actorId: U.a5, action: "submit", fromStepId: null, toStepId: P.reviewId, reasonCodeId: null, comment: null, at: "2026-07-13T08:44:00.000Z" },
      { id: "EVT-008-2", actorId: U.reviewer, action: "approve", fromStepId: P.reviewId, toStepId: P.approvalId, reasonCodeId: null, comment: null, at: "2026-07-15T05:30:00.000Z" },
    ],
  },
  // -- returned ---------------------------------------------------------------
  {
    id: "APP-009", applicantId: U.a2, status: "returned", currentStepId: P.reviewId,
    createdAt: "2026-07-12T06:10:00.000Z",
    answers: { name: "Jose Bautista", dob: "1975-11-02", income: "8200", type: "medical", reason: "Check-up and laboratory fees after workplace injury." },
    events: [
      { id: "EVT-009-1", actorId: U.a2, action: "submit", fromStepId: null, toStepId: P.reviewId, reasonCodeId: null, comment: null, at: "2026-07-12T06:10:00.000Z" },
      { id: "EVT-009-2", actorId: U.reviewer, action: "return", fromStepId: P.reviewId, toStepId: P.reviewId, reasonCodeId: "RC-P-REV-RET-1", comment: "Please attach the medical abstract from the attending physician.", at: "2026-07-13T02:25:00.000Z" },
    ],
  },
  // -- approved, waiting at disbursement --------------------------------------
  {
    id: "APP-010", applicantId: U.a4, status: "approved", currentStepId: P.disburseId,
    createdAt: "2026-07-10T01:05:00.000Z",
    answers: { name: "Liza Moreno", dob: "1983-01-30", income: "7800", type: "medical", reason: "Post-operative medication and follow-up consultations." },
    events: [
      { id: "EVT-010-1", actorId: U.a4, action: "submit", fromStepId: null, toStepId: P.reviewId, reasonCodeId: null, comment: null, at: "2026-07-10T01:05:00.000Z" },
      { id: "EVT-010-2", actorId: U.reviewer, action: "approve", fromStepId: P.reviewId, toStepId: P.approvalId, reasonCodeId: null, comment: "Verified with barangay; endorsing.", at: "2026-07-11T03:40:00.000Z" },
      { id: "EVT-010-3", actorId: U.approver, action: "approve", fromStepId: P.approvalId, toStepId: P.disburseId, reasonCodeId: null, comment: "Approved for release.", at: "2026-07-12T08:15:00.000Z" },
    ],
  },
  // -- rejected ----------------------------------------------------------------
  {
    id: "APP-011", applicantId: U.a6, status: "rejected", currentStepId: P.reviewId,
    createdAt: "2026-07-11T09:50:00.000Z",
    answers: { name: "Nena Flores", dob: "1968-12-15", income: "6400", type: "burial", reason: "Burial support request for a distant relative." },
    events: [
      { id: "EVT-011-1", actorId: U.a6, action: "submit", fromStepId: null, toStepId: P.reviewId, reasonCodeId: null, comment: null, at: "2026-07-11T09:50:00.000Z" },
      { id: "EVT-011-2", actorId: U.reviewer, action: "reject", fromStepId: P.reviewId, toStepId: null, reasonCodeId: "RC-P-REV-REJ-1", comment: "Assistance is limited to immediate family members of the applicant.", at: "2026-07-12T04:00:00.000Z" },
    ],
  },
  // -- disbursed (complete) ---------------------------------------------------
  {
    id: "APP-013", applicantId: U.a1, status: "disbursed", currentStepId: null,
    createdAt: "2026-07-08T02:00:00.000Z",
    answers: { name: "Maria Reyes", dob: "1988-03-12", income: "9500", type: "food", reason: "Food assistance after typhoon damaged our home." },
    events: [
      { id: "EVT-013-1", actorId: U.a1, action: "submit", fromStepId: null, toStepId: P.reviewId, reasonCodeId: null, comment: null, at: "2026-07-08T02:00:00.000Z" },
      { id: "EVT-013-2", actorId: U.reviewer, action: "approve", fromStepId: P.reviewId, toStepId: P.approvalId, reasonCodeId: null, comment: null, at: "2026-07-08T06:00:00.000Z" },
      { id: "EVT-013-3", actorId: U.approver, action: "approve", fromStepId: P.approvalId, toStepId: P.disburseId, reasonCodeId: null, comment: "Approved for release.", at: "2026-07-09T01:00:00.000Z" },
      { id: "EVT-013-4", actorId: U.approver, action: "disburse", fromStepId: P.disburseId, toStepId: null, reasonCodeId: null, comment: "Released ₱5,000 to Maria Reyes", at: "2026-07-09T03:30:00.000Z" },
    ],
  },
]

export const SEED: WorkflowState = {
  actingUserId: U.admin,
  users: [
    { id: U.admin, name: "Amara Santos", roles: ["admin"] },
    { id: U.reviewer, name: "Rosa Dizon", roles: ["reviewer"] },
    { id: U.approver, name: "Diego Ramos", roles: ["approver"] },
    { id: U.socialWorker, name: "Grace Villanueva", roles: ["social_worker"] },
    { id: U.a1, name: "Maria Reyes", roles: ["applicant"] },
    { id: U.a2, name: "Jose Bautista", roles: ["applicant"] },
    { id: U.a3, name: "Ana Dela Cruz", roles: ["applicant"] },
    { id: U.a4, name: "Liza Moreno", roles: ["applicant"] },
    { id: U.a5, name: "Carlo Aquino", roles: ["applicant"] },
    { id: U.a6, name: "Nena Flores", roles: ["applicant"] },
  ],
  templates: [
    {
      id: "TPL-STD",
      name: "Standard Assistance Flow",
      description: "Form → Section Head Review → Director Approval. Baseline flow for cash assistance programs.",
      status: "published",
      stepSetId: T.stepSetId,
    },
  ],
  programs: [
    {
      id: "PRG-FA",
      name: "Financial Assistance",
      description: "Cash assistance for individuals in crisis situations (medical, burial, educational, food).",
      classification: "simple",
      createdFromTemplateId: "TPL-STD",
    },
    {
      id: "PRG-4PS",
      name: "4Ps Financial Aid",
      description: "Pantawid Pamilyang Pilipino Program — conditional cash grant for qualified households. Social worker reviews each application item by item.",
      classification: "complex",
      createdFromTemplateId: null,
    },
  ],
  versions: [
    {
      id: "VER-FA-1",
      programId: "PRG-FA",
      versionNo: 1,
      status: "published",
      stepSetId: P.stepSetId,
      publishedAt: "2026-07-09T08:00:00.000Z",
    },
    {
      id: "VER-4PS-1",
      programId: "PRG-4PS",
      versionNo: 1,
      status: "published",
      stepSetId: F.stepSetId,
      publishedAt: "2026-07-11T08:00:00.000Z",
    },
  ],
  stepSets: [{ id: T.stepSetId }, { id: P.stepSetId }, { id: F.stepSetId }],
  steps: [...T.steps, ...P.steps, ...F.steps],
  fields: [...T.fields, ...P.fields, ...F.fields],
  options: [...T.options, ...P.options, ...F.options],
  fileRules: [...T.fileRules, ...P.fileRules, ...F.fileRules],
  stepActions: [...T.stepActions, ...P.stepActions, ...F.stepActions],
  reasonCodes: [...T.reasonCodes, ...P.reasonCodes, ...F.reasonCodes],
  applications: [
    ...APPS.map((a) => ({
      id: a.id,
      programId: "PRG-FA",
      programVersionId: "VER-FA-1",
      applicantId: a.applicantId,
      currentStepId: a.currentStepId,
      status: a.status,
      createdAt: a.createdAt,
      updatedAt: a.events[a.events.length - 1]?.at ?? a.createdAt,
    })),
    ...FOURPS_APPS.map((a) => ({
      id: a.id,
      programId: "PRG-4PS",
      programVersionId: "VER-4PS-1",
      applicantId: a.applicantId,
      currentStepId: a.currentStepId,
      status: a.status,
      createdAt: a.createdAt,
      updatedAt: a.events[a.events.length - 1]?.at ?? a.createdAt,
    })),
  ],
  answers: [
    ...APPS.flatMap((a) => answersFor(a.id, a.answers)),
    ...FOURPS_APPS.flatMap((a) => fourPsAnswers(a.id, a.answers)),
  ],
  events: [
    ...APPS.flatMap((a) => a.events.map((e) => ({ ...e, applicationId: a.id }))),
    ...FOURPS_APPS.flatMap((a) => a.events.map((e) => ({ ...e, applicationId: a.id }))),
  ].sort((x, y) => x.at.localeCompare(y.at)),
  verifyResults: [],
  disbursements: [
    {
      id: "DSB-013",
      applicationId: "APP-013",
      stepId: P.disburseId,
      payee: "Maria Reyes",
      amount: 5000,
      instrument: "egovpay",
      releasedBy: U.approver,
      at: "2026-07-09T03:30:00.000Z",
    },
    {
      id: "DSB-FPS-006",
      applicationId: "FPS-006",
      stepId: F.disburseId,
      payee: "Nena Flores",
      amount: 4400,
      instrument: "egovpay",
      releasedBy: U.admin,
      at: "2026-07-13T03:00:00.000Z",
    },
  ],
  reviewChecks: [],
}
