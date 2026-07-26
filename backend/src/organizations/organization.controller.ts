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
  CreateOrganizationDto,
  LifecycleReasonDto,
  OrganizationListQueryDto,
  OrganizationOfficeListQueryDto,
  ReactivateOrganizationDto,
  UpdateOrganizationAdminDto,
  UpdateOrganizationDto,
} from './organization.dto';
import { OrganizationService } from './organization.service';

type AuthedRequest = Request & { user: JwtPayload };

@Controller('admin/organizations')
@UseGuards(AuthGuard('jwt'))
export class OrganizationController {
  constructor(private readonly organizations: OrganizationService) {}

  @Get()
  list(@Req() req: AuthedRequest, @Query() query: OrganizationListQueryDto) {
    return this.organizations.list(req.user.sub, query);
  }

  @Post()
  create(
    @Req() req: AuthedRequest,
    @Body() body: CreateOrganizationDto,
    @Headers('x-request-id') requestId?: string,
  ) {
    return this.organizations.create(
      req.user.sub,
      body,
      this.meta(req, requestId),
    );
  }

  @Get(':organizationId')
  detail(
    @Req() req: AuthedRequest,
    @Param('organizationId') organizationId: string,
  ) {
    return this.organizations.detail(req.user.sub, organizationId);
  }

  @Get(':organizationId/offices')
  offices(
    @Req() req: AuthedRequest,
    @Param('organizationId') organizationId: string,
    @Query() query: OrganizationOfficeListQueryDto,
  ) {
    return this.organizations.listOffices(req.user.sub, organizationId, query);
  }

  @Patch(':organizationId')
  update(
    @Req() req: AuthedRequest,
    @Param('organizationId') organizationId: string,
    @Body() body: UpdateOrganizationDto,
    @Headers('x-request-id') requestId?: string,
  ) {
    return this.organizations.update(
      req.user.sub,
      organizationId,
      body,
      this.meta(req, requestId),
    );
  }

  @Post(':organizationId/suspend')
  suspend(
    @Req() req: AuthedRequest,
    @Param('organizationId') organizationId: string,
    @Body() body: LifecycleReasonDto,
    @Headers('x-request-id') requestId?: string,
  ) {
    return this.organizations.suspend(
      req.user.sub,
      organizationId,
      body.reason,
      this.meta(req, requestId),
    );
  }

  @Post(':organizationId/reactivate')
  reactivate(
    @Req() req: AuthedRequest,
    @Param('organizationId') organizationId: string,
    @Body() body: ReactivateOrganizationDto,
    @Headers('x-request-id') requestId?: string,
  ) {
    return this.organizations.reactivate(
      req.user.sub,
      organizationId,
      body.reason,
      this.meta(req, requestId),
    );
  }

  @Post(':organizationId/archive')
  archive(
    @Req() req: AuthedRequest,
    @Param('organizationId') organizationId: string,
    @Body() body: LifecycleReasonDto,
    @Headers('x-request-id') requestId?: string,
  ) {
    return this.organizations.archive(
      req.user.sub,
      organizationId,
      body.reason,
      this.meta(req, requestId),
    );
  }

  @Patch(':organizationId/admins/:adminId')
  updateAdmin(
    @Req() req: AuthedRequest,
    @Param('organizationId') organizationId: string,
    @Param('adminId') adminId: string,
    @Body() body: UpdateOrganizationAdminDto,
    @Headers('x-request-id') requestId?: string,
  ) {
    return this.organizations.updateAdmin(
      req.user.sub,
      organizationId,
      adminId,
      body,
      this.meta(req, requestId),
    );
  }

  @Post(':organizationId/admins/:adminId/suspend')
  suspendAdmin(
    @Req() req: AuthedRequest,
    @Param('organizationId') organizationId: string,
    @Param('adminId') adminId: string,
    @Body() body: LifecycleReasonDto,
    @Headers('x-request-id') requestId?: string,
  ) {
    return this.organizations.suspendAdmin(
      req.user.sub,
      organizationId,
      adminId,
      body.reason,
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
