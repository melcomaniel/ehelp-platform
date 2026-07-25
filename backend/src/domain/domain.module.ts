import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
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
  imports: [TypeOrmModule.forFeature(entities)],
  controllers: [DomainController],
  providers: [DomainService],
  exports: [DomainService],
})
export class DomainModule {}
