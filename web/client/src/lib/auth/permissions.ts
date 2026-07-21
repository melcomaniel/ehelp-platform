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

/** Fixed capabilities for DSWD admin (not stored in regional_rbac). */
export const DSWD_ADMIN_PERMISSIONS: DbPermission[] = [
  "view_analytics",
  "manage_templates",
  "manage_rbac",
  "approve_accounts",
  "view_audit",
  "customize_templates",
  "manage_region_rbac",
  "register_accounts",
  "submit_recommendations",
  "act_recommendations",
  "evaluate_applications",
  "approve_applications",
  "release_disbursements",
  "register_customers",
];

export function toUiPermission(db: DbPermission): UiPermission {
  return db.replaceAll("_", "-") as UiPermission;
}

export function toDbPermission(ui: string): DbPermission | null {
  const db = ui.replaceAll("-", "_") as DbPermission;
  return DB_PERMISSIONS.includes(db) ? db : null;
}

export function permissionsForRole(
  role: AppRole,
  regional: DbPermission[],
): DbPermission[] {
  if (role === "dswd_admin") return [...DSWD_ADMIN_PERMISSIONS];
  return regional;
}
