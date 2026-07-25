import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserAccountEntity } from './user.entity';

@Entity({ name: 'staff_profiles' })
export class StaffProfileEntity {
  @PrimaryColumn({ name: 'user_account_id', type: 'uuid' })
  userAccountId!: string;

  @OneToOne(() => UserAccountEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_account_id' })
  userAccount!: UserAccountEntity;

  @Column({ name: 'full_name', type: 'text', default: '' })
  fullName!: string;

  @Column({ type: 'text', nullable: true })
  phone!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
