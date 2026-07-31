import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DomainModule } from '../domain/domain.module';
import { EgovAiController } from './egov-ai.controller';
import { EgovAiService } from './egov-ai.service';

@Module({
  imports: [ConfigModule, DomainModule],
  controllers: [EgovAiController],
  providers: [EgovAiService],
  exports: [EgovAiService],
})
export class EgovAiModule {}
