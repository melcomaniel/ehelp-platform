import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import {
  decideRbac,
  type ErdRoleCode,
  type RbacActor,
  type RbacDecision,
  type RbacPermission,
} from '../auth/rbac.policy';
import { RbacAccessService } from '../auth/rbac-access.service';
import { BeneficiaryEntity } from '../users/beneficiary.entity';
import {
  UserAccountEntity,
  UserRoleAssignmentEntity,
} from '../users/user.entity';
import {
  ApplicationAnswerEntity,
  ApplicationEntity,
  FormFieldEntity,
  OfficeEntity,
  ProgramTemplateEntity,
  ProgramTemplateVersionEntity,
  RelationshipEntity,
  WorkflowStepEntity,
  WorkflowTaskEntity,
} from './domain.entities';
import { OfficeOpsService } from './office-ops.service';
import {
  assertApplicationPeriodOpen,
  assertReviewPeriodOpen,
  defaultApplicantStages,
  earliestBookableSlotStart,
  normalizePeriodWindows,
  stageTypeFromErdStatus,
  summarizePeriodWindowsForAi,
  type PeriodWindows,
} from './period-windows';

/** Map ERD status → Flutter-friendly status for mobile clients. */
const TO_CLIENT_STATUS: Record<string, string> = {
  draft: 'draft',
  submitted: 'submitted',
  in_evaluation: 'under_review',
  in_approval: 'recommended',
  approved: 'approved',
  rejected: 'declined',
  disbursed: 'disbursed',
  claimed: 'claimed',
  cancelled: 'cancelled',
};

const FROM_CLIENT_STATUS: Record<string, string> = {
  draft: 'draft',
  submitted: 'submitted',
  under_review: 'in_evaluation',
  recommended: 'in_approval',
  approved: 'approved',
  declined: 'rejected',
  rejected: 'rejected',
  disbursed: 'disbursed',
  claimed: 'claimed',
  cancelled: 'cancelled',
  in_evaluation: 'in_evaluation',
  in_approval: 'in_approval',
};

