import type { EgovSsoProfile } from './types';

function staffProfile(
  uniqid: string,
  email: string,
  first: string,
  middle: string,
  last: string,
): EgovSsoProfile {
  return {
    uniqid,
    email,
    birth_date: '1990-01-01',
    first_name: first,
    middle_name: middle,
    last_name: last,
    gender: 'female',
    nationality: 'Filipino',
    mobile: '+639090000000',
    address: '100 SAMPLE ST., POBLACION, QUEZON CITY',
    street: '100 SAMPLE ST.',
    barangay: 'POBLACION',
    municipality: 'QUEZON CITY',
  };
}

/**
 * Fixed SSO codes for local / demo testing.
 * Work in AUTH_PROVIDER_MODE=mock and in live mode when the exchange_code
 * matches a fixture key (prefix `mock:` optional).
 *
 * Web: paste these on /signin (must match a provisioned staff email in DB).
 * Mobile: beneficiary / dependent codes.
 */
const FIXTURES: Record<string, EgovSsoProfile> = {
  // ── Web staff (seed 002_staff_accounts.sql) ─────────────────
  platform: staffProfile(
    'MOCK-PLATFORM-ADMIN',
    'platform@ehelp.local',
    'PLATFORM',
    'DEMO',
    'ADMIN',
  ),
  orgadmin: staffProfile(
    'MOCK-ORG-ADMIN',
    'orgadmin@ehelp.local',
    'ORG',
    'DEMO',
    'ADMIN',
  ),
  officeadmin: staffProfile(
    'MOCK-OFFICE-ADMIN',
    'officeadmin@ehelp.local',
    'OFFICE',
    'DEMO',
    'ADMIN',
  ),
  evaluator: staffProfile(
    'MOCK-EVALUATOR',
    'evaluator@ehelp.local',
    'DEMO',
    'CASE',
    'EVALUATOR',
  ),
  approver: staffProfile(
    'MOCK-APPROVER',
    'approver@ehelp.local',
    'DEMO',
    'CASE',
    'APPROVER',
  ),

  // Aliases / role-shaped codes
  platform_admin: staffProfile(
    'MOCK-PLATFORM-ADMIN',
    'platform@ehelp.local',
    'PLATFORM',
    'DEMO',
    'ADMIN',
  ),
  org_admin: staffProfile(
    'MOCK-ORG-ADMIN',
    'orgadmin@ehelp.local',
    'ORG',
    'DEMO',
    'ADMIN',
  ),
  dswd_admin: staffProfile(
    'MOCK-ORG-ADMIN',
    'orgadmin@ehelp.local',
    'ORG',
    'DEMO',
    'ADMIN',
  ),
  office_admin: staffProfile(
    'MOCK-OFFICE-ADMIN',
    'officeadmin@ehelp.local',
    'OFFICE',
    'DEMO',
    'ADMIN',
  ),
  satellite_admin: staffProfile(
    'MOCK-OFFICE-ADMIN',
    'officeadmin@ehelp.local',
    'OFFICE',
    'DEMO',
    'ADMIN',
  ),

  // Hackathon ssoplatform* identities (seed 003) — optional when that seed is loaded
  ssoplatform: staffProfile(
    'MOCK-SSO-PLATFORM',
    'ssoplatform@ehelp.local',
    'DEMO',
    'SANTOS',
    'DELA CRUZ',
  ),
  ssoorgadmin: staffProfile(
    'MOCK-SSO-ORG',
    'ssoorgadmin@ehelp.local',
    'JOSE',
    'CRUZ',
    'DELA PENA',
  ),
  ssoofficeadmin: staffProfile(
    'MOCK-SSO-OFFICE',
    'ssoofficeadmin@ehelp.local',
    'ARNEL',
    'DELA',
    'CRUZ',
  ),
  ssoevaluator: staffProfile(
    'MOCK-SSO-EVAL',
    'ssoevaluator@ehelp.local',
    'JOHN',
    'GARCIA',
    'REYES',
  ),
  ssoapprover: staffProfile(
    'MOCK-SSO-APPR',
    'ssoapprover@ehelp.local',
    'APPROVER',
    'RAMOS',
    'MENDOZA',
  ),

  // ── Mobile beneficiaries ────────────────────────────────────
  beneficiary: {
    uniqid: 'MOCK-BENEFICIARY-1',
    email: 'beneficiary@mock.gov.ph',
    birth_date: '1990-01-15',
    first_name: 'ANA',
    middle_name: 'CRUZ',
    last_name: 'SANTOS',
    gender: 'female',
    nationality: 'Filipino',
    mobile: '+639171000001',
    address: '123 SAMPLE ST., BAGONG BARRIO, CALOOCAN CITY',
    street: '123 SAMPLE ST.',
    barangay: 'BAGONG BARRIO',
    municipality: 'CALOOCAN CITY',
  },
  beneficiary2: {
    uniqid: 'MOCK-BENEFICIARY-2',
    email: 'beneficiary2@mock.gov.ph',
    birth_date: '1988-06-20',
    first_name: 'CARLO',
    middle_name: 'REYES',
    last_name: 'GARCIA',
    gender: 'male',
    nationality: 'Filipino',
    mobile: '+639171000002',
    address: '200 SAMPLE ST., POBLACION, QUEZON CITY',
    street: '200 SAMPLE ST.',
    barangay: 'POBLACION',
    municipality: 'QUEZON CITY',
  },
  dependent: {
    uniqid: 'MOCK-DEPENDENT-1',
    email: 'dependent@mock.gov.ph',
    birth_date: '2005-03-10',
    first_name: 'LIZA',
    middle_name: 'CRUZ',
    last_name: 'SANTOS',
    gender: 'female',
    nationality: 'Filipino',
    mobile: '+639171000003',
    address: '123 SAMPLE ST., BAGONG BARRIO, CALOOCAN CITY',
    street: '123 SAMPLE ST.',
    barangay: 'BAGONG BARRIO',
    municipality: 'CALOOCAN CITY',
  },
};

/** Normalize `beneficiary`, `mock:beneficiary`, `MOCK:BENEFICIARY` → fixture key. */
export function normalizeMockSsoCode(exchangeCode: string): string {
  return exchangeCode
    .trim()
    .toLowerCase()
    .replace(/^mock:/, '')
    .replace(/\s+/g, '');
}

export function resolveMockSsoFixture(
  exchangeCode: string,
): EgovSsoProfile | null {
  const key = normalizeMockSsoCode(exchangeCode);
  const profile = FIXTURES[key];
  return profile ? { ...profile } : null;
}

export function listMockSsoFixtureCodes(): string[] {
  return Object.keys(FIXTURES);
}
