import { Transform, Type } from 'class-transformer';
import {
  Equals,
  IsBoolean,
  IsDefined,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { OFFICE_LEVELS, type OfficeLevel } from '../offices/office.policy';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const lower = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;
const upper = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

export const PLATFORM_SECURITY_BASELINE = Object.freeze({
  mfa_required: true as const,
  device_registration_required: true as const,
  session_timeout_minutes: 30,
});

export class InitialOrganizationAdminDto {
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  full_name!: string;

  @Transform(lower)
  @IsEmail()
  @Matches(/@(?:[a-z0-9-]+\.)*gov\.ph$/i, {
    message: 'email must be a Philippine government email address (.gov.ph)',
  })
  @MaxLength(254)
  email!: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(40)
  phone?: string;
}

export class InitialPolicyConfigDto {
  @IsBoolean()
  @Equals(true, {
    message: 'mfa_required cannot weaken the platform security baseline',
  })
  mfa_required!: true;

  @IsBoolean()
  @Equals(true, {
    message:
      'device_registration_required cannot weaken the platform security baseline',
  })
  device_registration_required!: true;

  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(PLATFORM_SECURITY_BASELINE.session_timeout_minutes, {
    message:
      'session_timeout_minutes cannot exceed the platform security baseline of 30 minutes',
  })
  session_timeout_minutes!: number;
}

export class CreateOrganizationDto {
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name!: string;

  @Transform(upper)
  @IsString()
  @Matches(/^[A-Z0-9][A-Z0-9_-]{1,31}$/)
  code!: string;

  @IsUUID()
  creation_key!: string;

  @ValidateNested()
  @IsDefined()
  @Type(() => InitialPolicyConfigDto)
  policy_config!: InitialPolicyConfigDto;

  @ValidateNested()
  @IsDefined()
  @Type(() => InitialOrganizationAdminDto)
  initial_admin!: InitialOrganizationAdminDto;
}

export class UpdateOrganizationDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @Transform(upper)
  @IsString()
  @Matches(/^[A-Z0-9][A-Z0-9_-]{1,31}$/)
  code?: string;
}

export class OrganizationListQueryDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsIn(['active', 'suspended', 'archived'])
  status?: 'active' | 'suspended' | 'archived';

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  page_size = 20;
}

export class OrganizationOfficeListQueryDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsIn(OFFICE_LEVELS)
  level?: OfficeLevel;

  @IsOptional()
  @IsIn(['active', 'archived'])
  status?: 'active' | 'archived';

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  page_size = 10;
}

export class OrganizationAdminListQueryDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsIn(['active', 'suspended'])
  status?: 'active' | 'suspended';

  @IsOptional()
  @IsIn(['pending', 'accepted', 'revoked'])
  invitation_status?: 'pending' | 'accepted' | 'revoked';

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  page_size = 20;
}

export class LifecycleReasonDto {
  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}

export class ReactivateOrganizationDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class UpdateOrganizationAdminDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  full_name?: string;

  @IsOptional()
  @Transform(lower)
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(40)
  phone?: string;
}
