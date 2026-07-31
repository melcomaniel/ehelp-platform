import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';
import type { JwtPayload } from '../auth/jwt.strategy';
import {
  CreateApplicationDto,
  DecideDto,
  RecommendDto,
  RegisterDependentDto,
  RelationshipDecisionDto,
  ApplyWorkflowTemplateDto,
  UpdateApplicationDto,
  ProfileChangeRequestDto,
  ProfileChangeDecisionDto,
  CreateDisbursementSlotDto,
  UpdateDisbursementSlotDto,
  BookDisbursementSlotDto,
  ValidateDisbursementClaimDto,
  PreviewDisbursementClaimDto,
  ClaimLivenessSessionDto,
  BeneficiaryDocumentDto,
} from './domain.dto';
import { DomainService } from './domain.service';
import { OfficeOpsService } from './office-ops.service';

type AuthedRequest = { user: JwtPayload };

@Controller()
@UseGuards(AuthGuard('jwt'))
export class DomainController {
  constructor(
    private readonly domain: DomainService,
    private readonly officeOps: OfficeOpsService,
  ) {}

  /** Multipart file upload for beneficiary documents / form attachments. */
  @Post('uploads')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: join(process.cwd(), 'uploads'),
        filename: (_req, file, cb) => {
          const safeExt = extname(file.originalname || '').slice(0, 16);
          cb(null, `${randomUUID()}${safeExt}`);
        },
      }),
      limits: { fileSize: 12 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const ok =
          /^(image\/(jpeg|png|webp|heic)|application\/pdf|application\/msword|application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document)$/i.test(
            file.mimetype,
          ) ||
          /\.(jpe?g|png|webp|heic|pdf|doc|docx)$/i.test(file.originalname || '');
        if (!ok) {
          cb(
            new BadRequestException(
              'Only images (JPEG/PNG/WebP) or PDF/DOC files are allowed',
            ) as unknown as Error,
            false,
          );
          return;
        }
        cb(null, true);
      },
    }),
  )
  uploadFile(@UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('file is required (multipart field name: file)');
    }
    return {
      storage_uri: `/uploads/${file.filename}`,
      file_name: file.originalname,
      mime_type: file.mimetype,
      size_bytes: file.size,
    };
  }

  @Get('offices')
  listOffices(@Req() req: AuthedRequest) {
    return this.domain.listOffices(req.user.sub);
  }

  /** Flutter legacy alias — offices mapped as regions. */
  @Get('regions')
  listRegions(@Req() req: AuthedRequest) {
    return this.domain.listOffices(req.user.sub);
  }

  @Get('programs')
  listPrograms(@Req() req: AuthedRequest) {
    return this.domain.listPrograms(req.user.sub);
  }

  /** Flutter legacy alias. */
  @Get('templates')
  listTemplates(@Req() req: AuthedRequest) {
    return this.domain.listPrograms(req.user.sub);
  }

  @Get('programs/:id')
  getProgram(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.domain.getProgram(req.user.sub, id);
  }

  /** Flutter legacy alias. */
  @Get('templates/:id')
  getTemplate(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.domain.getProgram(req.user.sub, id);
  }

  @Get('applications/me')
  listMine(@Req() req: AuthedRequest) {
    return this.domain.listMyApplications(req.user.sub);
  }

  @Get('applications/queue')
  listQueue(@Req() req: AuthedRequest, @Query('statuses') statuses?: string) {
    const list = statuses
      ? statuses
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : undefined;
    return this.domain.listQueue(req.user.sub, list);
  }

  /** Live KPI / pipeline summary for Organization & Office Admin Overview. */
  @Get('admin/dashboard-summary')
  dashboardSummary(@Req() req: AuthedRequest) {
    return this.domain.getAdminDashboardSummary(req.user.sub);
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

  /** Evaluator declines during evaluation (terminal decline — no Approver step). */
  @Post('applications/:id/decline')
  declineEvaluation(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() body: RecommendDto,
  ) {
    return this.domain.declineEvaluation(req.user.sub, id, body);
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

  @Get('relationships/pending')
  pendingRelationships(
    @Req() req: AuthedRequest,
    @Query('stage') stage?: string,
  ) {
    return this.domain.listPendingRelationships(req.user.sub, stage);
  }

  @Post('relationships')
  registerDependent(
    @Req() req: AuthedRequest,
    @Body() body: RegisterDependentDto,
  ) {
    return this.domain.registerDependent(req.user.sub, body);
  }

  @Post('relationships/:id/validate')
  validateRelationship(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() body: RelationshipDecisionDto,
  ) {
    return this.domain.validateRelationship(req.user.sub, id, body);
  }

  @Post('relationships/:id/approve')
  approveRelationship(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() body: RelationshipDecisionDto,
  ) {
    return this.domain.approveRelationship(req.user.sub, id, body);
  }

  @Get('workflow-templates')
  listWorkflowTemplates(@Req() req: AuthedRequest) {
    return this.domain.listWorkflowTemplates(req.user.sub);
  }

  @Post('program-versions/:id/workflow')
  applyWorkflowTemplate(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() body: ApplyWorkflowTemplateDto,
  ) {
    return this.domain.applyWorkflowTemplate(req.user.sub, id, body);
  }

  /** Admin: list program templates (draft + published) for the actor's org. */
  @Get('admin/program-templates')
  listAdminProgramTemplates(@Req() req: AuthedRequest) {
    return this.domain.listAdminProgramTemplates(req.user.sub);
  }

  @Get('admin/program-templates/office-overrides')
  listOfficeOverrides(
    @Req() req: AuthedRequest,
    @Query('office_id') officeId?: string,
  ) {
    return this.domain.listOfficeProgramOverrides(req.user.sub, officeId);
  }

  @Get('admin/program-templates/:id')
  getAdminProgramTemplate(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.domain.getAdminProgramTemplate(req.user.sub, id);
  }

  @Post('admin/program-templates')
  createAdminProgramTemplate(
    @Req() req: AuthedRequest,
    @Body()
    body: {
      name: string;
      description?: string;
      requirements?: string;
      cooldown_days?: number;
      is_active?: boolean;
      workflow_template_id?: string;
      eligibility?: {
        min_age?: number;
        max_age?: number;
        regions?: string[];
        municipalities?: string[];
      };
      period_windows?: {
        application_start?: string | null;
        application_end?: string | null;
        review_start?: string | null;
        review_end?: string | null;
        disbursement_start?: string | null;
        disbursement_end?: string | null;
        review_leeway_days?: number;
      };
    },
  ) {
    return this.domain.createAdminProgramTemplate(req.user.sub, body);
  }

  @Patch('admin/program-templates/:id')
  updateAdminProgramTemplate(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body()
    body: {
      name?: string;
      description?: string;
      requirements?: string;
      cooldown_days?: number;
      is_active?: boolean;
      eligibility?: {
        min_age?: number;
        max_age?: number;
        regions?: string[];
        municipalities?: string[];
      };
      period_windows?: {
        application_start?: string | null;
        application_end?: string | null;
        review_start?: string | null;
        review_end?: string | null;
        disbursement_start?: string | null;
        disbursement_end?: string | null;
        review_leeway_days?: number;
      };
    },
  ) {
    return this.domain.updateAdminProgramTemplate(req.user.sub, id, body);
  }

  @Put('admin/program-templates/:id/applicant-workflow')
  syncApplicantWorkflow(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body()
    body: {
      stages: Array<{ name: string; type: string }>;
      form_title?: string;
      form_subtitle?: string | null;
      fields: Array<{
        key: string;
        type: string;
        label: string;
        help_text?: string;
        required?: boolean;
        options?: string[];
        multiline?: boolean;
      }>;
    },
  ) {
    return this.domain.syncApplicantWorkflow(req.user.sub, id, body);
  }

  @Put('admin/program-templates/:id/office-override')
  saveOfficeOverride(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body()
    body: {
      office_id?: string;
      eligibility_note?: string;
      cooldown_days?: number;
    },
  ) {
    return this.domain.saveOfficeProgramOverride(req.user.sub, id, body);
  }

  // ── Profile change requests ────────────────────────────────

  @Post('profile-change-requests')
  requestProfileChange(
    @Req() req: AuthedRequest,
    @Body() body: ProfileChangeRequestDto,
  ) {
    return this.officeOps.requestProfileChange(req.user.sub, body);
  }

  @Get('profile-change-requests/me')
  myProfileChangeRequests(@Req() req: AuthedRequest) {
    return this.officeOps.listMyProfileChangeRequests(req.user.sub);
  }

  @Get('profile-change-requests/pending')
  pendingProfileChangeRequests(@Req() req: AuthedRequest) {
    return this.officeOps.listPendingProfileChangeRequests(req.user.sub);
  }

  @Post('profile-change-requests/:id/decide')
  decideProfileChange(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() body: ProfileChangeDecisionDto,
  ) {
    return this.officeOps.decideProfileChangeRequest(req.user.sub, id, body);
  }

  // ── Notifications ──────────────────────────────────────────

  @Get('notifications/me')
  myNotifications(@Req() req: AuthedRequest) {
    return this.officeOps.listMyNotifications(req.user.sub);
  }

  @Post('notifications/:id/read')
  readNotification(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.officeOps.markNotificationRead(req.user.sub, id);
  }

  // ── Disbursement slots ─────────────────────────────────────

  @Post('admin/disbursement-slots')
  createSlot(
    @Req() req: AuthedRequest,
    @Body() body: CreateDisbursementSlotDto,
  ) {
    return this.officeOps.createDisbursementSlot(req.user.sub, body);
  }

  @Patch('admin/disbursement-slots/:id')
  updateSlot(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() body: UpdateDisbursementSlotDto,
  ) {
    return this.officeOps.updateDisbursementSlot(req.user.sub, id, body);
  }

  @Post('admin/disbursement-slots/:id/cancel')
  cancelSlot(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.officeOps.cancelDisbursementSlot(req.user.sub, id);
  }

  @Get('admin/disbursement-slots')
  listAdminSlots(
    @Req() req: AuthedRequest,
    @Query('office_id') officeId?: string,
  ) {
    return this.officeOps.listOfficeDisbursementSlots(req.user.sub, officeId);
  }

  @Get('disbursement-slots')
  listBookableSlots(
    @Req() req: AuthedRequest,
    @Query('office_id') officeId?: string,
    @Query('application_id') applicationId?: string,
  ) {
    return this.officeOps.listBookableSlots(req.user.sub, {
      officeId,
      applicationId,
    });
  }

  @Post('disbursement-bookings')
  bookSlot(@Req() req: AuthedRequest, @Body() body: BookDisbursementSlotDto) {
    return this.officeOps.bookDisbursementSlot(req.user.sub, body);
  }

  @Get('disbursement-bookings/me')
  myBookings(@Req() req: AuthedRequest) {
    return this.officeOps.listMyBookings(req.user.sub);
  }

  /** Office Admin: look up claim QR before face liveness. */
  @Post('admin/disbursement-claims/preview')
  previewClaim(
    @Req() req: AuthedRequest,
    @Body() body: PreviewDisbursementClaimDto,
  ) {
    return this.officeOps.previewDisbursementClaim(req.user.sub, body);
  }

  /** Office Admin: start claimant face liveness at cash window. */
  @Post('admin/disbursement-claims/liveness-session')
  startClaimLiveness(
    @Req() req: AuthedRequest,
    @Body() body: ClaimLivenessSessionDto,
  ) {
    return this.officeOps.startClaimLivenessSession(req.user.sub, body);
  }

  /** Office Admin: complete claim after beneficiary face liveness. */
  @Post('admin/disbursement-claims/validate')
  validateClaim(
    @Req() req: AuthedRequest,
    @Body() body: ValidateDisbursementClaimDto,
  ) {
    return this.officeOps.validateDisbursementClaim(req.user.sub, body);
  }

  // ── Document vault ─────────────────────────────────────────

  @Get('beneficiary-documents')
  listVault(@Req() req: AuthedRequest) {
    return this.officeOps.listVaultDocuments(req.user.sub);
  }

  @Post('beneficiary-documents')
  addVault(@Req() req: AuthedRequest, @Body() body: BeneficiaryDocumentDto) {
    return this.officeOps.addVaultDocument(req.user.sub, body);
  }

  @Post('beneficiary-documents/:id/delete')
  deleteVault(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.officeOps.deleteVaultDocument(req.user.sub, id);
  }
}
