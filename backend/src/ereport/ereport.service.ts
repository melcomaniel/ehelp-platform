import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { RbacAccessService } from '../auth/rbac-access.service';
import {
  UserAccountEntity,
} from '../users/user.entity';

export type EreportCategoryCode =
  | 'aid_process'
  | 'account_config'
  | 'mobile_feature';

type TokenCache = { accessToken: string; expiresAtMs: number };
type ViewTokenCache = { token: string; expiresAtMs: number };

const CATEGORIES: Array<{
  code: EreportCategoryCode;
  label: string;
  description: string;
  /** Upstream eReport report_type (staging catalog). */
  upstreamReportType: string;
  subjectPrefix: string;
}> = [
  {
    code: 'aid_process',
    label: 'Aid processes',
    description: 'Application delays, eligibility, claim/disbursement issues',
    upstreamReportType: 'red_tape',
    subjectPrefix: '[EHelp · Aid]',
  },
  {
    code: 'account_config',
    label: 'Account configuration',
    description: 'Sign-in, profile, SSO, or account access problems',
    upstreamReportType: 'scam',
    subjectPrefix: '[EHelp · Account]',
  },
  {
    code: 'mobile_feature',
    label: 'Mobile feature reporting',
    description: 'Bugs or feedback about the beneficiary mobile app',
    upstreamReportType: 'accident',
    subjectPrefix: '[EHelp · Mobile]',
  },
];

/** PSA defaults — NCR / Caloocan demo when beneficiary lacks codes. */
const DEFAULT_GEO = {
  region_code: '130000000',
  province_code: '137500000',
  municipality_code: '137501000',
  barangay_code: '137501001',
};

