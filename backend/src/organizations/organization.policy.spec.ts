import { ConflictException } from '@nestjs/common';
import {
  assertOrganizationTransition,
  normalizeInitialPolicyConfig,
  normalizeOrganizationCode,
  sanitizeAuditState,
} from './organization.policy';

describe('organization policy', () => {
  it('normalizes organization codes', () => {
    expect(normalizeOrganizationCode(' dswd-ncr ')).toBe('DSWD-NCR');
  });

  it('persists only policy controls allowed by the platform baseline', () => {
    expect(
      normalizeInitialPolicyConfig({
        mfa_required: true,
        device_registration_required: true,
        session_timeout_minutes: 15,
      }),
    ).toEqual({
      mfa_required: true,
      device_registration_required: true,
      session_timeout_minutes: 15,
    });
  });

  it.each([
    ['active', 'suspended'],
    ['suspended', 'active'],
    ['suspended', 'archived'],
  ] as const)('allows %s to %s', (current, next) => {
    expect(() => assertOrganizationTransition(current, next)).not.toThrow();
  });

  it('requires suspension before archive', () => {
    expect(() => assertOrganizationTransition('active', 'archived')).toThrow(
      new ConflictException(
        'Organization must be suspended before it can be archived',
      ),
    );
  });

  it('treats archived as terminal', () => {
    expect(() => assertOrganizationTransition('archived', 'active')).toThrow(
      ConflictException,
    );
  });

  it('removes secrets recursively from audit state', () => {
    expect(
      sanitizeAuditState({
        email: 'admin@example.gov.ph',
        password_hash: 'never-log',
        nested: { token: 'never-log', status: 'pending' },
      }),
    ).toEqual({
      email: 'admin@example.gov.ph',
      nested: { status: 'pending' },
    });
  });
});
