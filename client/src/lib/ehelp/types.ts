export type Role = "dswd-admin" | "satellite-admin" | "approver" | "evaluator"

export type Region = "NCR" | "Region III" | "Region VII"

export const REGIONS: Region[] = ["NCR", "Region III", "Region VII"]

export const ROLE_LABEL: Record<Role, string> = {
  "dswd-admin": "DSWD Admin",
  "satellite-admin": "Satellite Admin",
  approver: "Regional Approver",
  evaluator: "Regional Evaluator",
}

export const ROLE_TIER: Record<Role, string> = {
  "dswd-admin": "Tier 1 · System-wide",
  "satellite-admin": "Tier 2 · Region-wide",
  approver: "Tier 3 · Case-level",
  evaluator: "Tier 4 · Case-level",
}

export type Permission =
  | "view-analytics"
  | "manage-templates"
  | "customize-templates"
  | "manage-rbac"
  | "manage-region-rbac"
  | "approve-accounts"
  | "register-accounts"
  | "evaluate-applications"
  | "approve-applications"
  | "release-disbursements"
  | "register-customers"
  | "submit-recommendations"
  | "act-recommendations"
  | "view-audit"

export const PERMISSION_LABEL: Record<Permission, string> = {
  "view-analytics": "View analytics",
  "manage-templates": "Create / edit master templates",
  "customize-templates": "Customize templates (own region)",
  "manage-rbac": "Manage RBAC (all roles)",
  "manage-region-rbac": "Manage RBAC (own region)",
  "approve-accounts": "Approve internal accounts",
  "register-accounts": "Register internal accounts",
  "evaluate-applications": "Register / evaluate applications",
  "approve-applications": "Approve / decline applications",
  "release-disbursements": "Release disbursements",
  "register-customers": "Register customers (ID + face scan)",
  "submit-recommendations": "Submit priority recommendations",
  "act-recommendations": "Act on recommendations",
  "view-audit": "View security audit log",
}

export type ApplicationStatus =
  | "Submitted"
  | "In Evaluation"
  | "For Approval"
  | "Approved"
  | "Declined"
  | "Disbursed"

export interface Application {
  id: string
  customerId: string
  templateId: string
  region: Region
  status: ApplicationStatus
  priority: "High" | "Medium" | "Low"
  filedBy: "Customer" | "Evaluator"
  note?: string
  updatedAt: string
}

export interface Customer {
  id: string
  name: string
  region: Region
  philsysId: string
  idRecords: boolean
  faceScan: "Verified" | "Pending"
  disbursementPref: "Bank" | "E-wallet" | "Cash pickup" | "—"
  lastDisbursedAt?: string
}

export interface Dependent {
  id: string
  name: string
  customerId: string
  kind: "Dependent" | "Guarantor"
  relationshipRecord: boolean
  notarizedLetter: boolean
  status: "Pending Validation" | "Active"
}

export interface Template {
  id: string
  name: string
  program: string
  cooldownDays: number
  requirements: string
  active: boolean
}

export interface RegionalOverride {
  templateId: string
  region: Region
  eligibilityNote: string
  cooldownDays?: number
}

export interface Recommendation {
  id: string
  subject: string
  priority: "High" | "Medium" | "Low"
  submittedBy: string
  region: Region
  status: "Open" | "Acted"
  note: string
}

export interface InternalAccount {
  id: string
  name: string
  role: Role
  region: Region | "Central"
  status: "Pending Approval" | "Active"
  pinAgeDays: number
  otpEnabled: boolean
  faceEnrolled: boolean
}

export interface AuditEvent {
  id: string
  ts: string
  actor: string
  action: string
  detail: string
}

export interface Session {
  role: Role
  region: Region
}

export interface EhelpState {
  session: Session
  rbac: Record<Role, Permission[]>
  customers: Customer[]
  dependents: Dependent[]
  applications: Application[]
  templates: Template[]
  overrides: RegionalOverride[]
  recommendations: Recommendation[]
  accounts: InternalAccount[]
  audit: AuditEvent[]
}
