import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateApplicationDto {
  @IsString()
  office_id!: string;

  /** Program template id (or version id). */
  @IsString()
  template_id!: string;

  @IsOptional()
  @IsString()
  customer_user_id?: string;

  @IsOptional()
  @IsObject()
  form_data?: Record<string, unknown>;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  amount_requested?: number;

  @IsOptional()
  @IsBoolean()
  submit?: boolean;
}

export class UpdateApplicationDto {
  @IsOptional()
  @IsObject()
  form_data?: Record<string, unknown>;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  amount_requested?: number;

  @IsOptional()
  @IsString()
  status?: string;
}

export class RecommendDto {
  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  priority?: string;
}

export class DecideDto {
  @IsBoolean()
  approve!: boolean;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  amount_approved?: number;
}

export class RegisterDependentDto {
  @IsString()
  principal_user_id!: string;

  @IsString()
  dependent_user_id!: string;

  @IsString()
  relationship!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
