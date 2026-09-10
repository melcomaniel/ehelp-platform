import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health.controller';
import { HealthIntegrationsService } from './health.integrations';
import { HealthService } from './health.service';

@Module({
  imports: [ConfigModule],
  controllers: [HealthController],
  providers: [HealthService, HealthIntegrationsService],
})
export class HealthModule {}
