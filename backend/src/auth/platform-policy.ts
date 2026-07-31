/** Platform access policy for EHelp personas (PRD §§4.1–4.6). */

export const ERD_ROLES = {
  PLATFORM_ADMIN: 'PLATFORM_ADMIN',
  ORG_ADMIN: 'ORG_ADMIN',
  OFFICE_ADMIN: 'OFFICE_ADMIN',
  EVALUATOR: 'EVALUATOR',
  APPROVER: 'APPROVER',
  BENEFICIARY: 'BENEFICIARY',
  DEPENDENT: 'DEPENDENT',
} as const;

export type ErdRoleCode = (typeof ERD_ROLES)[keyof typeof ERD_ROLES];

/**
 * Roles allowed on Flutter mobile.
 * DEPENDENT is beneficiary-class (same app); activation still needs an
 * approved relationship to a principal.
 */
export const MOBILE_ERD_ROLES = new Set<string>([
  ERD_ROLES.BENEFICIARY,
  ERD_ROLES.DEPENDENT,
]);

/** Evaluator / Approver on web staff console. */
export const WEB_STAFF_ERD_ROLES = new Set<string>([
  ERD_ROLES.EVALUATOR,
  ERD_ROLES.APPROVER,
]);

/** Admin personas on web /admin. */
export const WEB_ADMIN_ERD_ROLES = new Set<string>([
  ERD_ROLES.PLATFORM_ADMIN,
  ERD_ROLES.ORG_ADMIN,
  ERD_ROLES.OFFICE_ADMIN,
]);

export const WEB_ERD_ROLES = new Set<string>([
  ...WEB_STAFF_ERD_ROLES,
  ...WEB_ADMIN_ERD_ROLES,
]);

export type ClientPlatform = 'mobile' | 'web';

export function platformForErdRole(erdCode: string): ClientPlatform | 'none' {
  if (MOBILE_ERD_ROLES.has(erdCode)) return 'mobile';
  if (WEB_ERD_ROLES.has(erdCode)) return 'web';
  return 'none';
}

export function assertPlatformAllowed(
  erdCode: string,
  client: ClientPlatform,
):
  | { ok: true }
  | { ok: false; required: ClientPlatform | 'none'; message: string } {
  const required = platformForErdRole(erdCode);
  if (required === 'none') {
    return {
      ok: false,
      required: 'none',
      message: 'This account role is not enabled for client access',
    };
  }
  if (client === 'mobile' && required !== 'mobile') {
    return {
      ok: false,
      required: 'web',
      message: 'Staff and admin accounts must use the web portal',
    };
  }
  if (client === 'web' && required !== 'web') {
    return {
      ok: false,
      required: 'mobile',
      message: 'Beneficiaries must use the EHelp mobile app',
    };
  }
  return { ok: true };
}
