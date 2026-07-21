export type StepType = "form" | "verify" | "review" | "disbursement"

export const STEP_TYPE_LABEL: Record<StepType, string> = {
  form: "Form",
  verify: "Identity Verify",
  review: "Review",
  disbursement: "Disbursement",
}

export type FieldType =
  | "text"
  | "textarea"
  | "number"
  | "date"
  | "select"
  | "checkbox"
  | "file"

export type DecisionAction = "approve" | "return" | "reject"

export type RoleKey = "admin" | "applicant" | "reviewer" | "approver" | "social_worker"

export const ROLE_LABEL: Record<RoleKey, string> = {
  admin: "Admin",
  applicant: "Applicant",
  reviewer: "Reviewer",
  approver: "Approver",
  social_worker: "Social Worker",
}

export type Classification = "simple" | "complex" | "highly_technical"

export const CLASSIFICATION_LABEL: Record<Classification, string> = {
  simple: "Simple · 3 working days",
  complex: "Complex · 7 working days",
  highly_technical: "Highly Technical · 20 working days",
}

export type TemplateStatus = "draft" | "published" | "archived"
export type VersionStatus = "draft" | "published" | "archived"

export interface WorkflowTemplate {
  id: string
  name: string
  description: string
  status: TemplateStatus
  stepSetId: string
}

export interface Program {
  id: string
  name: string
  description: string
  classification: Classification
  createdFromTemplateId: string | null
}

export interface ProgramVersion {
  id: string
  programId: string
  versionNo: number
  status: VersionStatus
  stepSetId: string
  publishedAt?: string
}

export interface StepSet {
  id: string
}

export interface Step {
  id: string
  stepSetId: string
  position: number
  type: StepType
  name: string
  /** review + disbursement steps */
  assignedRole: RoleKey | null
  /** hard lock — always false for review (§2.1) */
  autoAdvance: boolean
  /** verify steps: which checks run (mocked; no real eVerify API) */
  verifyConfig?: VerifyConfig
}

export interface VerifyConfig {
  /** provider label shown to the applicant, e.g. "eVerify" */
  provider: string
  faceLiveness: boolean
  philsysMatch: boolean
}

export type DisbursementInstrument = "cash" | "check" | "egovpay" | "guarantee_letter"

export const INSTRUMENT_LABEL: Record<DisbursementInstrument, string> = {
  cash: "Cash",
  check: "Check",
  egovpay: "eGovPay",
  guarantee_letter: "Guarantee Letter",
}

export interface FormField {
  id: string
  stepId: string
  position: number
  type: FieldType
  label: string
  helpText: string
  required: boolean
}

export interface FieldOption {
  id: string
  fieldId: string
  position: number
  value: string
  label: string
}

export interface FileRule {
  id: string
  fieldId: string
  allowedMime: string[]
  maxSizeMb: number
  minCount: number
  maxCount: number
}

export interface StepAction {
  id: string
  stepId: string
  action: DecisionAction
  enabled: boolean
  commentRequired: boolean
}

export interface ReasonCode {
  id: string
  stepActionId: string
  position: number
  code: string
  label: string
}

export interface AppUser {
  id: string
  name: string
  roles: RoleKey[]
}

export type ApplicationStatus =
  | "draft"
  | "verifying"
  | "submitted"
  | "returned"
  | "approved"
  | "disbursed"
  | "rejected"

export const APPLICATION_STATUS_LABEL: Record<ApplicationStatus, string> = {
  draft: "Draft",
  verifying: "Verifying",
  submitted: "Submitted",
  returned: "Returned",
  approved: "Approved",
  disbursed: "Disbursed",
  rejected: "Rejected",
}

export interface FileMeta {
  name: string
  sizeBytes: number
  mime: string
  /** object URL — not persisted across reloads; metadata is */
  url?: string
}

export interface WorkflowApplication {
  id: string
  programId: string
  programVersionId: string
  applicantId: string
  /** decision step the application is waiting at; null when terminal or draft */
  currentStepId: string | null
  status: ApplicationStatus
  createdAt: string
  updatedAt: string
}

export interface Answer {
  id: string
  applicationId: string
  fieldId: string
  value: string
  checked: boolean
  files: FileMeta[]
}

export type EventAction =
  | "submit"
  | "resubmit"
  | "verify"
  | "approve"
  | "return"
  | "reject"
  | "disburse"
  | "comment"

export interface ApplicationEvent {
  id: string
  applicationId: string
  actorId: string
  action: EventAction
  fromStepId: string | null
  toStepId: string | null
  reasonCodeId: string | null
  comment: string | null
  at: string
}

/** Result of clearing a verify step (applicant-driven mock face check). */
export interface VerifyResult {
  id: string
  applicationId: string
  stepId: string
  passed: boolean
  faceScore: number
  at: string
}

/** Record of a disbursement release. */
export interface Disbursement {
  id: string
  applicationId: string
  stepId: string
  payee: string
  amount: number
  instrument: DisbursementInstrument
  releasedBy: string
  at: string
}

/**
 * The reviewer's verdict on one checklist item of a review step. itemKey is
 * stable per submitted input: the field id for an answer, `${fieldId}#${index}`
 * per file. Approve-the-application requires every item approved; a rejected
 * item flags what to fix (the reviewer then returns or rejects the whole
 * application — item rejects never partially reject it).
 */
export interface ReviewCheck {
  id: string
  applicationId: string
  stepId: string
  itemKey: string
  verdict: "approved" | "rejected"
  checkedBy: string
  at: string
}

export interface WorkflowState {
  actingUserId: string
  users: AppUser[]
  templates: WorkflowTemplate[]
  programs: Program[]
  versions: ProgramVersion[]
  stepSets: StepSet[]
  steps: Step[]
  fields: FormField[]
  options: FieldOption[]
  fileRules: FileRule[]
  stepActions: StepAction[]
  reasonCodes: ReasonCode[]
  applications: WorkflowApplication[]
  answers: Answer[]
  events: ApplicationEvent[]
  verifyResults: VerifyResult[]
  disbursements: Disbursement[]
  reviewChecks: ReviewCheck[]
}
