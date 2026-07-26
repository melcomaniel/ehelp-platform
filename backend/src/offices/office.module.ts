import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OfficeEntity } from '../domain/domain.entities';
import {
  AuditLogEntity,
  OrganizationEntity,
} from '../organizations/organization.entities';
import { UserAccountEntity } from '../users/user.entity';
import { OfficeController } from './office.controller';
import { OfficeService } from './office.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      OfficeEntity,
      OrganizationEntity,
      AuditLogEntity,
      UserAccountEntity,
    ]),
  ],
  controllers: [OfficeController],
  providers: [OfficeService],
})
export class OfficeModule {}
