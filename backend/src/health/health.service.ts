import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ENV_GROUPS, EnvGroupSpec } from './health.env-spec';
import { HealthIntegrationsService } from './health.integrations';
import {
  DbReport,
  EnvGroupReport,
  EnvVarReport,
  HealthReport,
  HealthState,
} from './health.types';

const TABLE_COUNT_SQL = `select count(*)::int as count
  from information_schema.tables
  where table_schema = 'public'`;

@Injectable()
export class HealthService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly config: ConfigService,
    private readonly integrations: HealthIntegrationsService,
  ) {}

  /**
   * @param deep when true, also probes every eGov upstream (outbound network calls).
   */
  async report(deep = false): Promise<HealthReport> {
    const db = await this.checkDb();
    const env = this.checkEnv();
    const integrations = deep ? await this.checkIntegrations() : undefined;

    const states = [db.state, env.state];
    if (integrations) states.push(integrations.state);

    return {
      // The database is the only hard dependency: without it nothing serves.
      up: db.state !== 'error',
      status: worst(states),
      checked_at: new Date().toISOString(),
      uptime_seconds: Math.round(process.uptime()),
      db,
      env,
      ...(integrations ? { integrations } : {}),
    };
  }

  async checkIntegrations(): Promise<
    NonNullable<HealthReport['integrations']>
  > {
    const services = await this.integrations.probeAll();
    const down = services
      .filter((s) => s.state === 'down')
      .map((s) => s.service);
    return {
      state: down.length > 0 ? 'degraded' : 'ok',
      down,
      services,
    };
  }

  async checkDb(): Promise<DbReport> {
    const host = this.config.get<string>('DATABASE_HOST') ?? 'localhost';
    const port = Number(this.config.get<string>('DATABASE_PORT') ?? 5432);
    const database = this.config.get<string>('DATABASE_NAME') ?? 'ehelp';
    const base = {
      host,
      port,
      database,
      latency_ms: null,
      table_count: null,
    };

    const startedAt = Date.now();
    try {
      const rows =
        await this.dataSource.query<{ count: number }[]>(TABLE_COUNT_SQL);
      const latency = Date.now() - startedAt;
      const tableCount = rows[0]?.count ?? null;
      return {
        ...base,
        state: 'ok',
        connected: true,
        latency_ms: latency,
        table_count: tableCount,
        error: null,
      };
    } catch (err) {
      return {
        ...base,
        state: 'error',
        connected: false,
        error: err instanceof Error ? err.message : 'unknown database error',
      };
    }
  }

  checkEnv(): HealthReport['env'] {
    const groups = ENV_GROUPS.map((spec) => this.checkEnvGroup(spec));
    const missing = groups.flatMap((g) => g.missing);
    return {
      state: worst(groups.map((g) => g.state)),
      missing,
      groups,
    };
  }

  private checkEnvGroup(spec: EnvGroupSpec): EnvGroupReport {
    const vars = spec.vars.map((v) => this.readEnvVar(v.name, v.secret));
    const byName = new Map(vars.map((v) => [v.name, v]));

    const missing = spec.vars
      .filter((v) => v.required && !byName.get(v.name)?.set)
      .map((v) => v.name);

    if (spec.anyOf?.length && !spec.anyOf.some((n) => byName.get(n)?.set)) {
      missing.push(`one of: ${spec.anyOf.join(', ')}`);
    }

    return {
      group: spec.group,
      state: missing.length > 0 ? 'degraded' : 'ok',
      missing,
      vars,
    };
  }

  private readEnvVar(name: string, isSecret: boolean): EnvVarReport {
    const raw = this.config.get<string>(name)?.trim() ?? '';
    return {
      name,
      set: raw.length > 0,
      secret: isSecret,
      // Secrets are never echoed, only their presence is reported.
      value: isSecret || raw.length === 0 ? null : raw,
    };
  }
}

const RANK: Record<HealthState, number> = { ok: 0, degraded: 1, error: 2 };

function worst(states: HealthState[]): HealthState {
  return states.reduce<HealthState>(
    (acc, s) => (RANK[s] > RANK[acc] ? s : acc),
    'ok',
  );
}
