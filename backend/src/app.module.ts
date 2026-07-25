import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { DomainModule } from './domain/domain.module';
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
} from './domain/domain.entities';
import { BeneficiaryEntity } from './users/beneficiary.entity';
import { LivenessSessionEntity } from './users/liveness-session.entity';
import { StaffProfileEntity } from './users/staff-profile.entity';
import {
  RoleEntity,
  UserAccountEntity,
  UserRoleAssignmentEntity,
} from './users/user.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        host: config.get<string>('DATABASE_HOST') ?? 'localhost',
        port: Number(config.get<string>('DATABASE_PORT') ?? 5432),
        username: config.get<string>('DATABASE_USER') ?? 'ehelp',
        password: config.get<string>('DATABASE_PASSWORD') ?? 'ehelp',
        database: config.get<string>('DATABASE_NAME') ?? 'ehelp',
        entities: [
          UserAccountEntity,
          BeneficiaryEntity,
          StaffProfileEntity,
          RoleEntity,
          UserRoleAssignmentEntity,
          LivenessSessionEntity,
          OfficeEntity,
          ProgramTemplateEntity,
          ProgramTemplateVersionEntity,
          FormFieldEntity,
          ApplicationEntity,
          ApplicationAnswerEntity,
          WorkflowStepEntity,
          WorkflowTaskEntity,
          RelationshipEntity,
        ],
        synchronize: false,
      }),
    }),
    AuthModule,
    DomainModule,
  ],
})
export class AppModule {}
