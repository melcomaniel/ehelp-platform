export type AppRole =
  | "platform_admin"
  | "dswd_admin"
  | "satellite_admin"
  | "approver"
  | "evaluator"
  | "customer"
  | "dependent";

export const APP_ROLE_LABEL: Record<AppRole, string> = {
  platform_admin: "Platform Admin",
  dswd_admin: "Organization Admin",
  satellite_admin: "Office Admin",
  approver: "Approver",
  evaluator: "Evaluator",
  customer: "Beneficiary",
  dependent: "Dependent / Guarantor",
};

/** Self-registration on web is staff-only (beneficiaries use mobile). */
export const SIGNUP_ROLES: AppRole[] = ["evaluator", "approver"];

export type AccountValidationStatus = "pending" | "validated" | "rejected";

export type Profile = {
  id: string;
  email: string | null;
  phone: string | null;
  fullName: string;
  role: AppRole;
  regionId: string | null;
  validationStatus: AccountValidationStatus;
  isActive: boolean;
};

const APP_ROLES = new Set<string>(Object.keys(APP_ROLE_LABEL));

export function parseAppRole(value: string | null | undefined): AppRole {
  if (value && APP_ROLES.has(value)) return value as AppRole;
  return "customer";
}

export function isWebAdminRole(role: AppRole): boolean {
  return (
    role === "platform_admin" ||
    role === "dswd_admin" ||
    role === "satellite_admin"
  );
}

export function isWebStaffRole(role: AppRole): boolean {
  return role === "evaluator" || role === "approver";
}

/** Web home route — beneficiaries are directed to the mobile app CTA. */
export function homeRouteForRole(role: AppRole): string {
  switch (role) {
    case "approver":
    case "evaluator":
      return "/staff";
    case "platform_admin":
    case "dswd_admin":
    case "satellite_admin":
      return "/admin";
    case "dependent":
    case "customer":
    default:
      return "/get-app";
  }
}

export function profileFromRow(row: Record<string, unknown>): Profile {
  return {
    id: row.id as string,
    email: (row.email as string | null) ?? null,
    phone: (row.phone as string | null) ?? null,
    fullName: (row.full_name as string | null) ?? "",
    role: parseAppRole(row.role as string | null),
    regionId: (row.region_id as string | null) ?? null,
    validationStatus:
      (row.validation_status as AccountValidationStatus | null) ?? "pending",
    isActive: (row.is_active as boolean | null) ?? true,
  };
}
