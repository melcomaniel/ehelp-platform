import {
  decideRbac,
  grantsForRole,
  roleHasPermission,
  type RbacActor,
} from './rbac.policy';

describe('PRD RBAC policy', () => {
  const platform: RbacActor = {
    userId: 'platform-user',
    role: 'PLATFORM_ADMIN',
    organizationId: null,
    officeId: null,
  };

  const orgAdmin: RbacActor = {
    userId: 'org-user',
    role: 'ORG_ADMIN',
    organizationId: 'org-1',
    officeId: null,
  };

  const officeAdmin: RbacActor = {
    userId: 'office-user',
    role: 'OFFICE_ADMIN',
    organizationId: 'org-1',
    officeId: 'office-1',
  };

  const evaluator: RbacActor = {
    userId: 'evaluator-user',
    role: 'EVALUATOR',
    organizationId: 'org-1',
    officeId: 'office-1',
  };

  const approver: RbacActor = {
    userId: 'approver-user',
    role: 'APPROVER',
    organizationId: 'org-1',
    officeId: 'office-1',
  };

  it('exposes a grant catalog for every PRD role', () => {
    expect(grantsForRole('PLATFORM_ADMIN')).toContainEqual({
      permission: 'tenant.create',
      scope: 'platform',
    });
    expect(roleHasPermission('BENEFICIARY', 'application.submit')).toBe(true);
  });

  it('keeps platform administrators out of beneficiary case decisions', () => {
    expect(
      decideRbac(platform, 'application.approve', {
        organizationId: 'org-1',
        officeId: 'office-1',
        assignedUserId: 'platform-user',
      }),
    ).toEqual({
      allowed: false,
      reason: 'Platform admin has no case authority',
    });
  });

  it.each([
    'program_template.create',
    'program_template.publish_version',
    'program_template.retire',
    'program_template.override_bounds_define',
    'program_template.override_allowed_fields',
    'workflow.manage',
    'rule_set.manage',
  ] as const)('denies platform administrators %s', (permission) => {
    expect(
      decideRbac(platform, permission, { organizationId: 'org-1' }).allowed,
    ).toBe(false);
  });

  it('allows organization admins to manage own organization templates only', () => {
    expect(
      decideRbac(orgAdmin, 'program_template.create', {
        organizationId: 'org-1',
      }),
    ).toEqual({ allowed: true, scope: 'organization' });

    expect(
      decideRbac(orgAdmin, 'program_template.create', {
        organizationId: 'org-2',
      }).allowed,
    ).toBe(false);
  });

  it('allows office admins to customize only their own office envelope', () => {
    expect(
      decideRbac(officeAdmin, 'program_template.override_allowed_fields', {
        organizationId: 'org-1',
        officeId: 'office-1',
      }),
    ).toEqual({ allowed: true, scope: 'office' });

    expect(
      decideRbac(officeAdmin, 'program_template.override_allowed_fields', {
        organizationId: 'org-1',
        officeId: 'office-2',
      }).allowed,
    ).toBe(false);
  });

  it('requires assigned workflow tasks for evaluators and approvers', () => {
    expect(
      decideRbac(evaluator, 'application.evaluate', {
        organizationId: 'org-1',
        officeId: 'office-1',
        assignedUserId: 'evaluator-user',
      }),
    ).toEqual({ allowed: true, scope: 'assigned_task' });

    expect(
      decideRbac(approver, 'application.approve', {
        organizationId: 'org-1',
        officeId: 'office-1',
        assignedUserId: 'other-user',
      }).allowed,
    ).toBe(false);
  });

  it('allows office-pool claim when the workflow task is unassigned', () => {
    expect(
      decideRbac(evaluator, 'application.endorse', {
        organizationId: 'org-1',
        officeId: 'office-1',
        assignedUserId: null,
      }),
    ).toEqual({ allowed: true, scope: 'assigned_task' });
  });

  it('denies org and office admins case evaluate/approve grants', () => {
    expect(
      decideRbac(orgAdmin, 'application.endorse', {
        organizationId: 'org-1',
        officeId: 'office-1',
      }).allowed,
    ).toBe(false);
    expect(
      decideRbac(officeAdmin, 'application.approve', {
        organizationId: 'org-1',
        officeId: 'office-1',
        assignedUserId: 'office-user',
      }).allowed,
    ).toBe(false);
  });

  it('enforces evaluator and approver separation of duties', () => {
    expect(
      decideRbac(approver, 'application.approve', {
        organizationId: 'org-1',
        officeId: 'office-1',
        assignedUserId: 'approver-user',
        evaluatedByUserId: 'approver-user',
      }),
    ).toEqual({
      allowed: false,
      reason: 'Evaluator and approver must be different users',
    });

    expect(
      decideRbac(approver, 'application.reject', {
        organizationId: 'org-1',
        officeId: 'office-1',
        assignedUserId: 'approver-user',
        evaluatedByUserId: 'approver-user',
      }).allowed,
    ).toBe(false);
  });

  it('gives Office Admin relationship approval at office scope', () => {
    expect(
      decideRbac(officeAdmin, 'relationship.approve', {
        organizationId: 'org-1',
        officeId: 'office-1',
      }),
    ).toEqual({ allowed: true, scope: 'office' });

    expect(
      decideRbac(approver, 'relationship.approve', {
        organizationId: 'org-1',
        officeId: 'office-1',
      }).allowed,
    ).toBe(false);

    expect(
      decideRbac(evaluator, 'relationship.validate' as never, {
        organizationId: 'org-1',
        officeId: 'office-1',
      }).allowed,
    ).toBe(false);
  });

  it('treats DEPENDENT as beneficiary-class for own-account grants', () => {
    const dependent: RbacActor = {
      userId: 'dependent-user',
      role: 'DEPENDENT',
      organizationId: null,
      officeId: null,
      beneficiaryId: 'beneficiary-1',
    };
    expect(
      decideRbac(dependent, 'application.submit', {
        beneficiaryId: 'beneficiary-1',
      }),
    ).toEqual({ allowed: true, scope: 'own_account' });
    expect(
      decideRbac(dependent, 'application.approve', {
        organizationId: 'org-1',
        officeId: 'office-1',
      }).allowed,
    ).toBe(false);
  });

  it('limits beneficiaries to their own account data', () => {
    const beneficiary: RbacActor = {
      userId: 'beneficiary-user',
      role: 'BENEFICIARY',
      organizationId: null,
      officeId: null,
      beneficiaryId: 'beneficiary-1',
    };

    expect(
      decideRbac(beneficiary, 'application.view_own', {
        beneficiaryId: 'beneficiary-1',
      }),
    ).toEqual({ allowed: true, scope: 'own_account' });

    expect(
      decideRbac(beneficiary, 'application.view_own', {
        beneficiaryId: 'beneficiary-2',
      }).allowed,
    ).toBe(false);
  });
});
