import { Controller, Get, Query } from '@nestjs/common';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  /** `?deep=true` also probes every eGov upstream. */
  @Get()
  overall(@Query('deep') deep?: string) {
    return this.health.report(deep === 'true' || deep === '1');
  }

  @Get('db')
  db() {
    return this.health.checkDb();
  }

  @Get('env')
  env() {
    return this.health.checkEnv();
  }

  @Get('integrations')
  integrations() {
    return this.health.checkIntegrations();
  }
}
