import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { DataSource } from 'typeorm';
import { OrganizationInvitationEntity } from '../organizations/organization.entities';
import { BeneficiaryEntity } from '../users/beneficiary.entity';
import { LivenessSessionEntity } from '../users/liveness-session.entity';
import { StaffProfileEntity } from '../users/staff-profile.entity';
import {
  APP_ROLE_TO_ERD,
  AppRole,
  ERD_ROLE_TO_APP,
  RoleEntity,
  UserAccountEntity,
  UserRoleAssignmentEntity,
} from '../users/user.entity';
import {
  assertPlatformAllowed,
  ERD_ROLES,
  WEB_ADMIN_ERD_ROLES,
  type ClientPlatform,
} from './platform-policy';
import type {
  EgovSsoProfile,
  EgovSsoProvider,
  EverifyProvider,
  LivenessProvider,
} from './providers/types';
import {
  EGOV_SSO_PROVIDER,
  EVERIFY_PROVIDER,
  LIVENESS_PROVIDER,
} from './providers/tokens';

const STAFF_CREATABLE_BY: Record<string, AppRole[]> = {
  // Tenant onboarding is atomic through OrganizationService. The generic
  // staff endpoint must not let the platform operator grant tenant business roles.
  PLATFORM_ADMIN: [],
  ORG_ADMIN: ['satellite_admin', 'evaluator', 'approver'],
  OFFICE_ADMIN: ['evaluator', 'approver'],
};

@Injectable()
export class AuthService {
  private readonly log = new Logger(AuthService.name);

  constructor(
    @InjectRepository(UserAccountEntity)
    private readonly users: Repository<UserAccountEntity>,
    @InjectRepository(BeneficiaryEntity)
    private readonly beneficiaries: Repository<BeneficiaryEntity>,
    @InjectRepository(StaffProfileEntity)
    private readonly staffProfiles: Repository<StaffProfileEntity>,
    @InjectRepository(RoleEntity)
    private readonly roles: Repository<RoleEntity>,
    @InjectRepository(UserRoleAssignmentEntity)
    private readonly roleAssignments: Repository<UserRoleAssignmentEntity>,
    @InjectRepository(LivenessSessionEntity)
    private readonly livenessSessions: Repository<LivenessSessionEntity>,
    private readonly dataSource: DataSource,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    @Inject(EGOV_SSO_PROVIDER) private readonly sso: EgovSsoProvider,
    @Inject(EVERIFY_PROVIDER) private readonly everify: EverifyProvider,
    @Inject(LIVENESS_PROVIDER) private readonly liveness: LivenessProvider,
  ) {}

  private ensureBeneficiary(user: UserAccountEntity): BeneficiaryEntity {
    if (!user.beneficiary) {
      throw new BadRequestException('Account has no beneficiary profile');
    }
    return user.beneficiary;
  }

  private async resolveAppRole(userId: string): Promise<{
    appRole: AppRole;
    erdCode: string;
  }> {
    const assignments = await this.roleAssignments.find({
      where: { userAccountId: userId },
      relations: ['role'],
      take: 1,
    });
    const code = assignments[0]?.role?.code ?? 'BENEFICIARY';
    return {
      erdCode: code,
      appRole: ERD_ROLE_TO_APP[code] ?? 'customer',
    };
  }

  private async attachRole(
    user: UserAccountEntity,
  ): Promise<UserAccountEntity> {
    const { appRole, erdCode } = await this.resolveAppRole(user.id);
    user.appRole = appRole;
    user.erdRoleCode = erdCode;
    return user;
  }

  private assertClientPlatform(
    user: UserAccountEntity,
    client: ClientPlatform = 'mobile',
  ) {
    const check = assertPlatformAllowed(user.erdRoleCode, client);
    if (!check.ok) {
      throw new ForbiddenException({
        message: check.message,
        platform: check.required === 'web' ? 'web_required' : 'mobile_required',
        erd_role: user.erdRoleCode,
        role: user.appRole,
      });
    }
  }

