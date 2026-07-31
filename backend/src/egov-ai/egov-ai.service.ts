import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DomainService } from '../domain/domain.service';

type TokenCache = {
  accessToken: string;
  expiresAtMs: number;
};

type AiEligibilityContext = Awaited<
  ReturnType<DomainService['getAiEligibilityContext']>
>;

const SCOPE_REFUSAL =
  'I can only help with EHelp guidance — navigation, location-matched programs (details & coverage), program dates, disbursement queue slots/locations, and your application status. ' +
  'I cannot create or change applications, book slots for you, approve/reject cases, or discuss unrelated topics. ' +
  'Try asking about a program’s details, where to claim, available queue times, application status, or how to open Programs / Schedule.';

/**
 * Hard scope: navigation + eligibility + details/dates + queue slots + app status.
 */
const SCOPE_PREAMBLE = `You are the EHelp government assistance in-app guide (Philippine DSWD / social assistance context).

STRICT RULES — follow every item:
1. Answer ONLY about EHelp: navigation, eligible programs (AUTHORITATIVE ELIGIBLE PROGRAMS LIST), program details/description/location_scope, period dates, disbursement queue slots (upcoming_queue_slots / MY DISBURSEMENT BOOKINGS), office/site locations, and application status (AUTHORITATIVE APPLICATIONS LIST).
2. Program suggestions: ONLY from the eligible list (already location-filtered). Never invent programs.
3. Program details & location: use description, location_scope (regions/municipalities), and office/site fields. For claim sites use site_name, site_address, office_name, maps_url from slots, bookings, or application.office.
4. Dates: use period_windows only; compare to server_now; never invent dates. State open/not_started/closed/unset.
5. Queue / timeslots: use ONLY upcoming_queue_slots and my_disbursement_bookings. Report starts_at/ends_at, remaining seats, site address. Prefer application-linked slots when asking about "my" schedule. Never invent slots. You MUST NOT book a slot — guide the user to Schedule in the app.
6. Application status / “what happened”: prefer is_preferred=true when unspecified; match program/reference (including 4PS) when named. Use outcome_summary and claim fields. Answer Filipino/Taglish status questions the same way. Never invent statuses. Only say you cannot change status when the user asks you to change/approve/reject/update status — do not add that disclaimer on ordinary status questions.
7. Prefer short, concrete answers. Do not pad every reply with capability disclaimers.
8. Treat all lists as authoritative. Do not add missing programs, dates, slots, or offices.
9. You MUST NOT create/submit/edit/delete/approve/reject applications or book/cancel slots. Never claim you did.
10. No off-topic answers. Keep replies short and actionable.

`;

