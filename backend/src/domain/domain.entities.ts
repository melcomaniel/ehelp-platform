import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'offices' })
export class OfficeEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId!: string;

  @Column({ name: 'parent_office_id', type: 'uuid', nullable: true })
  parentOfficeId!: string | null;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text' })
  code!: string;

  @Column({ name: 'normalized_code', type: 'text' })
  normalizedCode!: string;

  @Column({ type: 'text' })
  level!: string;

  @Column({ type: 'text', default: 'active' })
  status!: string;

  @Column({ type: 'text', nullable: true })
  address!: string | null;

  @Column({ type: 'double precision', nullable: true })
  latitude!: number | null;

  @Column({ type: 'double precision', nullable: true })
  longitude!: number | null;

  @Column({ name: 'map_label', type: 'text', nullable: true })
  mapLabel!: string | null;

  @Column({ name: 'archived_at', type: 'timestamptz', nullable: true })
  archivedAt!: Date | null;

  @Column({ name: 'lifecycle_reason', type: 'text', nullable: true })
  lifecycleReason!: string | null;

  @Column({ name: 'created_by_user_id', type: 'uuid', nullable: true })
  createdByUserId!: string | null;

  @Column({ name: 'updated_by_user_id', type: 'uuid', nullable: true })
  updatedByUserId!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

@Entity({ name: 'program_templates' })
export class ProgramTemplateEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId!: string;

  @Column({ type: 'text' })
  code!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text' })
  status!: string;
}

@Entity({ name: 'program_template_versions' })
export class ProgramTemplateVersionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'program_template_id', type: 'uuid' })
  programTemplateId!: string;

  @Column({ name: 'version_number', type: 'int' })
  versionNumber!: number;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'cooldown_period', type: 'interval', nullable: true })
  cooldownPeriod!: string | null;

  @Column({ type: 'boolean', default: false })
  immutable!: boolean;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt!: Date | null;
}

@Entity({ name: 'form_fields' })
export class FormFieldEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'form_definition_id', type: 'uuid' })
  formDefinitionId!: string;

  @Column({ name: 'field_key', type: 'text' })
  fieldKey!: string;

  @Column({ name: 'field_type', type: 'text' })
  fieldType!: string;

  @Column({ type: 'jsonb', default: {} })
  config!: Record<string, unknown>;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder!: number;

  @Column({ type: 'boolean', default: false })
  required!: boolean;
}

@Entity({ name: 'applications' })
export class ApplicationEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId!: string;

  @Column({ name: 'office_id', type: 'uuid' })
  officeId!: string;

  @Column({ name: 'beneficiary_id', type: 'uuid' })
  beneficiaryId!: string;

  @Column({ name: 'program_template_version_id', type: 'uuid' })
  programTemplateVersionId!: string;

  @Column({ type: 'text', default: 'draft' })
  status!: string;

  @Column({ name: 'reference_no', type: 'text', nullable: true })
  referenceNo!: string | null;

  @Column({ name: 'amount_requested', type: 'numeric', nullable: true })
  amountRequested!: string | null;

  @Column({ name: 'amount_approved', type: 'numeric', nullable: true })
  amountApproved!: string | null;

  @Column({ name: 'evaluator_notes', type: 'text', nullable: true })
  evaluatorNotes!: string | null;

  @Column({ name: 'approver_notes', type: 'text', nullable: true })
  approverNotes!: string | null;

  @Column({ name: 'submitted_at', type: 'timestamptz', nullable: true })
  submittedAt!: Date | null;

  @Column({ name: 'decided_at', type: 'timestamptz', nullable: true })
  decidedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

@Entity({ name: 'application_answers' })
export class ApplicationAnswerEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'application_id', type: 'uuid' })
  applicationId!: string;

  @Column({ name: 'form_field_id', type: 'uuid' })
  formFieldId!: string;

  @Column({ type: 'jsonb', default: null })
  value!: unknown;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

@Entity({ name: 'workflow_steps' })
export class WorkflowStepEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'workflow_definition_id', type: 'uuid' })
  workflowDefinitionId!: string;

  @Column({ name: 'step_key', type: 'text' })
  stepKey!: string;

  @Column({ name: 'step_type', type: 'text' })
  stepType!: string;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder!: number;
}

@Entity({ name: 'workflow_tasks' })
export class WorkflowTaskEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'application_id', type: 'uuid' })
  applicationId!: string;

  @Column({ name: 'workflow_step_id', type: 'uuid' })
  workflowStepId!: string;

  @Column({ name: 'assignee_user_id', type: 'uuid', nullable: true })
  assigneeUserId!: string | null;

  @Column({ type: 'text', default: 'pending' })
  status!: string;

  @Column({ type: 'text', nullable: true })
  decision!: string | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

@Entity({ name: 'relationships' })
export class RelationshipEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId!: string;

  @Column({ name: 'requester_beneficiary_id', type: 'uuid' })
  requesterBeneficiaryId!: string;

  @Column({ name: 'related_beneficiary_id', type: 'uuid' })
  relatedBeneficiaryId!: string;

  @Column({ type: 'text' })
  type!: string;

  @Column({ type: 'text', default: 'requested' })
  status!: string;

  @Column({ name: 'activated_at', type: 'timestamptz', nullable: true })
  activatedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