@Injectable()
export class DomainService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(OfficeEntity)
    private readonly offices: Repository<OfficeEntity>,
    @InjectRepository(ProgramTemplateEntity)
    private readonly templates: Repository<ProgramTemplateEntity>,
    @InjectRepository(ProgramTemplateVersionEntity)
    private readonly versions: Repository<ProgramTemplateVersionEntity>,
    @InjectRepository(FormFieldEntity)
    private readonly formFields: Repository<FormFieldEntity>,
    @InjectRepository(ApplicationEntity)
    private readonly applications: Repository<ApplicationEntity>,
    @InjectRepository(ApplicationAnswerEntity)
    private readonly answers: Repository<ApplicationAnswerEntity>,
    @InjectRepository(WorkflowStepEntity)
    private readonly steps: Repository<WorkflowStepEntity>,
    @InjectRepository(WorkflowTaskEntity)
    private readonly tasks: Repository<WorkflowTaskEntity>,
    @InjectRepository(RelationshipEntity)
    private readonly relationships: Repository<RelationshipEntity>,
    @InjectRepository(UserAccountEntity)
    private readonly users: Repository<UserAccountEntity>,
    @InjectRepository(BeneficiaryEntity)
    private readonly beneficiaries: Repository<BeneficiaryEntity>,
    @InjectRepository(UserRoleAssignmentEntity)
    private readonly roleAssignments: Repository<UserRoleAssignmentEntity>,
    private readonly rbac: RbacAccessService,
    private readonly officeOps: OfficeOpsService,
  ) {}

  async listOffices(actorUserId: string) {
    const actor = await this.requireUser(actorUserId);
    const rows = await this.offices.find({
      where: {
        status: 'active',
        ...(actor.organizationId
          ? { organizationId: actor.organizationId }
          : {}),
      },
      order: { name: 'ASC' },
    });
    return rows.map((o) => ({
      id: o.id,
      code: o.level.toUpperCase(),
      name: o.name,
      level: o.level,
      organization_id: o.organizationId,
      address: o.address ?? null,
      latitude: o.latitude ?? null,
      longitude: o.longitude ?? null,
      map_label: o.mapLabel ?? null,
    }));
  }

  async listPrograms(actorUserId: string) {
    const actor = await this.requireUser(actorUserId);
    const beneficiary = actor.beneficiary;
    const isBeneficiary =
      actor.accountType === 'beneficiary' || Boolean(beneficiary);
    // Beneficiaries see all published programs that match age/location.
    // Staff still see only their organization's catalog.
    const templates = await this.templates.find({
      where: {
        status: 'published',
        ...(!isBeneficiary && actor.organizationId
          ? { organizationId: actor.organizationId }
          : {}),
      },
      order: { name: 'ASC' },
    });
    const result = [];

    for (const t of templates) {
      const version = await this.versions.findOne({
        where: { programTemplateId: t.id },
        order: { versionNumber: 'DESC' },
      });
      const cooldownDays = this.intervalToDays(version?.cooldownPeriod);
      const rawRules = version
        ? await this.dataSource.query(
            `SELECT disbursement_rules FROM program_template_versions WHERE id = $1`,
            [version.id],
          )
        : [];
      const rules =
        (rawRules[0]?.disbursement_rules as Record<string, unknown>) ?? {};
      if (
        isBeneficiary &&
        !this.beneficiaryMatchesEligibility(beneficiary, rules)
      ) {
        continue;
      }
      const applyGate =
        isBeneficiary && beneficiary?.id
          ? await this.getProgramApplyGate(
              beneficiary.id,
              t.id,
              cooldownDays,
            )
          : null;
      result.push({
        id: t.id,
        code: t.code,
        name: t.name,
        description: version?.description ?? null,
        disbursement_cooldown_days: cooldownDays,
        version_id: version?.id ?? null,
        version_number: version?.versionNumber ?? null,
        eligibility_rules: rules,
        can_apply: applyGate?.can_apply ?? true,
        apply_block_reason: applyGate?.block_reason ?? null,
        apply_block_message: applyGate?.message ?? null,
        cooldown_remaining_days: applyGate?.remaining_days ?? null,
        eligible_again_at: applyGate?.eligible_again_at ?? null,
        last_claimed_at: applyGate?.last_claimed_at ?? null,
      });
    }
    return result;
  }

  /**
   * Context for eGov AI: location-filtered programs (details + dates + queue slots),
   * beneficiary applications, and existing disbursement bookings.
   */
  async getAiEligibilityContext(actorUserId: string) {
    const actor = await this.requireUser(actorUserId);
    const beneficiary = actor.beneficiary;
    const programs = await this.listPrograms(actorUserId);
    const municipality = beneficiary?.municipality?.trim() || null;
    const barangay = beneficiary?.barangay?.trim() || null;
    const address = beneficiary?.address?.trim() || null;
    const hasLocation = Boolean(municipality || barangay || address);
    const summary = [municipality, barangay, address]
      .filter(Boolean)
      .join(', ');

    const applicationCtx = await this.listApplicationsForAi(actor);
    const myBookings = await this.listBookingsForAi(actorUserId);
    const nowIso = new Date().toISOString();

    const eligible_programs = await Promise.all(
      programs.map(async (p) => {
        const rules = (p.eligibility_rules ?? {}) as {
          eligibility?: {
            min_age?: number;
            max_age?: number;
            regions?: string[];
            municipalities?: string[];
          };
          period_windows?: PeriodWindows;
        };
        const elig = rules.eligibility ?? {};
        const regions = elig.regions ?? [];
        const municipalities = elig.municipalities ?? [];
        const locationScope = [
          regions.length ? `regions: ${regions.join(', ')}` : null,
          municipalities.length
            ? `municipalities: ${municipalities.join(', ')}`
            : null,
          !regions.length && !municipalities.length
            ? 'no geographic restriction'
            : null,
        ]
          .filter(Boolean)
          .join('; ');

        const upcomingSlots = await this.listOpenSlotsForAi({
          programTemplateId: p.id,
          periodWindows: rules.period_windows ?? null,
          limit: 6,
        });

        return {
          id: p.id,
          code: p.code,
          name: p.name,
          description: p.description,
          location_scope: locationScope,
          regions,
          municipalities,
          min_age: elig.min_age ?? null,
          max_age: elig.max_age ?? null,
          disbursement_cooldown_days: p.disbursement_cooldown_days ?? null,
          can_apply: p.can_apply ?? true,
          apply_block_reason: p.apply_block_reason ?? null,
          apply_block_message: p.apply_block_message ?? null,
          cooldown_remaining_days: p.cooldown_remaining_days ?? null,
          eligible_again_at: p.eligible_again_at ?? null,
          last_claimed_at: p.last_claimed_at ?? null,
          period_windows: summarizePeriodWindowsForAi(
            rules.period_windows ?? null,
          ),
          upcoming_queue_slots: upcomingSlots,
        };
      }),
    );

    return {
      is_beneficiary:
        actor.accountType === 'beneficiary' || Boolean(beneficiary),
      server_now: nowIso,
      location: {
        municipality,
        barangay,
        address,
        summary: summary || null,
        location_complete: hasLocation,
      },
      eligible_programs,
      my_disbursement_bookings: myBookings,
      ...applicationCtx,
    };
  }

  private async getOfficeSummaryForAi(officeId: string | null) {
    if (!officeId) return null;
    const office = await this.offices.findOne({ where: { id: officeId } });
    if (!office) return null;
    const lat = office.latitude ?? null;
    const lng = office.longitude ?? null;
    return {
      id: office.id,
      name: office.name,
      level: office.level,
      address: office.address ?? null,
      map_label: office.mapLabel ?? null,
      latitude: lat,
      longitude: lng,
      maps_url:
        lat != null && lng != null
          ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
          : null,
    };
  }

  /** Open queue slots for a program (optional office), within disbursement window. */
  private async listOpenSlotsForAi(opts: {
    programTemplateId: string;
    officeId?: string | null;
    periodWindows?: PeriodWindows | null;
    limit?: number;
  }) {
    const limit = opts.limit ?? 6;
    const windows = normalizePeriodWindows(opts.periodWindows ?? null);
    const params: unknown[] = [
      opts.programTemplateId,
      earliestBookableSlotStart().toISOString(),
    ];
    let officeFilter = '';
    if (opts.officeId) {
      params.push(opts.officeId);
      officeFilter = `AND s.office_id = $${params.length}`;
    }
    params.push(limit * 3);

    const rows = await this.dataSource.query<
      Array<{
        id: string;
        starts_at: string;
        ends_at: string;
        capacity: number;
        booked_count: number;
        label: string | null;
        site_name: string | null;
        site_address: string | null;
        latitude: number | null;
        longitude: number | null;
        office_name: string;
        office_address: string | null;
        office_latitude: number | null;
        office_longitude: number | null;
      }>
    >(
      `SELECT s.id, s.starts_at, s.ends_at, s.capacity, s.booked_count, s.label,
              s.site_name, s.site_address, s.latitude, s.longitude,
              o.name AS office_name, o.address AS office_address,
              o.latitude AS office_latitude, o.longitude AS office_longitude
       FROM disbursement_slots s
       JOIN offices o ON o.id = s.office_id
       WHERE s.status = 'open'
         AND s.booked_count < s.capacity
         AND s.starts_at >= $2
         AND (
           s.program_template_id IS NULL
           OR s.program_template_id = $1
         )
         ${officeFilter}
       ORDER BY s.starts_at ASC
       LIMIT $${params.length}`,
      params,
    );

    const filtered = rows.filter((r) => {
      const start = new Date(r.starts_at).getTime();
      const end = new Date(r.ends_at).getTime();
      if (windows?.disbursement_start) {
        const wStart = new Date(windows.disbursement_start).getTime();
        if (!Number.isNaN(wStart) && start < wStart) return false;
      }
      if (windows?.disbursement_end) {
        const wEnd = new Date(windows.disbursement_end).getTime();
        if (!Number.isNaN(wEnd) && end > wEnd) return false;
      }
      return true;
    });

    return filtered.slice(0, limit).map((r) => {
      const lat = r.latitude ?? r.office_latitude ?? null;
      const lng = r.longitude ?? r.office_longitude ?? null;
      const remaining = Math.max(0, Number(r.capacity) - Number(r.booked_count));
      return {
        id: r.id,
        label: r.label,
        starts_at: r.starts_at,
        ends_at: r.ends_at,
        capacity: Number(r.capacity),
        booked_count: Number(r.booked_count),
        remaining,
        office_name: r.office_name,
        site_name: r.site_name ?? r.office_name,
        site_address: r.site_address ?? r.office_address,
        latitude: lat,
        longitude: lng,
        maps_url:
          lat != null && lng != null
            ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
            : null,
      };
    });
  }

  private async listBookingsForAi(actorUserId: string) {
    const rows = await this.dataSource.query<
      Array<{
        id: string;
        application_id: string;
        queue_number: number;
        status: string;
        starts_at: string;
        ends_at: string;
        label: string | null;
        site_name: string | null;
        site_address: string | null;
        office_name: string | null;
        latitude: number | null;
        longitude: number | null;
        office_latitude: number | null;
        office_longitude: number | null;
      }>
    >(
      `SELECT b.id, b.application_id, b.queue_number, b.status,
              s.starts_at, s.ends_at, s.label, s.site_name, s.site_address,
              s.latitude, s.longitude,
              o.name AS office_name,
              o.latitude AS office_latitude, o.longitude AS office_longitude
       FROM disbursement_bookings b
       JOIN disbursement_slots s ON s.id = b.slot_id
       LEFT JOIN offices o ON o.id = s.office_id
       WHERE b.user_account_id = $1
         AND b.status = 'booked'
       ORDER BY s.starts_at ASC
       LIMIT 10`,
      [actorUserId],
    );

    return rows.map((b) => {
      const lat = b.latitude ?? b.office_latitude ?? null;
      const lng = b.longitude ?? b.office_longitude ?? null;
      return {
        booking_id: b.id,
        application_id: b.application_id,
        queue_number: b.queue_number,
        status: b.status,
        starts_at: b.starts_at,
        ends_at: b.ends_at,
        label: b.label,
        site_name: b.site_name ?? b.office_name,
        site_address: b.site_address,
        office_name: b.office_name,
        maps_url:
          lat != null && lng != null
            ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
            : null,
      };
    });
  }

  /**
   * Lightweight application summary for the assistant (no form answers / PII dump).
   * Preferred = most recently created application that is not terminal; else latest.
   */
  private async listApplicationsForAi(actor: UserAccountEntity) {
    type AppAiRow = {
      id: string;
      reference_no: string;
      program_id: string | null;
      program_name: string | null;
      program_code: string | null;
      status: string;
      status_label: string;
      current_stage: string;
      stage_label: string;
      is_in_progress: boolean;
      is_preferred: boolean;
      submitted_at: string | null;
      decided_at: string | null;
      created_at: string | null;
      period_windows: ReturnType<typeof summarizePeriodWindowsForAi>;
      office: Awaited<ReturnType<DomainService['getOfficeSummaryForAi']>>;
      upcoming_queue_slots: Awaited<
        ReturnType<DomainService['listOpenSlotsForAi']>
      >;
      /** Human-readable what-happened line for claimed / closed apps. */
      outcome_summary: string | null;
      claim: {
        claimed_at: string;
        site_name: string | null;
        site_address: string | null;
        slot_starts_at: string;
        slot_ends_at: string;
        queue_number: number;
        face_liveness_passed: boolean;
      } | null;
    };

    if (!actor.beneficiaryId) {
      return {
        preferred_application_id: null as string | null,
        applications: [] as AppAiRow[],
      };
    }

    const rows = await this.applications.find({
      where: { beneficiaryId: actor.beneficiaryId },
      order: { createdAt: 'DESC' },
    });

    const terminalClient = new Set([
      'declined',
      'disbursed',
      'claimed',
      'cancelled',
    ]);
    const stageLabels: Record<string, string> = {
      form: 'Application Form',
      verify: 'Face Verification',
      review: 'Review',
      disbursement: 'Disbursement',
    };
    const statusLabels: Record<string, string> = {
      draft: 'Draft',
      submitted: 'Submitted',
      under_review: 'Under Review',
      recommended: 'Recommended',
      approved: 'Approved',
      declined: 'Declined',
      disbursed: 'Disbursed',
      claimed: 'Claimed',
      cancelled: 'Cancelled',
    };

    const mapped: AppAiRow[] = [];
    for (const app of rows) {
      const version = await this.versions.findOne({
        where: { id: app.programTemplateVersionId },
      });
      const template = version
        ? await this.templates.findOne({
            where: { id: version.programTemplateId },
          })
        : null;
      const rules = version
        ? await this.loadVersionRules(version.id)
        : {};
      const status = TO_CLIENT_STATUS[app.status] ?? app.status;
      const currentStage = stageTypeFromErdStatus(app.status);
      const office = await this.getOfficeSummaryForAi(app.officeId);
      const upcomingSlots =
        status === 'approved' && template
          ? await this.listOpenSlotsForAi({
              programTemplateId: template.id,
              officeId: app.officeId,
              periodWindows: (rules.period_windows as PeriodWindows) ?? null,
              limit: 8,
            })
          : [];

      const claimRows =
        status === 'claimed' || status === 'disbursed'
          ? await this.dataSource.query<
              Array<{
                claimed_at: string;
                site_name: string | null;
                site_address: string | null;
                slot_starts_at: string;
                slot_ends_at: string;
                queue_number: number;
                face_liveness: Record<string, unknown> | null;
              }>
            >(
              `SELECT claimed_at, site_name, site_address, slot_starts_at, slot_ends_at,
                      queue_number, face_liveness
               FROM disbursement_claims
               WHERE application_id = $1
               ORDER BY claimed_at DESC
               LIMIT 1`,
              [app.id],
            )
          : [];
      const claimRow = claimRows[0] ?? null;
      const facePassed = Boolean(
        claimRow?.face_liveness &&
          (claimRow.face_liveness.face_match_pending === true ||
            String(claimRow.face_liveness.status ?? '')
              .toUpperCase()
              .includes('SUCCEED')),
      );

      let outcomeSummary: string | null = null;
      if (status === 'claimed' && claimRow) {
        outcomeSummary =
          `Approved, scheduled, then claimed at cash window` +
          (claimRow.site_name ? ` (${claimRow.site_name})` : '') +
          ` on ${claimRow.claimed_at}` +
          (facePassed ? '; beneficiary face liveness verified' : '') +
          '. Application is completed.';
      } else if (status === 'claimed') {
        outcomeSummary =
          'Aid was claimed at the office cash window. Application is completed.';
      } else if (status === 'disbursed') {
        outcomeSummary = 'Disbursement completed.';
      } else if (status === 'approved') {
        outcomeSummary =
          'Approved — beneficiary should schedule a disbursement queue slot.';
      } else if (status === 'declined') {
        outcomeSummary = 'Declined by staff.';
      } else if (status === 'under_review' || status === 'recommended') {
        outcomeSummary = 'Under staff review / approval.';
      }

      mapped.push({
        id: app.id,
        reference_no: app.referenceNo ?? `APP-${app.id.slice(0, 8)}`,
        program_id: template?.id ?? null,
        program_name: template?.name ?? null,
        program_code: template?.code ?? null,
        status,
        status_label: statusLabels[status] ?? status,
        current_stage: currentStage,
        stage_label: stageLabels[currentStage] ?? currentStage,
        is_in_progress: !terminalClient.has(status),
        is_preferred: false,
        submitted_at: app.submittedAt?.toISOString() ?? null,
        decided_at: app.decidedAt?.toISOString() ?? null,
        created_at: app.createdAt?.toISOString() ?? null,
        period_windows: summarizePeriodWindowsForAi(
          (rules.period_windows as PeriodWindows) ?? null,
        ),
        office,
        upcoming_queue_slots: upcomingSlots,
        outcome_summary: outcomeSummary,
        claim: claimRow
          ? {
              claimed_at: claimRow.claimed_at,
              site_name: claimRow.site_name,
              site_address: claimRow.site_address,
              slot_starts_at: claimRow.slot_starts_at,
              slot_ends_at: claimRow.slot_ends_at,
              queue_number: claimRow.queue_number,
              face_liveness_passed: facePassed,
            }
          : null,
      });
    }

    const preferred =
      mapped.find((a) => a.is_in_progress) ?? mapped[0] ?? null;
    if (preferred) {
      preferred.is_preferred = true;
    }

    return {
      preferred_application_id: preferred?.id ?? null,
      applications: mapped,
    };
  }

  /**
   * Optional place-name aliases for region codes on programs.
   * NCR is one example: city names map to region code "NCR". Add other regions
   * the same way when programs use a code that users won't type in address fields.
   */
  private static readonly REGION_LOCATION_ALIASES: Record<string, string[]> = {
    NCR: [
      'NCR',
      'QUEZON CITY',
      'MANILA',
      'MAKATI',
      'PASIG',
      'TAGUIG',
      'PASAY',
      'CALOOCAN',
      'MANDALUYONG',
      'PARANAQUE',
      'PARAÑAQUE',
      'MUNTINLUPA',
      'LAS PINAS',
      'LAS PIÑAS',
      'MARIKINA',
      'VALENZUELA',
      'MALABON',
      'NAVOTAS',
      'SAN JUAN',
      'PATEROS',
    ],
  };

  /** Age + region/municipality gate for mobile program discovery (any region). */
  private beneficiaryMatchesEligibility(
    beneficiary: BeneficiaryEntity | null,
    rules: Record<string, unknown>,
  ): boolean {
    const elig = (rules.eligibility ?? {}) as {
      min_age?: number;
      max_age?: number;
      regions?: string[];
      municipalities?: string[];
    };
    const minAge = elig.min_age != null ? Number(elig.min_age) : null;
    const maxAge = elig.max_age != null ? Number(elig.max_age) : null;
    const regions = (elig.regions ?? [])
      .map((r) => String(r).trim().toUpperCase())
      .filter(Boolean);
    const municipalities = (elig.municipalities ?? [])
      .map((m) => String(m).trim().toUpperCase())
      .filter(Boolean);

    if (minAge != null || maxAge != null) {
      const dob = beneficiary?.dateOfBirth
        ? new Date(String(beneficiary.dateOfBirth))
        : null;
      if (!dob || Number.isNaN(dob.getTime())) return false;
      const age = this.ageFromDob(dob);
      if (minAge != null && age < minAge) return false;
      if (maxAge != null && age > maxAge) return false;
    }

    if (municipalities.length) {
      const muni = String(beneficiary?.municipality ?? '')
        .trim()
        .toUpperCase();
      if (
        !muni ||
        !municipalities.some((m) => muni.includes(m) || m.includes(muni))
      ) {
        return false;
      }
    }

    if (regions.length) {
      const hay = [
        beneficiary?.municipality,
        beneficiary?.address,
        beneficiary?.barangay,
      ]
        .filter(Boolean)
        .join(' ')
        .toUpperCase();
      const matchesRegion = regions.some((region) =>
        this.locationMatchesRegion(hay, region),
      );
      if (!matchesRegion) return false;
    }

    return true;
  }

  /** Match profile text to a program region code (direct substring or aliases). */
  private locationMatchesRegion(locationHay: string, regionCode: string): boolean {
    if (!locationHay) return false;
    if (locationHay.includes(regionCode)) return true;
    const aliases =
      DomainService.REGION_LOCATION_ALIASES[regionCode] ?? [regionCode];
    return aliases.some((alias) => locationHay.includes(alias));
  }

  private ageFromDob(dob: Date): number {
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age -= 1;
    return age;
  }

  async getProgram(actorUserId: string, id: string) {
    const actor = await this.requireUser(actorUserId);
    const template = await this.templates.findOne({ where: { id } });
    if (!template) throw new NotFoundException('Program not found');
    const isBeneficiary =
      actor.accountType === 'beneficiary' || Boolean(actor.beneficiary);
    if (
      !isBeneficiary &&
      actor.organizationId &&
      template.organizationId !== actor.organizationId
    ) {
      throw new ForbiddenException('Not allowed to access this program');
    }
    if (isBeneficiary && template.status !== 'published') {
      throw new NotFoundException('Program not found');
    }
    const version = await this.versions.findOne({
      where: { programTemplateId: id },
      order: { versionNumber: 'DESC' },
    });
    if (!version) throw new NotFoundException('Program version not found');

    const rawRules = await this.dataSource.query(
      `SELECT disbursement_rules FROM program_template_versions WHERE id = $1`,
      [version.id],
    );
    const rules =
      (rawRules[0]?.disbursement_rules as Record<string, unknown>) ?? {};
    const applicantWorkflow = (rules.applicant_workflow ?? null) as {
      stages?: Array<{ name: string; type: string }>;
      form_title?: string;
      form_subtitle?: string | null;
    } | null;

    if (
      isBeneficiary &&
      !this.beneficiaryMatchesEligibility(actor.beneficiary, rules)
    ) {
      throw new ForbiddenException('Not eligible for this program');
    }

    const applyGate =
      isBeneficiary && actor.beneficiary?.id
        ? await this.getProgramApplyGate(
            actor.beneficiary.id,
            template.id,
            this.intervalToDays(version.cooldownPeriod),
          )
        : null;

    const form = await this.dataSource.query(
      `SELECT id, name FROM form_definitions WHERE program_template_version_id = $1 LIMIT 1`,
      [version.id],
    );
    const formId = form[0]?.id as string | undefined;
    const fields = formId
      ? await this.formFields.find({
          where: { formDefinitionId: formId },
          order: { sortOrder: 'ASC' },
        })
      : [];

    // Applicant journey must come from the Workflow Builder sync
    // (`applicant_workflow`). Never surface Nest staff engine steps
    // (evaluation/approval) on mobile — those are back-office only.
    const stages =
      applicantWorkflow?.stages?.length
        ? applicantWorkflow.stages
        : defaultApplicantStages();

    return {
      id: template.id,
      code: template.code,
      name: template.name,
      description: version.description,
      disbursement_cooldown_days: this.intervalToDays(version.cooldownPeriod),
      version_id: version.id,
      form_title: applicantWorkflow?.form_title ?? `${template.name} Application`,
      form_subtitle: applicantWorkflow?.form_subtitle ?? null,
      workflow_synced: Boolean(applicantWorkflow?.stages?.length),
      period_windows: normalizePeriodWindows(
        (rules.period_windows as PeriodWindows) ?? null,
      ),
      can_apply: applyGate?.can_apply ?? true,
      apply_block_reason: applyGate?.block_reason ?? null,
      apply_block_message: applyGate?.message ?? null,
      cooldown_remaining_days: applyGate?.remaining_days ?? null,
      eligible_again_at: applyGate?.eligible_again_at ?? null,
      last_claimed_at: applyGate?.last_claimed_at ?? null,
      active_application_id: applyGate?.active_application_id ?? null,
      last_claim_application_id: applyGate?.last_claim_application_id ?? null,
      fields: fields.map((f) => ({
        id: f.id,
        key: f.fieldKey,
        type: f.fieldType,
        required: f.required,
        sort_order: f.sortOrder,
        label: String((f.config as { label?: string })?.label ?? f.fieldKey),
        help_text: String((f.config as { help_text?: string })?.help_text ?? ''),
        options: Array.isArray((f.config as { options?: unknown })?.options)
          ? ((f.config as { options: string[] }).options)
          : [],
        multiline: Boolean((f.config as { multiline?: boolean })?.multiline),
        config: f.config,
      })),
      stages,
    };
  }

  /**
   * Persist the Workflow Builder applicant journey (Form → Verify → Review →
   * Disbursement + form fields) onto a Nest program version for mobile.
   */
  async syncApplicantWorkflow(
    actorUserId: string,
    programTemplateId: string,
    input: {
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
    const actor = await this.requireUser(actorUserId);
    if (!actor.organizationId) {
      throw new ForbiddenException('Organization required');
    }
    await this.rbac.assertPermission(actorUserId, 'program_template.publish_version', {
      organizationId: actor.organizationId,
    });
    const template = await this.templates.findOne({
      where: { id: programTemplateId },
    });
    if (!template || template.organizationId !== actor.organizationId) {
      throw new NotFoundException('Program not found');
    }
    const version = await this.versions.findOne({
      where: { programTemplateId },
      order: { versionNumber: 'DESC' },
    });
    if (!version) throw new NotFoundException('Program version not found');

    const stages = (input.stages ?? [])
      .map((s) => ({
        name: String(s.name ?? '').trim() || 'Step',
        type: String(s.type ?? 'form').trim().toLowerCase(),
      }))
      .filter((s) => s.type);

    const rawRules = await this.dataSource.query(
      `SELECT disbursement_rules FROM program_template_versions WHERE id = $1`,
      [version.id],
    );
    const prev =
      (rawRules[0]?.disbursement_rules as Record<string, unknown>) ?? {};
    const nextRules = {
      ...prev,
      applicant_workflow: {
        stages,
        form_title: input.form_title?.trim() || `${template.name} Application`,
        form_subtitle: input.form_subtitle?.trim() || null,
      },
    };
    await this.dataSource.query(
      `UPDATE program_template_versions
       SET disbursement_rules = $2::jsonb
       WHERE id = $1`,
      [version.id, JSON.stringify(nextRules)],
    );

    let form = await this.dataSource.query<Array<{ id: string }>>(
      `SELECT id FROM form_definitions WHERE program_template_version_id = $1 LIMIT 1`,
      [version.id],
    );
    if (!form[0]?.id) {
      form = await this.dataSource.query(
        `INSERT INTO form_definitions (program_template_version_id, name)
         VALUES ($1, $2)
         RETURNING id`,
        [version.id, input.form_title?.trim() || template.name],
      );
    }
    const formId = form[0].id as string;
    await this.dataSource.query(
      `DELETE FROM form_fields WHERE form_definition_id = $1`,
      [formId],
    );

    let sort = 0;
    for (const field of input.fields ?? []) {
      const key = String(field.key ?? '')
        .trim()
        .replace(/[^a-zA-Z0-9_]/g, '_')
        .slice(0, 64);
      if (!key) continue;
      const mapped = this.mapBuilderFieldType(field.type, field.multiline);
      await this.dataSource.query(
        `INSERT INTO form_fields
           (form_definition_id, field_key, field_type, config, sort_order, required)
         VALUES ($1, $2, $3, $4::jsonb, $5, $6)`,
        [
          formId,
          key,
          mapped.fieldType,
          JSON.stringify({
            label: field.label?.trim() || key,
            help_text: field.help_text?.trim() || '',
            options: field.options ?? [],
            multiline: mapped.multiline,
            builder_type: field.type,
          }),
          sort++,
          Boolean(field.required),
        ],
      );
    }

    return this.getProgram(actorUserId, programTemplateId);
  }

  private mapBuilderFieldType(
    type: string,
    multiline?: boolean,
  ): { fieldType: string; multiline: boolean } {
    const t = String(type ?? 'text').toLowerCase();
    if (t === 'textarea' || multiline) return { fieldType: 'text', multiline: true };
    if (t === 'select' || t === 'dropdown' || t === 'choice')
      return { fieldType: 'dropdown', multiline: false };
    if (t === 'checkbox' || t === 'consent' || t === 'toggle')
      return { fieldType: 'checkbox', multiline: false };
    if (t === 'number') return { fieldType: 'number', multiline: false };
    if (t === 'date') return { fieldType: 'date', multiline: false };
    if (t === 'file') return { fieldType: 'file', multiline: false };
    if (t === 'radio') return { fieldType: 'radio', multiline: false };
    return { fieldType: 'text', multiline: false };
  }

  async createApplication(
    actorUserId: string,
    input: {
      office_id: string;
      template_id: string;
      form_data?: Record<string, unknown>;
      amount_requested?: number;
      submit?: boolean;
      customer_user_id?: string;
    },
  ) {
    await this.requireUser(actorUserId);
    const beneficiaryAccountId = input.customer_user_id ?? actorUserId;
    const beneficiaryUser = await this.requireUser(beneficiaryAccountId);
    if (!beneficiaryUser.beneficiaryId || !beneficiaryUser.beneficiary) {
      throw new BadRequestException('Customer has no beneficiary profile');
    }

    if (beneficiaryAccountId === actorUserId) {
      await this.rbac.assertPermission(actorUserId, 'application.create', {
        beneficiaryId: beneficiaryUser.beneficiaryId,
      });
    } else {
      await this.rbac.assertPermission(actorUserId, 'beneficiary.register', {
        organizationId: beneficiaryUser.organizationId,
        officeId: beneficiaryUser.officeId,
      });
    }

    const version = await this.resolveVersion(input.template_id);
    const office = await this.offices.findOne({
      where: { id: input.office_id },
    });
    if (!office || office.status !== 'active') {
      throw new BadRequestException('Office is not available for new work');
    }
    if (
      beneficiaryUser.organizationId &&
      beneficiaryUser.organizationId !== office.organizationId
    ) {
      throw new ForbiddenException(
        'Office does not belong to the beneficiary organization',
      );
    }

    await this.assertCanApplyForProgram(
      beneficiaryUser.beneficiaryId,
      version.programTemplateId,
    );

    const versionRules = await this.loadVersionRules(version.id);
    if (input.submit) {
      try {
        assertApplicationPeriodOpen(versionRules);
      } catch (e) {
        throw new BadRequestException(
          e instanceof Error ? e.message : 'Application period closed',
        );
      }
    }

    const orgId =
      beneficiaryUser.organizationId ??
      office.organizationId ??
      (
        await this.dataSource.query(
          `SELECT id FROM organizations WHERE code = 'DSWD' LIMIT 1`,
        )
      )[0]?.id;
    if (!orgId) throw new BadRequestException('Organization missing');

    const ref = `APP-${Date.now().toString(36).toUpperCase()}`;
    const status = input.submit ? 'submitted' : 'draft';

    const app = await this.applications.save(
      this.applications.create({
        organizationId: orgId,
        officeId: office.id,
        beneficiaryId: beneficiaryUser.beneficiaryId,
        programTemplateVersionId: version.id,
        status,
        referenceNo: ref,
        amountRequested:
          input.amount_requested != null
            ? String(input.amount_requested)
            : null,
        submittedAt: input.submit ? new Date() : null,
      }),
    );

    await this.upsertAnswers(app.id, version.id, input.form_data ?? {});

    if (input.submit) {
      await this.spawnEvaluationTask(app);
      app.status = 'in_evaluation';
      await this.applications.save(app);
    }

    return this.serializeApplication(app.id);
  }

  async updateApplication(
    actorUserId: string,
    id: string,
    updates: {
      form_data?: Record<string, unknown>;
      amount_requested?: number;
      status?: string;
    },
  ) {
    const app = await this.applications.findOne({ where: { id } });
    if (!app) throw new NotFoundException('Application not found');
    await this.assertCanAccess(actorUserId, app);

    if (updates.form_data) {
      if (app.status !== 'draft') {
        throw new BadRequestException(
          'Submitted applications are locked — documents and answers cannot be changed or discarded',
        );
      }
      await this.upsertAnswers(
        app.id,
        app.programTemplateVersionId,
        updates.form_data,
      );
    }
    if (updates.amount_requested != null) {
      app.amountRequested = String(updates.amount_requested);
    }
    if (updates.status) {
      app.status = FROM_CLIENT_STATUS[updates.status] ?? updates.status;
    }
    await this.applications.save(app);
    return this.serializeApplication(app.id);
  }

  async submitApplication(actorUserId: string, id: string) {
    const app = await this.applications.findOne({ where: { id } });
    if (!app) throw new NotFoundException('Application not found');
    await this.assertCanAccess(actorUserId, app);
    const user = await this.requireUser(actorUserId);
    if (user.beneficiaryId && user.beneficiaryId === app.beneficiaryId) {
      await this.rbac.assertPermission(actorUserId, 'application.submit', {
        beneficiaryId: app.beneficiaryId,
      });
    }
    await this.assertOfficeAcceptsNewWork(app.officeId);
    if (app.status !== 'draft' && app.status !== 'submitted') {
      throw new BadRequestException('Only draft applications can be submitted');
    }
    try {
      assertApplicationPeriodOpen(
        await this.loadVersionRules(app.programTemplateVersionId),
      );
    } catch (e) {
      throw new BadRequestException(
        e instanceof Error ? e.message : 'Application period closed',
      );
    }
    app.status = 'in_evaluation';
    app.submittedAt = new Date();
    await this.applications.save(app);
    await this.spawnEvaluationTask(app);
    return this.serializeApplication(app.id);
  }

  async listMyApplications(userId: string) {
    const user = await this.requireUser(userId);
    if (!user.beneficiaryId) return [];
    const rows = await this.applications.find({
      where: { beneficiaryId: user.beneficiaryId },
      order: { createdAt: 'DESC' },
    });
    const serialized = await Promise.all(
      rows.map((r) => this.serializeApplication(r.id)),
    );
    // In-progress first, then completed/closed; newest activity within each group.
    const rank = (status: string) => {
      switch (status) {
        case 'draft':
          return 0;
        case 'submitted':
        case 'under_review':
          return 1;
        case 'recommended':
          return 2;
        case 'approved':
          return 3;
        case 'claimed':
        case 'disbursed':
          return 4;
        case 'declined':
        case 'rejected':
        case 'cancelled':
          return 5;
        default:
          return 6;
      }
    };
    serialized.sort((a, b) => {
      const ra = rank(String(a.status));
      const rb = rank(String(b.status));
      if (ra !== rb) return ra - rb;
      const ta = Date.parse(String(a.submitted_at ?? a.created_at ?? 0)) || 0;
      const tb = Date.parse(String(b.submitted_at ?? b.created_at ?? 0)) || 0;
      return tb - ta;
    });
    return serialized;
  }

  async listQueue(actorUserId: string, statuses?: string[]) {
    const actor = await this.requireUser(actorUserId);
    await this.rbac.assertPermission(actorUserId, 'application.view_assigned', {
      organizationId: actor.organizationId,
      officeId: actor.officeId,
      assignedUserId: null,
    });
    const erdStatuses = (statuses ?? []).map((s) => FROM_CLIENT_STATUS[s] ?? s);
    const qb = this.applications.createQueryBuilder('a');
    if (actor.officeId) {
      qb.andWhere('a.office_id = :officeId', { officeId: actor.officeId });
    } else if (actor.organizationId) {
      qb.andWhere('a.organization_id = :orgId', {
        orgId: actor.organizationId,
      });
    }
    if (erdStatuses.length) {
      qb.andWhere('a.status IN (:...statuses)', { statuses: erdStatuses });
    }
    qb.orderBy('a.updated_at', 'DESC').addOrderBy('a.created_at', 'DESC');
    const rows = await qb.getMany();
    const serialized = await Promise.all(
      rows.map((r) => this.serializeApplication(r.id)),
    );
    const rank = (status: string) => {
      switch (status) {
        case 'draft':
          return 0;
        case 'submitted':
        case 'under_review':
          return 1;
        case 'recommended':
          return 2;
        case 'approved':
          return 3;
        case 'claimed':
        case 'disbursed':
          return 4;
        case 'declined':
        case 'rejected':
        case 'cancelled':
          return 5;
        default:
          return 6;
      }
    };
    serialized.sort((a, b) => {
      const ra = rank(String(a.status));
      const rb = rank(String(b.status));
      if (ra !== rb) return ra - rb;
      const ta = Date.parse(String(a.submitted_at ?? a.created_at ?? 0)) || 0;
      const tb = Date.parse(String(b.submitted_at ?? b.created_at ?? 0)) || 0;
      return tb - ta;
    });
    return serialized;
  }

  /**
   * Live Overview metrics for Organization / Office Admin consoles.
   */
  async getAdminDashboardSummary(actorUserId: string) {
    const actor = await this.requireUser(actorUserId);
    if (!actor.organizationId) {
      throw new ForbiddenException('Organization scope required');
    }

    try {
      if (actor.officeId) {
        await this.rbac.assertPermission(actorUserId, 'analytics.view_office', {
          organizationId: actor.organizationId,
          officeId: actor.officeId,
        });
      } else {
        await this.rbac.assertPermission(actorUserId, 'analytics.view_org', {
          organizationId: actor.organizationId,
        });
      }
    } catch (err) {
      if (!(err instanceof ForbiddenException)) throw err;
      await this.rbac.assertPermission(actorUserId, 'application.view_assigned', {
        organizationId: actor.organizationId,
        officeId: actor.officeId,
        assignedUserId: null,
      });
    }

    const params: unknown[] = [actor.organizationId];
    let officeClause = '';
    if (actor.officeId) {
      params.push(actor.officeId);
      officeClause = ` AND a.office_id = $${params.length}`;
    }

    const statusRows = await this.dataSource.query<
      Array<{ status: string; count: string }>
    >(
      `SELECT a.status, COUNT(*)::text AS count
       FROM applications a
       WHERE a.organization_id = $1${officeClause}
       GROUP BY a.status`,
      params,
    );

    const byStatus: Record<string, number> = {};
    let totalApplications = 0;
    for (const row of statusRows) {
      const client = TO_CLIENT_STATUS[row.status] ?? row.status;
      const n = Number(row.count) || 0;
      byStatus[client] = (byStatus[client] ?? 0) + n;
      totalApplications += n;
    }

    const locationRows = await this.dataSource.query<
      Array<{ location: string; count: string }>
    >(
      `SELECT COALESCE(NULLIF(TRIM(b.municipality), ''), 'Unspecified') AS location,
              COUNT(*)::text AS count
       FROM applications a
       JOIN beneficiaries b ON b.id = a.beneficiary_id
       WHERE a.organization_id = $1${officeClause}
       GROUP BY 1
       ORDER BY COUNT(*) DESC, location ASC
       LIMIT 12`,
      params,
    );

    const beneficiaryRows = await this.dataSource.query<
      Array<{ total: string; face_verified: string }>
    >(
      actor.officeId
        ? `SELECT COUNT(DISTINCT a.beneficiary_id)::text AS total,
                  COUNT(DISTINCT a.beneficiary_id)
                    FILTER (WHERE COALESCE(b.face_scan_verified, false))::text AS face_verified
           FROM applications a
           JOIN beneficiaries b ON b.id = a.beneficiary_id
           WHERE a.organization_id = $1 AND a.office_id = $2`
        : `SELECT COUNT(*)::text AS total,
                  COUNT(*) FILTER (WHERE COALESCE(b.face_scan_verified, false))::text AS face_verified
           FROM user_accounts ua
           JOIN beneficiaries b ON b.id = ua.beneficiary_id
           WHERE ua.organization_id = $1
             AND ua.beneficiary_id IS NOT NULL`,
      actor.officeId
        ? [actor.organizationId, actor.officeId]
        : [actor.organizationId],
    );

    const pendingProfileRows = await this.dataSource.query<
      Array<{ count: string }>
    >(
      `SELECT COUNT(*)::text AS count
       FROM profile_change_requests p
       WHERE p.organization_id = $1
         AND p.status = 'pending'
         ${actor.officeId ? `AND p.office_id = $2` : ''}`,
      actor.officeId
        ? [actor.organizationId, actor.officeId]
        : [actor.organizationId],
    );

    const recentApps = await this.dataSource.query<
      Array<{
        id: string;
        reference_no: string | null;
        status: string;
        template_name: string | null;
        customer_name: string | null;
        municipality: string | null;
        updated_at: string;
        submitted_at: string | null;
        decided_at: string | null;
      }>
    >(
      `SELECT a.id, a.reference_no, a.status, t.name AS template_name,
              b.full_name AS customer_name, b.municipality,
              a.updated_at, a.submitted_at, a.decided_at
       FROM applications a
       JOIN beneficiaries b ON b.id = a.beneficiary_id
       LEFT JOIN program_template_versions v ON v.id = a.program_template_version_id
       LEFT JOIN program_templates t ON t.id = v.program_template_id
       WHERE a.organization_id = $1${officeClause}
       ORDER BY a.updated_at DESC
       LIMIT 8`,
      params,
    );

    const pipeline = {
      submitted: byStatus.submitted ?? 0,
      under_review: byStatus.under_review ?? 0,
      recommended: byStatus.recommended ?? 0,
      approved: byStatus.approved ?? 0,
      claimed: (byStatus.claimed ?? 0) + (byStatus.disbursed ?? 0),
      declined: byStatus.declined ?? 0,
      cancelled: byStatus.cancelled ?? 0,
      draft: byStatus.draft ?? 0,
    };

    return {
      scope: actor.officeId ? 'office' : 'organization',
      organization_id: actor.organizationId,
      office_id: actor.officeId,
      total_applications: totalApplications,
      awaiting_approval: pipeline.recommended,
      registered_customers: Number(beneficiaryRows[0]?.total ?? 0),
      face_verified_customers: Number(beneficiaryRows[0]?.face_verified ?? 0),
      claimed_or_disbursed: pipeline.claimed,
      pending_profile_changes: Number(pendingProfileRows[0]?.count ?? 0),
      pipeline,
      by_location: locationRows.map((r) => ({
        location: r.location,
        count: Number(r.count) || 0,
      })),
      recent_applications: recentApps.map((a) => ({
        id: a.id,
        reference_no: a.reference_no ?? `APP-${a.id.slice(0, 8)}`,
        status: TO_CLIENT_STATUS[a.status] ?? a.status,
        erd_status: a.status,
        template_name: a.template_name,
        customer_name: a.customer_name,
        municipality: a.municipality,
        updated_at: a.updated_at,
        submitted_at: a.submitted_at,
        decided_at: a.decided_at,
      })),
    };
  }

  async getApplication(actorUserId: string, id: string) {
    const app = await this.applications.findOne({ where: { id } });
    if (!app) throw new NotFoundException('Application not found');
    await this.assertCanAccess(actorUserId, app);
    return this.serializeApplication(id);
  }

  async recommend(
    actorUserId: string,
    applicationId: string,
    input: { notes?: string; priority?: string },
  ) {
    const app = await this.applications.findOne({
      where: { id: applicationId },
    });
    if (!app) throw new NotFoundException('Application not found');
    await this.assertEvaluator(actorUserId);
    await this.assertCanAccess(actorUserId, app);
    const evaluationTask = await this.requireActionableTask(
      actorUserId,
      app,
      'evaluation',
    );
    await this.rbac.assertPermission(actorUserId, 'application.endorse', {
      organizationId: app.organizationId,
      officeId: app.officeId,
      assignedUserId: evaluationTask.assigneeUserId,
    });
    try {
      assertReviewPeriodOpen(
        await this.loadVersionRules(app.programTemplateVersionId),
      );
    } catch (e) {
      throw new BadRequestException(
        e instanceof Error ? e.message : 'Review period closed',
      );
    }
    app.evaluatorNotes = input.notes ?? app.evaluatorNotes;
    app.status = 'in_approval';
    await this.applications.save(app);

    evaluationTask.status = 'completed';
    evaluationTask.decision = 'endorse';
    evaluationTask.notes = input.notes ?? null;
    evaluationTask.assigneeUserId = actorUserId;
    evaluationTask.completedAt = new Date();
    await this.tasks.save(evaluationTask);
    await this.spawnApprovalTask(app);

    return {
      id: `rec-${app.id}`,
      application_id: app.id,
      recommended_by: actorUserId,
      priority: input.priority ?? 'medium',
      rationale: input.notes ?? null,
      is_acted_on: false,
      created_at: new Date().toISOString(),
      applications: await this.serializeApplication(app.id),
    };
  }

  /**
   * Evaluator declines during evaluation (does not send to Approver).
   * Beneficiary may apply again when eligible.
   */
  async declineEvaluation(
    actorUserId: string,
    applicationId: string,
    input: { notes?: string },
  ) {
    const app = await this.applications.findOne({
      where: { id: applicationId },
    });
    if (!app) throw new NotFoundException('Application not found');
    await this.assertEvaluator(actorUserId);
    await this.assertCanAccess(actorUserId, app);
    const evaluationTask = await this.requireActionableTask(
      actorUserId,
      app,
      'evaluation',
    );
    await this.rbac.assertPermission(actorUserId, 'application.reject', {
      organizationId: app.organizationId,
      officeId: app.officeId,
      assignedUserId: evaluationTask.assigneeUserId,
    });
    try {
      assertReviewPeriodOpen(
        await this.loadVersionRules(app.programTemplateVersionId),
      );
    } catch (e) {
      throw new BadRequestException(
        e instanceof Error ? e.message : 'Review period closed',
      );
    }

    app.evaluatorNotes = input.notes ?? app.evaluatorNotes;
    app.decidedAt = new Date();
    app.status = 'rejected';
    await this.applications.save(app);

    evaluationTask.status = 'completed';
    evaluationTask.decision = 'reject';
    evaluationTask.notes = input.notes ?? null;
    evaluationTask.assigneeUserId = actorUserId;
    evaluationTask.completedAt = new Date();
    await this.tasks.save(evaluationTask);

    try {
      await this.officeOps.notifyApplicationDeclined(app, input.notes);
    } catch (err) {
      // Decision already saved — notification must not roll back decline.
      console.warn(
        `[notify] decline notification failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }

    return this.serializeApplication(app.id);
  }

  async listPendingRecommendations(actorUserId: string) {
    const apps = await this.listQueue(actorUserId, [
      'recommended',
      'in_approval',
    ]);
    return apps.map((a) => ({
      id: `rec-${a.id}`,
      application_id: a.id,
      recommended_by: 'evaluator',
      priority: a.priority ?? 'medium',
      rationale: a.evaluator_notes,
      is_acted_on: false,
      created_at: a.submitted_at,
      applications: a,
    }));
  }

  async decide(
    actorUserId: string,
    applicationId: string,
    input: {
      approve: boolean;
      notes?: string;
      amount_approved?: number;
    },
  ) {
    const app = await this.applications.findOne({
      where: { id: applicationId },
    });
    if (!app) throw new NotFoundException('Application not found');
    await this.assertApprover(actorUserId);
    await this.assertCanAccess(actorUserId, app);
    const approvalTask = await this.requireActionableTask(
      actorUserId,
      app,
      'approval',
    );
    const evaluatedByUserId = await this.findPriorEvaluatorUserId(app.id);
    await this.rbac.assertPermission(
      actorUserId,
      input.approve ? 'application.approve' : 'application.reject',
      {
        organizationId: app.organizationId,
        officeId: app.officeId,
        assignedUserId: approvalTask.assigneeUserId,
        evaluatedByUserId,
      },
    );
    try {
      assertReviewPeriodOpen(
        await this.loadVersionRules(app.programTemplateVersionId),
      );
    } catch (e) {
      throw new BadRequestException(
        e instanceof Error ? e.message : 'Review period closed',
      );
    }

    app.approverNotes = input.notes ?? null;
    app.decidedAt = new Date();
    if (input.amount_approved != null) {
      app.amountApproved = String(input.amount_approved);
    }
    app.status = input.approve ? 'approved' : 'rejected';
    await this.applications.save(app);

    approvalTask.status = 'completed';
    approvalTask.decision = input.approve ? 'approve' : 'reject';
    approvalTask.notes = input.notes ?? null;
    approvalTask.assigneeUserId = actorUserId;
    approvalTask.completedAt = new Date();
    await this.tasks.save(approvalTask);

    if (input.approve) {
      try {
        await this.officeOps.notifyApplicationApproved(app);
      } catch (err) {
        console.warn(
          `[notify] approve notification failed: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    } else {
      try {
        await this.officeOps.notifyApplicationDeclined(app, input.notes);
      } catch (err) {
        console.warn(
          `[notify] decline notification failed: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }

    return this.serializeApplication(app.id);
  }

  async listDependents(userId: string) {
    const user = await this.requireUser(userId);
    if (!user.beneficiaryId) return [];
    const rows = await this.relationships.find({
      where: {
        requesterBeneficiaryId: user.beneficiaryId,
        type: In(['dependent', 'child', 'guardian']),
      },
    });
    return Promise.all(rows.map((r) => this.serializeRelationship(r)));
  }

  async listLinkedPrincipals(userId: string) {
    const user = await this.requireUser(userId);
    if (!user.beneficiaryId) return [];
    const rows = await this.relationships.find({
      where: { relatedBeneficiaryId: user.beneficiaryId },
    });
    return Promise.all(rows.map((r) => this.serializeRelationship(r)));
  }

  async registerDependent(
    actorUserId: string,
    input: {
      principal_user_id: string;
      dependent_user_id: string;
      relationship: string;
      notes?: string;
      documents?: Array<{ document_type: string; storage_uri: string }>;
    },
  ) {
    const principal = await this.requireUser(input.principal_user_id);
    const dependent = await this.requireUser(input.dependent_user_id);
    if (
      principal.accountType !== 'beneficiary' ||
      dependent.accountType !== 'beneficiary' ||
      !principal.beneficiaryId ||
      !dependent.beneficiaryId
    ) {
      throw new BadRequestException(
        'Only beneficiary accounts can link as dependents of each other',
      );
    }
    if (principal.beneficiaryId === dependent.beneficiaryId) {
      throw new BadRequestException('Cannot link a beneficiary to themselves');
    }

    const docs = (input.documents ?? []).filter(
      (d) => d.document_type?.trim() && d.storage_uri?.trim(),
    );
    if (!docs.length) {
      throw new BadRequestException(
        'At least one proof document is required for a dependent relationship',
      );
    }

    // Either party may request (mutual / one-to-many). Actor must be one of them.
    if (actorUserId !== principal.id && actorUserId !== dependent.id) {
      throw new ForbiddenException(
        'Only the linked beneficiaries may request this relationship',
      );
    }
    const actor = await this.requireUser(actorUserId);
    await this.rbac.assertPermission(actorUserId, 'relationship.request', {
      beneficiaryId: actor.beneficiaryId,
    });

    const orgId =
      principal.organizationId ??
      dependent.organizationId ??
      (
        await this.dataSource.query(
          `SELECT id FROM organizations WHERE code = 'DSWD' LIMIT 1`,
        )
      )[0]?.id;
    if (!orgId) throw new BadRequestException('Organization missing');

    const existing = await this.relationships.findOne({
      where: {
        requesterBeneficiaryId: principal.beneficiaryId,
        relatedBeneficiaryId: dependent.beneficiaryId,
        type: input.relationship || 'dependent',
      },
    });
    if (existing && !['rejected', 'revoked'].includes(existing.status)) {
      throw new BadRequestException('Relationship already exists');
    }

    const rel = await this.relationships.save(
      this.relationships.create({
        organizationId: orgId,
        requesterBeneficiaryId: principal.beneficiaryId,
        relatedBeneficiaryId: dependent.beneficiaryId,
        type: input.relationship || 'dependent',
        status: 'requested',
        activatedAt: null,
      }),
    );

    for (const doc of docs) {
      await this.dataSource.query(
        `INSERT INTO relationship_documents
           (relationship_id, document_type, storage_uri)
         VALUES ($1, $2, $3)`,
        [rel.id, doc.document_type.trim(), doc.storage_uri.trim()],
      );
    }

    return this.serializeRelationship(rel);
  }

  /**
   * Office Admin approves (or rejects) a beneficiary↔beneficiary link after
   * reviewing proof documents. Accepts `requested` or `validated` status.
   */
  async approveRelationship(
    actorUserId: string,
    relationshipId: string,
    input: { notes?: string; approve?: boolean } = {},
  ) {
    const rel = await this.relationships.findOne({
      where: { id: relationshipId },
    });
    if (!rel) throw new NotFoundException('Relationship not found');
    if (!['requested', 'validated'].includes(rel.status)) {
      throw new BadRequestException(
        'Relationship is not awaiting Office Admin approval',
      );
    }

    const docs = await this.dataSource.query<Array<{ id: string }>>(
      `SELECT id FROM relationship_documents WHERE relationship_id = $1 LIMIT 1`,
      [rel.id],
    );
    if (!docs.length) {
      throw new BadRequestException(
        'Cannot approve a relationship without proof documents',
      );
    }

    const actor = await this.requireUser(actorUserId);
    if (!actor.officeId) {
      throw new ForbiddenException('Office Administrator office scope required');
    }
    await this.rbac.assertPermission(actorUserId, 'relationship.approve', {
      organizationId: rel.organizationId,
      officeId: actor.officeId,
    });

    const approve = input.approve !== false;
    if (approve) {
      rel.status = 'approved';
      rel.activatedAt = new Date();
    } else {
      rel.status = 'rejected';
      rel.activatedAt = null;
    }
    await this.relationships.save(rel);
    await this.dataSource.query(
      `INSERT INTO relationship_reviews
         (relationship_id, approver_id, stage, decision, notes)
       VALUES ($1, $2, 'approval', $3, $4)`,
      [
        rel.id,
        actorUserId,
        approve ? 'approve' : 'reject',
        input.notes ?? null,
      ],
    );
    return this.serializeRelationship(rel);
  }

  /** @deprecated Prefer Office Admin approve from requested. Kept for compat. */
  async validateRelationship(
    actorUserId: string,
    relationshipId: string,
    input: { notes?: string; accept?: boolean } = {},
  ) {
    // Soft acknowledge only — final authority is Office Admin approve.
    return this.approveRelationship(actorUserId, relationshipId, {
      notes: input.notes,
      approve: input.accept !== false,
    });
  }

  async listPendingRelationships(actorUserId: string, _stage?: string) {
    const actor = await this.requireUser(actorUserId);
    await this.rbac.assertPermission(actorUserId, 'relationship.approve', {
      organizationId: actor.organizationId,
      officeId: actor.officeId,
    });

    const qb = this.relationships.createQueryBuilder('r');
    if (actor.organizationId) {
      qb.andWhere('r.organization_id = :orgId', {
        orgId: actor.organizationId,
      });
    }
    qb.andWhere('r.status IN (:...statuses)', {
      statuses: ['requested', 'validated'],
    });
    qb.orderBy('r.created_at', 'DESC');
    const rows = await qb.getMany();
    return Promise.all(rows.map((r) => this.serializeRelationship(r)));
  }

  async listWorkflowTemplates(actorUserId: string) {
    const actor = await this.requireUser(actorUserId);
    await this.rbac.assertPermission(actorUserId, 'workflow.manage', {
      organizationId: actor.organizationId,
    });
    const rows = await this.dataSource.query<
      Array<{
        id: string;
        code: string;
        name: string;
        description: string | null;
        status: string;
      }>
    >(
      `SELECT id, code, name, description, status
       FROM workflow_templates
       WHERE organization_id = $1
       ORDER BY name ASC`,
      [actor.organizationId],
    );
    return Promise.all(
      rows.map(async (t) => ({
        ...t,
        steps: await this.dataSource.query(
          `SELECT id, step_key, step_type, assignment_strategy, sort_order
           FROM workflow_template_steps
           WHERE workflow_template_id = $1
           ORDER BY sort_order ASC, step_key ASC`,
          [t.id],
        ),
      })),
    );
  }

  /**
   * Copy a published workflow template into a program version's private engine.
   * Enforces 1 engine per program version; template remains reusable elsewhere.
   */
  async applyWorkflowTemplate(
    actorUserId: string,
    programTemplateVersionId: string,
    input: { workflow_template_id: string; name?: string },
  ) {
    const actor = await this.requireUser(actorUserId);
    await this.rbac.assertPermission(actorUserId, 'workflow.manage', {
      organizationId: actor.organizationId,
    });

    const version = await this.versions.findOne({
      where: { id: programTemplateVersionId },
    });
    if (!version) throw new NotFoundException('Program template version not found');

    const template = await this.templates.findOne({
      where: { id: version.programTemplateId },
    });
    if (!template || template.organizationId !== actor.organizationId) {
      throw new ForbiddenException('Version is outside organization scope');
    }

    const wfTemplate = await this.dataSource.query<
      Array<{ id: string; name: string; status: string; organization_id: string }>
    >(
      `SELECT id, name, status, organization_id
       FROM workflow_templates WHERE id = $1 LIMIT 1`,
      [input.workflow_template_id],
    );
    const source = wfTemplate[0];
    if (!source || source.organization_id !== actor.organizationId) {
      throw new NotFoundException('Workflow template not found');
    }
    if (source.status !== 'published') {
      throw new BadRequestException('Only published workflow templates can be applied');
    }

    const existing = await this.dataSource.query<Array<{ id: string }>>(
      `SELECT id FROM workflow_definitions
       WHERE program_template_version_id = $1 LIMIT 1`,
      [programTemplateVersionId],
    );
    if (existing[0]) {
      const apps = await this.applications.count({
        where: { programTemplateVersionId },
      });
      if (apps > 0) {
        throw new BadRequestException(
          'Cannot replace workflow — applications already use this program version',
        );
      }
      await this.dataSource.query(
        `DELETE FROM workflow_definitions WHERE id = $1`,
        [existing[0].id],
      );
    }

    const steps = await this.dataSource.query<
      Array<{
        step_key: string;
        step_type: string;
        assignment_strategy: unknown;
        timeout: string | null;
        escalation_config: unknown;
        sort_order: number;
      }>
    >(
      `SELECT step_key, step_type, assignment_strategy, timeout, escalation_config, sort_order
       FROM workflow_template_steps
       WHERE workflow_template_id = $1
       ORDER BY sort_order ASC`,
      [source.id],
    );
    if (!steps.length) {
      throw new BadRequestException('Workflow template has no steps to copy');
    }

    const created = await this.dataSource.query<Array<{ id: string }>>(
      `INSERT INTO workflow_definitions
         (program_template_version_id, name, source_workflow_template_id)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [
        programTemplateVersionId,
        input.name ?? source.name,
        source.id,
      ],
    );
    const engineId = created[0]?.id;
    if (!engineId) throw new BadRequestException('Failed to create workflow engine');

    for (const step of steps) {
      await this.dataSource.query(
        `INSERT INTO workflow_steps
           (workflow_definition_id, step_key, step_type, assignment_strategy,
            timeout, escalation_config, sort_order)
         VALUES ($1, $2, $3, $4::jsonb, $5, $6::jsonb, $7)`,
        [
          engineId,
          step.step_key,
          step.step_type,
          JSON.stringify(step.assignment_strategy ?? {}),
          step.timeout,
          JSON.stringify(step.escalation_config ?? {}),
          step.sort_order,
        ],
      );
    }

    return {
      id: engineId,
      program_template_version_id: programTemplateVersionId,
      source_workflow_template_id: source.id,
      name: input.name ?? source.name,
      steps: steps.map((s) => ({
        step_key: s.step_key,
        step_type: s.step_type,
        sort_order: s.sort_order,
      })),
    };
  }

  /** Org-scoped template catalog for Admin → Templates (includes drafts). */
  async listAdminProgramTemplates(actorUserId: string) {
    const actor = await this.requireUser(actorUserId);
    if (!actor.organizationId) {
      throw new ForbiddenException('Organization required');
    }
    const templates = await this.templates.find({
      where: { organizationId: actor.organizationId },
      order: { name: 'ASC' },
    });
    const result = [];
    for (const t of templates) {
      const version = await this.versions.findOne({
        where: { programTemplateId: t.id },
        order: { versionNumber: 'DESC' },
      });
      const rawRules = version
        ? await this.dataSource.query(
            `SELECT disbursement_rules FROM program_template_versions WHERE id = $1`,
            [version.id],
          )
        : [];
      const eligibility =
        (rawRules[0]?.disbursement_rules as Record<string, unknown>) ?? {};
      result.push({
        id: t.id,
        name: t.name,
        description: version?.description ?? null,
        eligibility_rules: eligibility,
        period_windows: normalizePeriodWindows(
          (eligibility.period_windows as PeriodWindows) ?? null,
        ),
        disbursement_cooldown_days: this.intervalToDays(
          version?.cooldownPeriod,
        ),
        is_active: t.status === 'published',
        status: t.status,
        code: t.code,
        version_id: version?.id ?? null,
        version_number: version?.versionNumber ?? null,
        workflow: version
          ? await this.serializeProgramWorkflow(version.id)
          : null,
      });
    }
    return result;
  }

  async getAdminProgramTemplate(actorUserId: string, templateId: string) {
    const rows = await this.listAdminProgramTemplates(actorUserId);
    const row = rows.find((r) => r.id === templateId);
    if (!row) throw new NotFoundException('Program not found');
    return row;
  }

  private async serializeProgramWorkflow(programTemplateVersionId: string) {
    const wf = await this.dataSource.query<
      Array<{
        id: string;
        name: string;
        source_workflow_template_id: string | null;
      }>
    >(
      `SELECT id, name, source_workflow_template_id
       FROM workflow_definitions
       WHERE program_template_version_id = $1
       LIMIT 1`,
      [programTemplateVersionId],
    );
    if (!wf[0]) return null;
    const steps = await this.dataSource.query(
      `SELECT id, step_key, step_type, sort_order
       FROM workflow_steps
       WHERE workflow_definition_id = $1
       ORDER BY sort_order ASC`,
      [wf[0].id],
    );
    return {
      id: wf[0].id,
      name: wf[0].name,
      source_workflow_template_id: wf[0].source_workflow_template_id,
      steps,
    };
  }

  async createAdminProgramTemplate(
    actorUserId: string,
    input: {
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
      period_windows?: PeriodWindows;
    },
  ) {
    const actor = await this.requireUser(actorUserId);
    if (!actor.organizationId) {
      throw new ForbiddenException('Organization required');
    }
    await this.rbac.assertPermission(actorUserId, 'program_template.create', {
      organizationId: actor.organizationId,
    });
    const name = input.name?.trim();
    if (!name) throw new BadRequestException('name is required');
    const codeBase = name
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 24);
    const code = `${codeBase || 'PROG'}_${Date.now().toString(36).toUpperCase()}`;
    const published = input.is_active !== false;
    const cooldownDays = Math.max(0, Number(input.cooldown_days ?? 90));
    const template = await this.templates.save(
      this.templates.create({
        organizationId: actor.organizationId,
        code,
        name,
        status: published ? 'published' : 'draft',
      }),
    );
    const version = await this.versions.save(
      this.versions.create({
        programTemplateId: template.id,
        versionNumber: 1,
        description: input.description?.trim() || null,
        cooldownPeriod: `${cooldownDays} days`,
        immutable: false,
        publishedAt: published ? new Date() : null,
      }),
    );
    const rules = {
      requirements: input.requirements?.trim() || '',
      eligibility: {
        min_age: input.eligibility?.min_age,
        max_age: input.eligibility?.max_age,
        regions: input.eligibility?.regions ?? [],
        municipalities: input.eligibility?.municipalities ?? [],
      },
      period_windows: normalizePeriodWindows(input.period_windows ?? null),
    };
    await this.dataSource.query(
      `UPDATE program_template_versions
       SET disbursement_rules = $2::jsonb
       WHERE id = $1`,
      [version.id, JSON.stringify(rules)],
    );
    if (input.workflow_template_id?.trim()) {
      await this.applyWorkflowTemplate(actorUserId, version.id, {
        workflow_template_id: input.workflow_template_id.trim(),
      });
    } else {
      await this.ensureDefaultWorkflow(version.id, name);
    }
    return this.getAdminProgramTemplate(actorUserId, template.id);
  }

  async updateAdminProgramTemplate(
    actorUserId: string,
    templateId: string,
    input: {
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
      period_windows?: PeriodWindows;
    },
  ) {
    const actor = await this.requireUser(actorUserId);
    const template = await this.templates.findOne({ where: { id: templateId } });
    if (!template) throw new NotFoundException('Template not found');
    if (template.organizationId !== actor.organizationId) {
      throw new ForbiddenException('Not allowed');
    }
    if (input.is_active === false) {
      await this.rbac.assertPermission(actorUserId, 'program_template.retire', {
        organizationId: actor.organizationId,
      });
    } else {
      const canCreate = await this.rbac.hasPermission(
        actorUserId,
        'program_template.create',
        { organizationId: actor.organizationId },
      );
      if (!canCreate) {
        await this.rbac.assertPermission(
          actorUserId,
          'program_template.override_allowed_fields',
          {
            organizationId: actor.organizationId,
            officeId: actor.officeId,
          },
        );
      }
    }
    if (input.name?.trim()) template.name = input.name.trim();
    if (input.is_active !== undefined) {
      template.status = input.is_active ? 'published' : 'draft';
    }
    await this.templates.save(template);
    let version = await this.versions.findOne({
      where: { programTemplateId: template.id },
      order: { versionNumber: 'DESC' },
    });
    if (!version) {
      version = await this.versions.save(
        this.versions.create({
          programTemplateId: template.id,
          versionNumber: 1,
          description: null,
          cooldownPeriod: '90 days',
        }),
      );
    }
    if (input.description !== undefined) {
      version.description = input.description.trim() || null;
    }
    if (input.cooldown_days !== undefined) {
      version.cooldownPeriod = `${Math.max(0, Number(input.cooldown_days))} days`;
    }
    if (input.is_active === true) {
      version.publishedAt = version.publishedAt ?? new Date();
    }
    await this.versions.save(version);

    const existing = await this.dataSource.query(
      `SELECT disbursement_rules FROM program_template_versions WHERE id = $1`,
      [version.id],
    );
    const prev = (existing[0]?.disbursement_rules ?? {}) as Record<
      string,
      unknown
    >;
    const prevElig = (prev.eligibility ?? {}) as Record<string, unknown>;
    const nextRules = {
      ...prev,
      ...(input.requirements !== undefined
        ? { requirements: input.requirements.trim() }
        : {}),
      eligibility: {
        ...prevElig,
        ...(input.eligibility?.min_age !== undefined
          ? { min_age: input.eligibility.min_age }
          : {}),
        ...(input.eligibility?.max_age !== undefined
          ? { max_age: input.eligibility.max_age }
          : {}),
        ...(input.eligibility?.regions !== undefined
          ? { regions: input.eligibility.regions }
          : {}),
        ...(input.eligibility?.municipalities !== undefined
          ? { municipalities: input.eligibility.municipalities }
          : {}),
      },
      ...(input.period_windows !== undefined
        ? {
            period_windows: normalizePeriodWindows(input.period_windows),
          }
        : {}),
    };
    await this.dataSource.query(
      `UPDATE program_template_versions SET disbursement_rules = $2::jsonb WHERE id = $1`,
      [version.id, JSON.stringify(nextRules)],
    );
    return {
      id: template.id,
      name: template.name,
      description: version.description,
      eligibility_rules: nextRules,
      disbursement_cooldown_days: this.intervalToDays(version.cooldownPeriod),
      is_active: template.status === 'published',
      status: template.status,
      code: template.code,
    };
  }

  async listOfficeProgramOverrides(actorUserId: string, officeId?: string) {
    const actor = await this.requireUser(actorUserId);
    const office =
      officeId ||
      actor.officeId ||
      (
        await this.offices.findOne({
          where: {
            organizationId: actor.organizationId!,
            status: 'active',
          },
          order: { createdAt: 'ASC' },
        })
      )?.id;
    if (!office) return [];
    const rows = await this.dataSource.query(
      `SELECT c.id, c.office_id, c.applied_overrides, c.program_template_version_id,
              t.id AS template_id, o.code AS office_code
       FROM program_office_customizations c
       JOIN program_template_versions v ON v.id = c.program_template_version_id
       JOIN program_templates t ON t.id = v.program_template_id
       JOIN offices o ON o.id = c.office_id
       WHERE c.office_id = $1
         AND t.organization_id = $2`,
      [office, actor.organizationId],
    );
    return rows.map(
      (r: {
        id: string;
        office_id: string;
        template_id: string;
        applied_overrides: Record<string, unknown>;
        office_code: string;
      }) => ({
        id: r.id,
        region_id: r.office_id,
        template_id: r.template_id,
        local_eligibility_rules: r.applied_overrides ?? {},
        is_active: true,
        region_code: r.office_code,
      }),
    );
  }

  async saveOfficeProgramOverride(
    actorUserId: string,
    templateId: string,
    input: {
      office_id?: string;
      eligibility_note?: string;
      cooldown_days?: number;
    },
  ) {
    const actor = await this.requireUser(actorUserId);
    const template = await this.templates.findOne({ where: { id: templateId } });
    if (!template || template.organizationId !== actor.organizationId) {
      throw new ForbiddenException('Template not found in your organization');
    }
    const officeId = input.office_id || actor.officeId;
    if (!officeId) throw new BadRequestException('office_id is required');
    await this.rbac.assertPermission(
      actorUserId,
      'program_template.override_allowed_fields',
      { organizationId: actor.organizationId, officeId },
    );
    const version = await this.versions.findOne({
      where: { programTemplateId: templateId },
      order: { versionNumber: 'DESC' },
    });
    if (!version) throw new NotFoundException('Template version not found');
    const applied = {
      eligibility_note: input.eligibility_note?.trim() || '',
      ...(input.cooldown_days !== undefined
        ? { cooldown_days: Math.max(0, Number(input.cooldown_days)) }
        : {}),
    };
    await this.dataSource.query(
      `INSERT INTO program_office_customizations
         (program_template_version_id, office_id, applied_overrides)
       VALUES ($1, $2, $3::jsonb)
       ON CONFLICT (program_template_version_id, office_id)
       DO UPDATE SET applied_overrides = EXCLUDED.applied_overrides,
                     updated_at = now()`,
      [version.id, officeId, JSON.stringify(applied)],
    );
    return { ok: true };
  }

  // ── helpers ──────────────────────────────────────────────

  private async loadVersionRules(
    versionId: string,
  ): Promise<Record<string, unknown>> {
    const raw = await this.dataSource.query(
      `SELECT disbursement_rules FROM program_template_versions WHERE id = $1`,
      [versionId],
    );
    return (raw[0]?.disbursement_rules as Record<string, unknown>) ?? {};
  }

  private intervalToDays(interval: string | null | undefined): number {
    if (!interval) return 90;
    const m = String(interval).match(/(\d+)/);
    return m ? Number(m[1]) : 90;
  }

  /**
   * Whether a beneficiary may start/submit a new application for a program.
   * Blocks while another case is in progress, or while the program's
   * disbursement cooldown is still running after a claim/disbursement.
   */
  private async getProgramApplyGate(
    beneficiaryId: string,
    programTemplateId: string,
    cooldownDaysFallback?: number | null,
  ): Promise<{
    can_apply: boolean;
    block_reason: 'in_progress' | 'cooldown' | null;
    message: string | null;
    cooldown_days: number;
    remaining_days: number | null;
    eligible_again_at: string | null;
    last_claimed_at: string | null;
    active_application_id: string | null;
    last_claim_application_id: string | null;
  }> {
    const openRows = await this.dataSource.query<
      Array<{ id: string; status: string }>
    >(
      `SELECT a.id, a.status
       FROM applications a
       JOIN program_template_versions v ON v.id = a.program_template_version_id
       WHERE a.beneficiary_id = $1
         AND v.program_template_id = $2
         AND a.status IN (
           'draft', 'submitted', 'in_evaluation', 'in_approval', 'approved'
         )
       ORDER BY a.updated_at DESC
       LIMIT 1`,
      [beneficiaryId, programTemplateId],
    );

    const claimRows = await this.dataSource.query<
      Array<{
        id: string;
        claimed_at: string | null;
        decided_at: string | null;
        updated_at: string;
        cooldown_period: string | null;
      }>
    >(
      `SELECT a.id,
              c.claimed_at,
              a.decided_at,
              a.updated_at,
              v.cooldown_period
       FROM applications a
       JOIN program_template_versions v ON v.id = a.program_template_version_id
       LEFT JOIN LATERAL (
         SELECT claimed_at
         FROM disbursement_claims dc
         WHERE dc.application_id = a.id
         ORDER BY dc.claimed_at DESC
         LIMIT 1
       ) c ON true
       WHERE a.beneficiary_id = $1
         AND v.program_template_id = $2
         AND a.status IN ('claimed', 'disbursed')
       ORDER BY COALESCE(c.claimed_at, a.decided_at, a.updated_at) DESC
       LIMIT 1`,
      [beneficiaryId, programTemplateId],
    );

    const cooldownDays = Math.max(
      0,
      claimRows[0]
        ? this.intervalToDays(claimRows[0].cooldown_period)
        : (cooldownDaysFallback ?? 90),
    );

    if (openRows[0]) {
      const status = TO_CLIENT_STATUS[openRows[0].status] ?? openRows[0].status;
      return {
        can_apply: false,
        block_reason: 'in_progress',
        message: `You already have an open application for this program (${status}).`,
        cooldown_days: cooldownDays,
        remaining_days: null,
        eligible_again_at: null,
        last_claimed_at: claimRows[0]?.claimed_at ?? null,
        active_application_id: openRows[0].id,
        last_claim_application_id: claimRows[0]?.id ?? null,
      };
    }

    const lastClaim = claimRows[0];
    if (lastClaim && cooldownDays > 0) {
      const startRaw =
        lastClaim.claimed_at ?? lastClaim.decided_at ?? lastClaim.updated_at;
      const start = new Date(startRaw);
      if (!Number.isNaN(start.getTime())) {
        const eligibleAt = new Date(
          start.getTime() + cooldownDays * 86_400_000,
        );
        const remainingMs = eligibleAt.getTime() - Date.now();
        if (remainingMs > 0) {
          const remainingDays = Math.max(1, Math.ceil(remainingMs / 86_400_000));
          return {
            can_apply: false,
            block_reason: 'cooldown',
            message: `You already claimed aid for this program. You can apply again after ${eligibleAt.toISOString().slice(0, 10)} (${remainingDays} day${remainingDays === 1 ? '' : 's'} left of a ${cooldownDays}-day cooldown).`,
            cooldown_days: cooldownDays,
            remaining_days: remainingDays,
            eligible_again_at: eligibleAt.toISOString(),
            last_claimed_at: start.toISOString(),
            active_application_id: null,
            last_claim_application_id: lastClaim.id,
          };
        }
      }
    }

    return {
      can_apply: true,
      block_reason: null,
      message: null,
      cooldown_days: cooldownDays,
      remaining_days: 0,
      eligible_again_at: null,
      last_claimed_at: lastClaim?.claimed_at
        ? new Date(lastClaim.claimed_at).toISOString()
        : null,
      active_application_id: null,
      last_claim_application_id: lastClaim?.id ?? null,
    };
  }

  private async assertCanApplyForProgram(
    beneficiaryId: string,
    programTemplateId: string,
  ) {
    const gate = await this.getProgramApplyGate(
      beneficiaryId,
      programTemplateId,
    );
    if (!gate.can_apply) {
      throw new BadRequestException(
        gate.message ?? 'You cannot apply for this program right now',
      );
    }
    return gate;
  }

  private async requireUser(id: string) {
    const user = await this.users.findOne({ where: { id } });
    if (!user) throw new UnauthorizedException();
    if (!user.isActive || user.status !== 'active') {
      throw new UnauthorizedException('Account is suspended');
    }
    const roles = await this.roleAssignments.find({
      where: { userAccountId: id },
      relations: ['role'],
    });
    if (
      roles.some((assignment) => assignment.role?.code === 'PLATFORM_ADMIN')
    ) {
      throw new ForbiddenException(
        'Platform Administrators cannot access tenant business operations',
      );
    }
    if (user.accountType === 'staff') {
      if (!user.organizationId) {
        throw new ForbiddenException('Staff account has no organization');
      }
      const organization = await this.dataSource.query<
        Array<{ status: string }>
      >(`SELECT status FROM organizations WHERE id = $1 LIMIT 1`, [
        user.organizationId,
      ]);
      if (!organization[0] || organization[0].status !== 'active') {
        throw new ForbiddenException('Organization is suspended or archived');
      }
    }
    return user;
  }

  private async assertRole(userId: string, allowed: string[], message: string) {
    await this.requireUser(userId);
    const assignments = await this.roleAssignments.find({
      where: { userAccountId: userId },
      relations: ['role'],
    });
    const codes = assignments.map((a) => a.role?.code);
    const ok = codes.some((c) => allowed.includes(c ?? ''));
    if (!ok) throw new ForbiddenException(message);
  }

  private async assertStaff(userId: string) {
    await this.assertRole(
      userId,
      ['EVALUATOR', 'APPROVER', 'OFFICE_ADMIN', 'ORG_ADMIN'],
      'Staff role required',
    );
  }

  private async assertEvaluator(userId: string) {
    await this.assertRole(userId, ['EVALUATOR'], 'Evaluator role required');
  }

  private async assertApprover(userId: string) {
    await this.assertRole(userId, ['APPROVER'], 'Approver role required');
  }

  private async buildRbacActor(
    userId: string,
    role: ErdRoleCode,
  ): Promise<RbacActor> {
    const user = await this.requireUser(userId);
    return {
      userId,
      role,
      organizationId: user.organizationId ?? null,
      officeId: user.officeId ?? null,
      beneficiaryId: user.beneficiaryId ?? null,
    };
  }

  private async decideCaseAction(
    userId: string,
    role: ErdRoleCode,
    permission: RbacPermission,
    app: ApplicationEntity,
    assignedUserId?: string | null,
    evaluatedByUserId?: string | null,
  ): Promise<RbacDecision> {
    const actor = await this.buildRbacActor(userId, role);
    return decideRbac(actor, permission, {
      organizationId: app.organizationId,
      officeId: app.officeId,
      assignedUserId: assignedUserId ?? null,
      evaluatedByUserId: evaluatedByUserId ?? null,
    });
  }

  private assertRbacAllowed(decision: RbacDecision) {
    if (!decision.allowed) {
      throw new ForbiddenException(decision.reason);
    }
  }

  private async findPriorEvaluatorUserId(
    applicationId: string,
  ): Promise<string | null> {
    const completed = await this.tasks.find({
      where: { applicationId, status: 'completed' },
      order: { completedAt: 'DESC' },
    });
    for (const task of completed) {
      const step = await this.steps.findOne({
        where: { id: task.workflowStepId },
      });
      if (step?.stepType === 'evaluation' && task.assigneeUserId) {
        return task.assigneeUserId;
      }
    }
    return null;
  }

  private async assertCanAccess(userId: string, app: ApplicationEntity) {
    const user = await this.requireUser(userId);
    if (user.beneficiaryId && user.beneficiaryId === app.beneficiaryId) return;
    try {
      await this.assertStaff(userId);
    } catch {
      throw new ForbiddenException('Not allowed to access this application');
    }
    if (user.organizationId !== app.organizationId) {
      throw new ForbiddenException('Not allowed to access this application');
    }
  }

  private async assertOfficeAcceptsNewWork(officeId: string) {
    const office = await this.offices.findOne({ where: { id: officeId } });
    if (!office || office.status !== 'active') {
      throw new BadRequestException('Office is not available for new work');
    }
  }

  private async requireActionableTask(
    actorUserId: string,
    app: ApplicationEntity,
    stepType: 'evaluation' | 'approval',
  ) {
    const actor = await this.requireUser(actorUserId);
    if (actor.officeId && actor.officeId !== app.officeId) {
      throw new ForbiddenException(
        'Application is assigned to a different office',
      );
    }

    const office = await this.offices.findOne({ where: { id: app.officeId } });
    if (!office) {
      throw new ForbiddenException('Application office is unavailable');
    }

    const pending = await this.tasks.find({
      where: { applicationId: app.id, status: 'pending' },
    });
    for (const task of pending) {
      const step = await this.steps.findOne({
        where: { id: task.workflowStepId },
      });
      if (step?.stepType !== stepType) continue;
      if (
        office.status === 'archived' &&
        (!office.archivedAt || task.createdAt > office.archivedAt)
      ) {
        throw new ForbiddenException(
          'Archived offices cannot receive new work',
        );
      }
      return task;
    }

    throw new ForbiddenException(
      `No pending ${stepType} task is assigned to this application`,
    );
  }

  private async resolveVersion(templateId: string) {
    let version = await this.versions.findOne({
      where: { id: templateId },
    });
    if (version) return version;
    version = await this.versions.findOne({
      where: { programTemplateId: templateId },
      order: { versionNumber: 'DESC' },
    });
    if (!version) throw new BadRequestException('Unknown program template');
    return version;
  }

  private async upsertAnswers(
    applicationId: string,
    versionId: string,
    formData: Record<string, unknown>,
  ) {
    const form = await this.dataSource.query(
      `SELECT id FROM form_definitions WHERE program_template_version_id = $1 LIMIT 1`,
      [versionId],
    );
    const formId = form[0]?.id as string | undefined;
    if (!formId) return;
    const fields = await this.formFields.find({
      where: { formDefinitionId: formId },
    });
    const byKey = new Map(fields.map((f) => [f.fieldKey, f]));

    for (const [key, value] of Object.entries(formData)) {
      const field = byKey.get(key);
      if (!field) continue;
      const existing = await this.answers.findOne({
        where: { applicationId, formFieldId: field.id },
      });
      if (existing) {
        existing.value = value;
        await this.answers.save(existing);
      } else {
        await this.answers.save(
          this.answers.create({
            applicationId,
            formFieldId: field.id,
            value,
          }),
        );
      }
    }
  }

  private async spawnEvaluationTask(app: ApplicationEntity) {
    const office = await this.offices.findOne({ where: { id: app.officeId } });
    if (!office || office.status !== 'active') return;
    await this.ensureDefaultWorkflow(app.programTemplateVersionId);
    const wf = await this.dataSource.query(
      `SELECT id FROM workflow_definitions WHERE program_template_version_id = $1 LIMIT 1`,
      [app.programTemplateVersionId],
    );
    if (!wf[0]?.id) return;
    const step = await this.steps.findOne({
      where: { workflowDefinitionId: wf[0].id, stepType: 'evaluation' },
    });
    if (!step) return;
    const existing = await this.tasks.findOne({
      where: {
        applicationId: app.id,
        workflowStepId: step.id,
        status: 'pending',
      },
    });
    if (existing) return;
    await this.tasks.save(
      this.tasks.create({
        applicationId: app.id,
        workflowStepId: step.id,
        status: 'pending',
      }),
    );
  }

  /** Evaluation → approval workflow when admin creates a program without a builder. */
  private async ensureDefaultWorkflow(
    programTemplateVersionId: string,
    programName?: string,
  ) {
    const existing = await this.dataSource.query<Array<{ id: string }>>(
      `SELECT id FROM workflow_definitions
       WHERE program_template_version_id = $1 LIMIT 1`,
      [programTemplateVersionId],
    );
    let engineId = existing[0]?.id as string | undefined;
    if (!engineId) {
      const created = await this.dataSource.query<Array<{ id: string }>>(
        `INSERT INTO workflow_definitions
           (program_template_version_id, name)
         VALUES ($1, $2)
         RETURNING id`,
        [
          programTemplateVersionId,
          `${programName?.trim() || 'Program'} review flow`,
        ],
      );
      engineId = created[0]?.id;
    }
    if (!engineId) return;

    const steps = await this.dataSource.query<
      Array<{ step_type: string }>
    >(
      `SELECT step_type FROM workflow_steps WHERE workflow_definition_id = $1`,
      [engineId],
    );
    const types = new Set(steps.map((s) => s.step_type));
    if (!types.has('evaluation')) {
      await this.dataSource.query(
        `INSERT INTO workflow_steps
           (workflow_definition_id, step_key, step_type, sort_order)
         VALUES ($1, 'evaluation', 'evaluation', 1)`,
        [engineId],
      );
    }
    if (!types.has('approval')) {
      await this.dataSource.query(
        `INSERT INTO workflow_steps
           (workflow_definition_id, step_key, step_type, sort_order)
         VALUES ($1, 'approval', 'approval', 2)`,
        [engineId],
      );
    }
  }

  private async spawnApprovalTask(app: ApplicationEntity) {
    const office = await this.offices.findOne({ where: { id: app.officeId } });
    if (!office || office.status !== 'active') return;
    await this.ensureDefaultWorkflow(app.programTemplateVersionId);
    const wf = await this.dataSource.query(
      `SELECT id FROM workflow_definitions WHERE program_template_version_id = $1 LIMIT 1`,
      [app.programTemplateVersionId],
    );
    if (!wf[0]?.id) return;
    const step = await this.steps.findOne({
      where: { workflowDefinitionId: wf[0].id, stepType: 'approval' },
    });
    if (!step) return;
    await this.tasks.save(
      this.tasks.create({
        applicationId: app.id,
        workflowStepId: step.id,
        status: 'pending',
      }),
    );
  }

  private async serializeApplication(id: string) {
    const app = await this.applications.findOne({ where: { id } });
    if (!app) throw new NotFoundException('Application not found');

    const beneficiary = await this.beneficiaries.findOne({
      where: { id: app.beneficiaryId },
    });
    const account = await this.users.findOne({
      where: { beneficiary: { id: app.beneficiaryId } },
    });
    const version = await this.versions.findOne({
      where: { id: app.programTemplateVersionId },
    });
    const template = version
      ? await this.templates.findOne({
          where: { id: version.programTemplateId },
        })
      : null;

    const answerRows = await this.dataSource.query(
      `SELECT ff.field_key, aa.value
       FROM application_answers aa
       JOIN form_fields ff ON ff.id = aa.form_field_id
       WHERE aa.application_id = $1`,
      [id],
    );
    const formData: Record<string, unknown> = {};
    for (const row of answerRows) {
      formData[row.field_key] = row.value;
    }

    const rules = version
      ? await this.loadVersionRules(version.id)
      : {};
    const applicantWorkflow = (rules.applicant_workflow ?? null) as {
      stages?: Array<{ name: string; type: string }>;
    } | null;
    const stages =
      applicantWorkflow?.stages?.length
        ? applicantWorkflow.stages
        : defaultApplicantStages();
    const currentStageType = stageTypeFromErdStatus(app.status);
    const answersLocked = app.status !== 'draft';

    const claimRows = await this.dataSource.query<
      Array<{
        id: string;
        claimed_at: string;
        queue_number: number;
        slot_starts_at: string;
        slot_ends_at: string;
        site_name: string | null;
        site_address: string | null;
        face_liveness: Record<string, unknown> | null;
        reference_no: string | null;
      }>
    >(
      `SELECT id, claimed_at, queue_number, slot_starts_at, slot_ends_at,
              site_name, site_address, face_liveness, reference_no
       FROM disbursement_claims
       WHERE application_id = $1
       ORDER BY claimed_at DESC
       LIMIT 1`,
      [id],
    );
    const claim = claimRows[0] ?? null;
    const bookingRows = await this.dataSource.query<
      Array<{
        id: string;
        status: string;
        queue_number: number;
        validated_at: string | null;
        starts_at: string;
        ends_at: string;
        site_name: string | null;
        site_address: string | null;
      }>
    >(
      `SELECT b.id, b.status, b.queue_number, b.validated_at,
              s.starts_at, s.ends_at, s.site_name, s.site_address
       FROM disbursement_bookings b
       JOIN disbursement_slots s ON s.id = b.slot_id
       WHERE b.application_id = $1
       ORDER BY b.updated_at DESC
       LIMIT 1`,
      [id],
    );
    const booking = bookingRows[0] ?? null;

    return {
      id: app.id,
      reference_no: app.referenceNo ?? `APP-${app.id.slice(0, 8)}`,
      customer_id: account?.id ?? app.beneficiaryId,
      submitted_by: account?.id ?? null,
      region_id: app.officeId,
      template_id: template?.id ?? version?.programTemplateId ?? '',
      program_template_version_id: app.programTemplateVersionId,
      status: TO_CLIENT_STATUS[app.status] ?? app.status,
      erd_status: app.status,
      form_data: formData,
      form_fields: await this.serializeFormFieldMeta(app.programTemplateVersionId),
      stages,
      current_stage_type: currentStageType,
      answers_locked: answersLocked,
      period_windows: normalizePeriodWindows(
        (rules.period_windows as PeriodWindows) ?? null,
      ),
      amount_requested: app.amountRequested
        ? Number(app.amountRequested)
        : null,
      amount_approved: app.amountApproved ? Number(app.amountApproved) : null,
      priority: 'medium',
      evaluator_notes: app.evaluatorNotes,
      approver_notes: app.approverNotes,
      submitted_at: app.submittedAt?.toISOString() ?? null,
      decided_at: app.decidedAt?.toISOString() ?? null,
      created_at: app.createdAt?.toISOString() ?? null,
      profiles: beneficiary
        ? {
            full_name: beneficiary.fullName,
            id: account?.id,
            email: account?.email ?? null,
            phone: beneficiary.phone ?? null,
            birth_date: beneficiary.dateOfBirth ?? null,
            address: beneficiary.address ?? null,
            municipality: beneficiary.municipality ?? null,
            barangay: beneficiary.barangay ?? null,
          }
        : null,
      program_templates: template
        ? { id: template.id, name: template.name, code: template.code }
        : null,
      customer_name: beneficiary?.fullName ?? null,
      customer_email: account?.email ?? null,
      customer_phone: beneficiary?.phone ?? null,
      customer_birth_date: beneficiary?.dateOfBirth ?? null,
      customer_address: beneficiary?.address ?? null,
      customer_municipality: beneficiary?.municipality ?? null,
      customer_barangay: beneficiary?.barangay ?? null,
      template_name: template?.name ?? null,
      template_code: template?.code ?? null,
      disbursement_claim: claim
        ? {
            id: claim.id,
            claimed_at: claim.claimed_at,
            queue_number: claim.queue_number,
            slot_starts_at: claim.slot_starts_at,
            slot_ends_at: claim.slot_ends_at,
            site_name: claim.site_name,
            site_address: claim.site_address,
            face_liveness_passed: Boolean(
              claim.face_liveness &&
                (claim.face_liveness.face_match_pending === true ||
                  String(claim.face_liveness.status ?? '')
                    .toUpperCase()
                    .includes('SUCCEED')),
            ),
            status: 'claimed',
          }
        : null,
      disbursement_booking: booking
        ? {
            id: booking.id,
            status: booking.status,
            queue_number: booking.queue_number,
            validated_at: booking.validated_at,
            slot_starts_at: booking.starts_at,
            slot_ends_at: booking.ends_at,
            site_name: booking.site_name,
            site_address: booking.site_address,
          }
        : null,
    };
  }

  private async serializeFormFieldMeta(versionId: string) {
    const form = await this.dataSource.query<Array<{ id: string }>>(
      `SELECT id FROM form_definitions WHERE program_template_version_id = $1 LIMIT 1`,
      [versionId],
    );
    if (!form[0]?.id) return [];
    const fields = await this.formFields.find({
      where: { formDefinitionId: form[0].id },
      order: { sortOrder: 'ASC' },
    });
    return fields.map((f) => ({
      key: f.fieldKey,
      type: f.fieldType,
      label: String((f.config as { label?: string })?.label ?? f.fieldKey),
      help_text: String((f.config as { help_text?: string })?.help_text ?? ''),
      required: f.required,
      options: Array.isArray((f.config as { options?: unknown })?.options)
        ? (f.config as { options: string[] }).options
        : [],
    }));
  }

  private async serializeRelationship(r: RelationshipEntity) {
    const requester = await this.beneficiaries.findOne({
      where: { id: r.requesterBeneficiaryId },
    });
    const related = await this.beneficiaries.findOne({
      where: { id: r.relatedBeneficiaryId },
    });
    const principalAccount = await this.users.findOne({
      where: { beneficiary: { id: r.requesterBeneficiaryId } },
    });
    const dependentAccount = await this.users.findOne({
      where: { beneficiary: { id: r.relatedBeneficiaryId } },
    });
    const documents = await this.dataSource.query<
      Array<{ id: string; document_type: string; storage_uri: string }>
    >(
      `SELECT id, document_type, storage_uri
       FROM relationship_documents
       WHERE relationship_id = $1
       ORDER BY created_at ASC`,
      [r.id],
    );
    return {
      id: r.id,
      principal_id: principalAccount?.id ?? r.requesterBeneficiaryId,
      dependent_id: dependentAccount?.id ?? r.relatedBeneficiaryId,
      relationship: r.type,
      is_notarized: documents.length > 0,
      is_validated: r.status === 'approved',
      status: r.status,
      notes: null,
      documents,
      dependent: related ? { full_name: related.fullName } : null,
      principal: requester ? { full_name: requester.fullName } : null,
    };
  }
}
