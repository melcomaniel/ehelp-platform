import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  IsArray,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import type { Request } from 'express';
import type { JwtPayload } from '../auth/jwt.strategy';
import { EreportService } from './ereport.service';

type AuthedRequest = Request & { user: JwtPayload };

class SubmitComplaintDto {
  @IsString()
  @MinLength(1)
  category_code!: string;

  @IsString()
  @MinLength(1)
  subject!: string;

  @IsString()
  @MinLength(1)
  message!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  evidences?: string[];

  @IsOptional()
  @IsString()
  gender?: string;
}

class ViewOtpRequestDto {
  @IsString()
  @MinLength(3)
  email!: string;
}

class ViewOtpConfirmDto {
  @IsString()
  @MinLength(3)
  email!: string;

  @IsString()
  @MinLength(4)
  otp!: string;
}

@Controller('integrations/ereport')
export class EreportController {
  constructor(private readonly ereport: EreportService) {}

  @Get('status')
  status() {
    return this.ereport.status();
  }

  @Get('categories')
  @UseGuards(AuthGuard('jwt'))
  categories() {
    return this.ereport.listCategories();
  }

  @Post('complaints')
  @UseGuards(AuthGuard('jwt'))
  submit(@Req() req: AuthedRequest, @Body() body: SubmitComplaintDto) {
    return this.ereport.submitComplaint(req.user.sub, body);
  }

  @Get('my-cases')
  @UseGuards(AuthGuard('jwt'))
  myCases(@Req() req: AuthedRequest) {
    return this.ereport.listMyCases(req.user.sub);
  }
}

@Controller('admin/ereport')
@UseGuards(AuthGuard('jwt'))
export class EreportAdminController {
  constructor(private readonly ereport: EreportService) {}

  @Get('reports')
  list(
    @Req() req: AuthedRequest,
    @Query('region') region?: string,
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.ereport.listAdminReports(req.user.sub, {
      region,
      q,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('reports/:caseNumber')
  detail(@Req() req: AuthedRequest, @Param('caseNumber') caseNumber: string) {
    return this.ereport.getAdminReport(req.user.sub, caseNumber);
  }

  @Post('view-token/request')
  requestOtp(@Req() req: AuthedRequest, @Body() body: ViewOtpRequestDto) {
    return this.ereport.requestViewOtp(req.user.sub, body.email);
  }

  @Post('view-token/confirm')
  confirmOtp(@Req() req: AuthedRequest, @Body() body: ViewOtpConfirmDto) {
    return this.ereport.confirmViewOtp(req.user.sub, body);
  }
}
