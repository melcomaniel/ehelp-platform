import { ConflictException } from '@nestjs/common';
import type { OrganizationStatus } from './organization.entities';

export function normalizeOrganizationCode(code: string): string {
  return code.trim().toUpperCase();
}

export function assertOrganizationTransition(
  current: OrganizationStatus,
  next: OrganizationStatus,
): void {
  const allowed =
    (current === 'active' && next === 'suspended') ||
    (current === 'suspended' && (next === 'active' || next === 'archived'));
  if (!allowed) {
    const message =
      next === 'archived' && current === 'active'
        ? 'Organization must be suspended before it can be archived'
        : `Organization cannot transition from ${current} to ${next}`;
    throw new ConflictException(message);
  }
}

const SENSITIVE_KEYS = new Set([
  'password',
  'password_hash',
  'passwordHash',
  'token',
  'access_token',
  'refresh_token',
  'secret',
  'biometric',
  'face_scan_url',
]);

export function sanitizeAuditState(
  value: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (!value) return null;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !SENSITIVE_KEYS.has(key))
      .map(([key, item]) => [
        key,
        item && typeof item === 'object' && !Array.isArray(item)
          ? sanitizeAuditState(item as Record<string, unknown>)
          : item,
      ]),
  );
}
