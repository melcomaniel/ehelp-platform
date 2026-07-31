import { ConfigService } from '@nestjs/config';

export type AuthAdapterKind = 'mock' | 'live';

function normalizeMode(raw: string | undefined | null): AuthAdapterKind {
  return (raw ?? '').trim().toLowerCase() === 'live' ? 'live' : 'mock';
}

/** Global default: AUTH_PROVIDER_MODE=mock|live */
export function baseAuthProviderMode(
  config: ConfigService | NodeJS.ProcessEnv,
): AuthAdapterKind {
  const raw =
    'get' in config && typeof config.get === 'function'
      ? (config as ConfigService).get<string>('AUTH_PROVIDER_MODE')
      : (config as NodeJS.ProcessEnv).AUTH_PROVIDER_MODE;
  return normalizeMode(raw);
}

/**
 * Per-adapter override. Falls back to AUTH_PROVIDER_MODE.
 *
 * Examples:
 *   AUTH_PROVIDER_MODE=mock
 *   AUTH_LIVENESS_MODE=live   → mock SSO + mock eVerify + real camera
 *   AUTH_SSO_MODE=mock
 *   AUTH_EVERIFY_MODE=mock
 */
export function authAdapterMode(
  config: ConfigService | NodeJS.ProcessEnv,
  overrideKey: 'AUTH_SSO_MODE' | 'AUTH_EVERIFY_MODE' | 'AUTH_LIVENESS_MODE',
): AuthAdapterKind {
  const override =
    'get' in config && typeof config.get === 'function'
      ? (config as ConfigService).get<string>(overrideKey)
      : (config as NodeJS.ProcessEnv)[overrideKey];
  if (override != null && String(override).trim() !== '') {
    return normalizeMode(override);
  }
  return baseAuthProviderMode(config);
}

export function isLiveAdapter(
  config: ConfigService,
  overrideKey: 'AUTH_SSO_MODE' | 'AUTH_EVERIFY_MODE' | 'AUTH_LIVENESS_MODE',
): boolean {
  return authAdapterMode(config, overrideKey) === 'live';
}
