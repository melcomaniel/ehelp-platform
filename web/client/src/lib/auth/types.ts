export type AppRole =
  | "dswd_admin"
  | "satellite_admin"
  | "approver"
  | "evaluator"
  | "customer"
  | "dependent";

export const APP_ROLE_LABEL: Record<AppRole, string> = {
  dswd_admin: "DSWD Admin",
  satellite_admin: "Satellite Admin",
  approver: "Approver",
  evaluator: "Evaluator",
  customer: "Customer",
  dependent: "Dependent / Guarantor",
};

/** Roles selectable during self-registration (matches mobile). */
export const SIGNUP_ROLES: AppRole[] = [
  "customer",
  "dependent",
  "evaluator",
  "approver",
];

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

/** Web home route for a profile role (mobile uses /approver, /evaluator, etc.). */
export function homeRouteForRole(role: AppRole): string {
  switch (role) {
    case "approver":
    case "evaluator":
      return "/social-worker/dashboard";
    case "dswd_admin":
    case "satellite_admin":
      return "/admin";
    case "dependent":
    case "customer":
    default:
      return "/dashboard";
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
