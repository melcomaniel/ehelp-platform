export interface EnvVarSpec {
  name: string;
  /** Secret values are reported as set/unset only, never echoed. */
  secret: boolean;
  required: boolean;
}

export interface EnvGroupSpec {
  group: string;
  vars: EnvVarSpec[];
  /** Group is satisfied when at least one of these names is set. */
  anyOf?: string[];
}

const secret = (name: string, required = true): EnvVarSpec => ({
  name,
  secret: true,
  required,
});

const plain = (name: string, required = true): EnvVarSpec => ({
  name,
  secret: false,
  required,
});

export const ENV_GROUPS: readonly EnvGroupSpec[] = [
  {
    group: 'database',
    vars: [
      plain('DATABASE_HOST'),
      plain('DATABASE_PORT'),
      plain('DATABASE_USER'),
      secret('DATABASE_PASSWORD'),
      plain('DATABASE_NAME'),
    ],
  },
  {
    group: 'auth',
    vars: [
      secret('JWT_SECRET'),
      plain('JWT_EXPIRES_IN', false),
      plain('AUTH_PROVIDER_MODE'),
      plain('AUTH_SSO_MODE', false),
      plain('AUTH_EVERIFY_MODE', false),
      plain('AUTH_LIVENESS_MODE', false),
    ],
  },
  {
    group: 'egov_sso',
    vars: [
      plain('EGOV_SSO_BASE_URL'),
      secret('EGOV_PARTNER_CODE'),
      secret('EGOV_PARTNER_SECRET'),
      plain('EGOV_SSO_CALLBACK_PATH', false),
    ],
  },
  {
    group: 'everify',
    vars: [
      plain('EVERIFY_BASE_URL'),
      secret('EVERIFY_CLIENT_ID'),
      secret('EVERIFY_CLIENT_SECRET'),
      secret('EVERIFY_PUBKEY'),
      plain('EVERIFY_LIVENESS_HOST', false),
    ],
  },
  {
    group: 'face_liveness',
    vars: [
      plain('FACE_LIVENESS_BASE_URL'),
      secret('FACE_LIVENESS_API_KEY'),
      plain('FACE_LIVENESS_MIN_CONFIDENCE', false),
    ],
  },
  {
    group: 'emessage',
    vars: [
      plain('EMESSAGE_BASE_URL', false),
      secret('EMESSAGE_ACCESS_TOKEN', false),
    ],
  },
  {
    group: 'egov_ai',
    vars: [plain('EGOV_AI_BASE_URL'), secret('EGOV_AI_ACCESS_CODE')],
  },
  {
    group: 'ereport',
    vars: [
      plain('EREPORT_BASE_URL'),
      secret('EREPORT_ACCESS_CODE', false),
      secret('EREPORT_ACCESS_TOKEN', false),
      secret('EREPORT_REPORT_VIEW_TOKEN', false),
    ],
    anyOf: ['EREPORT_ACCESS_CODE', 'EREPORT_ACCESS_TOKEN'],
  },
  {
    group: 'web',
    vars: [
      plain('WEB_APP_URL'),
      plain('CORS_ORIGINS', false),
      plain('PORT', false),
    ],
  },
];
