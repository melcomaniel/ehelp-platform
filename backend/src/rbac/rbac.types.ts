export type DbPermission =
  | 'view_analytics'
  | 'manage_templates'
  | 'customize_templates'
  | 'manage_rbac'
  | 'manage_region_rbac'
  | 'approve_accounts'
  | 'register_accounts'
  | 'evaluate_applications'
  | 'approve_applications'
  | 'release_disbursements'
  | 'register_customers'
  | 'submit_recommendations'
  | 'act_recommendations'
  | 'view_audit';

export type RbacMatrixRole = 'satellite_admin' | 'approver' | 'evaluator';

export const DB_PERMISSIONS: readonly DbPermission[] = [
  'view_analytics',
  'manage_templates',
  'customize_templates',
  'manage_rbac',
  'manage_region_rbac',
  'approve_accounts',
  'register_accounts',
  'evaluate_applications',
  'approve_applications',
  'release_disbursements',
  'register_customers',
  'submit_recommendations',
  'act_recommendations',
  'view_audit',
];

export const RBAC_MATRIX_ROLES: readonly RbacMatrixRole[] = [
  'satellite_admin',
  'approver',
  'evaluator',
];
