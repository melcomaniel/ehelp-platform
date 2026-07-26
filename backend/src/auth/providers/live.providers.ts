import {
  Injectable,
  Logger,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
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

@Injectable()
export class LiveEgovSsoProvider implements EgovSsoProvider {
  private readonly log = new Logger(LiveEgovSsoProvider.name);

  constructor(private readonly config: ConfigService) {}

  async exchangeCode(exchangeCode: string): Promise<EgovSsoProfile> {
    const base = this.config.getOrThrow<string>('EGOV_SSO_BASE_URL');
    const partnerCode = this.config.getOrThrow<string>('EGOV_PARTNER_CODE');
    const partnerSecret = this.config.getOrThrow<string>('EGOV_PARTNER_SECRET');
    const code = exchangeCode.trim();

    this.log.log(
      `SSO /api/token partner_code=${partnerCode} exchange_code_len=${code.length}`,
    );

    const tokenRes = await axios.post(
      `${base.replace(/\/$/, '')}/api/token`,
      {
        exchange_code: code,
        scope: 'SSO_AUTHENTICATION',
        partner_code: partnerCode,
        partner_secret: partnerSecret,
      },
      { validateStatus: () => true },
    );

    this.log.log(
      `SSO /api/token status=${tokenRes.status} body=${JSON.stringify(tokenRes.data).slice(0, 400)}`,
    );

    if (tokenRes.status === 403) {
      throw new UnauthorizedException(
        'Invalid partner credentials (EGOV_PARTNER_CODE / EGOV_PARTNER_SECRET)',
      );
    }
    if (tokenRes.status === 422) {
      throw new UnprocessableEntityException(
        'Invalid or expired exchange_code. Codes are single-use and must be minted ' +
          `with the same partner_code as Nest (.env EGOV_PARTNER_CODE=${partnerCode}), ` +
          'not the literal {{partner_code}} placeholder. Generate a new code and try once.',
      );
    }
    if (tokenRes.status !== 200 || !tokenRes.data?.access_token) {
      throw new UnauthorizedException(
        `SSO token exchange failed (${tokenRes.status}): ${JSON.stringify(tokenRes.data).slice(0, 300)}`,
      );
    }

    const accessToken = tokenRes.data.access_token as string;
    const profileRes = await axios.post(
      `${base.replace(/\/$/, '')}/api/partner/sso_authentication`,
      null,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        validateStatus: () => true,
      },
    );

    if (profileRes.status === 401) {
      throw new UnauthorizedException('SSO access token invalid');
    }
    if (profileRes.status !== 200 || !profileRes.data?.data?.uniqid) {
      throw new UnauthorizedException('SSO profile fetch failed');
    }

    return profileRes.data.data as EgovSsoProfile;
  }
}

@Injectable()
export class LiveEverifyProvider implements EverifyProvider {
  private readonly log = new Logger(LiveEverifyProvider.name);

  constructor(private readonly config: ConfigService) {}

  private async accessToken(): Promise<string> {
    const base = this.config.getOrThrow<string>('EVERIFY_BASE_URL');
    const res = await axios.post(
      `${base.replace(/\/$/, '')}/api/auth`,
      {
        client_id: this.config.getOrThrow('EVERIFY_CLIENT_ID'),
        client_secret: this.config.getOrThrow('EVERIFY_CLIENT_SECRET'),
      },
      { validateStatus: () => true },
    );
    if (res.status !== 200 || !res.data?.data?.access_token) {
      this.log.error(`eVerify auth failed status=${res.status}`);
      throw new UnauthorizedException('eVerify auth failed');
    }
    return res.data.data.access_token as string;
  }

  private mapPerson(d: Record<string, unknown>): EverifyResult {
    const first =
      (d.first_name as string) ||
      (d.firstName as string) ||
      (d.given_name as string);
    const middle =
      (d.middle_name as string) ||
      (d.middleName as string) ||
      (d.middle_initial as string);
    const last =
      (d.last_name as string) ||
      (d.lastName as string) ||
      (d.surname as string) ||
      (d.family_name as string);
    const full =
      (d.full_name as string) ||
      (d.fullName as string) ||
      [first, middle, last].filter(Boolean).join(' ') ||
      undefined;
    return {
      reference: (d.reference as string) ?? (d.token as string),
      full_name: full,
      first_name: first,
      middle_name: middle,
      last_name: last,
      suffix: (d.suffix as string) ?? null,
      birth_date: (d.birth_date as string) || (d.birthDate as string),
      email: d.email as string,
      mobile_number: (d.mobile_number as string) || (d.mobile as string),
      full_address: (d.full_address as string) || (d.address as string),
      face_url: (d.face_url as string) || (d.photo_url as string),
      raw: d,
    };
  }

