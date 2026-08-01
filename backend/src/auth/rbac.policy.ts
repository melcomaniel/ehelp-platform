export type ErdRoleCode =
  | 'PLATFORM_ADMIN'
  | 'ORG_ADMIN'
  | 'OFFICE_ADMIN'
  | 'EVALUATOR'
  | 'APPROVER'
  | 'BENEFICIARY'
  /** Same own-account grants as BENEFICIARY; link requires validate→approve. */
  | 'DEPENDENT';

export type RbacScope =
  | 'platform'
  | 'platform_aggregate'
  | 'organization'
  | 'office'
  | 'assigned_task'
  | 'own_account';

export type RbacPermission =
  | 'tenant.create'
  | 'tenant.update_metadata'
  | 'tenant.suspend'
  | 'tenant.reactivate'
  | 'tenant.archive'
  | 'security_baseline.manage'
  | 'role_catalog.manage'
  | 'device.revoke_platform'
  | 'account.force_logout_platform'
  | 'integration_credentials.manage'
  | 'disbursement_channel.enable_platform'
  | 'audit.view_platform'
  | 'audit.export_platform'
  | 'analytics.view_platform_aggregate'
  | 'office.create'
  | 'office.update'
  | 'office.archive'
  | 'office_staff.assign'
  | 'account.request_office_staff'
  | 'account.approve_org_staff'
  | 'program_template.create'
  | 'program_template.publish_version'
  | 'program_template.retire'
  | 'program_template.override_bounds_define'
  | 'program_template.override_allowed_fields'
  | 'local_requirement.add'
  | 'workflow.manage'
  | 'rule_set.manage'
  | 'analytics.view_org'
  | 'analytics.view_office'
  | 'audit.view_org'
  | 'audit.view_office'
  | 'beneficiary.register'
  | 'beneficiary.verify_identity'
  | 'relationship.validate'
  | 'relationship.request'
  | 'relationship.approve'
  | 'profile_change.request'
  | 'profile_change.approve'
  | 'disbursement_slot.manage'
  | 'disbursement_slot.book'
  | 'beneficiary_document.manage'
  | 'application.create'
  | 'application.submit'
  | 'application.view_own'
  | 'application.view_assigned'
  | 'application.evaluate'
  | 'application.endorse'
  | 'application.flag'
  | 'application.approve'
  | 'application.reject'
  | 'disbursement_method.select'
  | 'disbursement.authenticate'
  | 'disbursement.authorize'
  | 'disbursement.view_own'
  | 'notification_preferences.manage';

export type RbacGrant = {
  permission: RbacPermission;
  scope: RbacScope;
};

export type RbacActor = {
  userId: string;
  role: ErdRoleCode;
  organizationId: string | null;
  officeId: string | null;
  beneficiaryId?: string | null;
};

export type RbacResource = {
  organizationId?: string | null;
  officeId?: string | null;
  beneficiaryId?: string | null;
  assignedUserId?: string | null;
  evaluatedByUserId?: string | null;
};

export type RbacDecision =
  { allowed: true; scope: RbacScope } | { allowed: false; reason: string };

