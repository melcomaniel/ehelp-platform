import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { JwtPayload } from '../auth/jwt.strategy';
import {
  CreateApplicationDto,
  DecideDto,
  RecommendDto,
  RegisterDependentDto,
  UpdateApplicationDto,
} from './domain.dto';
import { DomainService } from './domain.service';

type AuthedRequest = { user: JwtPayload };

@Controller()
@UseGuards(AuthGuard('jwt'))
export class DomainController {
  constructor(private readonly domain: DomainService) {}

  @Get('offices')
  listOffices() {
    return this.domain.listOffices();
  }

  /** Flutter legacy alias — offices mapped as regions. */
  @Get('regions')
  listRegions() {
    return this.domain.listOffices();
  }

  @Get('programs')
  listPrograms() {
    return this.domain.listPrograms();
  }

  /** Flutter legacy alias. */
  @Get('templates')
  listTemplates() {
    return this.domain.listPrograms();
  }

  @Get('programs/:id')
  getProgram(@Param('id') id: string) {
    return this.domain.getProgram(id);
  }

  @Get('applications/me')
  listMine(@Req() req: AuthedRequest) {
    return this.domain.listMyApplications(req.user.sub);
  }

  @Get('applications/queue')
  listQueue(
    @Req() req: AuthedRequest,
    @Query('statuses') statuses?: string,
  ) {
    const list = statuses
      ? statuses.split(',').map((s) => s.trim()).filter(Boolean)
      : undefined;
    return this.domain.listQueue(req.user.sub, list);
  }

  @Get('applications/:id')
  getOne(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.domain.getApplication(req.user.sub, id);
  }

  @Post('applications')
  create(@Req() req: AuthedRequest, @Body() body: CreateApplicationDto) {
    return this.domain.createApplication(req.user.sub, body);
  }

  @Patch('applications/:id')
  update(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() body: UpdateApplicationDto,
  ) {
    return this.domain.updateApplication(req.user.sub, id, body);
  }

  @Post('applications/:id/submit')
  submit(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.domain.submitApplication(req.user.sub, id);
  }

  @Post('applications/:id/recommend')
  recommend(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() body: RecommendDto,
  ) {
    return this.domain.recommend(req.user.sub, id, body);
  }

  @Post('applications/:id/decide')
  decide(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() body: DecideDto,
  ) {
    return this.domain.decide(req.user.sub, id, body);
  }

  @Get('recommendations/pending')
  pendingRecommendations(@Req() req: AuthedRequest) {
    return this.domain.listPendingRecommendations(req.user.sub);
  }

  @Get('relationships/dependents')
  dependents(@Req() req: AuthedRequest) {
    return this.domain.listDependents(req.user.sub);
  }

  @Get('relationships/principals')
  principals(@Req() req: AuthedRequest) {
    return this.domain.listLinkedPrincipals(req.user.sub);
  }

  @Post('relationships')
  registerDependent(
    @Req() req: AuthedRequest,
    @Body() body: RegisterDependentDto,
  ) {
    return this.domain.registerDependent(req.user.sub, body);
  }
}
