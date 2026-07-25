export type EgovSsoProfile = {
  uniqid: string;
  email?: string | null;
  birth_date?: string | null;
  first_name?: string | null;
  middle_name?: string | null;
  last_name?: string | null;
  suffix?: string | null;
  gender?: string | null;
  nationality?: string | null;
  photo?: string | null;
  mobile?: string | null;
  address?: string | null;
  street?: string | null;
  barangay?: string | null;
  municipality?: string | null;
};

export interface EgovSsoProvider {
  exchangeCode(exchangeCode: string): Promise<EgovSsoProfile>;
}

export type EverifyResult = {
  reference?: string;
  full_name?: string;
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  suffix?: string | null;
  birth_date?: string;
  email?: string;
  mobile_number?: string;
  full_address?: string;
  face_url?: string;
  raw?: Record<string, unknown>;
};

export interface EverifyProvider {
  verifyPersonalInfo(input: {
    firstName: string;
    middleName?: string;
    lastName: string;
    suffix?: string;
    birthDate: string;
    faceLivenessSessionId: string;
  }): Promise<EverifyResult>;

  verifyQr(input: {
    qrValue: string;
    faceLivenessSessionId: string;
  }): Promise<EverifyResult>;
}

export type LivenessCreateResult = {
  token: string;
  url: string;
  source?: 'everify_sdk' | 'face_liveness_api' | 'mock';
};

export type LivenessVerifyResult = {
  status: string;
  confidenceScore: number;
  referenceImageUrl?: string;
  passed: boolean;
};

export interface LivenessProvider {
  createSession(input: {
    action: string;
    callbackUrl: string;
    delay?: number;
    publicBaseUrl?: string;
  }): Promise<LivenessCreateResult>;

  getResult(sessionToken: string): Promise<LivenessVerifyResult>;
}