const ROLE_GRANTS: Record<ErdRoleCode, RbacGrant[]> = {
  PLATFORM_ADMIN: [
    { permission: 'tenant.create', scope: 'platform' },
    { permission: 'tenant.update_metadata', scope: 'platform' },
    { permission: 'tenant.suspend', scope: 'platform' },
    { permission: 'tenant.reactivate', scope: 'platform' },
    { permission: 'tenant.archive', scope: 'platform' },
    { permission: 'security_baseline.manage', scope: 'platform' },
    { permission: 'role_catalog.manage', scope: 'platform' },
    { permission: 'device.revoke_platform', scope: 'platform' },
    { permission: 'account.force_logout_platform', scope: 'platform' },
    { permission: 'integration_credentials.manage', scope: 'platform' },
    { permission: 'disbursement_channel.enable_platform', scope: 'platform' },
    { permission: 'audit.view_platform', scope: 'platform' },
    { permission: 'audit.export_platform', scope: 'platform' },
    {
      permission: 'analytics.view_platform_aggregate',
      scope: 'platform_aggregate',
    },
  ],
  ORG_ADMIN: [
    { permission: 'office.create', scope: 'organization' },
    { permission: 'office.update', scope: 'organization' },
    { permission: 'office.archive', scope: 'organization' },
    { permission: 'account.approve_org_staff', scope: 'organization' },
    { permission: 'program_template.create', scope: 'organization' },
    { permission: 'program_template.publish_version', scope: 'organization' },
    { permission: 'program_template.retire', scope: 'organization' },
    {
      permission: 'program_template.override_bounds_define',
      scope: 'organization',
    },
    { permission: 'workflow.manage', scope: 'organization' },
    { permission: 'rule_set.manage', scope: 'organization' },
    { permission: 'analytics.view_org', scope: 'organization' },
    { permission: 'audit.view_org', scope: 'organization' },
    { permission: 'profile_change.approve', scope: 'organization' },
    { permission: 'disbursement_slot.manage', scope: 'organization' },
    // Oversight: observe all office cases in the org (read-only via UI).
    { permission: 'application.view_assigned', scope: 'organization' },
  ],
  OFFICE_ADMIN: [
    // Edit published program fields (periods, eligibility) for own office ops.
    // Create/retire of org catalog stays with Org Admin.
    {
      permission: 'program_template.publish_version',
      scope: 'office',
    },
    { permission: 'program_template.override_allowed_fields', scope: 'office' },
    { permission: 'local_requirement.add', scope: 'office' },
    { permission: 'office_staff.assign', scope: 'office' },
    { permission: 'account.request_office_staff', scope: 'office' },
    { permission: 'analytics.view_office', scope: 'office' },
    { permission: 'audit.view_office', scope: 'office' },
    // Beneficiary↔beneficiary links with proof (PRD relationship approval).
    { permission: 'relationship.approve', scope: 'office' },
    { permission: 'profile_change.approve', scope: 'office' },
    { permission: 'disbursement_slot.manage', scope: 'office' },
    // Cash-window scan: validate unique beneficiary claim QR.
    { permission: 'disbursement.authorize', scope: 'office' },
    // Observe office cases including claimed / completed disbursements.
    { permission: 'application.view_assigned', scope: 'office' },
  ],
  EVALUATOR: [
    { permission: 'beneficiary.register', scope: 'office' },
    { permission: 'beneficiary.verify_identity', scope: 'office' },
    { permission: 'application.view_assigned', scope: 'assigned_task' },
    { permission: 'application.evaluate', scope: 'assigned_task' },
    { permission: 'application.endorse', scope: 'assigned_task' },
    // Decline at evaluation (before endorsement) — not the approver decision.
    { permission: 'application.reject', scope: 'assigned_task' },
    { permission: 'application.flag', scope: 'assigned_task' },
  ],
  APPROVER: [
    { permission: 'application.view_assigned', scope: 'assigned_task' },
    { permission: 'application.approve', scope: 'assigned_task' },
    { permission: 'application.reject', scope: 'assigned_task' },
    { permission: 'disbursement.authorize', scope: 'assigned_task' },
  ],
  BENEFICIARY: [
    { permission: 'relationship.request', scope: 'own_account' },
    { permission: 'profile_change.request', scope: 'own_account' },
    { permission: 'application.create', scope: 'own_account' },
    { permission: 'application.submit', scope: 'own_account' },
    { permission: 'application.view_own', scope: 'own_account' },
    { permission: 'disbursement_method.select', scope: 'own_account' },
    { permission: 'disbursement.authenticate', scope: 'own_account' },
    { permission: 'disbursement.view_own', scope: 'own_account' },
    { permission: 'disbursement_slot.book', scope: 'own_account' },
    { permission: 'beneficiary_document.manage', scope: 'own_account' },
    { permission: 'notification_preferences.manage', scope: 'own_account' },
  ],
  // Dependent is beneficiary-class. Links to other beneficiaries need proof
  // approved by Office Admin (not Evaluator/Approver case roles).
  DEPENDENT: [
    { permission: 'relationship.request', scope: 'own_account' },
    { permission: 'profile_change.request', scope: 'own_account' },
    { permission: 'application.create', scope: 'own_account' },
    { permission: 'application.submit', scope: 'own_account' },
    { permission: 'application.view_own', scope: 'own_account' },
    { permission: 'disbursement_method.select', scope: 'own_account' },
    { permission: 'disbursement.authenticate', scope: 'own_account' },
    { permission: 'disbursement.view_own', scope: 'own_account' },
    { permission: 'disbursement_slot.book', scope: 'own_account' },
    { permission: 'beneficiary_document.manage', scope: 'own_account' },
    { permission: 'notification_preferences.manage', scope: 'own_account' },
  ],
};

