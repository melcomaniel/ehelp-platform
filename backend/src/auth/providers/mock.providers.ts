import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import type {
  EgovSsoProfile,
  EgovSsoProvider,
  EverifyProvider,
  EverifyResult,
  LivenessCreateResult,
  LivenessProvider,
  LivenessVerifyResult,
} from './types';

/** Local/MVP adapters — no external network required. */
@Injectable()
export class MockEgovSsoProvider implements EgovSsoProvider {
  async exchangeCode(exchangeCode: string): Promise<EgovSsoProfile> {
    const suffix = exchangeCode.slice(-6) || 'DEMO01';
    return {
      uniqid: `MOCK-${suffix.toUpperCase()}`,
      email: `citizen.${suffix.toLowerCase()}@example.local`,
      birth_date: '1990-01-01',
      first_name: 'DEMO',
      middle_name: 'SANTOS',
      last_name: 'DELA CRUZ',
      gender: 'female',
      nationality: 'Filipino',
      mobile: '+639090000000',
      address: '100 SAMPLE ST., POBLACION, QUEZON CITY',
      street: '100 SAMPLE ST.',
      barangay: 'POBLACION',
      municipality: 'QUEZON CITY',
    };
  }
}

@Injectable()
export class MockEverifyProvider implements EverifyProvider {
  async verifyPersonalInfo(input: {
    firstName: string;
    middleName?: string;
    lastName: string;
    suffix?: string;
    birthDate: string;
    faceLivenessSessionId: string;
  }): Promise<EverifyResult> {
    return {
      reference: `MOCK-EV-${input.faceLivenessSessionId.slice(0, 8)}`,
      first_name: input.firstName,
      middle_name: input.middleName,
      last_name: input.lastName,
      suffix: input.suffix,
      birth_date: input.birthDate,
      full_name: [
        input.firstName,
        input.middleName,
        input.lastName,
        input.suffix,
      ]
        .filter(Boolean)
        .join(' '),
      // Unique per session so concurrent mock registrations do not collide on users.email
      email: `verified.${input.faceLivenessSessionId.slice(0, 8).toLowerCase()}@example.local`,
      mobile_number: '639090000000',
      full_address: 'MOCK VERIFIED ADDRESS',
    };
  }

  async verifyQr(input: {
    qrValue: string;
    faceLivenessSessionId: string;
  }): Promise<EverifyResult> {
    return this.verifyPersonalInfo({
      firstName: 'JUAN',
      middleName: 'SANTOS',
      lastName: 'DELA CRUZ',
      birthDate: '1989-09-12',
      faceLivenessSessionId: input.faceLivenessSessionId,
    });
  }
}

@Injectable()
export class MockLivenessProvider implements LivenessProvider {
  constructor(private readonly config: ConfigService) {}

  async createSession(input: {
    action: string;
    callbackUrl: string;
    delay?: number;
    /** Reachable from the client (LAN IP on physical devices). */
    publicBaseUrl?: string;
  }): Promise<LivenessCreateResult> {
    const token = randomUUID();
    const delay = input.delay ?? 3000;
    const base = (
      input.publicBaseUrl ||
      this.config.get<string>('PUBLIC_API_BASE_URL') ||
      'http://127.0.0.1:3001'
    ).replace(/\/$/, '');
    // Local mock page — mobile opens this then deep-links back
    const url =
      `${base}/auth/liveness/mock-ui` +
      `?token=${encodeURIComponent(token)}` +
      `&callback=${encodeURIComponent(input.callbackUrl)}` +
      `&delay=${delay}`;
    return { token, url, source: 'mock' };
  }

  async getResult(sessionToken: string): Promise<LivenessVerifyResult> {
    const min = Number(this.config.get('FACE_LIVENESS_MIN_CONFIDENCE') ?? 95);
    return {
      status: 'SUCCEEDED',
      confidenceScore: Math.max(min, 98.5),
      referenceImageUrl: null as unknown as undefined,
      passed: true,
    };
  }
}
