import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { UserAccountEntity } from '../users/user.entity';
import {
  EreportAdminController,
  EreportController,
} from './ereport.controller';
import { EreportService } from './ereport.service';

@Module({
  imports: [
    ConfigModule,
    AuthModule,
    TypeOrmModule.forFeature([UserAccountEntity]),
  ],
  controllers: [EreportController, EreportAdminController],
  providers: [EreportService],
  exports: [EreportService],
})
export class EreportModule {}
