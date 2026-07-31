import type { EgovSsoProfile } from './types';

/**
 * Fixed mobile/beneficiary SSO codes for local testing.
 * Work in AUTH_PROVIDER_MODE=mock (any code still works) and in live mode
 * when the exchange_code matches a fixture key (prefix `mock:` optional).
 *
 * Web staff should keep using real eGov sample identities (ssoplatform*@yopmail.com).
 */
const FIXTURES: Record<string, EgovSsoProfile> = {
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
