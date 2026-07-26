import { BadRequestException, ConflictException } from '@nestjs/common';
import { assertOfficeTransition, normalizeOfficeCode } from './office.policy';

describe('office policy', () => {
  it('normalizes office codes for tenant-scoped uniqueness', () => {
    expect(normalizeOfficeCode(' car regional office ')).toBe(
      'CAR_REGIONAL_OFFICE',
    );
    expect(normalizeOfficeCode('DSWD--CAR')).toBe('DSWD_CAR');
  });

  it('rejects blank office codes after normalization', () => {
    expect(() => normalizeOfficeCode(' --- ')).toThrow(BadRequestException);
  });

  it.each([
    ['active', 'archived'],
    ['archived', 'active'],
  ] as const)('allows %s to %s', (current, next) => {
    expect(() => assertOfficeTransition(current, next)).not.toThrow();
  });

  it('rejects no-op office lifecycle transitions', () => {
    expect(() => assertOfficeTransition('active', 'active')).toThrow(
      ConflictException,
    );
    expect(() => assertOfficeTransition('archived', 'archived')).toThrow(
      ConflictException,
    );
  });
});
