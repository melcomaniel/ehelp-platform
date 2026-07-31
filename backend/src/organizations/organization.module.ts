import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { StaffProfileEntity } from '../users/staff-profile.entity';
import {
  RoleEntity,
  UserAccountEntity,
  UserRoleAssignmentEntity,
} from '../users/user.entity';
import {
  OrganizationController,
  PlatformOrganizationController,
} from './organization.controller';
import {
  AuditLogEntity,
  OrganizationEntity,
  OrganizationInvitationEntity,
} from './organization.entities';
import { OrganizationService } from './organization.service';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([
      OrganizationEntity,
      OrganizationInvitationEntity,
      AuditLogEntity,
      UserAccountEntity,
      StaffProfileEntity,
      RoleEntity,
      UserRoleAssignmentEntity,
    ]),
  ],
  controllers: [OrganizationController, PlatformOrganizationController],
  providers: [OrganizationService],
})
export class OrganizationModule {}
