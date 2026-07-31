import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MinLength,
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

  /** Proof files required for Office Admin approval. */
  @IsOptional()
  documents?: Array<{ document_type: string; storage_uri: string }>;
}

export class RelationshipDecisionDto {
  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsBoolean()
  accept?: boolean;

  @IsOptional()
  @IsBoolean()
  approve?: boolean;
}

export class ApplyWorkflowTemplateDto {
  @IsString()
  workflow_template_id!: string;

  @IsOptional()
  @IsString()
  name?: string;
}

export class ProfileChangeRequestDto {
  @IsString()
  description!: string;

  @IsObject()
  proposed_changes!: Record<string, unknown>;

  @IsOptional()
  documents?: Array<{ document_type: string; storage_uri: string }>;
}

export class ProfileChangeDecisionDto {
  @IsBoolean()
  approve!: boolean;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateDisbursementSlotDto {
  @IsString()
  starts_at!: string;

  @IsString()
  ends_at!: string;

  /** Program whose period_windows.disbursement_* gate this slot. */
  @IsString()
  program_template_id!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  capacity?: number;

  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsString()
  office_id?: string;

  @IsOptional()
  @IsString()
  site_name?: string;

  @IsOptional()
  @IsString()
  site_address?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  longitude?: number;
}

export class UpdateDisbursementSlotDto {
  @IsOptional()
  @IsString()
  starts_at?: string;

  @IsOptional()
  @IsString()
  ends_at?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  capacity?: number;

  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsString()
  site_name?: string;

  @IsOptional()
  @IsString()
  site_address?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  longitude?: number;
}

export class BookDisbursementSlotDto {
  @IsString()
  slot_id!: string;

  @IsString()
  application_id!: string;
}

export class ValidateDisbursementClaimDto {
  @IsString()
  @MinLength(8)
  claim_token!: string;

  /** Required face-liveness session for the claimant (cash-window gate). */
  @IsString()
  @MinLength(8)
  liveness_session_token!: string;
}

export class PreviewDisbursementClaimDto {
  @IsString()
  @MinLength(8)
  claim_token!: string;
}

export class ClaimLivenessSessionDto {
  @IsString()
  @MinLength(8)
  claim_token!: string;

  @IsOptional()
  @IsString()
  callback_url?: string;
}

export class BeneficiaryDocumentDto {
  @IsString()
  document_type!: string;

  @IsString()
  storage_uri!: string;

  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
