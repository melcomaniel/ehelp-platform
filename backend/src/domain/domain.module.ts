import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { BeneficiaryEntity } from '../users/beneficiary.entity';
import {
  RoleEntity,
  UserAccountEntity,
  UserRoleAssignmentEntity,
} from '../users/user.entity';
import { DomainController } from './domain.controller';
import {
  ApplicationAnswerEntity,
  ApplicationEntity,
  FormFieldEntity,
  OfficeEntity,
  ProgramTemplateEntity,
  ProgramTemplateVersionEntity,
  RelationshipEntity,
  WorkflowStepEntity,
  WorkflowTaskEntity,
} from './domain.entities';
import { DomainService } from './domain.service';
import { OfficeOpsService } from './office-ops.service';

const entities = [
  OfficeEntity,
  ProgramTemplateEntity,
  ProgramTemplateVersionEntity,
  FormFieldEntity,
  ApplicationEntity,
  ApplicationAnswerEntity,
  WorkflowStepEntity,
  WorkflowTaskEntity,
  RelationshipEntity,
  UserAccountEntity,
  BeneficiaryEntity,
  RoleEntity,
  UserRoleAssignmentEntity,
];

@Module({
  imports: [AuthModule, TypeOrmModule.forFeature(entities)],
  controllers: [DomainController],
  providers: [DomainService, OfficeOpsService],
  exports: [DomainService, OfficeOpsService],
})
export class DomainModule {}
