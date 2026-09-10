import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type IntegrationState = 'up' | 'down' | 'not_configured';

export interface IntegrationReport {
  service: string;
  state: IntegrationState;
  http_status: number | null;
  latency_ms: number | null;
  base_url: string | null;
  detail: string | null;
}

const PROBE_TIMEOUT_MS = 8000;

interface ProbeSpec {
  service: string;
  baseUrlVar: string;
  /** Credential vars that must all be set for the probe to run. */
  credVars: string[];
  path: string;
  method: 'POST' | 'OPTIONS';
  /** Status codes that prove the service answered and accepted our credentials. */
  healthyStatuses: number[];
  headers?: (cfg: (name: string) => string) => Record<string, string>;
  body?: (cfg: (name: string) => string) => unknown;
}

// eMessage is probed with OPTIONS on purpose: a POST would send a real SMS.
const PROBES: readonly ProbeSpec[] = [
  {
    service: 'egov_sso',
    baseUrlVar: 'EGOV_SSO_BASE_URL',
    credVars: ['EGOV_PARTNER_CODE', 'EGOV_PARTNER_SECRET'],
    path: '/api/token',
    method: 'POST',
    // 422 = partner credentials accepted, throwaway exchange_code rejected.
    // 403 would mean the partner credentials themselves are invalid.
    healthyStatuses: [200, 422],
    body: (cfg) => ({
      exchange_code: 'healthcheck',
      scope: 'SSO_AUTHENTICATION',
      partner_code: cfg('EGOV_PARTNER_CODE'),
      partner_secret: cfg('EGOV_PARTNER_SECRET'),
    }),
  },
  {
    service: 'everify',
    baseUrlVar: 'EVERIFY_BASE_URL',
    credVars: ['EVERIFY_CLIENT_ID', 'EVERIFY_CLIENT_SECRET'],
    path: '/api/auth',
    method: 'POST',
    healthyStatuses: [200],
    body: (cfg) => ({
      client_id: cfg('EVERIFY_CLIENT_ID'),
      client_secret: cfg('EVERIFY_CLIENT_SECRET'),
    }),
  },
  {
    service: 'egov_ai',
    baseUrlVar: 'EGOV_AI_BASE_URL',
    credVars: ['EGOV_AI_ACCESS_CODE'],
    path: '/api/v1/egov/integration/token',
    method: 'POST',
    healthyStatuses: [200],
    body: (cfg) => ({ access_code: cfg('EGOV_AI_ACCESS_CODE') }),
  },
  {
    service: 'ereport',
    baseUrlVar: 'EREPORT_BASE_URL',
    credVars: ['EREPORT_ACCESS_CODE'],
    path: '/api/integration/token',
    method: 'POST',
    healthyStatuses: [200],
    body: (cfg) => ({ access_code: cfg('EREPORT_ACCESS_CODE') }),
  },
  {
    service: 'face_liveness',
    baseUrlVar: 'FACE_LIVENESS_BASE_URL',
    credVars: ['FACE_LIVENESS_API_KEY'],
    path: '/v1/liveness/session',
    method: 'POST',
    healthyStatuses: [200, 201],
    headers: (cfg) => ({ 'x-api-key': cfg('FACE_LIVENESS_API_KEY') }),
    body: () => ({
      action: 'redirect',
      callback_url: 'healthcheck',
      delay: 3000,
    }),
  },
  {
    service: 'emessage',
    baseUrlVar: 'EMESSAGE_BASE_URL',
    credVars: ['EMESSAGE_ACCESS_TOKEN'],
    path: '/messaging/v1/sms/push',
    method: 'OPTIONS',
    healthyStatuses: [200, 204],
  },
];

@Injectable()
export class HealthIntegrationsService {
  private readonly log = new Logger(HealthIntegrationsService.name);

  constructor(private readonly config: ConfigService) {}

  async probeAll(): Promise<IntegrationReport[]> {
    return Promise.all(PROBES.map((spec) => this.probe(spec)));
  }

  private async probe(spec: ProbeSpec): Promise<IntegrationReport> {
    const cfg = (name: string) => this.config.get<string>(name)?.trim() ?? '';
    const baseUrl = cfg(spec.baseUrlVar);
    const missingCreds = spec.credVars.filter((v) => !cfg(v));

    if (!baseUrl || missingCreds.length > 0) {
      return {
        service: spec.service,
        state: 'not_configured',
        http_status: null,
        latency_ms: null,
        base_url: baseUrl || null,
        detail: !baseUrl
          ? `${spec.baseUrlVar} is not set`
          : `missing: ${missingCreds.join(', ')}`,
      };
    }

    const url = `${baseUrl.replace(/\/$/, '')}${spec.path}`;
    const startedAt = Date.now();
    try {
      const res = await fetch(url, {
        method: spec.method,
        headers: {
          Accept: 'application/json',
          ...(spec.body ? { 'Content-Type': 'application/json' } : {}),
          ...(spec.headers ? spec.headers(cfg) : {}),
        },
        body: spec.body ? JSON.stringify(spec.body(cfg)) : undefined,
        signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      });
      const up = spec.healthyStatuses.includes(res.status);
      return {
        service: spec.service,
        state: up ? 'up' : 'down',
        http_status: res.status,
        latency_ms: Date.now() - startedAt,
        base_url: baseUrl,
        detail: up ? null : `unexpected status ${res.status}`,
      };
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'probe failed';
      this.log.warn(`${spec.service} probe failed: ${detail}`);
      return {
        service: spec.service,
        state: 'down',
        http_status: null,
        latency_ms: Date.now() - startedAt,
        base_url: baseUrl,
        detail,
      };
    }
  }
}
