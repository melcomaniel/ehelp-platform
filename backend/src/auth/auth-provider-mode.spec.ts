import { ConfigService } from '@nestjs/config';
import {
  authAdapterMode,
  baseAuthProviderMode,
  isLiveAdapter,
} from './auth-provider-mode';

function cfg(vars: Record<string, string>): ConfigService {
  return {
    get: (key: string) => vars[key],
  } as ConfigService;
}

describe('auth-provider-mode', () => {
  it('defaults all adapters to AUTH_PROVIDER_MODE', () => {
    const c = cfg({ AUTH_PROVIDER_MODE: 'mock' });
    expect(baseAuthProviderMode(c)).toBe('mock');
    expect(authAdapterMode(c, 'AUTH_SSO_MODE')).toBe('mock');
    expect(authAdapterMode(c, 'AUTH_LIVENESS_MODE')).toBe('mock');
    expect(isLiveAdapter(c, 'AUTH_LIVENESS_MODE')).toBe(false);
  });

  it('allows live liveness with mock SSO', () => {
    const c = cfg({
      AUTH_PROVIDER_MODE: 'mock',
      AUTH_LIVENESS_MODE: 'live',
    });
    expect(authAdapterMode(c, 'AUTH_SSO_MODE')).toBe('mock');
    expect(authAdapterMode(c, 'AUTH_EVERIFY_MODE')).toBe('mock');
    expect(authAdapterMode(c, 'AUTH_LIVENESS_MODE')).toBe('live');
    expect(isLiveAdapter(c, 'AUTH_LIVENESS_MODE')).toBe(true);
  });

  it('live base still overridable back to mock SSO', () => {
    const c = cfg({
      AUTH_PROVIDER_MODE: 'live',
      AUTH_SSO_MODE: 'mock',
    });
    expect(authAdapterMode(c, 'AUTH_SSO_MODE')).toBe('mock');
    expect(authAdapterMode(c, 'AUTH_LIVENESS_MODE')).toBe('live');
  });
});
