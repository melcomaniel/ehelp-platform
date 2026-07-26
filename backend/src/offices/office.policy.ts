import { BadRequestException, ConflictException } from '@nestjs/common';

export type OfficeStatus = 'active' | 'archived';
export type OfficeLevel = 'central' | 'regional' | 'provincial' | 'municipal';

export const OFFICE_LEVELS: OfficeLevel[] = [
  'central',
  'regional',
  'provincial',
  'municipal',
];

export function normalizeOfficeCode(code: string): string {
  const normalized = code
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (!normalized) throw new BadRequestException('Office code is required');
  return normalized;
}

export function assertOfficeTransition(
  current: OfficeStatus,
  next: OfficeStatus,
): void {
  const allowed =
    (current === 'active' && next === 'archived') ||
    (current === 'archived' && next === 'active');
  if (!allowed) {
    throw new ConflictException(
      `Office cannot transition from ${current} to ${next}`,
    );
  }
}