  private async assignRole(
    userId: string,
    appRole: AppRole,
    officeId: string | null = null,
  ) {
    const erdCode = APP_ROLE_TO_ERD[appRole];
    const role = await this.roles.findOne({ where: { code: erdCode } });
    if (!role) {
      throw new BadRequestException(`Role ${erdCode} is not seeded`);
    }
    const existing = await this.roleAssignments.findOne({
      where: { userAccountId: userId, roleId: role.id },
    });
    if (!existing) {
      await this.roleAssignments.save(
        this.roleAssignments.create({
          userAccountId: userId,
          roleId: role.id,
          officeId,
        }),
      );
    }
  }

  private async loadStaffProfile(userId: string) {
    return this.staffProfiles.findOne({ where: { userAccountId: userId } });
  }

  private async findByEgovUniqid(uniqid: string) {
    const user = await this.users.findOne({
      where: { beneficiary: { egovUniqid: uniqid } },
    });
    return user ? this.attachRole(user) : null;
  }

  private async findByEmail(email: string) {
    const user = await this.users.findOne({ where: { email } });
    return user ? this.attachRole(user) : null;
  }

  private async findById(id: string) {
    const user = await this.users.findOne({ where: { id } });
    return user ? this.attachRole(user) : null;
  }

  toProfile(user: UserAccountEntity, staff?: StaffProfileEntity | null) {
    const b = user.beneficiary;
    const fullName =
      b?.fullName ||
      staff?.fullName ||
      (user.email ? user.email.split('@')[0] : '') ||
      '';
    return {
      id: user.id,
      email: user.email,
      phone: b?.phone ?? staff?.phone ?? null,
      full_name: fullName,
      role: user.appRole,
      erd_role: user.erdRoleCode,
      account_type: user.accountType,
      allowed_platform: user.erdRoleCode === 'BENEFICIARY' ? 'mobile' : 'web',
      region_id: user.officeId,
      office_id: user.officeId,
      organization_id: user.organizationId,
      id_number: null,
      id_type: null,
      face_scan_verified: b?.faceScanVerified ?? false,
      face_scan_url: b?.faceScanUrl ?? null,
      pin_expires_at: b?.pinExpiresAt?.toISOString() ?? null,
      validation_status: b?.validationStatus ?? 'validated',
      disbursement_preference: null,
      disbursement_details: {},
      is_active: user.isActive,
      egov_uniqid: b?.egovUniqid ?? null,
      profile_locked: b?.profileLocked ?? true,
      first_name: b?.firstName ?? null,
      middle_name: b?.middleName ?? null,
      last_name: b?.lastName ?? null,
      birth_date: b?.dateOfBirth ?? null,
      address: b?.address ?? null,
      needs_everify: Boolean(b?.egovUniqid) && !b?.everifyVerifiedAt,
      everify_verified_at: b?.everifyVerifiedAt?.toISOString() ?? null,
    };
  }