@Injectable()
export class EgovAiService {
  private readonly logger = new Logger(EgovAiService.name);
  private tokenCache: TokenCache | null = null;
  private lastUpstreamError: string | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly domain: DomainService,
  ) {}

  /** Live when access code is set; otherwise mock answers for local MVP. */
  isLive(): boolean {
    return Boolean(this.config.get<string>('EGOV_AI_ACCESS_CODE')?.trim());
  }

  status() {
    return {
      configured: this.isLive(),
      mode: this.isLive() ? 'live' : 'mock',
      base_url: this.baseUrl(),
      fallback_mock_on_error: this.fallbackMockOnError(),
      last_upstream_error: this.lastUpstreamError,
      scope: 'navigation_programs_dates_slots_and_status',
    };
  }

  async askAssistant(input: {
    prompt: string;
    category?: string;
    actorUserId: string;
  }): Promise<{ data: string; session_id: string; mode: 'live' | 'mock' }> {
    const prompt = input.prompt?.trim();
    if (!prompt) throw new BadRequestException('prompt is required');
    const category = (input.category ?? 'PH').trim() || 'PH';

    let eligibility: AiEligibilityContext | null = null;
    try {
      eligibility = await this.domain.getAiEligibilityContext(
        input.actorUserId,
      );
    } catch (err) {
      this.logger.warn(
        `Could not load AI eligibility context: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }

    // Local guard: refuse clear off-topic / action requests before calling upstream.
    if (this.shouldRefuseLocally(prompt)) {
      return {
        data: SCOPE_REFUSAL,
        session_id: `scoped-${Date.now().toString(36)}`,
        mode: this.isLive() ? 'live' : 'mock',
      };
    }

    if (!this.isLive()) {
      return {
        data: this.mockAnswer(prompt, eligibility),
        session_id: `mock-${Date.now().toString(36)}`,
        mode: 'mock',
      };
    }

    const scopedPrompt = `${SCOPE_PREAMBLE}${this.formatEligibilityBlock(eligibility)}\nUser question:\n${prompt}`;

    try {
      const token = await this.getAccessToken();
      const base = this.baseUrl();
      const res = await fetch(
        `${base}/api/v1/egov/integration/ai_assistant/generate`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({ prompt: scopedPrompt, category }),
        },
      );
      const body = (await res.json().catch(() => ({}))) as {
        data?: string | { answer?: string; reply?: string };
        session_id?: string;
        message?: string;
      };
      if (!res.ok) {
        this.lastUpstreamError = `assistant ${res.status}: ${body.message ?? res.statusText}`;
        this.logger.warn(`eGov AI assistant failed: ${this.lastUpstreamError}`);
        return this.onUpstreamFailure(prompt, this.lastUpstreamError, eligibility);
      }
      this.lastUpstreamError = null;
      return {
        data: this.extractAnswer(body.data) || SCOPE_REFUSAL,
        session_id: body.session_id ?? `live-${Date.now().toString(36)}`,
        mode: 'live',
      };
    } catch (err) {
      const detail = this.describeFetchError(err);
      this.lastUpstreamError = detail;
      this.logger.warn(`eGov AI assistant upstream error: ${detail}`);
      return this.onUpstreamFailure(prompt, detail, eligibility);
    }
  }

  private formatEligibilityBlock(
    ctx: AiEligibilityContext | null,
  ): string {
    if (!ctx) {
      return (
        'AUTHORITATIVE USER LOCATION: (unavailable)\n' +
        'AUTHORITATIVE ELIGIBLE PROGRAMS LIST: (unavailable — only answer navigation questions)\n' +
        'AUTHORITATIVE APPLICATIONS LIST: (unavailable)\n' +
        'MY DISBURSEMENT BOOKINGS: (unavailable)\n'
      );
    }
    const loc = ctx.location;
    const formatWindow = (
      label: string,
      w: { start: string | null; end: string | null; state: string },
    ) =>
      `${label}: ${w.start ?? '(unset)'} → ${w.end ?? '(unset)'} [${w.state}]`;

    const formatSlot = (s: {
      starts_at: string;
      ends_at: string;
      remaining: number;
      capacity: number;
      site_name: string | null;
      site_address: string | null;
      office_name: string;
      maps_url: string | null;
      label: string | null;
    }) => {
      const when = `${s.starts_at} → ${s.ends_at}`;
      const place = [s.site_name || s.office_name, s.site_address]
        .filter(Boolean)
        .join(' — ');
      return `${when}; seats ${s.remaining}/${s.capacity}; ${place}${s.label ? `; label: ${s.label}` : ''}${s.maps_url ? `; maps: ${s.maps_url}` : ''}`;
    };

    const programs =
      ctx.eligible_programs.length === 0
        ? '(none — no published programs match this profile location/age)'
        : ctx.eligible_programs
            .map((p, i) => {
              const pw = p.period_windows;
              const slots =
                p.upcoming_queue_slots.length === 0
                  ? 'upcoming_queue_slots: (none open yet)'
                  : `upcoming_queue_slots:\n${p.upcoming_queue_slots
                      .map((s) => `    - ${formatSlot(s)}`)
                      .join('\n')}`;
              const parts = [
                `${i + 1}. ${p.name} (${p.code})`,
                p.description ? `description: ${p.description}` : null,
                `location_scope: ${p.location_scope}`,
                p.min_age != null || p.max_age != null
                  ? `age: ${p.min_age ?? '?'}–${p.max_age ?? '?'}`
                  : null,
                p.disbursement_cooldown_days != null
                  ? `cooldown_days: ${p.disbursement_cooldown_days}`
                  : null,
                formatWindow('application_window', pw.application),
                formatWindow('review_window', pw.review),
                formatWindow('disbursement_window', pw.disbursement),
                slots,
              ].filter(Boolean);
              return parts.join('\n   ');
            })
            .join('\n');

    const apps =
      ctx.applications.length === 0
        ? '(none — beneficiary has no applications yet)'
        : ctx.applications
            .map((a, i) => {
              const pw = a.period_windows;
              const office = a.office
                ? `office: ${a.office.name}; address: ${a.office.address ?? '(n/a)'}${a.office.maps_url ? `; maps: ${a.office.maps_url}` : ''}`
                : 'office: (not set)';
              const slots =
                a.upcoming_queue_slots.length === 0
                  ? 'upcoming_queue_slots: (none — need approval or no open slots)'
                  : `upcoming_queue_slots:\n${a.upcoming_queue_slots
                      .map((s) => `    - ${formatSlot(s)}`)
                      .join('\n')}`;
              const claim = a.claim
                ? `claim: queue #${a.claim.queue_number}; ${a.claim.slot_starts_at} → ${a.claim.slot_ends_at}; ${[a.claim.site_name, a.claim.site_address].filter(Boolean).join(' — ') || '(site n/a)'}; claimed_at=${a.claim.claimed_at}; face_liveness_passed=${a.claim.face_liveness_passed}`
                : null;
              const parts = [
                `${i + 1}. ${a.reference_no}`,
                a.program_name
                  ? `program: ${a.program_name} (${a.program_code ?? '?'})`
                  : 'program: (unknown)',
                `status: ${a.status_label} (${a.status})`,
                `stage: ${a.stage_label} (${a.current_stage})`,
                a.outcome_summary
                  ? `outcome_summary: ${a.outcome_summary}`
                  : null,
                a.is_preferred ? 'is_preferred: true' : 'is_preferred: false',
                a.is_in_progress ? 'in_progress: true' : 'in_progress: false',
                office,
                claim,
                a.submitted_at ? `submitted_at: ${a.submitted_at}` : null,
                a.decided_at ? `decided_at: ${a.decided_at}` : null,
                formatWindow('application_window', pw.application),
                formatWindow('review_window', pw.review),
                formatWindow('disbursement_window', pw.disbursement),
                slots,
              ].filter(Boolean);
              return parts.join('\n   ');
            })
            .join('\n');

    const bookings =
      ctx.my_disbursement_bookings.length === 0
        ? '(none)'
        : ctx.my_disbursement_bookings
            .map((b, i) => {
              const place = [b.site_name || b.office_name, b.site_address]
                .filter(Boolean)
                .join(' — ');
              return `${i + 1}. queue #${b.queue_number}; ${b.starts_at} → ${b.ends_at}; ${place}${b.maps_url ? `; maps: ${b.maps_url}` : ''}; application_id=${b.application_id}`;
            })
            .join('\n');

    return (
      `AUTHORITATIVE CLOCK:\n` +
      `- server_now: ${ctx.server_now}\n` +
      `AUTHORITATIVE USER LOCATION:\n` +
      `- beneficiary_account: ${ctx.is_beneficiary ? 'yes' : 'no'}\n` +
      `- municipality: ${loc.municipality ?? '(not set)'}\n` +
      `- barangay: ${loc.barangay ?? '(not set)'}\n` +
      `- address: ${loc.address ?? '(not set)'}\n` +
      `- summary: ${loc.summary ?? '(not set)'}\n` +
      `- location_complete: ${loc.location_complete ? 'yes' : 'no'}\n` +
      `AUTHORITATIVE ELIGIBLE PROGRAMS LIST (details, coverage, dates, queue slots):\n${programs}\n` +
      `AUTHORITATIVE APPLICATIONS LIST (preferred_application_id=${ctx.preferred_application_id ?? 'none'}):\n${apps}\n` +
      `MY DISBURSEMENT BOOKINGS:\n${bookings}\n`
    );
  }

  /**
   * Lightweight keyword gate for obvious out-of-scope asks.
   * In-scope navigation / eligibility keywords win when mixed with refusal triggers.
   * Includes common Filipino / Taglish EHelp phrasing.
   */
  private shouldRefuseLocally(prompt: string): boolean {
    const q = prompt.toLowerCase();
    const inScope =
      /\b(ehelp|program|programa|apply|application|aplikasyon|eligible|eligibility|qualify|qualification|suggest|recommend|vault|document|dependent|profile|schedule|disburs|queue|slot|timeslot|time slot|claim|site|address|location|details|about (the |this )?program|map|office|queueing|queuing|message|track|status|navigate|menu|screen|how (do|to)|where (do|can)|which (program|ones?)|login|liveness|verify|approv|evaluat|ncr|region|municipality|city|deadline|due date|period|window|open(s|ing)?|close(s|d|ing)?|when (can|do|is|does)|until when|start date|end date|cooldown|4ps|aics|akap|ano|nangyari|nangyare|ano'?ng|anong|saan|kailan|aplikasyon\s*ko|program(a)?\s*ko)\b/.test(
        q,
      );
    if (inScope) {
      // Still refuse if they ask the bot to perform mutations.
      if (
        /\b(create|submit|file|file for me|apply for me|approve|reject|endorse|delete|cancel my|change my application|update my application|fill (out|in) (the )?form for me)\b/.test(
          q,
        ) &&
        /\b(for me|on my behalf|automatically|now)\b/.test(q)
      ) {
        return true;
      }
      return false;
    }

    const offTopic =
      /\b(weather|joke|recipe|crypto|stock|bitcoin|movie|football|nba|cricket|homework|essay|poem|code (this|for)|write (a |me )?(python|java|script)|who (is|was) president|capital of|translate this long|medical diagnos|prescribe)\b/.test(
        q,
      );
    if (offTopic) return true;

    // Short greetings stay in-scope (welcome / how can I help).
    if (
      /^(hi|hello|hey|help|thanks|thank you|kumusta|kamusta|magandang (umaga|hapon|gabi))[.!?]*$/i.test(
        prompt.trim(),
      )
    ) {
      return false;
    }

    // No clear EHelp signal → refuse rather than open chat.
    return true;
  }

  /** Application status / “what happened” intent (EN + Filipino/Taglish). */
  private asksApplicationStatus(prompt: string): boolean {
    const q = prompt.toLowerCase();
    if (
      /\b(status|track|progress|where is my|my application|current application|preferred application|reference|what happened|what'?s going on|update on my)\b/.test(
        q,
      )
    ) {
      return true;
    }
    if (
      q.includes('application') &&
      /\b(status|track|progress|update|going|now|happen|happened)\b/.test(q)
    ) {
      return true;
    }
    // Filipino / Taglish: "ano nangyari/nangyare sa 4ps application ko"
    if (
      /\b(nangyari|nangyare|ano'?ng|anong|ano na|saan na|kumusta|kamusta)\b/.test(
        q,
      ) &&
      /\b(application|aplikasyon|4ps|aics|akap|program|programa|claim|status)\b/.test(
        q,
      )
    ) {
      return true;
    }
    if (
      /\b(status|estado)\b/.test(q) &&
      /\b(application|aplikasyon|4ps|program|programa)\b/.test(q)
    ) {
      return true;
    }
    if (/\b(aplikasyon\s*ko|application\s*ko|4ps\s*(ko|application))\b/.test(q)) {
      return true;
    }
    return false;
  }

  private onUpstreamFailure(
    prompt: string,
    detail: string,
    eligibility: AiEligibilityContext | null,
  ) {
    if (this.fallbackMockOnError()) {
      return {
        data: this.mockAnswer(prompt, eligibility),
        session_id: `mock-fallback-${Date.now().toString(36)}`,
        mode: 'mock' as const,
      };
    }
    throw new ServiceUnavailableException(
      `eGov AI upstream unreachable (${detail}). ` +
        `Confirm EGOV_AI_BASE_URL, or set EGOV_AI_FALLBACK_MOCK=true for local answers.`,
    );
  }

  private extractAnswer(
    data: string | { answer?: string; reply?: string } | undefined,
  ): string {
    if (typeof data === 'string') return data;
    if (data && typeof data === 'object') {
      return data.answer ?? data.reply ?? JSON.stringify(data);
    }
    return '';
  }

  private describeFetchError(err: unknown): string {
    if (!(err instanceof Error)) return String(err);
    const cause = (err as Error & { cause?: unknown }).cause;
    if (cause instanceof Error) {
      return `${err.message}: ${cause.message}`;
    }
    return err.message;
  }

  private baseUrl(): string {
    return (
      this.config.get<string>('EGOV_AI_BASE_URL')?.replace(/\/$/, '') ||
      'https://egov-ai-core-ws.oueg.info'
    );
  }

  /** When true (default), network/DNS failures return mock text instead of 503. */
  private fallbackMockOnError(): boolean {
    const raw = this.config.get<string>('EGOV_AI_FALLBACK_MOCK');
    if (raw == null || raw === '') return true;
    return !['0', 'false', 'no', 'off'].includes(raw.trim().toLowerCase());
  }

  private async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.tokenCache && this.tokenCache.expiresAtMs > now + 60_000) {
      return this.tokenCache.accessToken;
    }
    const accessCode = this.config.get<string>('EGOV_AI_ACCESS_CODE')?.trim();
    if (!accessCode) {
      throw new ServiceUnavailableException('EGOV_AI_ACCESS_CODE is not set');
    }
    const res = await fetch(`${this.baseUrl()}/api/v1/egov/integration/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ access_code: accessCode }),
    });
    const body = (await res.json().catch(() => ({}))) as {
      access_token?: string;
      expires_in_seconds?: number;
      message?: string;
    };
    if (!res.ok || !body.access_token) {
      throw new Error(
        body.message || `token endpoint returned ${res.status}`,
      );
    }
    const ttlSec = Number(body.expires_in_seconds ?? 28800);
    this.tokenCache = {
      accessToken: body.access_token,
      expiresAtMs: now + ttlSec * 1000,
    };
    return body.access_token;
  }

  private mockAnswer(
    prompt: string,
    eligibility: AiEligibilityContext | null,
  ): string {
    if (this.shouldRefuseLocally(prompt)) return SCOPE_REFUSAL;

    const q = prompt.toLowerCase();
    const asksEligibility =
      /\b(eligible|eligibility|qualify|qualification|suggest|recommend|which program|what program|can i apply|programs (for|near) me)\b/.test(
        q,
      ) ||
      (q.includes('program') &&
        /\b(ncr|region|municipality|city|location|area|where i live)\b/.test(q));

    if (asksEligibility || q.includes('eligible') || q.includes('qualify')) {
      return this.mockEligibilityAnswer(eligibility);
    }

    const asksSlots =
      /\b(slot|slots|timeslot|time slot|queue|queueing|queuing|schedule|claim site|where (do i|to) (claim|go|get)|map|booking)\b/.test(
        q,
      ) ||
      (/\b(disburs)\b/.test(q) &&
        /\b(where|when|time|slot|queue|location|address|site)\b/.test(q));

    if (asksSlots) {
      return this.mockQueueSlotsAnswer(eligibility, prompt);
    }

    const asksDetails =
      /\b(details|about (the |this )?program|what is|tell me about|description|coverage|where (is|does) (this |the )?program)\b/.test(
        q,
      ) ||
      (/\b(location|address|office|site)\b/.test(q) &&
        /\b(program)\b/.test(q));

    if (asksDetails) {
      return this.mockProgramDetailsAnswer(eligibility, prompt);
    }

    const asksDates =
      /\b(deadline|due date|period|window|opens?|opening|closes?|closed|closing|when (can|do|is|does|will)|until when|start date|end date|cooldown|how long)\b/.test(
        q,
      ) ||
      (/\b(date|dates)\b/.test(q) &&
        /\b(program|apply|application|disburs|schedule)\b/.test(q));

    if (asksDates) {
      return this.mockProgramDatesAnswer(eligibility, prompt);
    }

    const asksAppStatus = this.asksApplicationStatus(prompt);

    if (asksAppStatus) {
      return this.mockApplicationStatusAnswer(eligibility, prompt);
    }

    if (q.includes('program') || q.includes('apply') || q.includes('aics')) {
      const place =
        eligibility?.location.summary ||
        eligibility?.location.municipality ||
        'your registered location';
      const tip =
        eligibility && eligibility.eligible_programs.length
          ? ` Based on ${place}, programs you may open include: ${eligibility.eligible_programs
              .slice(0, 5)
              .map((p) => p.name)
              .join(', ')}.`
          : '';
      return (
        'To apply in EHelp: open Programs → choose a program that matches your area → complete the form and attach ' +
        'required documents → submit. I cannot create or submit an application for you — ' +
        `use those screens yourself.${tip} Track progress under your applications list.`
      );
    }
    if (q.includes('dependent') || q.includes('relationship') || q.includes('profile')) {
      return (
        'Open Profile to view locked details (including municipality/address used for program matching) and Dependents to manage links. ' +
        'Proof uploads may need Office Admin approval. I cannot change profile data for you.'
      );
    }
    if (q.includes('disburs') || q.includes('schedule') || q.includes('queue')) {
      return this.mockQueueSlotsAnswer(eligibility, prompt);
    }
    if (q.includes('document') || q.includes('vault')) {
      return (
        'Open Document Vault to upload reusable files early, then attach them when applying. ' +
        'I cannot upload files on your behalf.'
      );
    }
    if (q.includes('message') || q.includes('notif')) {
      return (
        'Open Messages for approval notices and schedule prompts. Tap the action in a message ' +
        'to jump to Schedule when offered.'
      );
    }
    if (q.includes('track') || q.includes('status') || this.asksApplicationStatus(prompt)) {
      return this.mockApplicationStatusAnswer(eligibility, prompt);
    }
    if (/^(hi|hello|hey|help|thanks|thank you)/i.test(prompt.trim())) {
      return (
        'Hi — I can help with programs for your area, program details & claim locations, dates, queue timeslots, and application status. ' +
        'Ask “Tell me about [program]”, “What queue slots are open?”, or “What’s my application status?” ' +
        'I cannot create applications or book slots for you.'
      );
    }
    return SCOPE_REFUSAL;
  }

  private formatDateRange(w: {
    start: string | null;
    end: string | null;
    state: string;
  }): string {
    const start = w.start ? new Date(w.start).toLocaleString() : 'not set';
    const end = w.end ? new Date(w.end).toLocaleString() : 'not set';
    const stateLabel =
      w.state === 'open'
        ? 'currently open'
        : w.state === 'not_started'
          ? 'not started yet'
          : w.state === 'closed'
            ? 'currently closed'
            : 'not configured';
    return `${start} → ${end} (${stateLabel})`;
  }

  private formatSlotLine(s: {
    starts_at: string;
    ends_at: string;
    remaining?: number;
    capacity?: number;
    site_name: string | null;
    site_address: string | null;
    office_name?: string | null;
    maps_url: string | null;
    label?: string | null;
    queue_number?: number;
  }): string {
    const when = `${new Date(s.starts_at).toLocaleString()} → ${new Date(s.ends_at).toLocaleString()}`;
    const place = [s.site_name || s.office_name, s.site_address]
      .filter(Boolean)
      .join(' — ');
    const seats =
      s.remaining != null && s.capacity != null
        ? `; ${s.remaining}/${s.capacity} seats left`
        : '';
    const queue =
      s.queue_number != null ? `; your queue #${s.queue_number}` : '';
    const maps = s.maps_url ? `\n  Map: ${s.maps_url}` : '';
    return `• ${when}${seats}${queue}${place ? `\n  ${place}` : ''}${maps}`;
  }

  private resolveProgramContext(
    eligibility: AiEligibilityContext,
    prompt: string,
  ) {
    const q = prompt.toLowerCase();
    const fromEligible = eligibility.eligible_programs.find((p) => {
      const name = p.name.toLowerCase();
      const code = p.code.toLowerCase();
      return q.includes(name) || q.includes(code);
    });
    if (fromEligible) {
      return {
        name: fromEligible.name,
        code: fromEligible.code,
        description: fromEligible.description,
        location_scope: fromEligible.location_scope,
        period_windows: fromEligible.period_windows,
        disbursement_cooldown_days: fromEligible.disbursement_cooldown_days,
        can_apply: fromEligible.can_apply,
        apply_block_reason: fromEligible.apply_block_reason,
        cooldown_remaining_days: fromEligible.cooldown_remaining_days,
        eligible_again_at: fromEligible.eligible_again_at,
        upcoming_queue_slots: fromEligible.upcoming_queue_slots,
        office: null as AiEligibilityContext['applications'][number]['office'],
      };
    }

    const fromApp = eligibility.applications.find((a) => {
      const name = (a.program_name ?? '').toLowerCase();
      const code = (a.program_code ?? '').toLowerCase();
      const ref = a.reference_no.toLowerCase();
      return (
        (name && q.includes(name)) ||
        (code && q.includes(code)) ||
        q.includes(ref)
      );
    });
    if (fromApp) {
      return {
        name: fromApp.program_name ?? fromApp.reference_no,
        code: fromApp.program_code ?? '',
        description: null as string | null,
        location_scope: fromApp.office
          ? `office: ${fromApp.office.name}${fromApp.office.address ? ` — ${fromApp.office.address}` : ''}`
          : 'see application office / claim site on slots',
        period_windows: fromApp.period_windows,
        disbursement_cooldown_days: null as number | null,
        can_apply: true,
        apply_block_reason: null as string | null,
        cooldown_remaining_days: null as number | null,
        eligible_again_at: null as string | null,
        upcoming_queue_slots: fromApp.upcoming_queue_slots,
        office: fromApp.office,
      };
    }

    const preferredApp =
      eligibility.applications.find((a) => a.is_preferred) ?? null;
    if (preferredApp) {
      return {
        name: preferredApp.program_name ?? preferredApp.reference_no,
        code: preferredApp.program_code ?? '',
        description: null as string | null,
        location_scope: preferredApp.office
          ? `office: ${preferredApp.office.name}${preferredApp.office.address ? ` — ${preferredApp.office.address}` : ''}`
          : 'see application office / claim site on slots',
        period_windows: preferredApp.period_windows,
        disbursement_cooldown_days: null as number | null,
        can_apply: true,
        apply_block_reason: null as string | null,
        cooldown_remaining_days: null as number | null,
        eligible_again_at: null as string | null,
        upcoming_queue_slots: preferredApp.upcoming_queue_slots,
        office: preferredApp.office,
      };
    }

    const first = eligibility.eligible_programs[0];
    if (!first) return null;
    return {
      name: first.name,
      code: first.code,
      description: first.description,
      location_scope: first.location_scope,
      period_windows: first.period_windows,
      disbursement_cooldown_days: first.disbursement_cooldown_days,
      can_apply: first.can_apply,
      apply_block_reason: first.apply_block_reason,
      cooldown_remaining_days: first.cooldown_remaining_days,
      eligible_again_at: first.eligible_again_at,
      upcoming_queue_slots: first.upcoming_queue_slots,
      office: null as AiEligibilityContext['applications'][number]['office'],
    };
  }

  private mockProgramDetailsAnswer(
    eligibility: AiEligibilityContext | null,
    prompt: string,
  ): string {
    if (!eligibility) {
      return (
        'I could not load program details just now. Open Programs in the app, then try asking again.'
      );
    }
    const target = this.resolveProgramContext(eligibility, prompt);
    if (!target) {
      return (
        'I do not have a matching program yet. Open Programs (filtered to your location) and ask again with the program name.'
      );
    }

    const lines = [
      `${target.name}${target.code ? ` (${target.code})` : ''}`,
      target.description
        ? `Details: ${target.description}`
        : 'Details: (no description on file — open Programs for the full form).',
      `Coverage / location rules: ${target.location_scope}`,
    ];
    if (target.office) {
      lines.push(
        `Your application office: ${target.office.name}` +
          (target.office.address ? ` — ${target.office.address}` : '') +
          (target.office.maps_url ? `\nMap: ${target.office.maps_url}` : ''),
      );
    }
    if (target.upcoming_queue_slots[0]) {
      const s = target.upcoming_queue_slots[0];
      lines.push(
        `Nearest open claim slot: ${new Date(s.starts_at).toLocaleString()} at ${s.site_name || s.office_name}` +
          (s.site_address ? ` (${s.site_address})` : '') +
          '. Ask me for more queue times, or open Schedule to book.',
      );
    }
    lines.push(
      'I cannot change program details. Open Programs for the application form.',
    );
    return lines.join('\n');
  }

  private mockQueueSlotsAnswer(
    eligibility: AiEligibilityContext | null,
    prompt: string,
  ): string {
    if (!eligibility) {
      return (
        'I could not load queue slots just now. Open Schedule in the app after approval to see times and locations.'
      );
    }

    if (eligibility.my_disbursement_bookings.length) {
      const booked = eligibility.my_disbursement_bookings
        .slice(0, 3)
        .map((b) => this.formatSlotLine(b))
        .join('\n');
      return (
        `You already have a disbursement booking:\n${booked}\n` +
        'Open Schedule / Messages for your QR and reminders. I cannot change or book slots for you.'
      );
    }

    const target = this.resolveProgramContext(eligibility, prompt);
    const approvedApp = eligibility.applications.find(
      (a) => a.status === 'approved',
    );

    const slots =
      (approvedApp?.upcoming_queue_slots?.length
        ? approvedApp.upcoming_queue_slots
        : target?.upcoming_queue_slots) ?? [];

    if (!slots.length) {
      const needApproval = !approvedApp;
      return (
        (needApproval
          ? 'Queue booking is available after your application is approved. '
          : 'No open queue slots are listed right now for this program/office. ') +
        'Check Schedule later during the disbursement window, or ask about the disbursement period dates. ' +
        'I cannot create slots or book for you.'
      );
    }

    const label = target?.name ?? approvedApp?.program_name ?? 'your program';
    const lines = slots
      .slice(0, 5)
      .map((s) => this.formatSlotLine(s))
      .join('\n');
    const officeHint = approvedApp?.office
      ? `\nHandling office: ${approvedApp.office.name}${approvedApp.office.address ? ` — ${approvedApp.office.address}` : ''}`
      : '';

    return (
      `Open queue times for ${label} (disbursement period):\n${lines}${officeHint}\n` +
      'Open Schedule in the app to book one yourself — I cannot book for you.'
    );
  }

  private resolveProgramForDates(
    eligibility: AiEligibilityContext,
    prompt: string,
  ) {
    return this.resolveProgramContext(eligibility, prompt);
  }

  private mockProgramDatesAnswer(
    eligibility: AiEligibilityContext | null,
    prompt: string,
  ): string {
    if (!eligibility) {
      return (
        'I could not load program dates just now. Open Programs in the app to see period windows, then try asking again.'
      );
    }

    const target = this.resolveProgramForDates(eligibility, prompt);
    if (!target) {
      return (
        'I do not have a matching program for date details yet. Open Programs (filtered to your location) or apply first, then ask again with the program name.'
      );
    }

    const pw = target.period_windows;
    const q = prompt.toLowerCase();
    const wantsDisburs =
      /\b(disburs|schedule|payout|claim|cash)\b/.test(q);
    const wantsApply =
      /\b(apply|application|submit|deadline|filing)\b/.test(q);
    const wantsReview = /\b(review|evaluat|approv)\b/.test(q);

    const lines: string[] = [];
    if (wantsDisburs && !wantsApply && !wantsReview) {
      lines.push(
        `Disbursement / scheduling window for ${target.name}: ${this.formatDateRange(pw.disbursement)}.`,
      );
    } else if (wantsReview && !wantsApply && !wantsDisburs) {
      lines.push(
        `Review window for ${target.name}: ${this.formatDateRange(pw.review)}.`,
      );
    } else if (wantsApply && !wantsDisburs) {
      lines.push(
        `Application window for ${target.name}: ${this.formatDateRange(pw.application)}.`,
      );
    } else {
      lines.push(
        `For ${target.name}${target.code ? ` (${target.code})` : ''}:`,
        `• Application: ${this.formatDateRange(pw.application)}`,
        `• Review: ${this.formatDateRange(pw.review)}`,
        `• Disbursement / scheduling: ${this.formatDateRange(pw.disbursement)}`,
      );
    }

    if (
      target.disbursement_cooldown_days != null &&
      /\b(cooldown|again|re-?apply|next)\b/.test(q)
    ) {
      if (
        target.can_apply === false &&
        target.apply_block_reason === 'cooldown'
      ) {
        lines.push(
          `You already claimed aid for ${target.name}. Cooldown is ${target.disbursement_cooldown_days} day(s)` +
            (target.cooldown_remaining_days != null
              ? `; about ${target.cooldown_remaining_days} day(s) left`
              : '') +
            (target.eligible_again_at
              ? `; you can apply again after ${String(target.eligible_again_at).slice(0, 10)}`
              : '') +
            '.',
        );
      } else {
        lines.push(
          `Cooldown after claim/disbursement: about ${target.disbursement_cooldown_days} day(s) before you can apply again for this program.`,
        );
      }
    }

    lines.push(
      'Dates come from the program configuration — I cannot change them. Open Programs or Schedule in the app for the same windows.',
    );
    return lines.join('\n');
  }

  private mockApplicationStatusAnswer(
    eligibility: AiEligibilityContext | null,
    prompt: string,
  ): string {
    if (!eligibility) {
      return (
        'I could not load your applications just now. Open your applications list in the app to see status, then try asking again.'
      );
    }
    if (!eligibility.applications.length) {
      return (
        'You have no applications yet. Open Programs, pick one that matches your registered location, and submit an application. ' +
        'After that I can tell you its status here.'
      );
    }

    const q = prompt.toLowerCase();
    const byRef = eligibility.applications.find((a) =>
      q.includes(a.reference_no.toLowerCase()),
    );
    const byProgram = eligibility.applications.find((a) => {
      const name = (a.program_name ?? '').toLowerCase();
      const code = (a.program_code ?? '').toLowerCase();
      return (
        (name && q.includes(name)) ||
        (code && q.includes(code))
      );
    });
    const preferred =
      eligibility.applications.find((a) => a.is_preferred) ??
      eligibility.applications[0];
    const target = byRef ?? byProgram ?? preferred;

    let story = '';
    if (target.outcome_summary) {
      story = ` What happened: ${target.outcome_summary}`;
    } else if (target.status === 'approved') {
      story =
        ' Next: open Schedule to book a disbursement slot if offered.';
    } else if (target.status === 'draft') {
      story = ' Next: open the application, finish the form, and submit.';
    } else if (target.status === 'declined' || target.status === 'cancelled') {
      story =
        ' This one is closed; open Programs if you want to apply again when eligible.';
    } else if (target.status === 'disbursed' || target.status === 'claimed') {
      story =
        ' This application has completed disbursement (claimed).';
    } else {
      story =
        ' Staff is still processing it — check Messages for updates, or open the application for journey stages.';
    }

    if (target.claim) {
      const when = new Date(target.claim.slot_starts_at).toLocaleString();
      const place = [target.claim.site_name, target.claim.site_address]
        .filter(Boolean)
        .join(' — ');
      story +=
        ` Claim details: queue #${target.claim.queue_number}` +
        ` for ${when}` +
        (place ? ` at ${place}` : '') +
        (target.claim.face_liveness_passed
          ? '; face liveness verified at the cash window'
          : '') +
        '.';
    }

    const others =
      eligibility.applications.length > 1
        ? `\nYou also have ${eligibility.applications.length - 1} other application(s); name the program or reference number if you want a different one.`
        : '';

    const changeAsk = this.asksStatusMutation(prompt)
      ? ' I cannot change application status for you — staff must do that in the console.'
      : '';

    return (
      `${target.is_preferred ? 'Your current / preferred application' : 'Your application'} ` +
      `${target.reference_no}` +
      (target.program_name ? ` (${target.program_name})` : '') +
      ` is ${target.status_label} — currently at the ${target.stage_label} stage.` +
      story +
      changeAsk +
      others
    );
  }

  /** True when the user asks the assistant to change/approve/reject status. */
  private asksStatusMutation(prompt: string): boolean {
    const q = prompt.toLowerCase();
    return (
      /\b(change|update|set|make|mark|approve|reject|decline|cancel|revert)\b/.test(
        q,
      ) &&
      /\b(status|application|aplikasyon|approve|reject|claimed|disbursed|approved)\b/.test(
        q,
      ) &&
      /\b(for me|to |please|paki|gawin|palitan|i-approve|i-reject|baguhin)\b/.test(
        q,
      )
    ) ||
      /\b(change my (application )?status|update my status|approve (my|this|the) application|reject (my|this|the) application|i-approve|i-reject|palitan (mo )?(ang )?status|gawing approved|gawing claimed)\b/.test(
        q,
      );
  }

  private mockEligibilityAnswer(
    eligibility: AiEligibilityContext | null,
  ): string {
    if (!eligibility) {
      return (
        'I could not load your profile location just now. Open Profile to confirm municipality/address, ' +
        'then ask again — I only suggest programs that match your registered area (any region).'
      );
    }
    const loc = eligibility.location;
    const locLabel =
      loc.summary || loc.municipality || loc.address || 'your registered address';

    if (!loc.location_complete) {
      return (
        'Your Profile has no municipality/address yet, so I cannot safely match location-limited programs. ' +
        'Update Profile with your city/municipality and region details, then ask again. ' +
        'Open Programs afterward — the list uses the same location filter for every region.'
      );
    }

    if (!eligibility.eligible_programs.length) {
      return (
        `Based on your profile location (${locLabel}), ` +
        'there are currently no published programs you can apply for in EHelp. ' +
        'Confirm Profile details, or check Programs later when offerings for your area are published. ' +
        'I will not suggest programs outside your location.'
      );
    }

    const lines = eligibility.eligible_programs.slice(0, 8).map((p) => {
      const regionBit = p.regions.length
        ? ` [${p.regions.join(', ')}]`
        : '';
      const cooldownBit =
        p.can_apply === false && p.apply_block_reason === 'cooldown'
          ? p.eligible_again_at
            ? ` — cooldown until ${String(p.eligible_again_at).slice(0, 10)}`
            : ' — cooldown active (already claimed)'
          : p.can_apply === false && p.apply_block_reason === 'in_progress'
            ? ' — application in progress'
            : '';
      return `• ${p.name} (${p.code})${regionBit}${cooldownBit}`;
    });
    const more =
      eligibility.eligible_programs.length > 8
        ? `\n…and ${eligibility.eligible_programs.length - 8} more in Programs.`
        : '';

    return (
      `Based on your profile location (${locLabel}), ` +
      `you may be eligible to apply for these published programs (location/age already filtered):\n` +
      `${lines.join('\n')}${more}\n` +
      'Open Programs to start an application yourself. Final eligibility is still verified by staff — ' +
      'I cannot apply for you or promise approval.'
    );
  }
}
