import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'liveness_sessions' })
export class LivenessSessionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_account_id', type: 'uuid', nullable: true })
  userId!: string | null;

  @Column({ name: 'session_token', type: 'text', unique: true })
  sessionToken!: string;

  @Column({ type: 'text', default: 'registration' })
  purpose!: string;

  @Column({ type: 'text', default: 'pending' })
  status!: string;

  @Column({ name: 'confidence_score', type: 'numeric', nullable: true })
  confidenceScore!: string | null;

  @Column({ name: 'reference_image_url', type: 'text', nullable: true })
  referenceImageUrl!: string | null;

  @Column({ name: 'provider_payload', type: 'jsonb', nullable: true })
  providerPayload!: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt!: Date | null;
}
