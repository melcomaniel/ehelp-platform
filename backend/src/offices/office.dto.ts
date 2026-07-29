import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  OFFICE_LEVELS,
  type OfficeLevel,
  type OfficeStatus,
} from './office.policy';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class OfficeListQueryDto {
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
  status?: OfficeStatus;

  @IsOptional()
  @IsUUID()
  parent_office_id?: string;

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

export class CreateOfficeDto {
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name!: string;

  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  code!: string;

  @IsIn(OFFICE_LEVELS)
  level!: OfficeLevel;

  @IsOptional()
  @IsUUID()
  parent_office_id?: string | null;
}

export class CreateRegionalOfficeDto {
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name!: string;

  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  code!: string;
}

export class UpdateOfficeDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  code?: string;

  @IsOptional()
  @IsIn(OFFICE_LEVELS)
  level?: OfficeLevel;

  @IsOptional()
  @IsUUID()
  parent_office_id?: string | null;
}

export class OfficeLifecycleReasonDto {
  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}
