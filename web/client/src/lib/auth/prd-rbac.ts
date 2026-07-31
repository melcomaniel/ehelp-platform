import type { AppRole } from "@/lib/auth/types";

export type PrdRole =
  | "platform_admin"
  | "dswd_admin"
  | "satellite_admin"
  | "evaluator"
  | "approver"
  | "customer";

export type PrdScope =
  | "platform"
  | "platform_aggregate"
  | "organization"
  | "office"
  | "assigned_task"
  | "own_account";

export type PrdPermission =
  | "tenant.create"
  | "tenant.suspend"
  | "tenant.archive"
  | "security_baseline.manage"
  | "role_catalog.manage"
  | "integration_credentials.manage"
  | "audit.view_platform"
  | "analytics.view_platform_aggregate"
  | "office.manage"
  | "program_template.manage"
  | "program_template.override_bounds_define"
  | "program_template.override_allowed_fields"
  | "office_staff.assign"
  | "analytics.view_org"
  | "analytics.view_office"
  | "audit.view_org"
  | "audit.view_office"
  | "beneficiary.register"
  | "beneficiary.verify_identity"
  | "relationship.request"
  | "relationship.validate"
  | "relationship.approve"
  | "application.submit"
  | "application.evaluate"
  | "application.approve"
  | "disbursement.authenticate"
  | "disbursement.authorize";

export type PrdGrant = {
  permission: PrdPermission;
  scope: PrdScope;
};

export const PRD_ROLE_LABEL: Record<PrdRole, string> = {
  platform_admin: "Platform Administrator",
  dswd_admin: "Organization Administrator",
  satellite_admin: "Office Administrator",
  evaluator: "Evaluator",
  approver: "Approver",
  customer: "Beneficiary",
};

export const PRD_PERMISSION_LABEL: Record<PrdPermission, string> = {
  "tenant.create": "Create / onboard tenants",
  "tenant.suspend": "Suspend / reactivate tenants",
  "tenant.archive": "Archive tenants",
  "security_baseline.manage": "Manage platform security baseline",
  "role_catalog.manage": "Manage platform role catalog",
  "integration_credentials.manage": "Manage shared integrations",
  "audit.view_platform": "View platform audit logs",
  "analytics.view_platform_aggregate": "View aggregate platform analytics",
  "office.manage": "Manage organization offices",
  "program_template.manage": "Create / publish program templates",
  "program_template.override_bounds_define": "Define office override bounds",
  "program_template.override_allowed_fields": "Apply allowed office overrides",
  "office_staff.assign": "Assign office staff to tasks",
  "analytics.view_org": "View organization analytics",
  "analytics.view_office": "View office analytics",
  "audit.view_org": "View organization audit logs",
  "audit.view_office": "View office audit logs",
  "beneficiary.register": "Register beneficiaries",
  "beneficiary.verify_identity": "Verify identity / documents",
  "relationship.request": "Request relationships",
  "relationship.validate": "Validate relationship proof",
  "relationship.approve": "Approve relationships",
  "application.submit": "Submit own applications",
  "application.evaluate": "Evaluate assigned applications",
  "application.approve": "Approve / reject assigned applications",
  "disbursement.authenticate": "Authenticate own disbursement",
  "disbursement.authorize": "Authorize disbursement release",
};

export const PRD_ROLE_GRANTS: Record<PrdRole, PrdGrant[]> = {
  platform_admin: [
    { permission: "tenant.create", scope: "platform" },
    { permission: "tenant.suspend", scope: "platform" },
    { permission: "tenant.archive", scope: "platform" },
    { permission: "security_baseline.manage", scope: "platform" },
    { permission: "role_catalog.manage", scope: "platform" },
    { permission: "integration_credentials.manage", scope: "platform" },
    { permission: "audit.view_platform", scope: "platform" },
    {
      permission: "analytics.view_platform_aggregate",
      scope: "platform_aggregate",
    },
  ],
  dswd_admin: [
    { permission: "office.manage", scope: "organization" },
    { permission: "program_template.manage", scope: "organization" },
    {
      permission: "program_template.override_bounds_define",
      scope: "organization",
    },
    { permission: "analytics.view_org", scope: "organization" },
    { permission: "audit.view_org", scope: "organization" },
  ],
  satellite_admin: [
    {
      permission: "program_template.override_allowed_fields",
      scope: "office",
    },
    { permission: "office_staff.assign", scope: "office" },
    { permission: "analytics.view_office", scope: "office" },
    { permission: "audit.view_office", scope: "office" },
    { permission: "relationship.approve", scope: "office" },
  ],
  evaluator: [
    { permission: "beneficiary.register", scope: "office" },
    { permission: "beneficiary.verify_identity", scope: "office" },
    { permission: "application.evaluate", scope: "assigned_task" },
  ],
  approver: [
    { permission: "application.approve", scope: "assigned_task" },
    { permission: "disbursement.authorize", scope: "assigned_task" },
  ],
  customer: [
    { permission: "relationship.request", scope: "own_account" },
    { permission: "application.submit", scope: "own_account" },
    { permission: "disbursement.authenticate", scope: "own_account" },
  ],
};

export const PRD_EXPLICIT_DENIES: Record<PrdRole, string[]> = {
  platform_admin: [
    "No beneficiary PII, biometrics, disbursement details, or case decisions",
    "No organization program template, workflow, or rule authoring",
  ],
  dswd_admin: [
    "No cross-tenant data",
    "No application approve/reject unless separately assigned as Approver",
  ],
  satellite_admin: [
    "No cross-office data",
    "No direct approve/reject unless separately assigned as Approver",
    "No workflow, disbursement, or notification rule changes",
  ],
  evaluator: [
    "No approval of personally evaluated applications",
    "No program configuration or disbursement authorization",
  ],
  approver: [
    "No approval of personally evaluated applications",
    "No program configuration or AI-originated automatic decisions",
  ],
  customer: ["No other beneficiary data", "No bypass of Rule Engine or approval"],
};

export function toPrdRole(role: AppRole): PrdRole | null {
  // Dependent is beneficiary-class for grants (own_account + relationship link).
  if (role === "dependent") return "customer";
  return Object.hasOwn(PRD_ROLE_GRANTS, role) ? (role as PrdRole) : null;
}

/** True when the app role is a mobile beneficiary-class persona. */
export function isBeneficiaryClassRole(role: AppRole): boolean {
  return role === "customer" || role === "dependent";
}
