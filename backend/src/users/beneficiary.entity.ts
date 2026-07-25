import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'beneficiaries' })
export class BeneficiaryEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'national_id_hash', type: 'text', nullable: true, unique: true })
  nationalIdHash!: string | null;

  @Column({ name: 'full_name', type: 'text', default: '' })
  fullName!: string;

  @Column({ name: 'date_of_birth', type: 'date', nullable: true })
  dateOfBirth!: string | null;

  @Column({ name: 'pin_hash', type: 'text', nullable: true })
  pinHash!: string | null;

  @Column({ name: 'verification_status', type: 'text', default: 'unverified' })
  verificationStatus!: string;

  @Column({ name: 'active_relationship_count', type: 'int', default: 0 })
  activeRelationshipCount!: number;

  @Column({ name: 'egov_uniqid', type: 'text', nullable: true, unique: true })
  egovUniqid!: string | null;

  @Column({ type: 'text', nullable: true })
  phone!: string | null;

  @Column({ name: 'first_name', type: 'text', nullable: true })
  firstName!: string | null;

  @Column({ name: 'middle_name', type: 'text', nullable: true })
  middleName!: string | null;

  @Column({ name: 'last_name', type: 'text', nullable: true })
  lastName!: string | null;

  @Column({ type: 'text', nullable: true })
  suffix!: string | null;

  @Column({ type: 'text', nullable: true })
  gender!: string | null;

  @Column({ type: 'text', nullable: true })
  nationality!: string | null;

  @Column({ type: 'text', nullable: true })
  address!: string | null;

  @Column({ type: 'text', nullable: true })
  street!: string | null;

  @Column({ type: 'text', nullable: true })
  barangay!: string | null;

  @Column({ type: 'text', nullable: true })
  municipality!: string | null;

  @Column({ name: 'photo_url', type: 'text', nullable: true })
  photoUrl!: string | null;

  @Column({ name: 'face_scan_verified', type: 'boolean', default: false })
  faceScanVerified!: boolean;

  @Column({ name: 'face_scan_url', type: 'text', nullable: true })
  faceScanUrl!: string | null;

  @Column({ name: 'pin_expires_at', type: 'timestamptz', nullable: true })
  pinExpiresAt!: Date | null;

  @Column({ name: 'validation_status', type: 'text', default: 'pending' })
  validationStatus!: string;

  @Column({ name: 'everify_reference', type: 'text', nullable: true })
  everifyReference!: string | null;

  @Column({ name: 'everify_verified_at', type: 'timestamptz', nullable: true })
  everifyVerifiedAt!: Date | null;

  @Column({ name: 'profile_locked', type: 'boolean', default: true })
  profileLocked!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
