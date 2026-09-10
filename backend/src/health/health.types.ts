import { IntegrationReport } from './health.integrations';

export type HealthState = 'ok' | 'degraded' | 'error';

export interface EnvVarReport {
  name: string;
  set: boolean;
  /** Secret values are never returned — only whether they are present. */
  secret: boolean;
  value: string | null;
}

export interface EnvGroupReport {
  group: string;
  state: HealthState;
  missing: string[];
  vars: EnvVarReport[];
}

export interface DbReport {
  state: HealthState;
  connected: boolean;
  latency_ms: number | null;
  host: string;
  port: number;
  database: string;
  table_count: number | null;
  error: string | null;
}

export interface HealthReport {
  /** Plain up/down for the whole stack. 'down' when the database is unreachable. */
  up: boolean;
  status: HealthState;
  checked_at: string;
  uptime_seconds: number;
  db: DbReport;
  env: {
    state: HealthState;
    missing: string[];
    groups: EnvGroupReport[];
  };
  integrations?: {
    state: HealthState;
    down: string[];
    services: IntegrationReport[];
  };
}
