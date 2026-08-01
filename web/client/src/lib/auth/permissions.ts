import type { AppRole } from "@/lib/auth/types";

/** DB `app_permission` enum values. */
export type DbPermission =
  | "view_analytics"
  | "manage_templates"
  | "customize_templates"
  | "manage_rbac"
  | "manage_region_rbac"
  | "approve_accounts"
  | "register_accounts"
  | "evaluate_applications"
  | "approve_applications"
  | "release_disbursements"
  | "register_customers"
  | "submit_recommendations"
  | "act_recommendations"
  | "view_audit";

/** UI / mock-store kebab form. */
export type UiPermission =
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
  | "view-audit";

export const DB_PERMISSIONS: DbPermission[] = [
  "view_analytics",
  "manage_templates",
  "customize_templates",
  "manage_rbac",
  "manage_region_rbac",
  "approve_accounts",
  "register_accounts",
  "evaluate_applications",
  "approve_applications",
  "release_disbursements",
  "register_customers",
  "submit_recommendations",
  "act_recommendations",
  "view_audit",
];

export const PERMISSION_LABEL: Record<DbPermission, string> = {
  view_analytics: "View analytics",
  manage_templates: "Create / edit master templates",
  customize_templates: "Customize templates (own region)",
  manage_rbac: "Manage RBAC (all roles)",
  manage_region_rbac: "Manage RBAC (own region)",
  approve_accounts: "Approve internal accounts",
  register_accounts: "Register internal accounts",
  evaluate_applications: "Register / evaluate applications",
  approve_applications: "Approve / decline applications",
  release_disbursements: "Release disbursements",
  register_customers: "Register customers (ID + face scan)",
  submit_recommendations: "Submit priority recommendations",
  act_recommendations: "Act on recommendations",
  view_audit: "View security audit log",
};

/** Roles that appear in regional_rbac / rbac_templates. */
export type RbacMatrixRole = "satellite_admin" | "approver" | "evaluator";

export const RBAC_MATRIX_ROLES: RbacMatrixRole[] = [
  "satellite_admin",
  "approver",
  "evaluator",
];

export const RBAC_MATRIX_ROLE_LABEL: Record<RbacMatrixRole, string> = {
  satellite_admin: "Satellite Admin",
  approver: "Approver",
  evaluator: "Evaluator",
};

/** Fixed capabilities for Organization (DSWD) Admin — oversight only (PRD §4.2). */
export const DSWD_ADMIN_PERMISSIONS: DbPermission[] = [
  "view_analytics",
  "manage_templates",
  "manage_rbac",
  "approve_accounts",
  "view_audit",
  "customize_templates",
  "manage_region_rbac",
  "register_accounts",
];

/** Fixed capabilities for Platform Admin (PRD §4.1 — no case PII). */
export const PLATFORM_ADMIN_PERMISSIONS: DbPermission[] = [
  "manage_rbac",
  "view_audit",
];

/** Fixed capabilities for Office (satellite) Admin — office oversight + program edit. */
export const OFFICE_ADMIN_PERMISSIONS: DbPermission[] = [
  "view_analytics",
  "manage_templates",
  "customize_templates",
  "manage_region_rbac",
  "register_accounts",
  "approve_accounts",
  "view_audit",
];

/** Evaluator case-work permissions (PRD §4.4). */
export const EVALUATOR_PERMISSIONS: DbPermission[] = [
  "evaluate_applications",
  "submit_recommendations",
  "register_customers",
];

/** Approver case-work permissions (PRD §4.5). */
export const APPROVER_PERMISSIONS: DbPermission[] = [
  "approve_applications",
  "act_recommendations",
  "release_disbursements",
];

/** @deprecated Prefer EVALUATOR_PERMISSIONS / APPROVER_PERMISSIONS by role. */
export const STAFF_CONSOLE_PERMISSIONS: DbPermission[] = [
  ...EVALUATOR_PERMISSIONS,
  ...APPROVER_PERMISSIONS,
];

export function toUiPermission(db: DbPermission): UiPermission {
  return db.replaceAll("_", "-") as UiPermission;
}

export function toDbPermission(ui: string): DbPermission | null {
  const db = ui.replaceAll("-", "_") as DbPermission;
  return DB_PERMISSIONS.includes(db) ? db : null;
}

/** Default Nest-backed permissions by app role (no Supabase regional_rbac). */
export function permissionsForRole(
  role: AppRole,
  regional: DbPermission[] = [],
): DbPermission[] {
  switch (role) {
    case "platform_admin":
      return [...PLATFORM_ADMIN_PERMISSIONS];
    case "dswd_admin":
      return [...DSWD_ADMIN_PERMISSIONS];
    case "satellite_admin":
      return regional.length ? regional : [...OFFICE_ADMIN_PERMISSIONS];
    case "evaluator":
      return [...EVALUATOR_PERMISSIONS];
    case "approver":
      return [...APPROVER_PERMISSIONS];
    default:
      return regional;
  }
}
