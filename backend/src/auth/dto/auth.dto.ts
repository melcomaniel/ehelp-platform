import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class SsoExchangeDto {
  @IsString()
  @MinLength(4)
  exchange_code!: string;

  /** mobile | web — defaults to mobile (beneficiary SSO). */
  @IsOptional()
  @IsIn(['mobile', 'web'])
  client_platform?: 'mobile' | 'web';

  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Matches(/^[A-Za-z0-9._:-]+$/)
  device_fingerprint?: string;
}

export class LivenessCreateDto {
  @IsString()
  purpose!: string; // registration | application | login

  @IsOptional()
  @IsUUID()
  user_id?: string;

  @IsOptional()
  @IsString()
  callback_url?: string;

  @IsOptional()
  @IsString()
  action?: string;
}

export class LoginCompleteDto {
  @IsString()
  @MinLength(10)
  pending_login_token!: string;

  @IsString()
  @MinLength(4)
  liveness_session_token!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Matches(/^[A-Za-z0-9._:-]+$/)
  device_fingerprint?: string;
}

export class LoginLivenessSessionDto {
  @IsString()
  @MinLength(10)
  pending_login_token!: string;

  @IsOptional()
  @IsString()
  callback_url?: string;

  @IsOptional()
  @IsString()
  action?: string;
}

export class LivenessVerifyDto {
  @IsString()
  session_token!: string;
}

export class FirstTimeEverifyDto {
  @IsString()
  face_liveness_session_id!: string;

  @IsOptional()
  @IsString()
  qr_value?: string;

  @IsOptional()
  @IsString()
  first_name?: string;

  @IsOptional()
  @IsString()
  middle_name?: string;

  @IsOptional()
  @IsString()
  last_name?: string;

  @IsOptional()
  @IsString()
  suffix?: string;

  @IsOptional()
  @IsString()
  birth_date?: string;
}

export class LivenessBindEverifyDto {
  @IsString()
  correlation!: string;

  @IsString()
  everify_session_id!: string;

  @IsOptional()
  @IsString()
  reference_image_url?: string;
}

export class DevLoginDto {
  @IsString()
  email!: string;

  @IsString()
  @MinLength(4)
  password!: string;

  /** mobile | web — defaults to mobile. */
  @IsOptional()
  @IsIn(['mobile', 'web'])
  client_platform?: 'mobile' | 'web';

  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Matches(/^[A-Za-z0-9._:-]+$/)
  device_fingerprint?: string;
}

const STAFF_APP_ROLES = [
  'platform_admin',
  'dswd_admin',
  'satellite_admin',
  'evaluator',
  'approver',
] as const;

export class CreateStaffAccountDto {
  @IsString()
  email!: string;

  @IsString()
  @MinLength(2)
  full_name!: string;

  @IsIn([...STAFF_APP_ROLES])
  role!: (typeof STAFF_APP_ROLES)[number];

  @IsOptional()
  @IsUUID()
  office_id?: string;

  @IsOptional()
  @IsUUID()
  organization_id?: string;

  /** Optional initial password (mock/dev). Staff can also sign in via SSO once provisioned. */
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @IsOptional()
  @IsString()
  phone?: string;
}
