import { ConflictException } from '@nestjs/common';
import {
  PLATFORM_SECURITY_BASELINE,
  type InitialPolicyConfigDto,
} from './organization.dto';
import type { OrganizationStatus } from './organization.entities';

export function normalizeOrganizationCode(code: string): string {
  return code.trim().toUpperCase();
}

export function normalizeInitialPolicyConfig(
  input: InitialPolicyConfigDto,
): Record<string, unknown> {
  return {
    mfa_required: PLATFORM_SECURITY_BASELINE.mfa_required,
    device_registration_required:
      PLATFORM_SECURITY_BASELINE.device_registration_required,
    session_timeout_minutes: input.session_timeout_minutes,
  };
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
