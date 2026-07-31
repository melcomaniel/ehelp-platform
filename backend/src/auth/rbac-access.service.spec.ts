import {
  decideAnyRole,
  isBeneficiaryClassRole,
  pickPrimaryErdRole,
} from './rbac-access.service';
import type { RbacActor } from './rbac.policy';

describe('RbacAccess helpers', () => {
  it('marks BENEFICIARY and DEPENDENT as beneficiary-class', () => {
    expect(isBeneficiaryClassRole('BENEFICIARY')).toBe(true);
    expect(isBeneficiaryClassRole('DEPENDENT')).toBe(true);
    expect(isBeneficiaryClassRole('EVALUATOR')).toBe(false);
  });

  it('picks primary JWT role by PRD priority', () => {
    expect(pickPrimaryErdRole(['EVALUATOR', 'ORG_ADMIN'])).toBe('ORG_ADMIN');
    expect(pickPrimaryErdRole(['DEPENDENT', 'BENEFICIARY'])).toBe(
      'BENEFICIARY',
    );
  });

  it('allows dual-role actors when any assignment grants the permission', () => {
    const actors: RbacActor[] = [
      {
        userId: 'u1',
        role: 'ORG_ADMIN',
        organizationId: 'org-1',
        officeId: null,
      },
      {
        userId: 'u1',
        role: 'EVALUATOR',
        organizationId: 'org-1',
        officeId: 'office-1',
      },
    ];
    expect(
      decideAnyRole(actors, 'application.endorse', {
        organizationId: 'org-1',
        officeId: 'office-1',
        assignedUserId: null,
      }).allowed,
    ).toBe(true);
    expect(
      decideAnyRole(actors, 'office.create', {
        organizationId: 'org-1',
      }).allowed,
    ).toBe(true);
  });
});