@Injectable()
export class EreportService {
  private readonly log = new Logger(EreportService.name);
  private tokenCache: TokenCache | null = null;
  private viewTokenCache: ViewTokenCache | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly dataSource: DataSource,
    private readonly rbac: RbacAccessService,
    @InjectRepository(UserAccountEntity)
    private readonly users: Repository<UserAccountEntity>,
  ) {}

  isLive(): boolean {
    return Boolean(
      this.config.get<string>('EREPORT_ACCESS_CODE')?.trim() ||
        this.config.get<string>('EREPORT_ACCESS_TOKEN')?.trim(),
    );
  }

  status() {
    return {
      configured: this.isLive(),
      mode: this.isLive() ? 'live' : 'mock',
      base_url: this.baseUrl(),
      has_view_token: Boolean(this.resolveViewTokenSync()),
      categories: CATEGORIES.map((c) => ({
        code: c.code,
        label: c.label,
        description: c.description,
      })),
      admin_region_code: this.adminRegionCode(),
    };
  }

  listCategories() {
    return CATEGORIES.map((c) => ({
      code: c.code,
      label: c.label,
      description: c.description,
    }));
  }

  async submitComplaint(
    actorUserId: string,
    input: {
      category_code: string;
      subject: string;
      message: string;
      evidences?: string[];
      gender?: string;
    },
  ) {
    const category = CATEGORIES.find((c) => c.code === input.category_code);
    if (!category) {
      throw new BadRequestException(
        'category_code must be aid_process, account_config, or mobile_feature',
      );
    }
    const subject = input.subject?.trim();
    const message = input.message?.trim();
    if (!subject) throw new BadRequestException('subject is required');
    if (!message) throw new BadRequestException('message is required');

    const user = await this.users.findOne({
      where: { id: actorUserId },
      relations: ['beneficiary'],
    });
    if (!user?.beneficiaryId || !user.beneficiary) {
      throw new ForbiddenException('Only beneficiaries can file eReport cases');
    }
    const b = user.beneficiary;
    const email = user.email?.trim();
    if (!email) {
      throw new BadRequestException(
        'Your account needs an email before filing a report',
      );
    }
    const mobile = this.normalizeMobile(b.phone);
    if (!mobile) {
      throw new BadRequestException(
        'Your profile needs a mobile number before filing a report',
      );
    }
    const first =
      b.firstName?.trim() ||
      b.fullName?.trim()?.split(/\s+/)[0] ||
      'Citizen';
    const last =
      b.lastName?.trim() ||
      b.fullName?.trim()?.split(/\s+/).slice(-1)[0] ||
      'Beneficiary';
    const gender =
      input.gender?.trim() ||
      b.gender?.trim() ||
      'Prefer not to say';
    const geo = this.geoFromBeneficiary(b.municipality, b.barangay);
    const fullSubject = `${category.subjectPrefix} ${subject}`.slice(0, 200);
    const payload = {
      mobile,
      first_name: first.slice(0, 80),
      last_name: last.slice(0, 80),
      gender,
      complainant_email: email,
      report_type: category.upstreamReportType,
      subject: fullSubject,
      message: `${message}\n\n(EHelp category: ${category.label} / ${category.code})`,
      evidences: input.evidences?.filter(Boolean) ?? [],
      region_code: geo.region_code,
      province_code: geo.province_code,
      municipality_code: geo.municipality_code,
      barangay_code: geo.barangay_code,
    };

    let caseNumber: string;
    let mode: 'live' | 'mock' = 'mock';
    if (this.isLive()) {
      try {
        const token = await this.getAccessToken();
        const res = await fetch(
          `${this.baseUrl()}/api/integration/submit_complaint`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
            body: JSON.stringify(payload),
          },
        );
        const body = (await res.json().catch(() => ({}))) as {
          code?: number;
          message?: string;
          case_number?: string;
        };
        if (!res.ok || !body.case_number) {
          throw new Error(
            body.message || `submit_complaint returned ${res.status}`,
          );
        }
        caseNumber = body.case_number;
        mode = 'live';
      } catch (err) {
        this.log.warn(
          `eReport submit failed, using mock case: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
        caseNumber = this.mockCaseNumber();
        mode = 'mock';
      }
    } else {
      caseNumber = this.mockCaseNumber();
    }

    await this.dataSource.query(
      `INSERT INTO ereport_cases (
         user_account_id, beneficiary_id, organization_id,
         case_number, category_code, report_type, subject, message,
         region_code, province_code, municipality_code, barangay_code,
         upstream_mode, details
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb)`,
      [
        user.id,
        user.beneficiaryId,
        user.organizationId,
        caseNumber,
        category.code,
        category.upstreamReportType,
        fullSubject,
        message,
        geo.region_code,
        geo.province_code,
        geo.municipality_code,
        geo.barangay_code,
        mode,
        JSON.stringify({
          evidences: payload.evidences,
          municipality_name: b.municipality ?? null,
          barangay_name: b.barangay ?? null,
        }),
      ],
    );

    return {
      case_number: caseNumber,
      category_code: category.code,
      mode,
      message:
        mode === 'live'
          ? 'We received your report. Track it with the case number.'
          : 'Report saved (mock eReport). Case number issued locally.',
    };
  }

  async listMyCases(actorUserId: string) {
    const rows = await this.dataSource.query<
      Array<{
        case_number: string;
        category_code: string;
        subject: string;
        message: string;
        upstream_mode: string;
        created_at: Date;
      }>
    >(
      `SELECT case_number, category_code, subject, message, upstream_mode, created_at
       FROM ereport_cases
       WHERE user_account_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [actorUserId],
    );
    return rows.map((r) => ({
      case_number: r.case_number,
      category_code: r.category_code,
      subject: r.subject,
      message: r.message,
      mode: r.upstream_mode,
      created_at: r.created_at,
    }));
  }

  async listAdminReports(
    actorUserId: string,
    opts: { region?: string; q?: string; page?: number; limit?: number },
  ) {
    await this.assertOrgAdmin(actorUserId);
    const regionCode = this.resolveRegionFilter(opts.region);
    const page = Math.max(1, Number(opts.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(opts.limit ?? 25)));
    const q = opts.q?.trim() || '';

    const viewToken = await this.getViewToken();
    if (viewToken && this.isLive()) {
      try {
        const url = new URL(`${this.baseUrl()}/api/integration/reports`);
        url.searchParams.set('page', String(page));
        url.searchParams.set('limit', String(limit));
        if (q) url.searchParams.set('q', q);
        const res = await fetch(url.toString(), {
          headers: {
            'X-EReport-View-Token': viewToken,
            Accept: 'application/json',
          },
        });
        const body = (await res.json().catch(() => ({}))) as {
          data?: unknown[];
          meta?: Record<string, unknown>;
          message?: string;
        };
        if (!res.ok) {
          throw new Error(body.message || `reports list ${res.status}`);
        }
        const filtered = this.filterReportsByRegion(body.data ?? [], regionCode);
        return {
          source: 'upstream' as const,
          region_code: regionCode,
          meta: body.meta ?? {
            total: filtered.length,
            per_page: limit,
            current_page: page,
            total_pages: 1,
          },
          data: filtered,
        };
      } catch (err) {
        this.log.warn(
          `Upstream reports list failed, falling back to local: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }

    const params: unknown[] = [regionCode];
    let searchClause = '';
    if (q) {
      params.push(`%${q}%`);
      searchClause =
        ` AND (c.case_number ILIKE $2 OR c.subject ILIKE $2 OR c.message ILIKE $2)`;
    }
    params.push(limit, (page - 1) * limit);
    const limitIdx = params.length - 1;
    const offsetIdx = params.length;
    const rows = await this.dataSource.query(
      `SELECT c.case_number, c.category_code, c.report_type, c.subject, c.message,
              c.region_code, c.municipality_code, c.upstream_mode, c.created_at, c.details,
              COALESCE(b.first_name, split_part(COALESCE(b.full_name, ''), ' ', 1)) AS first_name,
              COALESCE(
                b.last_name,
                NULLIF(regexp_replace(COALESCE(b.full_name, ''), '^\\S+\\s*', ''), '')
              ) AS last_name,
              b.full_name AS beneficiary_full_name,
              u.email AS complainant_email
       FROM ereport_cases c
       LEFT JOIN beneficiaries b ON b.id = c.beneficiary_id
       LEFT JOIN user_accounts u ON u.id = c.user_account_id
       WHERE c.region_code = $1${searchClause}
       ORDER BY c.created_at DESC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params,
    );
    const countRows = await this.dataSource.query<Array<{ n: string }>>(
      `SELECT COUNT(*)::text AS n FROM ereport_cases c
       WHERE c.region_code = $1${searchClause}`,
      params.slice(0, q ? 2 : 1),
    );
    const total = Number(countRows[0]?.n ?? 0);
    return {
      source: 'local' as const,
      region_code: regionCode,
      meta: {
        total,
        per_page: limit,
        current_page: page,
        total_pages: Math.max(1, Math.ceil(total / limit)),
      },
      data: rows.map((r: Record<string, unknown>) => {
        const full = String(r.beneficiary_full_name ?? '').trim();
        const first =
          String(r.first_name ?? '').trim() ||
          (full ? full.split(/\s+/)[0] : '');
        const last =
          String(r.last_name ?? '').trim() ||
          (full ? full.split(/\s+/).slice(1).join(' ') : '');
        return {
          type: 'reports',
          id: r.case_number,
          attributes: {
            case_number: r.case_number,
            report_type: {
              code: r.report_type,
              name: r.category_code,
            },
            subject: r.subject,
            message: r.message,
            region_code: r.region_code,
            created_at: r.created_at,
            mode: r.upstream_mode,
            complainant: {
              first_name: first || 'Citizen',
              last_name: last || '',
              email: r.complainant_email ?? null,
            },
          },
        };
      }),
    };
  }

  async getAdminReport(actorUserId: string, caseNumber: string) {
    await this.assertOrgAdmin(actorUserId);
    const ref = caseNumber?.trim();
    if (!ref) throw new BadRequestException('case_number is required');

    const viewToken = await this.getViewToken();
    if (viewToken && this.isLive()) {
      try {
        const res = await fetch(
          `${this.baseUrl()}/api/integration/reports/${encodeURIComponent(ref)}`,
          {
            headers: {
              'X-EReport-View-Token': viewToken,
              Accept: 'application/json',
            },
          },
        );
        const body = await res.json().catch(() => ({}));
        if (res.ok) return { source: 'upstream' as const, data: body };
      } catch (err) {
        this.log.warn(
          `Upstream report detail failed: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }

    const rows = await this.dataSource.query(
      `SELECT * FROM ereport_cases WHERE case_number = $1 LIMIT 1`,
      [ref],
    );
    if (!rows[0]) throw new NotFoundException('Report not found');
    const r = rows[0] as Record<string, unknown>;
    return {
      source: 'local' as const,
      data: {
        case_number: r.case_number,
        category_code: r.category_code,
        report_type: r.report_type,
        subject: r.subject,
        message: r.message,
        region_code: r.region_code,
        created_at: r.created_at,
        details: r.details,
        mode: r.upstream_mode,
      },
    };
  }

  /** Org Admin: start OTP to mint/refresh report view token. */
  async requestViewOtp(actorUserId: string, email: string) {
    await this.assertOrgAdmin(actorUserId);
    if (!this.isLive()) {
      return {
        code: 200,
        already_verified: true,
        message: 'Mock mode — set EREPORT_REPORT_VIEW_TOKEN or use local cases',
        mode: 'mock' as const,
      };
    }
    const token = await this.getAccessToken();
    const res = await fetch(`${this.baseUrl()}/api/integration/verify/request`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: email.trim() }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new BadRequestException(
        (body as { message?: string }).message || 'OTP request failed',
      );
    }
    return { ...body, mode: 'live' as const };
  }

  async confirmViewOtp(
    actorUserId: string,
    input: { email: string; otp: string },
  ) {
    await this.assertOrgAdmin(actorUserId);
    if (!this.isLive()) {
      return {
        code: 200,
        report_view_token: 'mock-view-token',
        mode: 'mock' as const,
      };
    }
    const token = await this.getAccessToken();
    const res = await fetch(`${this.baseUrl()}/api/integration/verify/confirm`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: input.email.trim(),
        otp: input.otp.trim(),
      }),
    });
    const body = (await res.json().catch(() => ({}))) as {
      report_view_token?: string;
      expires_at?: string;
      message?: string;
    };
    if (!res.ok || !body.report_view_token) {
      throw new BadRequestException(body.message || 'OTP confirm failed');
    }
    const expiresAt = body.expires_at
      ? Date.parse(body.expires_at)
      : Date.now() + 24 * 3600_000;
    this.viewTokenCache = {
      token: body.report_view_token,
      expiresAtMs: expiresAt,
    };
    return { ...body, mode: 'live' as const };
  }

  private async assertOrgAdmin(actorUserId: string) {
    const roles = await this.rbac.listErdRoles(actorUserId);
    if (!roles.includes('ORG_ADMIN')) {
      throw new ForbiddenException(
        'Only Organization Admins can view eReport appeals',
      );
    }
    const user = await this.users.findOne({ where: { id: actorUserId } });
    if (!user?.organizationId) {
      throw new ForbiddenException('Organization scope required');
    }
  }

  private resolveRegionFilter(region?: string): string {
    const raw = (region ?? '').trim().toUpperCase();
    if (!raw || raw === 'NCR') return this.adminRegionCode();
    if (/^\d{9}$/.test(raw)) return raw;
    return this.adminRegionCode();
  }

  private adminRegionCode(): string {
    return (
      this.config.get<string>('EREPORT_ADMIN_REGION_CODE')?.trim() ||
      DEFAULT_GEO.region_code
    );
  }

  private filterReportsByRegion(data: unknown[], regionCode: string): unknown[] {
    return data.filter((item) => {
      if (!item || typeof item !== 'object') return false;
      const attrs =
        (item as { attributes?: Record<string, unknown> }).attributes ??
        (item as Record<string, unknown>);
      const address = attrs.address as Record<string, unknown> | undefined;
      const code =
        attrs.region_code ??
        address?.region_code ??
        address?.region ??
        null;
      if (code == null) return true; // keep if upstream omits geo
      return String(code) === regionCode;
    });
  }

  private geoFromBeneficiary(
    municipality?: string | null,
    _barangay?: string | null,
  ) {
    const region =
      this.config.get<string>('EREPORT_DEFAULT_REGION_CODE')?.trim() ||
      DEFAULT_GEO.region_code;
    const province =
      this.config.get<string>('EREPORT_DEFAULT_PROVINCE_CODE')?.trim() ||
      DEFAULT_GEO.province_code;
    const muni =
      this.config.get<string>('EREPORT_DEFAULT_MUNICIPALITY_CODE')?.trim() ||
      DEFAULT_GEO.municipality_code;
    const brgy =
      this.config.get<string>('EREPORT_DEFAULT_BARANGAY_CODE')?.trim() ||
      DEFAULT_GEO.barangay_code;
    // Keep NCR defaults for demo; municipality name is stored in details.
    void municipality;
    return {
      region_code: region,
      province_code: province,
      municipality_code: muni,
      barangay_code: brgy,
    };
  }

  private normalizeMobile(phone?: string | null): string | null {
    if (!phone) return null;
    const digits = phone.replace(/\D/g, '');
    if (digits.startsWith('63') && digits.length >= 12) return digits.slice(0, 12);
    if (digits.startsWith('0') && digits.length === 11) {
      return `63${digits.slice(1)}`;
    }
    if (digits.length === 10) return `63${digits}`;
    return digits.length >= 10 ? digits : null;
  }

  private mockCaseNumber(): string {
    const d = new Date();
    const y = String(d.getFullYear()).slice(2);
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const seq = Math.floor(Math.random() * 9000 + 1000);
    return `EHELP-${y}${m}${day}-${seq}`;
  }

  private baseUrl(): string {
    return (
      this.config.get<string>('EREPORT_BASE_URL')?.replace(/\/$/, '') ||
      'https://stg-ereport-ws.oueg.info'
    );
  }

  private resolveViewTokenSync(): string | null {
    if (this.viewTokenCache && this.viewTokenCache.expiresAtMs > Date.now() + 60_000) {
      return this.viewTokenCache.token;
    }
    return this.config.get<string>('EREPORT_REPORT_VIEW_TOKEN')?.trim() || null;
  }

  private async getViewToken(): Promise<string | null> {
    return this.resolveViewTokenSync();
  }

  private async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.tokenCache && this.tokenCache.expiresAtMs > now + 60_000) {
      return this.tokenCache.accessToken;
    }
    const staticToken = this.config.get<string>('EREPORT_ACCESS_TOKEN')?.trim();
    if (staticToken) {
      this.tokenCache = {
        accessToken: staticToken,
        expiresAtMs: now + 8 * 3600_000,
      };
      return staticToken;
    }
    const accessCode = this.config.get<string>('EREPORT_ACCESS_CODE')?.trim();
    if (!accessCode) {
      throw new ServiceUnavailableException(
        'Set EREPORT_ACCESS_TOKEN or EREPORT_ACCESS_CODE',
      );
    }
    const res = await fetch(`${this.baseUrl()}/api/integration/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ access_code: accessCode }),
    });
    const body = (await res.json().catch(() => ({}))) as {
      access_token?: string;
      expires_at?: string;
      message?: string;
    };
    if (!res.ok || !body.access_token) {
      throw new Error(body.message || `token endpoint returned ${res.status}`);
    }
    const expiresAt = body.expires_at
      ? Date.parse(body.expires_at)
      : now + 8 * 3600_000;
    this.tokenCache = {
      accessToken: body.access_token,
      expiresAtMs: expiresAt,
    };
    return body.access_token;
  }
}
