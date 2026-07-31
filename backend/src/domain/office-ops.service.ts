import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AuthService } from '../auth/auth.service';
import { RbacAccessService } from '../auth/rbac-access.service';
import { BeneficiaryEntity } from '../users/beneficiary.entity';
import { UserAccountEntity } from '../users/user.entity';
import { ApplicationEntity } from './domain.entities';
import {
  assertDisbursementPeriodOpen,
  assertRebookAllowed,
  assertSlotMeetsLeadTime,
  assertSlotWithinDisbursementWindow,
  earliestBookableSlotStart,
  normalizePeriodWindows,
  type PeriodWindows,
} from './period-windows';

@Injectable()
export class OfficeOpsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly rbac: RbacAccessService,
    private readonly auth: AuthService,
    @InjectRepository(UserAccountEntity)
    private readonly users: Repository<UserAccountEntity>,
    @InjectRepository(BeneficiaryEntity)
    private readonly beneficiaries: Repository<BeneficiaryEntity>,
    @InjectRepository(ApplicationEntity)
    private readonly applications: Repository<ApplicationEntity>,
  ) {}

  private async requireUser(id: string) {
    const user = await this.users.findOne({ where: { id } });
    if (!user || !user.isActive || user.status !== 'active') {
      throw new ForbiddenException('Account required');
    }
    return user;
  }

  private async defaultOrgId(): Promise<string> {
    const rows = await this.dataSource.query<Array<{ id: string }>>(
      `SELECT id FROM organizations WHERE code = 'DSWD' LIMIT 1`,
    );
    if (!rows[0]?.id) throw new BadRequestException('Organization missing');
    return rows[0].id;
  }

  // ── Notifications ──────────────────────────────────────────

  async createInAppNotification(input: {
    organizationId: string;
    userAccountId: string;
    applicationId?: string | null;
    eventType: 'outcome' | 'status' | 'otp' | 'other';
    title: string;
    body: string;
    payload?: Record<string, unknown>;
    mandatory?: boolean;
  }) {
    const rows = await this.dataSource.query<Array<{ id: string }>>(
      `INSERT INTO notifications
         (organization_id, user_account_id, application_id, channel, event_type,
          mandatory, status, title, body, payload, sent_at)
       VALUES ($1, $2, $3, 'in_app', $4, $5, 'sent', $6, $7, $8::jsonb, now())
       RETURNING id`,
      [
        input.organizationId,
        input.userAccountId,
        input.applicationId ?? null,
        input.eventType,
        input.mandatory ?? true,
        input.title,
        input.body,
        JSON.stringify(input.payload ?? {}),
      ],
    );
    return rows[0];
  }

  async notifyApplicationApproved(app: ApplicationEntity) {
    const account = await this.users.findOne({
      where: { beneficiary: { id: app.beneficiaryId } },
    });
    if (!account) return;

    const details = await this.loadApprovalGuidance(app);
    const title = 'Application approved — next: schedule your aid';
    const body = this.buildApprovalInAppBody(details);
    const sms = this.buildApprovalSmsBody(details);

    await this.createInAppNotification({
      organizationId: app.organizationId,
      userAccountId: account.id,
      applicationId: app.id,
      eventType: 'outcome',
      title,
      body,
      payload: {
        action: 'schedule_disbursement',
        application_id: app.id,
        office_id: app.officeId,
        reference_no: details.referenceNo,
        program_name: details.programName,
        program_code: details.programCode,
        claim_location: details.claimLocation,
        claim_address: details.claimAddress,
        handling_office: details.handlingOfficeName,
        has_program_claim_site: details.hasProgramClaimSite,
        disbursement_start: details.disbursementStart,
        disbursement_end: details.disbursementEnd,
        next_queue_starts_at: details.slotStartsAt,
        next_queue_ends_at: details.slotEndsAt,
        has_booking: details.hasBooking,
      },
    });
    await this.sendOutcomeSms(app.beneficiaryId, sms);
  }

  async notifyApplicationDeclined(app: ApplicationEntity, notes?: string | null) {
    const account = await this.users.findOne({
      where: { beneficiary: { id: app.beneficiaryId } },
    });
    if (!account) return;
    const title = 'Application declined';
    const body = notes?.trim()
      ? `Your application was declined. Notes: ${notes.trim()}. You may apply again when eligible.`
      : 'Your application was declined. You may apply again when eligible for the program.';
    await this.createInAppNotification({
      organizationId: app.organizationId,
      userAccountId: account.id,
      applicationId: app.id,
      eventType: 'outcome',
      title,
      body,
      payload: {
        action: 'application_declined',
        application_id: app.id,
      },
    });
    await this.sendOutcomeSms(app.beneficiaryId, body);
  }

  private async loadApprovalGuidance(app: ApplicationEntity) {
    const office = await this.dataSource.query<
      Array<{
        name: string;
        address: string | null;
        map_label: string | null;
      }>
    >(
      `SELECT name, address, map_label FROM offices WHERE id = $1`,
      [app.officeId],
    );
    const prog = await this.dataSource.query<
      Array<{
        name: string;
        code: string;
        program_template_id: string;
        disbursement_rules: Record<string, unknown> | null;
      }>
    >(
      `SELECT t.name, t.code, t.id AS program_template_id, v.disbursement_rules
       FROM program_template_versions v
       JOIN program_templates t ON t.id = v.program_template_id
       WHERE v.id = $1`,
      [app.programTemplateVersionId],
    );
    const windows = normalizePeriodWindows(
      (prog[0]?.disbursement_rules?.period_windows as PeriodWindows) ?? null,
    );
    const programTemplateId = prog[0]?.program_template_id ?? null;

    // Prefer an existing booking for THIS application only.
    type SlotHint = {
      site_name: string | null;
      site_address: string | null;
      starts_at: string;
      ends_at: string;
      label: string | null;
      queue_number: number | null;
      source: 'booking' | 'program_slot';
    };
    const booking = await this.dataSource.query<
      Array<Omit<SlotHint, 'source'> & { source?: string }>
    >(
      `SELECT s.site_name, s.site_address, s.starts_at, s.ends_at, s.label,
              b.queue_number
       FROM disbursement_bookings b
       JOIN disbursement_slots s ON s.id = b.slot_id
       WHERE b.application_id = $1
         AND b.status IN ('booked', 'validated', 'claimed')
       ORDER BY b.created_at DESC
       LIMIT 1`,
      [app.id],
    );

    // Next open cash-window for THIS program only — never reuse another
    // program's slot or a stale office map_label from a prior cash site.
    let sites: SlotHint[] = booking[0]
      ? [{ ...booking[0], source: 'booking' }]
      : [];
    if (!sites[0] && programTemplateId) {
      const programSlots = await this.dataSource.query<
        Array<Omit<SlotHint, 'source'>>
      >(
        `SELECT site_name, site_address, starts_at, ends_at, label,
                NULL::int AS queue_number
         FROM disbursement_slots
         WHERE office_id = $1
           AND status = 'open'
           AND ends_at > now()
           AND program_template_id = $2
           AND COALESCE(NULLIF(TRIM(site_name), ''), NULLIF(TRIM(site_address), ''))
               IS NOT NULL
         ORDER BY starts_at ASC
         LIMIT 1`,
        [app.officeId, programTemplateId],
      );
      if (programSlots[0]) {
        sites = [{ ...programSlots[0], source: 'program_slot' }];
      }
    }

    const siteName = sites[0]?.site_name?.trim() || null;
    const siteAddress = sites[0]?.site_address?.trim() || null;
    const hasBooking = Boolean(booking[0]);
    const hasProgramClaimSite = Boolean(siteName || siteAddress);

    // Handling office (org unit) — not the cash-window claim site.
    // Do not use office.map_label/address here: those may still hold a prior
    // program's cash site after admin edits.
    const handlingOfficeName = office[0]?.name?.trim() || 'your regional office';

    return {
      referenceNo: app.referenceNo ?? `APP-${app.id.slice(0, 8)}`,
      programName: prog[0]?.name ?? 'your program',
      programCode: prog[0]?.code ?? '',
      claimLocation: hasProgramClaimSite ? siteName || handlingOfficeName : null,
      claimAddress: hasProgramClaimSite ? siteAddress : null,
      handlingOfficeName,
      disbursementStart: windows?.disbursement_start ?? null,
      disbursementEnd: windows?.disbursement_end ?? null,
      slotStartsAt: sites[0]?.starts_at ?? null,
      slotEndsAt: sites[0]?.ends_at ?? null,
      slotLabel: sites[0]?.label?.trim() || null,
      queueNumber: sites[0]?.queue_number ?? null,
      hasBooking,
      hasProgramClaimSite,
    };
  }

  /** Normalize PG / ISO timestamps so Date() always parses. */
  private parseTimestamp(iso: string | null | undefined): Date | null {
    if (!iso) return null;
    const raw = String(iso).trim();
    if (!raw) return null;
    let d = new Date(raw);
    if (!Number.isNaN(d.getTime())) return d;
    // Postgres often returns "+00" / " 01:00:00+00" without minutes in offset.
    const fixed = raw
      .replace(' ', 'T')
      .replace(/([+-]\d{2})$/, '$1:00')
      .replace(/([+-]\d{2})(\d{2})$/, '$1:$2');
    d = new Date(fixed);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  /** Date+time in Asia/Manila for a concrete queue slot. */
  private formatPhDateTime(iso: string | null): string | null {
    const d = this.parseTimestamp(iso);
    if (!d) return null;
    return new Intl.DateTimeFormat('en-PH', {
      timeZone: 'Asia/Manila',
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(d);
  }

  /** Concrete queue slot day + time range (Asia/Manila). */
  private formatQueueSlotLine(
    slotStartsAt?: string | null,
    slotEndsAt?: string | null,
    slotLabel?: string | null,
  ): string | null {
    const startDt = this.parseTimestamp(slotStartsAt ?? null);
    const endDt = this.parseTimestamp(slotEndsAt ?? null);
    if (!startDt || !endDt) return null;
    const dayFmt = new Intl.DateTimeFormat('en-PH', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
    const todFmt = new Intl.DateTimeFormat('en-PH', {
      timeZone: 'Asia/Manila',
      hour: 'numeric',
      minute: '2-digit',
    });
    const startDay = dayFmt.format(startDt);
    const endDay = dayFmt.format(endDt);
    const range =
      startDay === endDay
        ? `${startDay}, ${todFmt.format(startDt)} – ${todFmt.format(endDt)}`
        : `${this.formatPhDateTime(slotStartsAt!)} – ${this.formatPhDateTime(slotEndsAt!)}`;
    const label = slotLabel?.trim();
    return label ? `${range} (${label})` : range;
  }

  /**
   * Period windows are calendar days (often stored as UTC midnight / 23:59).
   * Show the ISO calendar date in PH locale — never clock times that shift a day
   * across Asia/Manila (e.g. Aug 31 23:59Z → Sep 1 7:59 AM).
   */
  private formatPhPeriodDay(iso: string | null): string | null {
    if (!iso) return null;
    const m = iso.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return null;
      return new Intl.DateTimeFormat('en-PH', {
        timeZone: 'Asia/Manila',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }).format(d);
    }
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const day = Number(m[3]);
    // Noon UTC keeps the calendar day stable in Asia/Manila.
    const d = new Date(Date.UTC(y, mo - 1, day, 12, 0, 0));
    return new Intl.DateTimeFormat('en-PH', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(d);
  }

  private formatDisbursementPeriod(
    start: string | null,
    end: string | null,
  ): string {
    const s = this.formatPhPeriodDay(start);
    const e = this.formatPhPeriodDay(end);
    if (s && e) return `${s} to ${e}`;
    if (s) return `from ${s}`;
    if (e) return `until ${e}`;
    return 'See EHelp for the official disbursement window';
  }

  private programLabel(d: { programName: string; programCode?: string }) {
    const code = d.programCode?.trim();
    return code ? `${d.programName} (${code})` : d.programName;
  }

  private buildApprovalInAppBody(d: {
    referenceNo: string;
    programName: string;
    programCode?: string;
    claimLocation: string | null;
    claimAddress: string | null;
    handlingOfficeName: string;
    hasProgramClaimSite?: boolean;
    disbursementStart: string | null;
    disbursementEnd: string | null;
    slotStartsAt?: string | null;
    slotEndsAt?: string | null;
    slotLabel?: string | null;
    queueNumber?: number | null;
    hasBooking?: boolean;
  }): string {
    const program = this.programLabel(d);
    const window = this.formatDisbursementPeriod(
      d.disbursementStart,
      d.disbursementEnd,
    );
    const queue = this.formatQueueSlotLine(
      d.slotStartsAt,
      d.slotEndsAt,
      d.slotLabel,
    );
    const lines = [
      `Good news: your ${program} application was approved.`,
      `Application: ${d.referenceNo}`,
      '',
      'Next step:',
      d.hasBooking
        ? '1) Your queue slot is already booked — open EHelp → Disbursement QR on claim day.'
        : '1) Open EHelp → Schedule disbursement and book a queue slot for this application.',
      '2) Book at least 2 days ahead when choosing a new slot.',
      '3) On claim day, show your Disbursement QR only to the Office Admin at the cash window.',
      '',
    ];
    if (d.hasProgramClaimSite && d.claimLocation) {
      lines.push(`Claim location: ${d.claimLocation}`);
      if (d.claimAddress) lines.push(`Address: ${d.claimAddress}`);
    } else {
      lines.push(
        `Handling office: ${d.handlingOfficeName}`,
        'Claim location: see available queue sites for this program in EHelp → Schedule (booked site is shown after you reserve a slot).',
      );
    }
    lines.push(`Disbursement window: ${window}`);
    if (queue) {
      lines.push(
        d.hasBooking
          ? `Your booked queue: ${queue}${d.queueNumber != null ? ` · Queue #${d.queueNumber}` : ''}`
          : `Next open queue for this program: ${queue}`,
      );
    }
    lines.push(
      '',
      'What to bring:',
      '• Valid government-issued ID matching your profile',
      '• Your phone with the EHelp Disbursement QR (after you book)',
      `• Application reference ${d.referenceNo}`,
      '',
      'Reminders:',
      '• Rebooking locks within 2 days of your scheduled slot.',
      '• Arrive on time for your queue number; late arrivals may need to rebook.',
      '• Do not share your claim QR outside the cash window.',
    );
    return lines.join('\n');
  }

  private buildApprovalSmsBody(d: {
    referenceNo: string;
    programName: string;
    programCode?: string;
    claimLocation: string | null;
    claimAddress: string | null;
    handlingOfficeName: string;
    hasProgramClaimSite?: boolean;
    disbursementStart: string | null;
    disbursementEnd: string | null;
    slotStartsAt?: string | null;
    slotEndsAt?: string | null;
    slotLabel?: string | null;
    queueNumber?: number | null;
    hasBooking?: boolean;
  }): string {
    const program = this.programLabel(d);
    const window = this.formatDisbursementPeriod(
      d.disbursementStart,
      d.disbursementEnd,
    );
    const queue = this.formatQueueSlotLine(
      d.slotStartsAt,
      d.slotEndsAt,
      d.slotLabel,
    );
    const parts = [
      `EHelp: APPROVED`,
      `Program: ${program}`,
      `Application: ${d.referenceNo}`,
      '',
    ];
    if (d.hasProgramClaimSite && d.claimLocation) {
      parts.push(`Claim location: ${d.claimLocation}`);
      if (d.claimAddress) {
        parts.push(`Address: ${this.shortAddress(d.claimAddress)}`);
      }
    } else {
      parts.push(
        `Handling office: ${d.handlingOfficeName}`,
        'Claim location: open EHelp > Schedule and book a queue slot for this program to see the cash site.',
      );
    }
    parts.push(`Disbursement window: ${window}`);
    if (queue) {
      parts.push(
        d.hasBooking
          ? `Your booked queue: ${queue}${d.queueNumber != null ? ` · #${d.queueNumber}` : ''}`
          : `Next open queue: ${queue}`,
      );
    }
    parts.push(
      '',
      d.hasBooking
        ? 'Open EHelp > Disbursement QR on claim day. Bring valid ID. Only Office Admin may scan it.'
        : 'Next: Open EHelp > Schedule disbursement and book a slot for this application. Bring valid ID + Disbursement QR on claim day.',
    );
    return parts.join('\n');
  }

  /** Keep SMS address readable (full OSM lines are too long). */
  private shortAddress(address: string): string {
    const parts = address
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length <= 4) return address;
    return parts.slice(0, 4).join(', ');
  }

  /** Best-effort SMS via eMessage; never fails the case decision. */
  private async sendOutcomeSms(beneficiaryId: string, message: string) {
    const token = process.env.EMESSAGE_ACCESS_TOKEN?.trim();
    if (!token) return;
    const beneficiary = await this.beneficiaries.findOne({
      where: { id: beneficiaryId },
    });
    const number = beneficiary?.phone?.trim();
    if (!number) return;
    const base = (
      process.env.EMESSAGE_BASE_URL?.trim() ||
      'https://ws-message.e.gov.ph'
    ).replace(/\/$/, '');
    try {
      const res = await fetch(`${base}/messaging/v1/sms/push`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-EMESSAGE-Auth': token,
          Accept: 'application/json',
        },
        // Allow multi-segment informational SMS (was capped too tightly at 320).
        body: JSON.stringify({ number, message: message.slice(0, 900) }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        // Soft-fail: case decision already committed.
        console.warn(
          `[eMessage] SMS push failed ${res.status} ${base}: ${text.slice(0, 200)}`,
        );
      } else {
        console.log(`[eMessage] SMS pushed to ${number.slice(0, 6)}… via ${base}`);
      }
    } catch (err) {
      const cause =
        err instanceof Error && 'cause' in err && err.cause instanceof Error
          ? `${err.message}: ${err.cause.message}`
          : err instanceof Error
            ? err.message
            : String(err);
      console.warn(`[eMessage] SMS push error (${base}): ${cause}`);
    }
  }

  async listMyNotifications(actorUserId: string) {
    const rows = await this.dataSource.query<
      Array<{
        id: string;
        title: string | null;
        body: string | null;
        event_type: string;
        status: string;
        payload: Record<string, unknown>;
        application_id: string | null;
        read_at: string | null;
        created_at: string;
      }>
    >(
      `SELECT id, title, body, event_type, status, payload, application_id,
              read_at, created_at
       FROM notifications
       WHERE user_account_id = $1 AND channel = 'in_app'
       ORDER BY created_at DESC
       LIMIT 50`,
      [actorUserId],
    );
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      body: r.body,
      event_type: r.event_type,
      status: r.status,
      payload: r.payload ?? {},
      application_id: r.application_id,
      read_at: r.read_at,
      created_at: r.created_at,
    }));
  }

  async markNotificationRead(actorUserId: string, id: string) {
    await this.dataSource.query(
      `UPDATE notifications SET read_at = now()
       WHERE id = $1 AND user_account_id = $2 AND read_at IS NULL`,
      [id, actorUserId],
    );
    return { ok: true };
  }

  // ── Profile change requests ────────────────────────────────

  async requestProfileChange(
    actorUserId: string,
    input: {
      description: string;
      proposed_changes: Record<string, unknown>;
      documents?: Array<{ document_type: string; storage_uri: string }>;
    },
  ) {
    const actor = await this.requireUser(actorUserId);
    if (!actor.beneficiaryId) {
      throw new ForbiddenException('Only beneficiaries may request profile changes');
    }
    await this.rbac.assertPermission(actorUserId, 'profile_change.request', {
      beneficiaryId: actor.beneficiaryId,
    });

    const description = (input.description ?? '').trim();
    if (description.length < 10) {
      throw new BadRequestException(
        'Description must explain why the details need to change (min 10 characters)',
      );
    }
    const changes = input.proposed_changes ?? {};
    if (!Object.keys(changes).length) {
      throw new BadRequestException('proposed_changes is required');
    }
    const docs = (input.documents ?? []).filter(
      (d) => d.document_type?.trim() && d.storage_uri?.trim(),
    );
    if (!docs.length) {
      throw new BadRequestException(
        'At least one proof document is required for a profile change request',
      );
    }

    const pending = await this.dataSource.query<Array<{ id: string }>>(
      `SELECT id FROM profile_change_requests
       WHERE beneficiary_id = $1 AND status = 'pending' LIMIT 1`,
      [actor.beneficiaryId],
    );
    if (pending[0]) {
      throw new BadRequestException(
        'You already have a pending profile change request',
      );
    }

    const orgId = actor.organizationId ?? (await this.defaultOrgId());
    const latestApp = await this.applications.findOne({
      where: { beneficiaryId: actor.beneficiaryId },
      order: { createdAt: 'DESC' },
    });
    const officeId = latestApp?.officeId ?? null;

    const inserted = await this.dataSource.query<Array<{ id: string }>>(
      `INSERT INTO profile_change_requests
         (organization_id, office_id, beneficiary_id, requested_by_user_id,
          description, proposed_changes, status)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, 'pending')
       RETURNING id`,
      [
        orgId,
        officeId,
        actor.beneficiaryId,
        actorUserId,
        description,
        JSON.stringify(changes),
      ],
    );
    const requestId = inserted[0].id;
    for (const doc of docs) {
      await this.dataSource.query(
        `INSERT INTO profile_change_documents
           (request_id, document_type, storage_uri)
         VALUES ($1, $2, $3)`,
        [requestId, doc.document_type.trim(), doc.storage_uri.trim()],
      );
    }
    return this.serializeProfileChangeRequest(requestId);
  }

  async listMyProfileChangeRequests(actorUserId: string) {
    const actor = await this.requireUser(actorUserId);
    if (!actor.beneficiaryId) return [];
    const rows = await this.dataSource.query<Array<{ id: string }>>(
      `SELECT id FROM profile_change_requests
       WHERE beneficiary_id = $1
       ORDER BY created_at DESC`,
      [actor.beneficiaryId],
    );
    return Promise.all(rows.map((r) => this.serializeProfileChangeRequest(r.id)));
  }

  async listPendingProfileChangeRequests(actorUserId: string) {
    const actor = await this.requireUser(actorUserId);
    if (!actor.organizationId) {
      throw new ForbiddenException('Organization scope required');
    }
    await this.rbac.assertPermission(actorUserId, 'profile_change.approve', {
      organizationId: actor.organizationId,
      officeId: actor.officeId,
    });

    const rows = await this.dataSource.query<Array<{ id: string }>>(
      actor.officeId
        ? `SELECT id FROM profile_change_requests
           WHERE status = 'pending'
             AND organization_id = $1
             AND (office_id IS NULL OR office_id = $2)
           ORDER BY created_at ASC`
        : `SELECT id FROM profile_change_requests
           WHERE status = 'pending'
             AND organization_id = $1
           ORDER BY created_at ASC`,
      actor.officeId
        ? [actor.organizationId, actor.officeId]
        : [actor.organizationId],
    );
    return Promise.all(rows.map((r) => this.serializeProfileChangeRequest(r.id)));
  }

  async decideProfileChangeRequest(
    actorUserId: string,
    requestId: string,
    input: { approve: boolean; notes?: string },
  ) {
    const actor = await this.requireUser(actorUserId);
    if (!actor.organizationId) {
      throw new ForbiddenException('Organization scope required');
    }

    const rows = await this.dataSource.query<
      Array<{
        id: string;
        organization_id: string;
        office_id: string | null;
        beneficiary_id: string;
        status: string;
        proposed_changes: Record<string, unknown>;
        requested_by_user_id: string;
      }>
    >(
      `SELECT id, organization_id, office_id, beneficiary_id, status,
              proposed_changes, requested_by_user_id
       FROM profile_change_requests WHERE id = $1`,
      [requestId],
    );
    const req = rows[0];
    if (!req) throw new NotFoundException('Profile change request not found');
    if (req.status !== 'pending') {
      throw new BadRequestException('Request is not pending');
    }

    const officeId = req.office_id ?? actor.officeId ?? undefined;
    await this.rbac.assertPermission(actorUserId, 'profile_change.approve', {
      organizationId: req.organization_id,
      officeId,
    });

    const docs = await this.dataSource.query<Array<{ id: string }>>(
      `SELECT id FROM profile_change_documents WHERE request_id = $1 LIMIT 1`,
      [requestId],
    );
    if (!docs.length) {
      throw new BadRequestException('Cannot decide without proof documents');
    }

    if (input.approve) {
      await this.applyProposedChanges(req.beneficiary_id, req.proposed_changes);
    }

    await this.dataSource.query(
      `UPDATE profile_change_requests
       SET status = $2,
           reviewed_by_user_id = $3,
           review_notes = $4,
           reviewed_at = now(),
           office_id = COALESCE(office_id, $5),
           updated_at = now()
       WHERE id = $1`,
      [
        requestId,
        input.approve ? 'approved' : 'rejected',
        actorUserId,
        input.notes ?? null,
        actor.officeId,
      ],
    );

    await this.createInAppNotification({
      organizationId: req.organization_id,
      userAccountId: req.requested_by_user_id,
      eventType: 'status',
      title: input.approve
        ? 'Profile change approved'
        : 'Profile change rejected',
      body: input.approve
        ? 'Office Admin approved your detail change. Your records were updated.'
        : `Office Admin rejected your detail change.${input.notes ? ` Notes: ${input.notes}` : ''}`,
      payload: { action: 'profile_change', request_id: requestId },
    });

    return this.serializeProfileChangeRequest(requestId);
  }

  private async applyProposedChanges(
    beneficiaryId: string,
    changes: Record<string, unknown> | string | null | undefined,
  ) {
    const parsed: Record<string, unknown> =
      typeof changes === 'string'
        ? (JSON.parse(changes) as Record<string, unknown>)
        : changes && typeof changes === 'object'
          ? changes
          : {};

    // Accept snake_case (API) and camelCase aliases from clients.
    const aliases: Record<string, string> = {
      full_name: 'full_name',
      fullName: 'full_name',
      phone: 'phone',
      contact: 'phone',
      contact_number: 'phone',
      address: 'address',
      municipality: 'municipality',
      barangay: 'barangay',
      date_of_birth: 'date_of_birth',
      dateOfBirth: 'date_of_birth',
      birth_date: 'date_of_birth',
    };

    const normalized: Record<string, string> = {};
    for (const [rawKey, rawVal] of Object.entries(parsed)) {
      const key = aliases[rawKey];
      if (!key || rawVal == null) continue;
      const value = String(rawVal).trim();
      if (!value) continue;
      normalized[key] = value;
    }

    if (!Object.keys(normalized).length) {
      throw new BadRequestException(
        'Approved request had no valid profile fields to apply',
      );
    }

    const sets: string[] = [];
    const params: unknown[] = [beneficiaryId];
    const push = (column: string, value: string) => {
      params.push(value);
      sets.push(`${column} = $${params.length}`);
    };

    if (normalized.full_name) push('full_name', normalized.full_name);
    if (normalized.phone) push('phone', normalized.phone);
    if (normalized.address) push('address', normalized.address);
    if (normalized.municipality) push('municipality', normalized.municipality);
    if (normalized.barangay) push('barangay', normalized.barangay);
    if (normalized.date_of_birth) {
      push('date_of_birth', normalized.date_of_birth);
    }

    // Keep locked — only office-mediated writes are allowed after this.
    sets.push('profile_locked = true');
    sets.push('updated_at = now()');

    // TypeORM + pg may return either rows[] or [rows, rowCount].
    const raw = await this.dataSource.query(
      `UPDATE beneficiaries
       SET ${sets.join(', ')}
       WHERE id = $1
       RETURNING id`,
      params,
    );
    const rows: Array<{ id: string }> = Array.isArray(raw?.[0])
      ? (raw[0] as Array<{ id: string }>)
      : Array.isArray(raw)
        ? (raw as Array<{ id: string }>)
        : [];
    if (!rows[0]?.id) {
      throw new NotFoundException('Beneficiary not found');
    }
  }

  private async serializeProfileChangeRequest(id: string) {
    const rows = await this.dataSource.query<
      Array<{
        id: string;
        organization_id: string;
        office_id: string | null;
        beneficiary_id: string;
        requested_by_user_id: string;
        description: string;
        proposed_changes: Record<string, unknown>;
        status: string;
        review_notes: string | null;
        reviewed_at: string | null;
        created_at: string;
      }>
    >(
      `SELECT id, organization_id, office_id, beneficiary_id, requested_by_user_id,
              description, proposed_changes, status, review_notes, reviewed_at, created_at
       FROM profile_change_requests WHERE id = $1`,
      [id],
    );
    const r = rows[0];
    if (!r) throw new NotFoundException('Profile change request not found');
    const beneficiary = await this.beneficiaries.findOne({
      where: { id: r.beneficiary_id },
    });
    const docs = await this.dataSource.query<
      Array<{ id: string; document_type: string; storage_uri: string }>
    >(
      `SELECT id, document_type, storage_uri FROM profile_change_documents
       WHERE request_id = $1`,
      [id],
    );
    return {
      id: r.id,
      organization_id: r.organization_id,
      office_id: r.office_id,
      beneficiary_id: r.beneficiary_id,
      beneficiary_name: beneficiary?.fullName ?? null,
      requested_by_user_id: r.requested_by_user_id,
      description: r.description,
      proposed_changes: r.proposed_changes ?? {},
      status: r.status,
      review_notes: r.review_notes,
      reviewed_at: r.reviewed_at,
      created_at: r.created_at,
      documents: docs,
    };
  }

  // ── Disbursement slots ─────────────────────────────────────

  async createDisbursementSlot(
    actorUserId: string,
    input: {
      starts_at: string;
      ends_at: string;
      program_template_id: string;
      capacity?: number;
      label?: string;
      office_id?: string;
      site_name?: string;
      site_address?: string;
      latitude?: number;
      longitude?: number;
    },
  ) {
    const actor = await this.requireUser(actorUserId);
    if (!actor.organizationId) {
      throw new ForbiddenException('Organization scope required');
    }

    let officeId = input.office_id?.trim() || actor.officeId || null;
    if (!officeId) {
      // Organization Admin has no personal office — use the sole active office,
      // or require an explicit office_id when multiple offices exist.
      const orgOffices = await this.dataSource.query<Array<{ id: string }>>(
        `SELECT id FROM offices
         WHERE organization_id = $1 AND status = 'active'
         ORDER BY name ASC`,
        [actor.organizationId],
      );
      if (orgOffices.length === 1) {
        officeId = orgOffices[0].id;
      } else if (orgOffices.length === 0) {
        throw new BadRequestException(
          'No active office in your organization. Create an office first.',
        );
      } else {
        throw new BadRequestException(
          'Select an office (office_id) — Organization Admins manage slots per office.',
        );
      }
    }

    // Ensure the office belongs to this organization.
    const officeRow = await this.dataSource.query<
      Array<{ id: string; organization_id: string; status: string }>
    >(
      `SELECT id, organization_id, status FROM offices WHERE id = $1`,
      [officeId],
    );
    if (!officeRow[0] || officeRow[0].status !== 'active') {
      throw new BadRequestException('Office is not available');
    }
    if (officeRow[0].organization_id !== actor.organizationId) {
      throw new ForbiddenException('Office is outside your organization');
    }

    await this.rbac.assertPermission(actorUserId, 'disbursement_slot.manage', {
      organizationId: actor.organizationId,
      officeId,
    });

    if (!input.program_template_id?.trim()) {
      throw new BadRequestException(
        'program_template_id is required so slots stay inside that program’s disbursement window',
      );
    }

    const starts = new Date(input.starts_at);
    const ends = new Date(input.ends_at);
    if (Number.isNaN(starts.getTime()) || Number.isNaN(ends.getTime())) {
      throw new BadRequestException('Invalid starts_at / ends_at');
    }
    if (ends <= starts) {
      throw new BadRequestException('ends_at must be after starts_at');
    }
    const capacity = input.capacity ?? 10;
    if (capacity < 1 || capacity > 500) {
      throw new BadRequestException('capacity must be between 1 and 500');
    }

    const tpl = await this.dataSource.query<
      Array<{ id: string; organization_id: string; name: string }>
    >(
      `SELECT id, organization_id, name FROM program_templates WHERE id = $1`,
      [input.program_template_id],
    );
    if (!tpl[0]) throw new NotFoundException('Program template not found');
    if (tpl[0].organization_id !== actor.organizationId) {
      throw new ForbiddenException('Program is outside your organization');
    }

    const version = await this.dataSource.query<
      Array<{ id: string; disbursement_rules: Record<string, unknown> }>
    >(
      `SELECT id, disbursement_rules FROM program_template_versions
       WHERE program_template_id = $1
       ORDER BY CASE WHEN published_at IS NOT NULL THEN 0 ELSE 1 END, version_number DESC
       LIMIT 1`,
      [input.program_template_id],
    );
    const rules = version[0]?.disbursement_rules ?? {};
    try {
      assertSlotMeetsLeadTime(starts);
      assertSlotWithinDisbursementWindow(rules, starts, ends);
    } catch (e) {
      throw new BadRequestException(
        e instanceof Error ? e.message : 'Slot outside disbursement window',
      );
    }

    // Default site pin from office when not provided.
    const office = await this.dataSource.query<
      Array<{
        address: string | null;
        latitude: number | null;
        longitude: number | null;
        map_label: string | null;
        name: string;
      }>
    >(
      `SELECT address, latitude, longitude, map_label, name FROM offices WHERE id = $1`,
      [officeId],
    );
    // Site must come from this slot (or stay null). Do not copy office.map_label /
    // address — those may still hold another program's cash window.
    const o = office[0];
    const siteName = input.site_name?.trim() || null;
    const siteAddress = input.site_address?.trim() || null;
    const latitude =
      input.latitude != null ? Number(input.latitude) : o?.latitude ?? null;
    const longitude =
      input.longitude != null ? Number(input.longitude) : o?.longitude ?? null;

    const rows = await this.dataSource.query<Array<{ id: string }>>(
      `INSERT INTO disbursement_slots
         (organization_id, office_id, program_template_id, starts_at, ends_at, capacity, label,
          status, created_by_user_id, site_name, site_address, latitude, longitude)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'open', $8, $9, $10, $11, $12)
       RETURNING id`,
      [
        actor.organizationId,
        officeId,
        input.program_template_id,
        starts.toISOString(),
        ends.toISOString(),
        capacity,
        input.label?.trim() || null,
        actorUserId,
        siteName,
        siteAddress,
        latitude,
        longitude,
      ],
    );
    return this.serializeSlot(rows[0].id);
  }

  async updateDisbursementSlot(
    actorUserId: string,
    slotId: string,
    input: {
      starts_at?: string;
      ends_at?: string;
      capacity?: number;
      label?: string;
      site_name?: string;
      site_address?: string;
      latitude?: number;
      longitude?: number;
    },
  ) {
    const actor = await this.requireUser(actorUserId);
    if (!actor.organizationId) {
      throw new ForbiddenException('Organization scope required');
    }

    const existing = await this.dataSource.query<
      Array<{
        id: string;
        organization_id: string;
        office_id: string;
        program_template_id: string | null;
        starts_at: string;
        ends_at: string;
        capacity: number;
        booked_count: number;
        status: string;
        label: string | null;
        site_name: string | null;
        site_address: string | null;
        latitude: number | null;
        longitude: number | null;
      }>
    >(
      `SELECT id, organization_id, office_id, program_template_id, starts_at, ends_at,
              capacity, booked_count, status, label, site_name, site_address,
              latitude, longitude
       FROM disbursement_slots WHERE id = $1`,
      [slotId],
    );
    const slot = existing[0];
    if (!slot) throw new NotFoundException('Slot not found');
    if (slot.organization_id !== actor.organizationId) {
      throw new ForbiddenException('Slot is outside your organization');
    }
    if (slot.status === 'cancelled') {
      throw new BadRequestException('Cancelled slots cannot be edited');
    }
    await this.rbac.assertPermission(actorUserId, 'disbursement_slot.manage', {
      organizationId: actor.organizationId,
      officeId: slot.office_id,
    });

    const starts = new Date(input.starts_at ?? slot.starts_at);
    const ends = new Date(input.ends_at ?? slot.ends_at);
    if (Number.isNaN(starts.getTime()) || Number.isNaN(ends.getTime())) {
      throw new BadRequestException('Invalid starts_at / ends_at');
    }
    if (ends <= starts) {
      throw new BadRequestException('ends_at must be after starts_at');
    }

    const capacity = input.capacity ?? slot.capacity;
    if (capacity < 1 || capacity > 500) {
      throw new BadRequestException('capacity must be between 1 and 500');
    }
    if (capacity < slot.booked_count) {
      throw new BadRequestException(
        `Capacity cannot be reduced below current bookings (${slot.booked_count}). You can increase capacity only.`,
      );
    }

    if (slot.program_template_id) {
      const version = await this.dataSource.query<
        Array<{ disbursement_rules: Record<string, unknown> }>
      >(
        `SELECT disbursement_rules FROM program_template_versions
         WHERE program_template_id = $1
         ORDER BY CASE WHEN published_at IS NOT NULL THEN 0 ELSE 1 END, version_number DESC
         LIMIT 1`,
        [slot.program_template_id],
      );
      const rules = version[0]?.disbursement_rules ?? {};
      try {
        assertSlotMeetsLeadTime(starts);
        assertSlotWithinDisbursementWindow(rules, starts, ends);
      } catch (e) {
        throw new BadRequestException(
          e instanceof Error ? e.message : 'Slot outside disbursement window',
        );
      }
    } else {
      try {
        assertSlotMeetsLeadTime(starts);
      } catch (e) {
        throw new BadRequestException(
          e instanceof Error ? e.message : 'Lead time not met',
        );
      }
    }

    const nextStatus =
      capacity <= slot.booked_count
        ? 'closed'
        : slot.status === 'closed' && capacity > slot.booked_count
          ? 'open'
          : slot.status;

    await this.dataSource.query(
      `UPDATE disbursement_slots SET
         starts_at = $2,
         ends_at = $3,
         capacity = $4,
         label = $5,
         site_name = $6,
         site_address = $7,
         latitude = $8,
         longitude = $9,
         status = $10,
         updated_at = now()
       WHERE id = $1`,
      [
        slotId,
        starts.toISOString(),
        ends.toISOString(),
        capacity,
        input.label !== undefined ? input.label.trim() || null : slot.label,
        input.site_name !== undefined
          ? input.site_name.trim() || null
          : slot.site_name,
        input.site_address !== undefined
          ? input.site_address.trim() || null
          : slot.site_address,
        input.latitude !== undefined ? Number(input.latitude) : slot.latitude,
        input.longitude !== undefined
          ? Number(input.longitude)
          : slot.longitude,
        nextStatus,
      ],
    );
    return this.serializeSlot(slotId);
  }

  async cancelDisbursementSlot(actorUserId: string, slotId: string) {
    const actor = await this.requireUser(actorUserId);
    if (!actor.organizationId) {
      throw new ForbiddenException('Organization scope required');
    }
    const existing = await this.dataSource.query<
      Array<{
        id: string;
        organization_id: string;
        office_id: string;
        booked_count: number;
        status: string;
      }>
    >(
      `SELECT id, organization_id, office_id, booked_count, status
       FROM disbursement_slots WHERE id = $1`,
      [slotId],
    );
    const slot = existing[0];
    if (!slot) throw new NotFoundException('Slot not found');
    if (slot.organization_id !== actor.organizationId) {
      throw new ForbiddenException('Slot is outside your organization');
    }
    await this.rbac.assertPermission(actorUserId, 'disbursement_slot.manage', {
      organizationId: actor.organizationId,
      officeId: slot.office_id,
    });
    if (slot.status === 'cancelled') {
      return this.serializeSlot(slotId);
    }
    if (slot.booked_count > 0) {
      throw new BadRequestException(
        'Cannot cancel a slot that already has bookings',
      );
    }
    await this.dataSource.query(
      `UPDATE disbursement_slots
       SET status = 'cancelled', updated_at = now()
       WHERE id = $1`,
      [slotId],
    );
    return this.serializeSlot(slotId);
  }

  async listOfficeDisbursementSlots(
    actorUserId: string,
    officeIdQuery?: string,
  ) {
    const actor = await this.requireUser(actorUserId);
    const officeId = officeIdQuery ?? actor.officeId;
    if (!actor.organizationId) {
      throw new ForbiddenException('Organization scope required');
    }
    if (!officeId) {
      // Org admin without office: list all org slots.
      await this.rbac.assertPermission(actorUserId, 'disbursement_slot.manage', {
        organizationId: actor.organizationId,
      });
      const rows = await this.dataSource.query<Array<{ id: string }>>(
        `SELECT id FROM disbursement_slots
         WHERE organization_id = $1 AND status <> 'cancelled'
         ORDER BY starts_at ASC`,
        [actor.organizationId],
      );
      return Promise.all(rows.map((r) => this.serializeSlot(r.id)));
    }
    await this.rbac.assertPermission(actorUserId, 'disbursement_slot.manage', {
      organizationId: actor.organizationId,
      officeId,
    });
    const rows = await this.dataSource.query<Array<{ id: string }>>(
      `SELECT id FROM disbursement_slots
       WHERE office_id = $1 AND status <> 'cancelled'
       ORDER BY starts_at ASC`,
      [officeId],
    );
    return Promise.all(rows.map((r) => this.serializeSlot(r.id)));
  }

  async listBookableSlots(
    actorUserId: string,
    opts?: { officeId?: string; applicationId?: string },
  ) {
    const actor = await this.requireUser(actorUserId);
    if (!actor.beneficiaryId) {
      throw new ForbiddenException('Beneficiaries only');
    }
    await this.rbac.assertPermission(actorUserId, 'disbursement_slot.book', {
      beneficiaryId: actor.beneficiaryId,
    });

    let app =
      opts?.applicationId
        ? await this.applications.findOne({ where: { id: opts.applicationId } })
        : null;
    if (opts?.applicationId) {
      if (!app) throw new NotFoundException('Application not found');
      if (app.beneficiaryId !== actor.beneficiaryId) {
        throw new ForbiddenException('Not your application');
      }
      if (app.status !== 'approved') {
        throw new BadRequestException(
          'Only approved applications can schedule disbursement',
        );
      }
    } else {
      app = await this.applications.findOne({
        where: { beneficiaryId: actor.beneficiaryId, status: 'approved' },
        order: { decidedAt: 'DESC' },
      });
    }

    const oid = opts?.officeId ?? app?.officeId;
    if (!oid || !app) {
      throw new BadRequestException(
        'No approved application office found — wait for approval first',
      );
    }

    const rulesRows = await this.dataSource.query<
      Array<{
        disbursement_rules: Record<string, unknown>;
        program_template_id: string;
      }>
    >(
      `SELECT v.disbursement_rules, v.program_template_id
       FROM program_template_versions v WHERE v.id = $1`,
      [app.programTemplateVersionId],
    );
    const rules = rulesRows[0]?.disbursement_rules ?? {};
    const programTemplateId = rulesRows[0]?.program_template_id;
    try {
      assertDisbursementPeriodOpen(rules);
    } catch (e) {
      throw new BadRequestException(
        e instanceof Error ? e.message : 'Disbursement period closed',
      );
    }

    const windows = (rules.period_windows ?? null) as {
      disbursement_start?: string | null;
      disbursement_end?: string | null;
    } | null;

    const rows = await this.dataSource.query<
      Array<{ id: string; starts_at: string; ends_at: string }>
    >(
      `SELECT id, starts_at, ends_at FROM disbursement_slots
       WHERE office_id = $1
         AND status = 'open'
         AND starts_at >= $3
         AND booked_count < capacity
         AND (
           program_template_id IS NULL
           OR program_template_id = $2
         )
       ORDER BY starts_at ASC
       LIMIT 80`,
      [
        oid,
        programTemplateId ?? null,
        earliestBookableSlotStart().toISOString(),
      ],
    );

    const filtered = rows.filter((r) => {
      const start = new Date(r.starts_at);
      const end = new Date(r.ends_at);
      if (windows?.disbursement_start) {
        const wStart = new Date(windows.disbursement_start).getTime();
        if (!Number.isNaN(wStart) && start.getTime() < wStart) return false;
      }
      if (windows?.disbursement_end) {
        const wEnd = new Date(windows.disbursement_end).getTime();
        if (!Number.isNaN(wEnd) && end.getTime() > wEnd) return false;
      }
      return true;
    });

    return Promise.all(filtered.slice(0, 60).map((r) => this.serializeSlot(r.id)));
  }

  async bookDisbursementSlot(
    actorUserId: string,
    input: { slot_id: string; application_id: string },
  ) {
    const actor = await this.requireUser(actorUserId);
    if (!actor.beneficiaryId) {
      throw new ForbiddenException('Beneficiaries only');
    }
    await this.rbac.assertPermission(actorUserId, 'disbursement_slot.book', {
      beneficiaryId: actor.beneficiaryId,
    });

    const app = await this.applications.findOne({
      where: { id: input.application_id },
    });
    if (!app) throw new NotFoundException('Application not found');
    if (app.beneficiaryId !== actor.beneficiaryId) {
      throw new ForbiddenException('Not your application');
    }
    if (app.status !== 'approved') {
      throw new BadRequestException(
        'Only approved applications can schedule disbursement',
      );
    }

    const rulesRows = await this.dataSource.query<
      Array<{ disbursement_rules: Record<string, unknown> }>
    >(
      `SELECT disbursement_rules FROM program_template_versions WHERE id = $1`,
      [app.programTemplateVersionId],
    );
    try {
      assertDisbursementPeriodOpen(rulesRows[0]?.disbursement_rules ?? {});
    } catch (e) {
      throw new BadRequestException(
        e instanceof Error ? e.message : 'Disbursement period closed',
      );
    }

    const versionMeta = await this.dataSource.query<
      Array<{ program_template_id: string }>
    >(
      `SELECT program_template_id FROM program_template_versions WHERE id = $1`,
      [app.programTemplateVersionId],
    );
    const appProgramId = versionMeta[0]?.program_template_id;

    return this.dataSource.transaction(async (manager) => {
      const slots = await manager.query<
        Array<{
          id: string;
          office_id: string;
          program_template_id: string | null;
          capacity: number;
          booked_count: number;
          status: string;
          starts_at: string;
          ends_at: string;
        }>
      >(
        `SELECT id, office_id, program_template_id, capacity, booked_count, status, starts_at, ends_at
         FROM disbursement_slots WHERE id = $1 FOR UPDATE`,
        [input.slot_id],
      );
      const slot = slots[0];
      if (!slot) throw new NotFoundException('Slot not found');
      if (slot.status !== 'open') {
        throw new BadRequestException('Slot is not open');
      }
      if (new Date(slot.starts_at) <= new Date()) {
        throw new BadRequestException('Slot has already started');
      }
      if (slot.booked_count >= slot.capacity) {
        throw new BadRequestException('Slot is full');
      }
      if (slot.office_id !== app.officeId) {
        throw new BadRequestException(
          'Slot office does not match your application office',
        );
      }
      if (
        slot.program_template_id &&
        appProgramId &&
        slot.program_template_id !== appProgramId
      ) {
        throw new BadRequestException(
          'This slot belongs to a different program',
        );
      }
      try {
        assertSlotMeetsLeadTime(new Date(slot.starts_at));
        assertSlotWithinDisbursementWindow(
          rulesRows[0]?.disbursement_rules ?? {},
          new Date(slot.starts_at),
          new Date(slot.ends_at),
        );
      } catch (e) {
        throw new BadRequestException(
          e instanceof Error ? e.message : 'Slot outside disbursement window',
        );
      }

      const existing = await manager.query<
        Array<{
          id: string;
          status: string;
          slot_id: string;
          claim_token: string;
          slot_starts_at: string;
        }>
      >(
        `SELECT b.id, b.status, b.slot_id, b.claim_token, s.starts_at AS slot_starts_at
         FROM disbursement_bookings b
         JOIN disbursement_slots s ON s.id = b.slot_id
         WHERE b.application_id = $1
         FOR UPDATE OF b`,
        [app.id],
      );
      const prior = existing[0];

      if (prior?.status === 'completed') {
        throw new BadRequestException(
          'This disbursement was already validated at the cash window and cannot be rebooked',
        );
      }

      if (prior?.status === 'booked') {
        try {
          assertRebookAllowed(new Date(prior.slot_starts_at));
        } catch (e) {
          throw new BadRequestException(
            e instanceof Error ? e.message : 'Rebooking is locked',
          );
        }
        if (prior.slot_id === slot.id) {
          throw new BadRequestException(
            'You already booked this slot. Choose a different time to reschedule.',
          );
        }

        // Free the previous slot seat, then move the booking.
        await manager.query(
          `UPDATE disbursement_slots
           SET booked_count = GREATEST(booked_count - 1, 0),
               updated_at = now(),
               status = CASE
                 WHEN status = 'closed' AND booked_count - 1 < capacity THEN 'open'
                 ELSE status
               END
           WHERE id = $1`,
          [prior.slot_id],
        );

        const queueNumber = slot.booked_count + 1;
        const moved = await manager.query<
          Array<{ id: string; claim_token: string }>
        >(
          `UPDATE disbursement_bookings
           SET slot_id = $2,
               queue_number = $3,
               claim_token = encode(gen_random_bytes(24), 'hex'),
               status = 'booked',
               validated_at = NULL,
               validated_by_user_id = NULL,
               updated_at = now()
           WHERE id = $1
           RETURNING id, claim_token`,
          [prior.id, slot.id, queueNumber],
        );

        await manager.query(
          `UPDATE disbursement_slots
           SET booked_count = booked_count + 1,
               updated_at = now(),
               status = CASE WHEN booked_count + 1 >= capacity THEN 'closed' ELSE status END
           WHERE id = $1`,
          [slot.id],
        );

        const claimToken = moved[0].claim_token;
        return {
          id: moved[0].id,
          slot_id: slot.id,
          application_id: app.id,
          queue_number: queueNumber,
          status: 'booked',
          claim_token: claimToken,
          claim_qr_payload: this.claimQrPayload(claimToken),
          replaced_previous: true,
          slot: await this.serializeSlot(slot.id),
        };
      }

      // No active booking (or cancelled/no_show row) — create or revive.
      if (prior && (prior.status === 'cancelled' || prior.status === 'no_show')) {
        const queueNumber = slot.booked_count + 1;
        const revived = await manager.query<
          Array<{ id: string; claim_token: string }>
        >(
          `UPDATE disbursement_bookings
           SET slot_id = $2,
               queue_number = $3,
               claim_token = encode(gen_random_bytes(24), 'hex'),
               status = 'booked',
               validated_at = NULL,
               validated_by_user_id = NULL,
               updated_at = now()
           WHERE id = $1
           RETURNING id, claim_token`,
          [prior.id, slot.id, queueNumber],
        );
        await manager.query(
          `UPDATE disbursement_slots
           SET booked_count = booked_count + 1,
               updated_at = now(),
               status = CASE WHEN booked_count + 1 >= capacity THEN 'closed' ELSE status END
           WHERE id = $1`,
          [slot.id],
        );
        const claimToken = revived[0].claim_token;
        return {
          id: revived[0].id,
          slot_id: slot.id,
          application_id: app.id,
          queue_number: queueNumber,
          status: 'booked',
          claim_token: claimToken,
          claim_qr_payload: this.claimQrPayload(claimToken),
          replaced_previous: false,
          slot: await this.serializeSlot(slot.id),
        };
      }

      const queueNumber = slot.booked_count + 1;
      const booking = await manager.query<
        Array<{ id: string; claim_token: string }>
      >(
        `INSERT INTO disbursement_bookings
           (slot_id, application_id, beneficiary_id, user_account_id, queue_number, status)
         VALUES ($1, $2, $3, $4, $5, 'booked')
         RETURNING id, claim_token`,
        [
          slot.id,
          app.id,
          actor.beneficiaryId,
          actorUserId,
          queueNumber,
        ],
      );
      await manager.query(
        `UPDATE disbursement_slots
         SET booked_count = booked_count + 1,
             updated_at = now(),
             status = CASE WHEN booked_count + 1 >= capacity THEN 'closed' ELSE status END
         WHERE id = $1`,
        [slot.id],
      );

      const claimToken = booking[0].claim_token;
      return {
        id: booking[0].id,
        slot_id: slot.id,
        application_id: app.id,
        queue_number: queueNumber,
        status: 'booked',
        claim_token: claimToken,
        claim_qr_payload: this.claimQrPayload(claimToken),
        replaced_previous: false,
        slot: await this.serializeSlot(slot.id),
      };
    });
  }

  async listMyBookings(actorUserId: string) {
    const rows = await this.dataSource.query<
      Array<{
        id: string;
        slot_id: string;
        application_id: string;
        queue_number: number;
        status: string;
        claim_token: string;
        validated_at: string | null;
        created_at: string;
      }>
    >(
      `SELECT id, slot_id, application_id, queue_number, status, claim_token,
              validated_at, created_at
       FROM disbursement_bookings
       WHERE user_account_id = $1
       ORDER BY created_at DESC`,
      [actorUserId],
    );
    return Promise.all(
      rows.map(async (b) => ({
        id: b.id,
        slot_id: b.slot_id,
        application_id: b.application_id,
        queue_number: b.queue_number,
        status: b.status,
        claim_token: b.claim_token,
        claim_qr_payload: this.claimQrPayload(b.claim_token),
        validated_at: b.validated_at,
        created_at: b.created_at,
        slot: await this.serializeSlot(b.slot_id),
      })),
    );
  }

  /**
   * Office Admin cash-window: look up a claim QR without completing it.
   */
  async previewDisbursementClaim(
    actorUserId: string,
    input: { claim_token: string },
  ) {
    const booking = await this.loadClaimBooking(actorUserId, input.claim_token);
    const done = this.isClaimDone(booking);
    return {
      ok: true,
      requires_face_liveness: booking.status === 'booked' && !booking.validated_at,
      already_validated: done,
      already_claimed: done,
      booking: this.serializeValidatedClaim(booking),
      claim: done
        ? await this.loadClaimRecord(booking.id)
        : null,
      message: done
        ? 'This aid was already claimed and recorded as completed.'
        : 'Claim found. The beneficiary must complete face liveness before cash release.',
    };
  }

  /**
   * Start a cash-window face-liveness session for the claimant.
   * Stored for future face-match against PhilSys / enrollment capture.
   */
  async startClaimLivenessSession(
    actorUserId: string,
    input: { claim_token: string; callback_url?: string },
  ) {
    const booking = await this.loadClaimBooking(actorUserId, input.claim_token);
    if (this.isClaimDone(booking)) {
      return {
        ok: true,
        already_validated: true,
        already_claimed: true,
        message: 'This aid was already claimed and recorded as completed.',
        booking: this.serializeValidatedClaim(booking),
        claim: await this.loadClaimRecord(booking.id),
      };
    }
    this.assertClaimReadyToComplete(booking);

    const beneficiaryUser = await this.users.findOne({
      where: { beneficiary: { id: booking.beneficiary_id } },
    });

    const session = await this.auth.createLivenessSession({
      purpose: 'disbursement_claim',
      userId: beneficiaryUser?.id,
      callbackUrl:
        input.callback_url?.trim() ||
        'http://127.0.0.1:3000/admin/disbursement-validate',
      action: 'redirect',
    });

    await this.dataSource.query(
      `UPDATE liveness_sessions
       SET provider_payload = COALESCE(provider_payload, '{}'::jsonb) || $2::jsonb
       WHERE session_token = $1`,
      [
        session.token,
        JSON.stringify({
          claim_token: booking.claim_token,
          booking_id: booking.id,
          application_id: booking.application_id,
          beneficiary_id: booking.beneficiary_id,
          purpose: 'disbursement_claim',
        }),
      ],
    );

    return {
      ok: true,
      already_validated: false,
      liveness: {
        token: session.token,
        url: session.url,
        purpose: session.purpose,
        provider: session.provider,
      },
      booking: this.serializeValidatedClaim(booking),
      message:
        'Have the beneficiary complete face liveness on this device, then finish validation.',
    };
  }

  /**
   * Completes a claim after Office Admin scanned the QR and the beneficiary
   * passed face liveness. Persists status=claimed + a durable claim record
   * (face liveness stored for future PhilSys / enrollment face match).
   */
  async validateDisbursementClaim(
    actorUserId: string,
    input: { claim_token: string; liveness_session_token: string },
  ) {
    const booking = await this.loadClaimBooking(actorUserId, input.claim_token);

    if (this.isClaimDone(booking)) {
      return {
        ok: true,
        already_validated: true,
        already_claimed: true,
        message: 'This aid was already claimed and recorded as completed.',
        booking: this.serializeValidatedClaim(booking),
        claim: await this.loadClaimRecord(booking.id),
      };
    }
    this.assertClaimReadyToComplete(booking);

    const livenessToken = (input.liveness_session_token ?? '').trim();
    if (!livenessToken) {
      throw new BadRequestException(
        'Face liveness is required before completing this claim',
      );
    }

    const beneficiaryUser = await this.users.findOne({
      where: { beneficiary: { id: booking.beneficiary_id } },
    });

    const liveness = await this.auth.verifyLiveness(
      livenessToken,
      beneficiaryUser?.id,
    );
    const passed =
      liveness.passed ||
      String(liveness.status ?? '').toUpperCase() === 'SUCCEEDED';
    if (!passed) {
      throw new BadRequestException({
        message: 'Face liveness check did not pass for this claimant',
        code: 'liveness_required',
        confidence_score: liveness.confidence_score,
        threshold: liveness.threshold,
      });
    }

    const sessionRow = await this.dataSource.query<
      Array<{
        id: string;
        purpose: string | null;
        status: string | null;
        confidence_score: string | null;
        reference_image_url: string | null;
        provider_payload: Record<string, unknown> | null;
        completed_at: string | null;
      }>
    >(
      `SELECT id, purpose, status, confidence_score, reference_image_url,
              provider_payload, completed_at
       FROM liveness_sessions
       WHERE session_token = $1
          OR provider_payload->>'everify_session_id' = $1
       LIMIT 1`,
      [livenessToken],
    );
    const livenessSession = sessionRow[0] ?? null;
    const livenessSessionId = livenessSession?.id ?? null;
    if (
      livenessSession?.purpose &&
      livenessSession.purpose !== 'disbursement_claim'
    ) {
      throw new BadRequestException(
        'Liveness session was not started for disbursement claim validation',
      );
    }

    const faceLiveness = {
      session_id: livenessSessionId,
      session_token: livenessToken,
      purpose: 'disbursement_claim',
      status: liveness.status ?? livenessSession?.status ?? null,
      confidence_score:
        liveness.confidence_score ??
        (livenessSession?.confidence_score != null
          ? Number(livenessSession.confidence_score)
          : null),
      reference_image_url:
        liveness.reference_image_url ??
        livenessSession?.reference_image_url ??
        null,
      face_liveness_session_id:
        (liveness as { face_liveness_session_id?: string })
          .face_liveness_session_id ?? null,
      // Reserved: match against PhilSys / enrollment capture.
      face_match: null as null,
      face_match_pending: true,
      verified_at:
        livenessSession?.completed_at ?? new Date().toISOString(),
      provider_payload: livenessSession?.provider_payload ?? null,
    };

    const claimedAt = new Date().toISOString();
    await this.dataSource.query(
      `UPDATE disbursement_bookings
       SET status = 'claimed',
           validated_at = now(),
           validated_by_user_id = $2,
           liveness_session_id = $3,
           updated_at = now()
       WHERE id = $1`,
      [booking.id, actorUserId, livenessSessionId],
    );
    await this.dataSource.query(
      `UPDATE applications
       SET status = 'claimed',
           updated_at = now()
       WHERE id = $1 AND status IN ('approved', 'disbursed')`,
      [booking.application_id],
    );

    const claimRows = await this.dataSource.query<
      Array<{ id: string; claimed_at: string }>
    >(
      `INSERT INTO disbursement_claims (
          booking_id, application_id, beneficiary_id, organization_id, office_id,
          claimed_by_user_id, liveness_session_id, claim_token, queue_number,
          reference_no, beneficiary_name, beneficiary_phone,
          slot_starts_at, slot_ends_at, site_name, site_address,
          face_liveness, details, claimed_at
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9,
          $10, $11, $12,
          $13, $14, $15, $16,
          $17::jsonb, $18::jsonb, now()
        )
        ON CONFLICT (booking_id) DO UPDATE SET
          claimed_by_user_id = EXCLUDED.claimed_by_user_id,
          liveness_session_id = EXCLUDED.liveness_session_id,
          face_liveness = EXCLUDED.face_liveness,
          details = EXCLUDED.details,
          claimed_at = COALESCE(disbursement_claims.claimed_at, EXCLUDED.claimed_at)
        RETURNING id, claimed_at`,
      [
        booking.id,
        booking.application_id,
        booking.beneficiary_id,
        booking.organization_id,
        booking.office_id,
        actorUserId,
        livenessSessionId,
        booking.claim_token,
        booking.queue_number,
        booking.reference_no,
        booking.full_name,
        booking.phone,
        booking.starts_at,
        booking.ends_at,
        booking.site_name,
        booking.site_address,
        JSON.stringify(faceLiveness),
        JSON.stringify({
          application_status: 'claimed',
          booking_status: 'claimed',
          slot_label: null,
          source: 'office_admin_cash_window',
        }),
      ],
    );

    const refreshed = {
      ...booking,
      status: 'claimed',
      validated_at: claimedAt,
    };
    return {
      ok: true,
      already_validated: false,
      already_claimed: false,
      face_liveness_passed: true,
      message:
        'Claim recorded as claimed — beneficiary face liveness saved; application completed.',
      booking: this.serializeValidatedClaim(refreshed),
      claim: {
        id: claimRows[0]?.id ?? null,
        claimed_at: claimRows[0]?.claimed_at ?? claimedAt,
        status: 'claimed',
        face_liveness: faceLiveness,
      },
      liveness: {
        status: liveness.status,
        confidence_score: liveness.confidence_score,
        face_match_pending: true,
      },
    };
  }

  private isClaimDone(booking: {
    status: string;
    validated_at: string | null;
  }): boolean {
    return (
      booking.status === 'claimed' ||
      booking.status === 'completed' ||
      Boolean(booking.validated_at)
    );
  }

  private async loadClaimRecord(bookingId: string) {
    const rows = await this.dataSource.query<
      Array<{
        id: string;
        claimed_at: string;
        face_liveness: Record<string, unknown> | null;
        details: Record<string, unknown> | null;
        claimed_by_user_id: string;
        liveness_session_id: string | null;
      }>
    >(
      `SELECT id, claimed_at, face_liveness, details, claimed_by_user_id, liveness_session_id
       FROM disbursement_claims WHERE booking_id = $1 LIMIT 1`,
      [bookingId],
    );
    const c = rows[0];
    if (!c) return null;
    return {
      id: c.id,
      status: 'claimed',
      claimed_at: c.claimed_at,
      claimed_by_user_id: c.claimed_by_user_id,
      liveness_session_id: c.liveness_session_id,
      face_liveness: c.face_liveness,
      details: c.details,
    };
  }

  private async loadClaimBooking(actorUserId: string, rawClaim: string) {
    const actor = await this.requireUser(actorUserId);
    if (!actor.organizationId) {
      throw new ForbiddenException('Organization scope required');
    }

    const raw = (rawClaim ?? '').trim();
    const token = this.extractClaimToken(raw);
    if (!token) {
      throw new BadRequestException('Invalid claim QR / token');
    }

    const rows = await this.dataSource.query<
      Array<{
        id: string;
        slot_id: string;
        application_id: string;
        beneficiary_id: string;
        queue_number: number;
        status: string;
        claim_token: string;
        validated_at: string | null;
        office_id: string;
        organization_id: string;
        starts_at: string;
        ends_at: string;
        site_name: string | null;
        site_address: string | null;
        full_name: string;
        phone: string | null;
        reference_no: string | null;
        app_status: string;
      }>
    >(
      `SELECT b.id, b.slot_id, b.application_id, b.beneficiary_id, b.queue_number,
              b.status, b.claim_token, b.validated_at,
              s.office_id, s.organization_id, s.starts_at, s.ends_at,
              s.site_name, s.site_address,
              ben.full_name, ben.phone,
              a.reference_no, a.status AS app_status
       FROM disbursement_bookings b
       JOIN disbursement_slots s ON s.id = b.slot_id
       JOIN beneficiaries ben ON ben.id = b.beneficiary_id
       JOIN applications a ON a.id = b.application_id
       WHERE b.claim_token = $1
       LIMIT 1`,
      [token],
    );
    const booking = rows[0];
    if (!booking) {
      throw new NotFoundException('Claim QR not recognized');
    }

    await this.rbac.assertPermission(actorUserId, 'disbursement.authorize', {
      organizationId: booking.organization_id,
      officeId: booking.office_id,
    });

    if (actor.officeId && actor.officeId !== booking.office_id) {
      throw new ForbiddenException(
        'This claim belongs to a different office cash window',
      );
    }

    if (booking.status === 'cancelled' || booking.status === 'no_show') {
      throw new BadRequestException(`Booking is ${booking.status}`);
    }

    return booking;
  }

  private assertClaimReadyToComplete(booking: {
    status: string;
    app_status: string;
  }) {
    if (booking.status !== 'booked') {
      throw new BadRequestException(`Booking status is ${booking.status}`);
    }
    if (!['approved', 'disbursed', 'claimed'].includes(booking.app_status)) {
      throw new BadRequestException(
        'Application is not in an approved state for disbursement',
      );
    }
  }

  private claimQrPayload(claimToken: string): string {
    return `EHELP|claim=${claimToken}|action=disburse_claim`;
  }

  private extractClaimToken(raw: string): string | null {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    const fromPayload = trimmed.match(/(?:^|[|&])claim=([A-Za-z0-9]+)/i);
    if (fromPayload?.[1]) return fromPayload[1];
    if (/^[A-Za-z0-9]{16,}$/.test(trimmed)) return trimmed;
    return null;
  }

  private serializeValidatedClaim(booking: {
    id: string;
    application_id: string;
    queue_number: number;
    status: string;
    claim_token: string;
    validated_at: string | null;
    starts_at: string;
    ends_at: string;
    site_name: string | null;
    site_address: string | null;
    full_name: string;
    phone: string | null;
    reference_no: string | null;
    office_id: string;
  }) {
    return {
      booking_id: booking.id,
      application_id: booking.application_id,
      reference_no: booking.reference_no,
      queue_number: booking.queue_number,
      status: booking.status,
      validated_at: booking.validated_at,
      beneficiary_name: booking.full_name,
      beneficiary_phone: booking.phone,
      slot_starts_at: booking.starts_at,
      slot_ends_at: booking.ends_at,
      site_name: booking.site_name,
      site_address: booking.site_address,
      office_id: booking.office_id,
    };
  }

  private async serializeSlot(id: string) {
    const rows = await this.dataSource.query<
      Array<{
        id: string;
        organization_id: string;
        office_id: string;
        program_template_id: string | null;
        starts_at: string;
        ends_at: string;
        capacity: number;
        booked_count: number;
        label: string | null;
        status: string;
        created_at: string;
        site_name: string | null;
        site_address: string | null;
        latitude: number | null;
        longitude: number | null;
      }>
    >(
      `SELECT id, organization_id, office_id, program_template_id, starts_at, ends_at, capacity,
              booked_count, label, status, created_at,
              site_name, site_address, latitude, longitude
       FROM disbursement_slots WHERE id = $1`,
      [id],
    );
    const s = rows[0];
    if (!s) throw new NotFoundException('Slot not found');
    const office = await this.dataSource.query<
      Array<{
        name: string;
        address: string | null;
        latitude: number | null;
        longitude: number | null;
      }>
    >(
      `SELECT name, address, latitude, longitude FROM offices WHERE id = $1`,
      [s.office_id],
    );
    let programName: string | null = null;
    let periodWindows: Record<string, unknown> | null = null;
    if (s.program_template_id) {
      const tpl = await this.dataSource.query<
        Array<{ name: string; disbursement_rules: Record<string, unknown> }>
      >(
        `SELECT t.name, v.disbursement_rules
         FROM program_templates t
         LEFT JOIN LATERAL (
           SELECT disbursement_rules FROM program_template_versions
           WHERE program_template_id = t.id
           ORDER BY CASE WHEN published_at IS NOT NULL THEN 0 ELSE 1 END, version_number DESC
           LIMIT 1
         ) v ON true
         WHERE t.id = $1`,
        [s.program_template_id],
      );
      programName = tpl[0]?.name ?? null;
      periodWindows =
        (tpl[0]?.disbursement_rules?.period_windows as Record<
          string,
          unknown
        >) ?? null;
    }
    const lat = s.latitude ?? office[0]?.latitude ?? null;
    const lng = s.longitude ?? office[0]?.longitude ?? null;
    return {
      id: s.id,
      organization_id: s.organization_id,
      office_id: s.office_id,
      office_name: office[0]?.name ?? null,
      program_template_id: s.program_template_id,
      program_name: programName,
      period_windows: periodWindows,
      starts_at: s.starts_at,
      ends_at: s.ends_at,
      capacity: s.capacity,
      booked_count: s.booked_count,
      remaining: Math.max(0, s.capacity - s.booked_count),
      label: s.label,
      status: s.status,
      created_at: s.created_at,
      site_name: s.site_name ?? office[0]?.name ?? null,
      site_address: s.site_address ?? office[0]?.address ?? null,
      latitude: lat,
      longitude: lng,
      maps_url:
        lat != null && lng != null
          ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
          : null,
    };
  }

  // ── Beneficiary document vault ─────────────────────────────

  async listVaultDocuments(actorUserId: string) {
    const actor = await this.requireUser(actorUserId);
    if (!actor.beneficiaryId) return [];
    await this.rbac.assertPermission(
      actorUserId,
      'beneficiary_document.manage',
      { beneficiaryId: actor.beneficiaryId },
    );
    return this.dataSource.query(
      `SELECT id, document_type, label, storage_uri, notes, created_at
       FROM beneficiary_documents
       WHERE beneficiary_id = $1
       ORDER BY created_at DESC`,
      [actor.beneficiaryId],
    );
  }

  async addVaultDocument(
    actorUserId: string,
    input: {
      document_type: string;
      storage_uri: string;
      label?: string;
      notes?: string;
    },
  ) {
    const actor = await this.requireUser(actorUserId);
    if (!actor.beneficiaryId) {
      throw new ForbiddenException('Beneficiaries only');
    }
    await this.rbac.assertPermission(
      actorUserId,
      'beneficiary_document.manage',
      { beneficiaryId: actor.beneficiaryId },
    );
    const type = input.document_type?.trim();
    const uri = input.storage_uri?.trim();
    if (!type || !uri) {
      throw new BadRequestException('document_type and storage_uri required');
    }
    const rows = await this.dataSource.query<Array<{ id: string }>>(
      `INSERT INTO beneficiary_documents
         (beneficiary_id, document_type, label, storage_uri, notes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [
        actor.beneficiaryId,
        type,
        input.label?.trim() || type,
        uri,
        input.notes?.trim() || null,
      ],
    );
    const list = await this.listVaultDocuments(actorUserId);
    return list.find((d: { id: string }) => d.id === rows[0].id) ?? rows[0];
  }

  async deleteVaultDocument(actorUserId: string, documentId: string) {
    const actor = await this.requireUser(actorUserId);
    if (!actor.beneficiaryId) {
      throw new ForbiddenException('Beneficiaries only');
    }
    await this.rbac.assertPermission(
      actorUserId,
      'beneficiary_document.manage',
      { beneficiaryId: actor.beneficiaryId },
    );
    const result = await this.dataSource.query(
      `DELETE FROM beneficiary_documents
       WHERE id = $1 AND beneficiary_id = $2
       RETURNING id`,
      [documentId, actor.beneficiaryId],
    );
    if (!result[0]) throw new NotFoundException('Document not found');
    return { ok: true };
  }
}
