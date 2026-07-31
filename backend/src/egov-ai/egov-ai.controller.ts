import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { IsOptional, IsString, MinLength } from 'class-validator';
import type { Request } from 'express';
import type { JwtPayload } from '../auth/jwt.strategy';
import { EgovAiService } from './egov-ai.service';

type AuthedRequest = Request & { user: JwtPayload };

class AssistantDto {
  @IsString()
  @MinLength(1)
  prompt!: string;

  @IsOptional()
  @IsString()
  category?: string;
}

@Controller('integrations/egov-ai')
export class EgovAiController {
  constructor(private readonly egovAi: EgovAiService) {}

  @Get('status')
  status() {
    return this.egovAi.status();
  }

  @Post('assistant')
  @UseGuards(AuthGuard('jwt'))
  ask(@Req() req: AuthedRequest, @Body() body: AssistantDto) {
    return this.egovAi.askAssistant({
      prompt: body.prompt,
      category: body.category,
      actorUserId: req.user.sub,
    });
  }
}
