import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import type { JwtPayload } from '../auth/jwt.strategy';
import { RbacService } from './rbac.service';

type AuthedRequest = Request & { user: JwtPayload };

type GrantDto = {
  role: string;
  permission: string;
  granted: boolean;
};

@Controller('admin/rbac')
@UseGuards(AuthGuard('jwt'))
export class RbacController {
  constructor(private readonly rbac: RbacService) {}

  @Get('offices')
  listOffices(@Req() req: AuthedRequest) {
    return this.rbac.listOffices(req.user.sub);
  }

  @Get('offices/:officeId/grants')
  officeGrants(@Req() req: AuthedRequest, @Param('officeId') officeId: string) {
    return this.rbac.officeGrants(req.user.sub, officeId);
  }

  @Patch('offices/:officeId/grants')
  setOfficeGrant(
    @Req() req: AuthedRequest,
    @Param('officeId') officeId: string,
    @Body() body: GrantDto,
  ) {
    return this.rbac.setOfficeGrant(req.user.sub, officeId, body);
  }

  @Get('global-template')
  globalTemplate(@Req() req: AuthedRequest) {
    return this.rbac.globalTemplate(req.user.sub);
  }

  @Patch('global-template')
  setGlobalGrant(@Req() req: AuthedRequest, @Body() body: GrantDto) {
    return this.rbac.setGlobalGrant(req.user.sub, body);
  }

  @Post('global-template/apply/:officeId')
  applyToOffice(
    @Req() req: AuthedRequest,
    @Param('officeId') officeId: string,
  ) {
    return this.rbac.applyGlobalTemplateToOffice(req.user.sub, officeId);
  }

  @Post('global-template/apply-all')
  applyToAll(@Req() req: AuthedRequest) {
    return this.rbac.applyGlobalTemplateToAll(req.user.sub);
  }
}