  async verifyPersonalInfo(input: {
    firstName: string;
    middleName?: string;
    lastName: string;
    suffix?: string;
    birthDate: string;
    faceLivenessSessionId: string;
  }): Promise<EverifyResult> {
    if (
      !input.firstName?.trim() ||
      !input.lastName?.trim() ||
      !input.birthDate?.trim()
    ) {
      throw new UnprocessableEntityException(
        'eVerify needs first_name, last_name, and birth_date from SSO (or enter them). Mock SSO names will not match your real face.',
      );
    }

    const base = this.config.getOrThrow<string>('EVERIFY_BASE_URL');
    const token = await this.accessToken();
    const body = {
      first_name: input.firstName.trim(),
      middle_name: input.middleName?.trim() || undefined,
      last_name: input.lastName.trim(),
      suffix: input.suffix?.trim() || undefined,
      birth_date: input.birthDate.trim(),
      face_liveness_session_id: input.faceLivenessSessionId,
    };
    this.log.log(
      `eVerify /api/query face_liveness_session_id=${input.faceLivenessSessionId} name=${body.first_name} ${body.last_name} dob=${body.birth_date}`,
    );

    const res = await axios.post(`${base.replace(/\/$/, '')}/api/query`, body, {
      headers: { Authorization: `Bearer ${token}` },
      validateStatus: () => true,
    });

    this.log.log(
      `eVerify /api/query status=${res.status} body=${JSON.stringify(res.data).slice(0, 800)}`,
    );

    if (res.status !== 200 || !res.data?.data) {
      const detail =
        typeof res.data === 'object'
          ? JSON.stringify(res.data)
          : String(res.data ?? res.status);
      throw new UnprocessableEntityException(
        `eVerify query failed (${res.status}): ${detail}`,
      );
    }

    const mapped = this.mapPerson(res.data.data as Record<string, unknown>);
    const meta = res.data.meta as Record<string, unknown> | undefined;
    if (!mapped.first_name && !mapped.full_name) {
      throw new UnprocessableEntityException(
        'eVerify returned no identity fields. Usually the face does not match the submitted name/DOB ' +
          `(sent ${body.first_name} ${body.last_name}, ${body.birth_date}). ` +
          'Use real eGov SSO for your own account (not mock-exchange), or National ID QR verify. ' +
          `meta=${JSON.stringify(meta ?? {})} data=${JSON.stringify(res.data.data).slice(0, 400)}`,
      );
    }
    return mapped;
  }

