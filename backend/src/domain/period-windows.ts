/** Program lifecycle windows stored on disbursement_rules.period_windows */

export type PeriodWindows = {
  application_start?: string | null;
  application_end?: string | null;
  review_start?: string | null;
  review_end?: string | null;
  disbursement_start?: string | null;
  disbursement_end?: string | null;
  /** @deprecated Review runs during the application window; leeway is unused. */
  review_leeway_days?: number;
};

export function normalizePeriodWindows(
  input?: PeriodWindows | null,
): PeriodWindows | null {
  if (!input || typeof input !== 'object') return null;
  const out: PeriodWindows = {
    application_start: input.application_start || null,
    application_end: input.application_end || null,
    // Review is concurrent with applications — same open as apply unless overridden.
    review_start: input.review_start || input.application_start || null,
    // Optional hard close only; do NOT auto-extend past application_end.
    review_end: input.review_end || null,
    disbursement_start: input.disbursement_start || null,
    disbursement_end: input.disbursement_end || null,
    review_leeway_days: 0,
  };
  return out;
}

function inRange(
  now: Date,
  start?: string | null,
  end?: string | null,
): boolean {
  if (!start && !end) return true;
  const t = now.getTime();
  if (start) {
    const s = new Date(start).getTime();
    if (!Number.isNaN(s) && t < s) return false;
  }
  if (end) {
    const e = new Date(end).getTime();
    if (!Number.isNaN(e) && t > e) return false;
  }
  return true;
}

/** Whether a window is open / not started / closed / unset (for AI + UI). */
export function describePeriodPhase(
  start?: string | null,
  end?: string | null,
  now = new Date(),
): 'open' | 'not_started' | 'closed' | 'unset' {
  if (!start && !end) return 'unset';
  const t = now.getTime();
  if (start) {
    const s = new Date(start).getTime();
    if (!Number.isNaN(s) && t < s) return 'not_started';
  }
  if (end) {
    const e = new Date(end).getTime();
    if (!Number.isNaN(e) && t > e) return 'closed';
  }
  return 'open';
}

export function summarizePeriodWindowsForAi(
  input?: PeriodWindows | null,
  now = new Date(),
) {
  const p = normalizePeriodWindows(input ?? null);
  if (!p) {
    return {
      application: {
        start: null as string | null,
        end: null as string | null,
        state: 'unset' as const,
      },
      review: {
        start: null as string | null,
        end: null as string | null,
        state: 'unset' as const,
      },
      disbursement: {
        start: null as string | null,
        end: null as string | null,
        state: 'unset' as const,
      },
    };
  }
  const reviewStart = p.review_start || p.application_start || null;
  const reviewEnd = p.review_end || p.application_end || null;
  return {
    application: {
      start: p.application_start || null,
      end: p.application_end || null,
      state: describePeriodPhase(p.application_start, p.application_end, now),
    },
    review: {
      start: reviewStart,
      end: reviewEnd,
      state: describePeriodPhase(reviewStart, reviewEnd, now),
    },
    disbursement: {
      start: p.disbursement_start || null,
      end: p.disbursement_end || null,
      state: describePeriodPhase(
        p.disbursement_start,
        p.disbursement_end,
        now,
      ),
    },
  };
}

export function assertApplicationPeriodOpen(
  rules: Record<string, unknown>,
  now = new Date(),
): void {
  const p = normalizePeriodWindows(
    (rules.period_windows as PeriodWindows) ?? null,
  );
  if (!p) return;
  if (!inRange(now, p.application_start, p.application_end)) {
    throw new Error(
      'Application period is closed for this program. Submissions are not accepted right now.',
    );
  }
}

/**
 * Evaluators/approvers may act as soon as applications are open — they do not
 * wait for a separate review phase. Close uses optional review_end, otherwise
 * the application close date (no leeway days).
 */
export function assertReviewPeriodOpen(
  rules: Record<string, unknown>,
  now = new Date(),
): void {
  const p = normalizePeriodWindows(
    (rules.period_windows as PeriodWindows) ?? null,
  );
  if (!p) return;
  const start = p.review_start || p.application_start;
  const end = p.review_end || p.application_end;
  if (!inRange(now, start, end)) {
    throw new Error(
      'Review / approval is closed for this program (outside the application window).',
    );
  }
}

export function assertDisbursementPeriodOpen(
  rules: Record<string, unknown>,
  now = new Date(),
): void {
  const p = normalizePeriodWindows(
    (rules.period_windows as PeriodWindows) ?? null,
  );
  if (!p) return;
  if (!p.disbursement_start && !p.disbursement_end) {
    throw new Error(
      'Disbursement scheduling window is not configured for this program. Set it under Programs → Program periods.',
    );
  }
  if (!inRange(now, p.disbursement_start, p.disbursement_end)) {
    const start = p.disbursement_start
      ? new Date(p.disbursement_start).toISOString()
      : '(unset)';
    const end = p.disbursement_end
      ? new Date(p.disbursement_end).toISOString()
      : '(unset)';
    throw new Error(
      `Disbursement scheduling period is closed for this program. Window: ${start} → ${end}.`,
    );
  }
}

