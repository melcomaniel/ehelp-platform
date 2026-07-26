import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
  RelationId,
  UpdateDateColumn,
} from 'typeorm';
import { BeneficiaryEntity } from './beneficiary.entity';

export type AccountType = 'platform_admin' | 'staff' | 'beneficiary';

/** Legacy mobile/JWT role strings (mapped from ERD role codes). */
export type AppRole =
  | 'customer'
  | 'dependent'
  | 'evaluator'
  | 'approver'
  | 'satellite_admin'
  | 'dswd_admin'
  | 'platform_admin';

export const ERD_ROLE_TO_APP: Record<string, AppRole> = {
  BENEFICIARY: 'customer',
  DEPENDENT: 'dependent',
  EVALUATOR: 'evaluator',
  APPROVER: 'approver',
  OFFICE_ADMIN: 'satellite_admin',
  ORG_ADMIN: 'dswd_admin',
  PLATFORM_ADMIN: 'platform_admin',
};

export const APP_ROLE_TO_ERD: Record<AppRole, string> = {
  customer: 'BENEFICIARY',
  dependent: 'DEPENDENT',
  evaluator: 'EVALUATOR',
  approver: 'APPROVER',
  satellite_admin: 'OFFICE_ADMIN',
  dswd_admin: 'ORG_ADMIN',
  platform_admin: 'PLATFORM_ADMIN',
};

@Entity({ name: 'user_accounts' })
export class UserAccountEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'organization_id', type: 'uuid', nullable: true })
  organizationId!: string | null;

  @Column({ name: 'office_id', type: 'uuid', nullable: true })
  officeId!: string | null;

  @OneToOne(() => BeneficiaryEntity, {
    cascade: true,
    eager: true,
    nullable: true,
  })
  @JoinColumn({ name: 'beneficiary_id' })
  beneficiary!: BeneficiaryEntity | null;

  @RelationId((user: UserAccountEntity) => user.beneficiary)
  beneficiaryId!: string | null;

  @Column({ name: 'account_type', type: 'text' })
  accountType!: AccountType;

  @Column({ type: 'text', nullable: true, unique: true })
  email!: string | null;

  @Column({ name: 'password_hash', type: 'text', nullable: true })
  passwordHash!: string | null;

  @Column({ type: 'text', default: 'active' })
  status!: string;

  @Column({ name: 'verified_at', type: 'timestamptz', nullable: true })
  verifiedAt!: Date | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  /** Resolved from user_role_assignments (not a DB column). */
  appRole: AppRole = 'customer';

  /** Resolved ERD role code alongside legacy appRole. */
  erdRoleCode: string = 'BENEFICIARY';

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

@Entity({ name: 'roles' })
export class RoleEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text', unique: true })
  code!: string;
}

@Entity({ name: 'user_role_assignments' })
export class UserRoleAssignmentEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_account_id', type: 'uuid' })
  userAccountId!: string;

  @ManyToOne(() => UserAccountEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_account_id' })
  userAccount!: UserAccountEntity;

  @Column({ name: 'role_id', type: 'uuid' })
  roleId!: string;

  @ManyToOne(() => RoleEntity, { eager: true })
  @JoinColumn({ name: 'role_id' })
  role!: RoleEntity;

  @Column({ name: 'office_id', type: 'uuid', nullable: true })
  officeId!: string | null;
}