  async verifyQr(input: {
    qrValue: string;
    faceLivenessSessionId: string;
  }): Promise<EverifyResult> {
    const base = this.config.getOrThrow<string>('EVERIFY_BASE_URL');
    const token = await this.accessToken();
    this.log.log(
      `eVerify /api/query/qr face_liveness_session_id=${input.faceLivenessSessionId}`,
    );
    const res = await axios.post(
      `${base.replace(/\/$/, '')}/api/query/qr`,
      {
        value: input.qrValue,
        face_liveness_session_id: input.faceLivenessSessionId,
      },
      {
        headers: { Authorization: `Bearer ${token}` },
        validateStatus: () => true,
      },
    );
    this.log.log(
      `eVerify /api/query/qr status=${res.status} body=${JSON.stringify(res.data).slice(0, 800)}`,
    );
    if (res.status !== 200 || !res.data?.data) {
      const detail =
        typeof res.data === 'object'
          ? JSON.stringify(res.data)
          : String(res.data ?? res.status);
      const faceErr =
        res.data?.error === 'face_liveness_error_exception' ||
        String(detail).includes('face_liveness_error_exception');
      throw new UnprocessableEntityException(
        faceErr
          ? `eVerify rejected face_liveness_session_id (incomplete, expired, already used, or wrong product). Retake Face Liveness in-app, then scan QR immediately without retrying name/DOB first. session=${input.faceLivenessSessionId} detail=${detail}`
          : `eVerify QR verify failed (${res.status}): ${detail}`,
      );
    }

    const data = res.data.data as Record<string, unknown>;
    const meta = res.data.meta as Record<string, unknown> | undefined;
    if (data.verified === false) {
      throw new UnprocessableEntityException(
        'eVerify QR: face does not match the National ID QR (verified=false). ' +
          'Retake Face Liveness with the same person as the ID, then rescan. ' +
          `meta=${JSON.stringify(meta ?? {})}`,
      );
    }

    const mapped = this.mapPerson(data);
    if (!mapped.first_name && !mapped.full_name) {
      throw new UnprocessableEntityException(
        'eVerify QR returned no identity fields. Check QR is a PhilSys National ID QR ' +
          `(not a random barcode) and face matches. meta=${JSON.stringify(meta ?? {})} ` +
          `data=${JSON.stringify(data).slice(0, 400)}`,
      );
    }
    return mapped;
  }
}

@Injectable()
export class LiveLivenessProvider implements LivenessProvider {
  constructor(private readonly config: ConfigService) {}

  async createSession(input: {
    action: string;
    callbackUrl: string;
    delay?: number;
    publicBaseUrl?: string;
  }): Promise<LivenessCreateResult> {
    const pubKey = this.config.get<string>('EVERIFY_PUBKEY');
    const host = (
      this.config.get<string>('EVERIFY_LIVENESS_HOST') ||
      'https://hackathon-everify-face-liveness.e.gov.ph'
    ).replace(/\/$/, '');

    // PhilSys eVerify requires a completed Web SDK session_id.
    // Open the official HTTPS liveness app TOP-LEVEL (not nested under Nest HTTP).
    // Mobile WebView loads this URL and injects a bridge to capture session_id.
    if (pubKey) {
      const correlation = randomUUID();
      // Match official SDK query shape (awst = public API key).
      const url = `${host}/?t=basic&liveness=0&awst=${encodeURIComponent(pubKey)}`;
      return { token: correlation, url, source: 'everify_sdk' };
    }

    const base = this.config.getOrThrow<string>('FACE_LIVENESS_BASE_URL');
    const apiKey = this.config.getOrThrow<string>('FACE_LIVENESS_API_KEY');
    const res = await axios.post(
      `${base.replace(/\/$/, '')}/v1/liveness/session`,
      {
        action: input.action,
        callback_url: input.callbackUrl,
        delay: input.delay ?? 3000,
      },
      {
        headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
        validateStatus: () => true,
      },
    );
    if (res.status !== 201 && res.status !== 200) {
      throw new UnprocessableEntityException('Liveness session create failed');
    }
    const token = res.data.token ?? res.data.data?.token;
    const url = res.data.url ?? res.data.data?.url;
    if (!token || !url) {
      throw new UnprocessableEntityException(
        'Invalid liveness session response',
      );
    }
    return { token, url, source: 'face_liveness_api' };
  }

  async getResult(sessionToken: string): Promise<LivenessVerifyResult> {
    const base = this.config.getOrThrow<string>('FACE_LIVENESS_BASE_URL');
    const apiKey = this.config.getOrThrow<string>('FACE_LIVENESS_API_KEY');
    const min = Number(this.config.get('FACE_LIVENESS_MIN_CONFIDENCE') ?? 95);
    const res = await axios.get(
      `${base.replace(/\/$/, '')}/v1/liveness/result/${sessionToken}`,
      {
        headers: { 'x-api-key': apiKey },
        validateStatus: () => true,
      },
    );
    if (res.status !== 200) {
      throw new UnprocessableEntityException('Liveness result fetch failed');
    }
    const status = String(res.data.status ?? '');
    const confidenceScore = Number(res.data.confidence_score ?? 0);
    return {
      status,
      confidenceScore,
      referenceImageUrl: res.data.reference_image_url,
      passed: status === 'SUCCEEDED' && confidenceScore >= min,
    };
  }
}