  private async issueTokens(user: UserAccountEntity) {
    await this.assertActiveContext(user);
    const staff =
      WEB_ADMIN_ERD_ROLES.has(user.erdRoleCode) ||
      user.erdRoleCode === ERD_ROLES.EVALUATOR ||
      user.erdRoleCode === ERD_ROLES.APPROVER
        ? await this.loadStaffProfile(user.id)
        : null;
    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      role: user.appRole,
      erd_role: user.erdRoleCode,
      email: user.email,
    });
    return {
      access_token: accessToken,
      token_type: 'Bearer',
      user: this.toProfile(user, staff),
    };
  }

  private applySsoProfile(beneficiary: BeneficiaryEntity, p: EgovSsoProfile) {
    beneficiary.egovUniqid = p.uniqid;
    beneficiary.phone = p.mobile ?? beneficiary.phone;
    beneficiary.firstName = p.first_name ?? beneficiary.firstName;
    beneficiary.middleName = p.middle_name ?? beneficiary.middleName;
    beneficiary.lastName = p.last_name ?? beneficiary.lastName;
    beneficiary.suffix = p.suffix ?? beneficiary.suffix;
    beneficiary.dateOfBirth = p.birth_date ?? beneficiary.dateOfBirth;
    beneficiary.gender = p.gender ?? beneficiary.gender;
    beneficiary.nationality = p.nationality ?? beneficiary.nationality;
    beneficiary.photoUrl = p.photo ?? beneficiary.photoUrl;
    beneficiary.address = p.address ?? beneficiary.address;
    beneficiary.street = p.street ?? beneficiary.street;
    beneficiary.barangay = p.barangay ?? beneficiary.barangay;
    beneficiary.municipality = p.municipality ?? beneficiary.municipality;
    beneficiary.fullName =
      [p.first_name, p.middle_name, p.last_name, p.suffix]
        .filter(Boolean)
        .join(' ')
        .trim() || beneficiary.fullName;
    beneficiary.profileLocked = true;
  }

  /** eGov SSO: exchange_code → upsert beneficiary (mobile) or link staff (web) → JWT */
  async ssoExchange(
    exchangeCode: string,
    clientPlatform: ClientPlatform = 'mobile',
  ) {
    const profile = await this.sso.exchangeCode(exchangeCode);

    let user = await this.findByEgovUniqid(profile.uniqid);

    if (!user && profile.email) {
      user = await this.findByEmail(profile.email);
    }

    const isNew = !user;
    if (!user) {
      if (clientPlatform === 'web') {
        throw new ForbiddenException({
          message:
            'Staff account not provisioned. Ask an Organization or Office Admin to create your account, then sign in with SSO.',
          platform: 'web_required',
          code: 'staff_not_provisioned',
        });
      }
      const beneficiary = await this.beneficiaries.save(
        this.beneficiaries.create({
          fullName: '',
          validationStatus: 'pending',
        }),
      );
      user = await this.users.save(
        this.users.create({
          accountType: 'beneficiary',
          beneficiary,
          email: profile.email ?? null,
          status: 'active',
        }),
      );
      await this.assignRole(user.id, 'customer');
      user = (await this.findById(user.id))!;
    }

    if (user.accountType === 'beneficiary' || user.beneficiary) {
      const beneficiary = this.ensureBeneficiary(user);
      this.applySsoProfile(beneficiary, profile);
      if (profile.email) user.email = profile.email;
      await this.beneficiaries.save(beneficiary);
      user = await this.users.save(user);
    } else {
      if (profile.email) user.email = profile.email;
      user = await this.users.save(user);
      const staff = await this.loadStaffProfile(user.id);
      if (staff) {
        const name = [
          profile.first_name,
          profile.middle_name,
          profile.last_name,
        ]
          .filter(Boolean)
          .join(' ')
          .trim();
        if (name) staff.fullName = name;
        if (profile.mobile) staff.phone = profile.mobile;
        await this.staffProfiles.save(staff);
      }
    }

    user = await this.attachRole(user);
    this.assertClientPlatform(user, clientPlatform);
    await this.assertActiveContext(user);
    await this.acceptPendingOrganizationInvitation(user);

    const tokens = await this.issueTokens(user);
    return {
      ...tokens,
      is_new_user: isNew,
      needs_everify:
        Boolean(user.beneficiary?.egovUniqid) &&
        !user.beneficiary?.everifyVerifiedAt,
    };
  }

  async createLivenessSession(input: {
    purpose: string;
    userId?: string;
    callbackUrl?: string;
    action?: string;
    publicBaseUrl?: string;
  }) {
    const created = await this.liveness.createSession({
      action: input.action ?? 'close',
      callbackUrl: input.callbackUrl ?? 'ehelp://liveness-callback',
      publicBaseUrl: input.publicBaseUrl,
    });

    await this.livenessSessions.save(
      this.livenessSessions.create({
        userId: input.userId ?? null,
        sessionToken: created.token,
        purpose: input.purpose || 'registration',
        status: 'pending',
        providerPayload: {
          source: created.source ?? 'unknown',
        },
      }),
    );

    return {
      token: created.token,
      url: created.url,
      session_id: created.token,
      purpose: input.purpose,
      provider: created.source ?? 'unknown',
    };
  }

  /** Bind eVerify Web SDK session_id after camera capture completes. */
  async bindEverifyLiveness(input: {
    correlation: string;
    everifySessionId: string;
    referenceImageUrl?: string;
  }) {
    const row = await this.livenessSessions.findOne({
      where: { sessionToken: input.correlation },
    });
    if (!row) {
      throw new BadRequestException('Unknown liveness correlation token');
    }
    row.status = 'SUCCEEDED';
    row.confidenceScore = '99';
    row.referenceImageUrl = input.referenceImageUrl ?? null;
    row.completedAt = new Date();
    row.providerPayload = {
      ...(row.providerPayload ?? {}),
      source: 'everify_sdk',
      correlation: input.correlation,
      everify_session_id: input.everifySessionId,
    };
    await this.livenessSessions.save(row);
    this.log.log(
      `eVerify liveness bound correlation=${input.correlation} everify_session_id=${input.everifySessionId}`,
    );
    return {
      ok: true,
      correlation: input.correlation,
      everify_session_id: input.everifySessionId,
    };
  }

  async verifyLiveness(sessionToken: string, userId?: string) {
    let row = await this.livenessSessions.findOne({
      where: { sessionToken },
    });

    if (!row) {
      row =
        (await this.livenessSessions
          .createQueryBuilder('s')
          .where(`s.provider_payload->>'everify_session_id' = :sid`, {
            sid: sessionToken,
          })
          .getOne()) ?? null;
    }

    const payload = row?.providerPayload ?? {};
    const everifySessionId =
      typeof payload.everify_session_id === 'string'
        ? payload.everify_session_id
        : null;
    if (
      row &&
      payload.source === 'everify_sdk' &&
      row.status === 'SUCCEEDED' &&
      everifySessionId
    ) {
      if (userId) {
        row.userId = userId;
        await this.livenessSessions.save(row);
        const user = await this.findById(userId);
        if (user?.beneficiary) {
          user.beneficiary.faceScanVerified = true;
          user.beneficiary.faceScanUrl = row.referenceImageUrl ?? null;
          await this.beneficiaries.save(user.beneficiary);
        }
      }
      return {
        passed: true,
        status: 'SUCCEEDED',
        confidence_score: Number(row.confidenceScore ?? 99),
        reference_image_url: row.referenceImageUrl,
        face_liveness_session_id: everifySessionId,
        threshold: Number(
          this.config.get('FACE_LIVENESS_MIN_CONFIDENCE') ?? 95,
        ),
        message: 'eVerify Face Liveness passed',
      };
    }

    if (payload.source === 'everify_sdk' && row?.status === 'pending') {
      throw new BadRequestException(
        'Face liveness not finished yet — complete the camera check, then tap Verify',
      );
    }

    const result = await this.liveness.getResult(sessionToken);
    if (row) {
      row.status = result.status;
      row.confidenceScore = String(result.confidenceScore);
      row.referenceImageUrl = result.referenceImageUrl ?? null;
      row.completedAt = new Date();
      row.providerPayload = {
        ...(row.providerPayload ?? {}),
        ...(result as unknown as Record<string, unknown>),
      };
      if (userId) row.userId = userId;
      await this.livenessSessions.save(row);
    }

    if (result.passed && userId) {
      const user = await this.findById(userId);
      if (user?.beneficiary) {
        user.beneficiary.faceScanVerified = true;
        user.beneficiary.faceScanUrl = result.referenceImageUrl ?? null;
        await this.beneficiaries.save(user.beneficiary);
      }
    }

    return {
      passed: result.passed,
      status: result.status,
      confidence_score: result.confidenceScore,
      reference_image_url: result.referenceImageUrl ?? null,
      face_liveness_session_id: sessionToken,
      threshold: Number(this.config.get('FACE_LIVENESS_MIN_CONFIDENCE') ?? 95),
      message: result.passed
        ? 'Liveness passed'
        : 'Liveness failed — retry required',
    };
  }

  /** First-time: eVerify after liveness (+ optional QR) */
  async firstTimeEverify(
    userId: string,
    input: {
      face_liveness_session_id: string;
      qr_value?: string;
      first_name?: string;
      middle_name?: string;
      last_name?: string;
      suffix?: string;
      birth_date?: string;
    },
  ) {
    const user = await this.findById(userId);
    if (!user) throw new UnauthorizedException();
    const beneficiary = this.ensureBeneficiary(user);

    const liveness = await this.verifyLiveness(
      input.face_liveness_session_id,
      userId,
    );
    if (!liveness.passed) {
      throw new BadRequestException(
        'Face liveness must succeed before eVerify',
      );
    }

    const everifySessionId =
      liveness.face_liveness_session_id || input.face_liveness_session_id;

    this.log.log(
      `firstTimeEverify user=${userId} input=${input.face_liveness_session_id} everify_session_id=${everifySessionId} qr=${Boolean(input.qr_value)}`,
    );

    if (!liveness.face_liveness_session_id) {
      throw new BadRequestException(
        'No eVerify Face Liveness session_id bound. Complete in-app WebView liveness, then verify QR immediately with that fresh capture (do not reuse a session after a failed /api/query).',
      );
    }

    const verified = input.qr_value
      ? await this.everify.verifyQr({
          qrValue: input.qr_value,
          faceLivenessSessionId: everifySessionId,
        })
      : await this.everify.verifyPersonalInfo({
          firstName: input.first_name || beneficiary.firstName || '',
          middleName: input.middle_name || beneficiary.middleName || undefined,
          lastName: input.last_name || beneficiary.lastName || '',
          suffix: input.suffix || beneficiary.suffix || undefined,
          birthDate: input.birth_date || beneficiary.dateOfBirth || '',
          faceLivenessSessionId: everifySessionId,
        });

    if (!verified.first_name && !verified.full_name) {
      throw new BadRequestException(
        input.qr_value
          ? 'eVerify QR returned empty identity — face session ok, but QR+face did not resolve PhilSys. Rescan a real National ID QR and retake liveness as the ID holder.'
          : 'eVerify returned empty identity — face/liveness ok, but name+DOB did not resolve PhilSys. Prefer National ID QR verify, or demographics that match the face.',
      );
    }

    beneficiary.firstName = verified.first_name ?? beneficiary.firstName;
    beneficiary.middleName = verified.middle_name ?? beneficiary.middleName;
    beneficiary.lastName = verified.last_name ?? beneficiary.lastName;
    beneficiary.suffix = verified.suffix ?? beneficiary.suffix;
    beneficiary.dateOfBirth = verified.birth_date ?? beneficiary.dateOfBirth;
    beneficiary.phone = verified.mobile_number ?? beneficiary.phone;
    beneficiary.address = verified.full_address ?? beneficiary.address;
    beneficiary.faceScanUrl = verified.face_url ?? beneficiary.faceScanUrl;
    beneficiary.faceScanVerified = true;
    beneficiary.everifyReference = verified.reference ?? null;
    beneficiary.everifyVerifiedAt = new Date();
    beneficiary.validationStatus = 'validated';
    beneficiary.verificationStatus = 'verified';
    beneficiary.fullName =
      verified.full_name ||
      [
        beneficiary.firstName,
        beneficiary.middleName,
        beneficiary.lastName,
        beneficiary.suffix,
      ]
        .filter(Boolean)
        .join(' ');

    if (verified.email && verified.email !== user.email) {
      const taken = await this.users.findOne({
        where: { email: verified.email },
      });
      if (!taken || taken.id === user.id) {
        user.email = verified.email;
      }
    }

    await this.beneficiaries.save(beneficiary);
    await this.users.save(user);
    user.beneficiary = beneficiary;
    await this.attachRole(user);
    return this.issueTokens(user);
  }

  async me(userId: string, clientPlatform?: ClientPlatform) {
    const user = await this.findById(userId);
    if (!user) throw new UnauthorizedException();
    await this.assertActiveContext(user);
    if (clientPlatform) this.assertClientPlatform(user, clientPlatform);
    const staff = await this.loadStaffProfile(user.id);
    return this.toProfile(user, staff);
  }

  /** Admin-provisioned staff account (web only). */
  async createStaffAccount(
    actorUserId: string,
    input: {
      email: string;
      full_name: string;
      role: AppRole;
      office_id?: string;
      organization_id?: string;
      password?: string;
      phone?: string;
    },
  ) {
    const actor = await this.findById(actorUserId);
    if (!actor) throw new UnauthorizedException();
    await this.assertActiveContext(actor);
    if (!WEB_ADMIN_ERD_ROLES.has(actor.erdRoleCode)) {
      throw new ForbiddenException('Only admins can provision staff accounts');
    }

    const allowed = STAFF_CREATABLE_BY[actor.erdRoleCode] ?? [];
    if (!allowed.includes(input.role)) {
      throw new ForbiddenException(
        `Your role cannot create ${input.role} accounts`,
      );
    }

    const email = input.email.trim().toLowerCase();
    const existing = await this.users.findOne({ where: { email } });
    if (existing) {
      throw new BadRequestException('Email already registered');
    }

    const officeId = input.office_id ?? actor.officeId ?? null;
    const organizationId =
      input.organization_id ?? actor.organizationId ?? null;

    const accountType =
      input.role === 'platform_admin' ? 'platform_admin' : 'staff';

    let user = await this.users.save(
      this.users.create({
        accountType,
        email,
        organizationId,
        officeId,
        passwordHash: input.password
          ? await bcrypt.hash(input.password, 10)
          : null,
        status: 'active',
        verifiedAt: new Date(),
        isActive: true,
      }),
    );

    await this.staffProfiles.save(
      this.staffProfiles.create({
        userAccountId: user.id,
        fullName: input.full_name.trim(),
        phone: input.phone?.trim() || null,
      }),
    );

    await this.assignRole(user.id, input.role, officeId);
    user = (await this.findById(user.id))!;
    const staff = await this.loadStaffProfile(user.id);
    return this.toProfile(user, staff);
  }

  async listStaffAccounts(actorUserId: string) {
    const actor = await this.findById(actorUserId);
    if (!actor) throw new UnauthorizedException();
    await this.assertActiveContext(actor);
    if (!WEB_ADMIN_ERD_ROLES.has(actor.erdRoleCode)) {
      throw new ForbiddenException('Only admins can list staff accounts');
    }

    const qb = this.users
      .createQueryBuilder('u')
      .where('u.account_type IN (:...types)', {
        types: ['staff', 'platform_admin'],
      })
      .orderBy('u.created_at', 'DESC');

    if (actor.erdRoleCode === ERD_ROLES.PLATFORM_ADMIN) {
      qb.innerJoin(
        'user_role_assignments',
        'platform_visible_assignment',
        'platform_visible_assignment.user_account_id = u.id',
      )
        .innerJoin(
          'roles',
          'platform_visible_role',
          'platform_visible_role.id = platform_visible_assignment.role_id',
        )
        .andWhere('platform_visible_role.code = :platformVisibleRole', {
          platformVisibleRole: ERD_ROLES.ORG_ADMIN,
        });
    } else if (actor.erdRoleCode === ERD_ROLES.OFFICE_ADMIN && actor.officeId) {
      qb.andWhere('u.office_id = :officeId', { officeId: actor.officeId });
    } else if (
      actor.erdRoleCode === ERD_ROLES.ORG_ADMIN &&
      actor.organizationId
    ) {
      qb.andWhere('u.organization_id = :orgId', {
        orgId: actor.organizationId,
      });
    }

    const rows = await qb.getMany();
    const out = [];
    for (const row of rows) {
      const user = await this.attachRole(row);
      const staff = await this.loadStaffProfile(user.id);
      out.push(this.toProfile(user, staff));
    }
    return out;
  }

  /** Password login for provisioned accounts.
   * Mock mode may auto-create beneficiaries on mobile.
   * Live mode only authenticates existing users with a password_hash (seeded / admin-created staff).
   */
  async devLogin(
    email: string,
    password: string,
    clientPlatform: ClientPlatform = 'mobile',
  ) {
    const mock = this.config.get('AUTH_PROVIDER_MODE') === 'mock';
    let user = await this.findByEmail(email);
    if (!user) {
      if (!mock || clientPlatform !== 'mobile') {
        throw new ForbiddenException({
          message: mock
            ? 'Create staff accounts via POST /auth/staff (admin) or seed 002_staff_accounts.sql'
            : 'Account not found. Staff must be provisioned before password or SSO login.',
          platform: 'web_required',
          code: 'staff_not_provisioned',
        });
      }
      const beneficiary = await this.beneficiaries.save(
        this.beneficiaries.create({
          fullName: email.split('@')[0],
          validationStatus: 'validated',
          verificationStatus: 'verified',
          profileLocked: false,
        }),
      );
      user = await this.users.save(
        this.users.create({
          accountType: 'beneficiary',
          beneficiary,
          email,
          passwordHash: await bcrypt.hash(password, 10),
          status: 'active',
        }),
      );
      await this.assignRole(user.id, 'customer');
      user = (await this.findById(user.id))!;
    } else if (user.passwordHash) {
      const ok = await bcrypt.compare(password, user.passwordHash);
      if (!ok) throw new UnauthorizedException('Invalid credentials');
    } else if (mock) {
      user.passwordHash = await bcrypt.hash(password, 10);
      await this.users.save(user);
    } else {
      throw new UnauthorizedException(
        'No password set for this account — use eGov SSO',
      );
    }
    user = await this.attachRole(user);
    this.assertClientPlatform(user, clientPlatform);
    return this.issueTokens(user);
  }

  private async assertActiveContext(user: UserAccountEntity) {
    if (!user.isActive || user.status !== 'active') {
      throw new UnauthorizedException('Account is not active');
    }
    if (user.erdRoleCode === ERD_ROLES.PLATFORM_ADMIN) {
      if (
        user.accountType !== 'platform_admin' ||
        user.organizationId ||
        user.officeId
      ) {
        throw new ForbiddenException('Invalid Platform Administrator scope');
      }
      return;
    }
    if (user.accountType === 'staff') {
      if (!user.organizationId) {
        throw new ForbiddenException('Staff account has no organization');
      }
      const rows = await this.dataSource.query<Array<{ status: string }>>(
        `SELECT status FROM organizations WHERE id = $1 LIMIT 1`,
        [user.organizationId],
      );
      if (!rows[0] || rows[0].status !== 'active') {
        throw new ForbiddenException('Organization is suspended or archived');
      }
      if (
        user.erdRoleCode === ERD_ROLES.ORG_ADMIN &&
        (user.officeId || user.accountType !== 'staff')
      ) {
        throw new ForbiddenException(
          'Invalid Organization Administrator scope',
        );
      }
    }
  }

  private async acceptPendingOrganizationInvitation(user: UserAccountEntity) {
    if (
      user.erdRoleCode !== ERD_ROLES.ORG_ADMIN ||
      !user.organizationId ||
      !user.email
    ) {
      return;
    }
    await this.dataSource.transaction(async (manager) => {
      const invitations = manager.getRepository(OrganizationInvitationEntity);
      const invitation = await invitations.findOne({
        where: {
          userAccountId: user.id,
          organizationId: user.organizationId!,
          status: 'pending',
        },
        lock: { mode: 'pessimistic_write' },
      });
      if (!invitation) return;
      invitation.status = 'accepted';
      invitation.acceptedAt = new Date();
      await invitations.save(invitation);
      await manager.query(
        `INSERT INTO audit_logs (
           organization_id, actor_user_id, action, entity_type, entity_id,
           after_state, outcome
         ) VALUES ($1, $2, 'invitation_accepted', 'organization_invitation', $3,
                   $4::jsonb, 'success')`,
        [
          user.organizationId,
          user.id,
          invitation.id,
          JSON.stringify({ status: 'accepted', email: user.email }),
        ],
      );
    });
  }
}
