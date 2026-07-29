import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import type { JwtPayload } from '../auth/jwt.strategy';
import {
  CreateOfficeAdminDto,
  CreateOfficeDto,
  CreateRegionalOfficeDto,
  OfficeLifecycleReasonDto,
  OfficeListQueryDto,
  UpdateOfficeDto,
} from './office.dto';
import { OfficeService } from './office.service';

type AuthedRequest = Request & { user: JwtPayload };

@Controller('admin/offices')
@UseGuards(AuthGuard('jwt'))
export class OfficeController {
  constructor(private readonly offices: OfficeService) {}

  @Get()
  list(@Req() req: AuthedRequest, @Query() query: OfficeListQueryDto) {
    return this.offices.list(req.user.sub, query);
  }

  @Get('parent-options')
  parentOptions(
    @Req() req: AuthedRequest,
    @Query('exclude_office_id') excludeOfficeId?: string,
  ) {
    return this.offices.parentOptions(req.user.sub, excludeOfficeId);
  }

  @Post()
  create(
    @Req() req: AuthedRequest,
    @Body() body: CreateOfficeDto,
    @Headers('x-request-id') requestId?: string,
  ) {
    return this.offices.create(req.user.sub, body, this.meta(req, requestId));
  }

  @Get(':officeId')
  detail(@Req() req: AuthedRequest, @Param('officeId') officeId: string) {
    return this.offices.detail(req.user.sub, officeId);
  }

  @Patch(':officeId')
  update(
    @Req() req: AuthedRequest,
    @Param('officeId') officeId: string,
    @Body() body: UpdateOfficeDto,
    @Headers('x-request-id') requestId?: string,
  ) {
    return this.offices.update(
      req.user.sub,
      officeId,
      body,
      this.meta(req, requestId),
    );
  }

  @Post(':officeId/archive')
  archive(
    @Req() req: AuthedRequest,
    @Param('officeId') officeId: string,
    @Body() body: OfficeLifecycleReasonDto,
    @Headers('x-request-id') requestId?: string,
  ) {
    return this.offices.archive(
      req.user.sub,
      officeId,
      body.reason,
      this.meta(req, requestId),
    );
  }

  @Post(':officeId/reactivate')
  reactivate(
    @Req() req: AuthedRequest,
    @Param('officeId') officeId: string,
    @Headers('x-request-id') requestId?: string,
  ) {
    return this.offices.reactivate(
      req.user.sub,
      officeId,
      this.meta(req, requestId),
    );
  }

  private meta(req: Request, requestId?: string) {
    return {
      ipAddress: req.ip || null,
      requestId: requestId?.trim() || null,
    };
  }
}

@Controller('organizations/:organizationId/offices')
@UseGuards(AuthGuard('jwt'))
export class OrganizationOfficeController {
  constructor(private readonly offices: OfficeService) {}

  @Post()
  createRegionalOffice(
    @Req() req: AuthedRequest,
    @Param('organizationId') organizationId: string,
    @Body() body: CreateRegionalOfficeDto,
    @Headers('x-request-id') requestId?: string,
  ) {
    return this.offices.createRegionalOffice(
      req.user.sub,
      organizationId,
      body,
      this.meta(req, requestId),
    );
  }

  @Patch(':officeId/archive')
  archiveRegionalOffice(
    @Req() req: AuthedRequest,
    @Param('organizationId') organizationId: string,
    @Param('officeId') officeId: string,
    @Body() body: OfficeLifecycleReasonDto,
    @Headers('x-request-id') requestId?: string,
  ) {
    return this.offices.archiveRegionalOffice(
      req.user.sub,
      organizationId,
      officeId,
      body.reason,
      this.meta(req, requestId),
    );
  }

  @Patch(':officeId/reactivate')
  reactivateRegionalOffice(
    @Req() req: AuthedRequest,
    @Param('organizationId') organizationId: string,
    @Param('officeId') officeId: string,
    @Headers('x-request-id') requestId?: string,
  ) {
    return this.offices.reactivateRegionalOffice(
      req.user.sub,
      organizationId,
      officeId,
      this.meta(req, requestId),
    );
  }

  @Post(':officeId/admins')
  createOfficeAdmin(
    @Req() req: AuthedRequest,
    @Param('organizationId') organizationId: string,
    @Param('officeId') officeId: string,
    @Body() body: CreateOfficeAdminDto,
    @Headers('x-request-id') requestId?: string,
  ) {
    return this.offices.createOfficeAdmin(
      req.user.sub,
      organizationId,
      officeId,
      body,
      this.meta(req, requestId),
    );
  }

  private meta(req: Request, requestId?: string) {
    return {
      ipAddress: req.ip || null,
      requestId: requestId?.trim() || null,
    };
  }
}