export const RBAC_ROLE_GRANTS: Readonly<
  Record<ErdRoleCode, readonly RbacGrant[]>
> = ROLE_GRANTS;

export const PLATFORM_ADMIN_EXPLICIT_DENIES: readonly RbacPermission[] = [
  'beneficiary.register',
  'beneficiary.verify_identity',
  'application.view_assigned',
  'application.evaluate',
  'application.endorse',
  'application.flag',
  'application.approve',
  'application.reject',
  'disbursement.authorize',
  'disbursement.view_own',
  'program_template.create',
  'program_template.publish_version',
  'program_template.retire',
  'program_template.override_bounds_define',
  'program_template.override_allowed_fields',
  'workflow.manage',
  'rule_set.manage',
];

export function grantsForRole(role: ErdRoleCode): readonly RbacGrant[] {
  return ROLE_GRANTS[role];
}

export function roleHasPermission(
  role: ErdRoleCode,
  permission: RbacPermission,
): boolean {
  return ROLE_GRANTS[role].some((grant) => grant.permission === permission);
}

export function decideRbac(
  actor: RbacActor,
  permission: RbacPermission,
  resource: RbacResource = {},
): RbacDecision {
  if (
    actor.role === 'PLATFORM_ADMIN' &&
    PLATFORM_ADMIN_EXPLICIT_DENIES.includes(permission)
  ) {
    return { allowed: false, reason: 'Platform admin has no case authority' };
  }

  const grant = ROLE_GRANTS[actor.role].find(
    (item) => item.permission === permission,
  );
  if (!grant) return { allowed: false, reason: 'Permission is not granted' };

  if (
    (permission === 'application.approve' ||
      permission === 'application.reject') &&
    resource.evaluatedByUserId != null &&
    resource.evaluatedByUserId === actor.userId
  ) {
    return {
      allowed: false,
      reason: 'Evaluator and approver must be different users',
    };
  }

  switch (grant.scope) {
    case 'platform':
    case 'platform_aggregate':
      return actor.role === 'PLATFORM_ADMIN'
        ? { allowed: true, scope: grant.scope }
        : { allowed: false, reason: 'Platform scope is required' };
    case 'organization':
      return actor.organizationId &&
        actor.organizationId === resource.organizationId
        ? { allowed: true, scope: grant.scope }
        : { allowed: false, reason: 'Resource is outside organization scope' };
    case 'office': {
      // Oversight calls often omit resource.officeId — treat as actor's own office.
      // Explicit officeId on the resource must still match.
      const resourceOfficeId = resource.officeId ?? actor.officeId;
      return actor.organizationId &&
        actor.officeId &&
        actor.organizationId === resource.organizationId &&
        actor.officeId === resourceOfficeId
        ? { allowed: true, scope: grant.scope }
        : { allowed: false, reason: 'Resource is outside office scope' };
    }
    case 'assigned_task': {
      // Office pool: unassigned tasks are claimable by any in-office actor
      // with the grant. Once assigned, only that assignee may act.
      const resourceOfficeId = resource.officeId ?? actor.officeId;
      const inOffice =
        !!actor.organizationId &&
        !!actor.officeId &&
        actor.organizationId === resource.organizationId &&
        actor.officeId === resourceOfficeId;
      if (!inOffice) {
        return { allowed: false, reason: 'Resource is outside office scope' };
      }
      if (
        resource.assignedUserId != null &&
        resource.assignedUserId !== actor.userId
      ) {
        return { allowed: false, reason: 'Task is not assigned to actor' };
      }
      return { allowed: true, scope: grant.scope };
    }
    case 'own_account':
      return actor.beneficiaryId &&
        actor.beneficiaryId === resource.beneficiaryId
        ? { allowed: true, scope: grant.scope }
        : { allowed: false, reason: 'Resource is outside own account scope' };
  }
}