/** Slot times must fall inside the program's disbursement scheduling window. */
export function assertSlotWithinDisbursementWindow(
  rules: Record<string, unknown>,
  startsAt: Date,
  endsAt: Date,
): void {
  const p = normalizePeriodWindows(
    (rules.period_windows as PeriodWindows) ?? null,
  );
  if (!p) {
    throw new Error(
      'Disbursement scheduling window is not configured for this program. Set it under Programs → Program periods.',
    );
  }
  if (!p.disbursement_start && !p.disbursement_end) {
    throw new Error(
      'Disbursement scheduling window is not configured for this program. Set Disbursement scheduling opens/closes on Programs.',
    );
  }

  if (p.disbursement_start) {
    const start = new Date(p.disbursement_start).getTime();
    if (!Number.isNaN(start) && startsAt.getTime() < start) {
      throw new Error(
        `Slot starts before this program's disbursement window opens (${p.disbursement_start}).`,
      );
    }
  }
  if (p.disbursement_end) {
    const end = new Date(p.disbursement_end).getTime();
    if (!Number.isNaN(end) && endsAt.getTime() > end) {
      throw new Error(
        `Slot ends after this program's disbursement window closes (${p.disbursement_end}).`,
      );
    }
  }
}

export function disbursementWindowOf(
  rules: Record<string, unknown>,
): { start: Date | null; end: Date | null; windows: PeriodWindows | null } {
  const p = normalizePeriodWindows(
    (rules.period_windows as PeriodWindows) ?? null,
  );
  if (!p) return { start: null, end: null, windows: null };
  const start = p.disbursement_start
    ? new Date(p.disbursement_start)
    : null;
  const end = p.disbursement_end ? new Date(p.disbursement_end) : null;
  return {
    start: start && !Number.isNaN(start.getTime()) ? start : null,
    end: end && !Number.isNaN(end.getTime()) ? end : null,
    windows: p,
  };
}

/** Minimum calendar days between today and a slot’s start date (inclusive of lead). */
export const DISBURSEMENT_SLOT_MIN_LEAD_DAYS = 2;

/** Earliest moment a slot may start: local midnight of (today + lead days). */
export function earliestBookableSlotStart(
  now = new Date(),
  leadDays = DISBURSEMENT_SLOT_MIN_LEAD_DAYS,
): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + leadDays);
  return d;
}

export function assertSlotMeetsLeadTime(
  startsAt: Date,
  now = new Date(),
  leadDays = DISBURSEMENT_SLOT_MIN_LEAD_DAYS,
): void {
  const earliest = earliestBookableSlotStart(now, leadDays);
  if (startsAt.getTime() < earliest.getTime()) {
    throw new Error(
      `Disbursement slots must be scheduled at least ${leadDays} days in advance (earliest allowed: ${earliest.toISOString()}).`,
    );
  }
}

/**
 * Once a booking exists, rebooking is locked from (slot local date − leadDays)
 * midnight onward — same 2-day buffer as booking lead time.
 */
export function assertRebookAllowed(
  currentSlotStartsAt: Date,
  now = new Date(),
  leadDays = DISBURSEMENT_SLOT_MIN_LEAD_DAYS,
): void {
  const slotDay = new Date(currentSlotStartsAt);
  slotDay.setHours(0, 0, 0, 0);
  const lockFrom = new Date(slotDay);
  lockFrom.setDate(lockFrom.getDate() - leadDays);
  if (now.getTime() >= lockFrom.getTime()) {
    throw new Error(
      `Rebooking is locked within ${leadDays} days of your scheduled disbursement (${currentSlotStartsAt.toISOString()}). Contact the office if you need help.`,
    );
  }
}

/** Map ERD application status → applicant journey stage type. */
export function stageTypeFromErdStatus(erdStatus: string): string {
  switch (erdStatus) {
    case 'draft':
      return 'form';
    case 'submitted':
      return 'verify';
    case 'in_evaluation':
    case 'in_approval':
    case 'rejected':
      return 'review';
    case 'approved':
    case 'disbursed':
    case 'claimed':
      return 'disbursement';
    default:
      return 'review';
  }
}

export function defaultApplicantStages() {
  return [
    { name: 'Application Form', type: 'form' },
    { name: 'Face Verification', type: 'verify' },
    { name: 'Review', type: 'review' },
    { name: 'Disbursement', type: 'disbursement' },
  ];
}
