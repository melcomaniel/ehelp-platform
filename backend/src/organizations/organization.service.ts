import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  QueryFailedError,
  Repository,
} from 'typeorm';
import { StaffProfileEntity } from '../users/staff-profile.entity';
import {
  RoleEntity,
  UserAccountEntity,
  UserRoleAssignmentEntity,
} from '../users/user.entity';
import {
  CreateOrganizationAdminDto,
  CreateOrganizationDto,
  OrganizationAdminListQueryDto,
  OrganizationListQueryDto,
  OrganizationOfficeListQueryDto,
  UpdateOrganizationAdminDto,
  UpdateOrganizationDto,
} from './organization.dto';
import {
  AuditLogEntity,
  OrganizationEntity,
  OrganizationInvitationEntity,
  type OrganizationStatus,
} from './organization.entities';
import {
  assertOrganizationTransition,
  normalizeInitialPolicyConfig,
  normalizeOrganizationCode,
  sanitizeAuditState,
} from './organization.policy';

type RequestMeta = {
  ipAddress?: string | null;
  requestId?: string | null;
};

type AdminRow = {
  id: string;
  email: string;
  status: string;
  is_active: boolean;
  full_name: string;
  phone: string | null;
  invitation_status: string | null;
  created_at: Date;
  updated_at: Date;
};

type OrganizationAdminListRow = AdminRow & {
  organization_id: string;
  organization_code: string;
  organization_name: string;
  organization_status: OrganizationStatus;
};

type OrganizationListRow = {
  id: string;
  code: string;
  name: string;
  status: OrganizationStatus;
  office_count: number;
  primary_admin_id: string | null;
  primary_admin_email: string | null;
  primary_admin_name: string | null;
  created_at: Date;
  updated_at: Date;
};

type PlatformActorRow = {
  id: string;
  organization_id: string | null;
  office_id: string | null;
  account_type: string;
  status: string;
  is_active: boolean;
};

type AuditRow = {
  id: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  before_state: Record<string, unknown> | null;
  after_state: Record<string, unknown> | null;
  reason: string | null;
  outcome: string;
  occurred_at: Date;
};

type OfficeRow = {
  id: string;
  organization_id: string;
  organization_name: string;
  parent_office_id: string | null;
  parent_office_name: string | null;
  name: string;
  code: string;
  normalized_code: string;
  level: string;
  status: string;
  direct_child_count: number;
  archived_at: Date | null;
  lifecycle_reason: string | null;
  created_at: Date;
  updated_at: Date;
};

@Injectable()
export class OrganizationService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(OrganizationEntity)
    private readonly organizations: Repository<OrganizationEntity>,
  ) {}

  async list(actorId: string, query: OrganizationListQueryDto) {
    await this.requirePlatformAdmin(actorId);
    const page = query.page || 1;
    const pageSize = query.page_size || 20;
    const params: unknown[] = [];
    const clauses: string[] = [];
    if (!query.include_archived && query.status !== 'archived') {
      clauses.push(`o.status <> 'archived'`);
    }
    if (query.search) {
      params.push(`%${query.search}%`);
      clauses.push(
        `(o.name ILIKE $${params.length} OR o.code ILIKE $${params.length})`,
      );
    }
    if (query.status) {
      params.push(query.status);
      clauses.push(`o.status = $${params.length}`);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const count = await this.dataSource.query<Array<{ total: number }>>(
      `SELECT count(*)::int AS total FROM organizations o ${where}`,
      params,
    );
    params.push(pageSize, (page - 1) * pageSize);
    const rows = await this.dataSource.query<OrganizationListRow[]>(
      `SELECT o.id, o.code, o.name, o.status, o.created_at, o.updated_at,
              COALESCE(offices.office_count, 0)::int AS office_count,
              admin.id AS primary_admin_id,
              admin.email AS primary_admin_email,
              admin.full_name AS primary_admin_name
       FROM organizations o
       LEFT JOIN LATERAL (
         SELECT count(*) AS office_count
         FROM offices f WHERE f.organization_id = o.id
       ) offices ON true
       LEFT JOIN LATERAL (
         SELECT u.id, u.email, sp.full_name
         FROM user_accounts u
         JOIN user_role_assignments ura ON ura.user_account_id = u.id
         JOIN roles r ON r.id = ura.role_id AND r.code = 'ORG_ADMIN'
         LEFT JOIN staff_profiles sp ON sp.user_account_id = u.id
         WHERE u.organization_id = o.id
         ORDER BY u.created_at ASC
         LIMIT 1
       ) admin ON true
       ${where}
       ORDER BY o.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    const total = Number(count[0]?.total ?? 0);
    return {
      data: rows,
      pagination: {
        page,
        page_size: pageSize,
        total,
        total_pages: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
  }

  async detail(actorId: string, organizationId: string) {
    await this.requirePlatformAdmin(actorId);
    const organization = await this.organizations.findOne({
      where: { id: organizationId },
    });
    if (!organization) throw new NotFoundException('Organization not found');
    const officeCount = await this.dataSource.query<Array<{ count: number }>>(
      `SELECT count(*)::int AS count FROM offices WHERE organization_id = $1`,
      [organizationId],
    );
    const admins = await this.listAdminsForOrganization(organizationId);
    const audits = await this.dataSource.query<AuditRow[]>(
      `SELECT id, action, entity_type, entity_id, before_state, after_state,
              reason, outcome, occurred_at
       FROM audit_logs
       WHERE organization_id = $1
         AND action IN (
           'organization_created', 'organization_updated',
           'organization_suspended', 'organization_reactivated',
          'organization_archived', 'organization_admin_created',
           'organization_admin_updated', 'organization_admin_suspended',
           'organization_admin_reactivated',
           'role_assigned', 'invitation_created', 'invitation_accepted',
           'device_registered'
         )
       ORDER BY occurred_at DESC LIMIT 50`,
      [organizationId],
    );
    return {
      ...this.organizationState(organization),
      office_count: Number(officeCount[0]?.count ?? 0),
      admins,
      audit_history: audits,
    };
  }

  async listOrganizationAdmins(
    actorId: string,
    query: OrganizationAdminListQueryDto,
  ) {
    await this.requirePlatformAdmin(actorId);
    const page = query.page || 1;
    const pageSize = query.page_size || 20;
    const params: unknown[] = [];
    const clauses = [`r.code = 'ORG_ADMIN'`];

    if (query.search) {
      params.push(`%${query.search}%`);
      clauses.push(
        `(u.email ILIKE $${params.length}
          OR sp.full_name ILIKE $${params.length}
          OR org.name ILIKE $${params.length}
          OR org.code ILIKE $${params.length})`,
      );
    }
    if (query.status) {
      params.push(query.status);
      clauses.push(`u.status = $${params.length}`);
    }
    if (query.invitation_status) {
      params.push(query.invitation_status);
      clauses.push(`COALESCE(invitation.status, '') = $${params.length}`);
    }

    const where = `WHERE ${clauses.join(' AND ')}`;
    const count = await this.dataSource.query<Array<{ total: number }>>(
      `SELECT count(*)::int AS total
       FROM user_accounts u
       JOIN organizations org ON org.id = u.organization_id
       JOIN user_role_assignments ura ON ura.user_account_id = u.id
       JOIN roles r ON r.id = ura.role_id
       JOIN staff_profiles sp ON sp.user_account_id = u.id
       LEFT JOIN LATERAL (
         SELECT oi.status FROM organization_invitations oi
         WHERE oi.user_account_id = u.id AND oi.organization_id = u.organization_id
         ORDER BY oi.created_at DESC LIMIT 1
       ) invitation ON true
       ${where}`,
      params,
    );

    params.push(pageSize, (page - 1) * pageSize);
    const rows = await this.dataSource.query<OrganizationAdminListRow[]>(
      `SELECT u.id, u.email, u.status, u.is_active, u.created_at, u.updated_at,
              sp.full_name, sp.phone,
              invitation.status AS invitation_status,
              org.id AS organization_id,
              org.code AS organization_code,
              org.name AS organization_name,
              org.status AS organization_status
       FROM user_accounts u
       JOIN organizations org ON org.id = u.organization_id
       JOIN user_role_assignments ura ON ura.user_account_id = u.id
       JOIN roles r ON r.id = ura.role_id
       JOIN staff_profiles sp ON sp.user_account_id = u.id
       LEFT JOIN LATERAL (
         SELECT oi.status FROM organization_invitations oi
         WHERE oi.user_account_id = u.id AND oi.organization_id = u.organization_id
         ORDER BY oi.created_at DESC LIMIT 1
       ) invitation ON true
       ${where}
       ORDER BY u.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );

    const total = Number(count[0]?.total ?? 0);
    return {
      data: rows,
      pagination: {
        page,
        page_size: pageSize,
        total,
        total_pages: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
  }

  async listAdmins(actorId: string, organizationId: string) {
    await this.requirePlatformAdmin(actorId);
    await this.requireOrganizationExists(organizationId);
    return this.listAdminsForOrganization(organizationId);
  }

  async listOffices(
    actorId: string,
    organizationId: string,
    query: OrganizationOfficeListQueryDto,
  ) {
    await this.requirePlatformAdmin(actorId);
    const organization = await this.organizations.findOne({
      where: { id: organizationId },
    });
    if (!organization) throw new NotFoundException('Organization not found');

    const page = query.page || 1;
    const pageSize = query.page_size || 10;
    const params: unknown[] = [organizationId];
    const clauses = ['o.organization_id = $1'];

    if (query.search) {
      params.push(`%${query.search}%`);
      clauses.push(
        `(o.name ILIKE $${params.length} OR o.code ILIKE $${params.length})`,
      );
    }
    if (query.level) {
      params.push(query.level);
      clauses.push(`o.level = $${params.length}`);
    }
    if (query.status) {
      params.push(query.status);
      clauses.push(`o.status = $${params.length}`);
    }

    const where = `WHERE ${clauses.join(' AND ')}`;
    const count = await this.dataSource.query<Array<{ total: number }>>(
      `SELECT count(*)::int AS total FROM offices o ${where}`,
      params,
    );

    params.push(pageSize, (page - 1) * pageSize);
    const rows = await this.dataSource.query<OfficeRow[]>(
      `SELECT o.id, o.organization_id, org.name AS organization_name,
              o.parent_office_id, parent.name AS parent_office_name,
              o.name, o.code, o.normalized_code, o.level, o.status,
              COALESCE(children.direct_child_count, 0)::int AS direct_child_count,
              o.archived_at, o.lifecycle_reason, o.created_at, o.updated_at
       FROM offices o
       JOIN organizations org ON org.id = o.organization_id
       LEFT JOIN offices parent ON parent.id = o.parent_office_id
       LEFT JOIN LATERAL (
         SELECT count(*)::int AS direct_child_count
         FROM offices child
         WHERE child.parent_office_id = o.id
       ) children ON true
       ${where}
       ORDER BY o.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );

    const total = Number(count[0]?.total ?? 0);
    return {
      data: rows.map((row) => this.officeState(row)),
      organization: {
        id: organization.id,
        name: organization.name,
      },
      pagination: {
        page,
        page_size: pageSize,
        total,
        total_pages: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
  }

  async create(
    actorId: string,
    input: CreateOrganizationDto,
    meta: RequestMeta = {},
  ) {
    await this.requirePlatformAdmin(actorId);
    const code = normalizeOrganizationCode(input.code);
    try {
      const id = await this.dataSource.transaction(async (manager) => {
        const orgRepo = manager.getRepository(OrganizationEntity);
        const existingByKey = await orgRepo.findOne({
          where: { creationKey: input.creation_key },
        });
        if (existingByKey) return existingByKey.id;

        if (
          await orgRepo
            .createQueryBuilder('o')
            .where('upper(o.code) = :code', { code })
            .getOne()
        ) {
          throw new ConflictException('Organization code already exists');
        }
        const organization = await orgRepo.save(
          orgRepo.create({
            code,
            name: input.name.trim(),
            status: 'active',
            policyConfig: normalizeInitialPolicyConfig(input.policy_config),
            creationKey: input.creation_key,
            suspendedAt: null,
            archivedAt: null,
            lifecycleReason: null,
          }),
        );
        await this.audit(manager, actorId, organization.id, {
          action: 'organization_created',
          entityType: 'organization',
          entityId: organization.id,
          after: this.organizationState(organization),
          ...meta,
        });
        await this.provisionOrganizationAdmin(
          manager,
          actorId,
          organization.id,
          input.initial_admin,
          meta,
        );
        return organization.id;
      });
      return this.detail(actorId, id);
    } catch (error) {
      this.rethrowConflict(error);
    }
  }

  async createAdmin(
    actorId: string,
    organizationId: string,
    input: CreateOrganizationAdminDto,
    meta: RequestMeta = {},
  ) {
    await this.requirePlatformAdmin(actorId);
    try {
      const adminId = await this.dataSource.transaction(async (manager) => {
        const organization = await manager
          .getRepository(OrganizationEntity)
          .findOne({ where: { id: organizationId } });
        if (!organization)
          throw new NotFoundException('Organization not found');
        if (organization.status !== 'active') {
          throw new ConflictException(
            'Organization must be active to add an administrator',
          );
        }
        return this.provisionOrganizationAdmin(
          manager,
          actorId,
          organizationId,
          input,
          meta,
        );
      });
      const admins = await this.listAdminsForOrganization(organizationId);
      return admins.find((admin) => admin.id === adminId)!;
    } catch (error) {
      this.rethrowConflict(error);
    }
  }

  async update(
    actorId: string,
    organizationId: string,
    input: UpdateOrganizationDto,
    meta: RequestMeta = {},
  ) {
    await this.requirePlatformAdmin(actorId);
    try {
      await this.dataSource.transaction(async (manager) => {
        const repo = manager.getRepository(OrganizationEntity);
        const organization = await repo.findOne({
          where: { id: organizationId },
        });
        if (!organization)
          throw new NotFoundException('Organization not found');
        if (organization.status === 'archived') {
          throw new ConflictException('Archived organizations are read-only');
        }
        const before = this.organizationState(organization);
        if (input.name !== undefined) organization.name = input.name.trim();
        if (input.code !== undefined) {
          organization.code = normalizeOrganizationCode(input.code);
        }
        await repo.save(organization);
        await this.audit(manager, actorId, organizationId, {
          action: 'organization_updated',
          entityType: 'organization',
          entityId: organizationId,
          before,
          after: this.organizationState(organization),
          ...meta,
        });
      });
      return this.detail(actorId, organizationId);
    } catch (error) {
      this.rethrowConflict(error);
    }
  }

  suspend(
    actorId: string,
    organizationId: string,
    reason: string,
    meta: RequestMeta = {},
  ) {
    return this.transition(actorId, organizationId, 'suspended', reason, meta);
  }

  reactivate(
    actorId: string,
    organizationId: string,
    reason: string | undefined,
    meta: RequestMeta = {},
  ) {
    return this.transition(
      actorId,
      organizationId,
      'active',
      reason ?? null,
      meta,
    );
  }

  archive(
    actorId: string,
    organizationId: string,
    reason: string,
    meta: RequestMeta = {},
  ) {
    return this.transition(actorId, organizationId, 'archived', reason, meta);
  }

  async updateAdmin(
    actorId: string,
    organizationId: string,
    adminId: string,
    input: UpdateOrganizationAdminDto,
    meta: RequestMeta = {},
  ) {
    await this.requirePlatformAdmin(actorId);
    if (
      input.full_name === undefined &&
      input.email === undefined &&
      input.phone === undefined &&
      input.status === undefined
    ) {
      throw new ConflictException(
        'At least one administrator field must be provided',
      );
    }
    if (input.status === 'suspended' && !input.reason) {
      throw new ConflictException('A suspension reason is required');
    }
    try {
      await this.dataSource.transaction(async (manager) => {
        await this.requireOrganizationWritable(manager, organizationId);
        const admin = await this.requireOrganizationAdmin(
          manager,
          organizationId,
          adminId,
        );
        const profileRepo = manager.getRepository(StaffProfileEntity);
        const profile = await profileRepo.findOne({
          where: { userAccountId: adminId },
        });
        if (!profile)
          throw new NotFoundException('Administrator profile not found');
        const before = {
          email: admin.email,
          full_name: profile.fullName,
          phone: profile.phone,
        };
        if (input.email !== undefined) admin.email = input.email;
        if (input.full_name !== undefined) profile.fullName = input.full_name;
        if (input.phone !== undefined) profile.phone = input.phone || null;
        await manager.getRepository(UserAccountEntity).save(admin);
        await profileRepo.save(profile);
        const profileChanged =
          input.email !== undefined ||
          input.full_name !== undefined ||
          input.phone !== undefined;
        if (input.email !== undefined) {
          await manager.getRepository(OrganizationInvitationEntity).update(
            {
              organizationId,
              userAccountId: adminId,
              status: 'pending',
            },
            { email: input.email },
          );
        }
        if (profileChanged) {
          await this.audit(manager, actorId, organizationId, {
            action: 'organization_admin_updated',
            entityType: 'user_account',
            entityId: adminId,
            before,
            after: {
              email: admin.email,
              full_name: profile.fullName,
              phone: profile.phone,
            },
            ...meta,
          });
        }
        if (input.status !== undefined) {
          await this.transitionAdminStatus(
            manager,
            actorId,
            organizationId,
            admin,
            input.status,
            input.reason ?? null,
            meta,
          );
        }
      });
      return this.detail(actorId, organizationId);
    } catch (error) {
      this.rethrowConflict(error);
    }
  }

  async suspendAdmin(
    actorId: string,
    organizationId: string,
    adminId: string,
    reason: string,
    meta: RequestMeta = {},
  ) {
    await this.requirePlatformAdmin(actorId);
    await this.dataSource.transaction(async (manager) => {
      await this.requireOrganizationWritable(manager, organizationId);
      const admin = await this.requireOrganizationAdmin(
        manager,
        organizationId,
        adminId,
      );
      await this.transitionAdminStatus(
        manager,
        actorId,
        organizationId,
        admin,
        'suspended',
        reason,
        meta,
      );
    });
    return this.detail(actorId, organizationId);
  }

  private async provisionOrganizationAdmin(
    manager: EntityManager,
    actorId: string,
    organizationId: string,
    input: CreateOrganizationAdminDto,
    meta: RequestMeta,
  ) {
    const email = input.email.trim().toLowerCase();
    if (
      await manager
        .getRepository(UserAccountEntity)
        .findOne({ where: { email } })
    ) {
      throw new ConflictException('Administrator email already exists');
    }
    const role = await manager
      .getRepository(RoleEntity)
      .findOne({ where: { code: 'ORG_ADMIN' } });
    if (!role) throw new ConflictException('ORG_ADMIN role is not seeded');

    const userRepo = manager.getRepository(UserAccountEntity);
    const user = await userRepo.save(
      userRepo.create({
        organizationId,
        officeId: null,
        accountType: 'staff',
        email,
        passwordHash: null,
        status: 'active',
        verifiedAt: null,
        isActive: true,
      }),
    );
    await manager.getRepository(StaffProfileEntity).save({
      userAccountId: user.id,
      fullName: input.full_name.trim(),
      phone: input.phone?.trim() || null,
    });
    await manager.getRepository(UserRoleAssignmentEntity).save({
      userAccountId: user.id,
      roleId: role.id,
      officeId: null,
    });
    const invitation = await manager
      .getRepository(OrganizationInvitationEntity)
      .save({
        organizationId,
        userAccountId: user.id,
        email,
        status: 'pending',
        invitedByUserId: actorId,
        acceptedAt: null,
      });
    await this.audit(manager, actorId, organizationId, {
      action: 'organization_admin_created',
      entityType: 'user_account',
      entityId: user.id,
      after: {
        email,
        full_name: input.full_name.trim(),
        organization_id: organizationId,
        office_id: null,
        status: user.status,
      },
      ...meta,
    });
    await this.audit(manager, actorId, organizationId, {
      action: 'role_assigned',
      entityType: 'user_role_assignment',
      entityId: user.id,
      after: { user_account_id: user.id, role: 'ORG_ADMIN' },
      ...meta,
    });
    await this.audit(manager, actorId, organizationId, {
      action: 'invitation_created',
      entityType: 'organization_invitation',
      entityId: invitation.id,
      after: { email, status: invitation.status },
      ...meta,
    });
    return user.id;
  }

  private async transitionAdminStatus(
    manager: EntityManager,
    actorId: string,
    organizationId: string,
    admin: UserAccountEntity,
    next: 'active' | 'suspended',
    reason: string | null,
    meta: RequestMeta,
  ) {
    const currentlyActive = admin.isActive && admin.status === 'active';
    if (
      (next === 'active' && currentlyActive) ||
      (next === 'suspended' && !currentlyActive)
    ) {
      throw new ConflictException(
        `Organization Administrator is already ${next}`,
      );
    }
    const before = { status: admin.status, is_active: admin.isActive };
    admin.status = next;
    admin.isActive = next === 'active';
    await manager.getRepository(UserAccountEntity).save(admin);
    await this.audit(manager, actorId, organizationId, {
      action:
        next === 'active'
          ? 'organization_admin_reactivated'
          : 'organization_admin_suspended',
      entityType: 'user_account',
      entityId: admin.id,
      before,
      after: { status: admin.status, is_active: admin.isActive },
      reason,
      ...meta,
    });
  }

  private async transition(
    actorId: string,
    organizationId: string,
    next: OrganizationStatus,
    reason: string | null,
    meta: RequestMeta,
  ) {
    await this.requirePlatformAdmin(actorId);
    await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(OrganizationEntity);
      const organization = await repo.findOne({
        where: { id: organizationId },
      });
      if (!organization) throw new NotFoundException('Organization not found');
      assertOrganizationTransition(organization.status, next);
      const before = this.organizationState(organization);
      organization.status = next;
      organization.lifecycleReason = reason;
      organization.suspendedAt =
        next === 'suspended' ? new Date() : organization.suspendedAt;
      organization.archivedAt = next === 'archived' ? new Date() : null;
      if (next === 'active') {
        organization.suspendedAt = null;
        organization.lifecycleReason = null;
      }
      await repo.save(organization);
      const action = {
        suspended: 'organization_suspended',
        active: 'organization_reactivated',
        archived: 'organization_archived',
      }[next];
      await this.audit(manager, actorId, organizationId, {
        action,
        entityType: 'organization',
        entityId: organizationId,
        before,
        after: this.organizationState(organization),
        reason,
        ...meta,
      });
    });
    return this.detail(actorId, organizationId);
  }

  private async requirePlatformAdmin(actorId: string) {
    const rows = await this.dataSource.query<PlatformActorRow[]>(
      `SELECT u.id, u.organization_id, u.office_id, u.account_type,
              u.status, u.is_active
       FROM user_accounts u
       JOIN user_role_assignments ura ON ura.user_account_id = u.id
       JOIN roles r ON r.id = ura.role_id
       WHERE u.id = $1 AND r.code = 'PLATFORM_ADMIN' LIMIT 1`,
      [actorId],
    );
    const actor = rows[0];
    if (!actor) throw new ForbiddenException('Platform Administrator required');
    if (!actor.is_active || actor.status !== 'active') {
      throw new UnauthorizedException('Account is suspended');
    }
    if (
      actor.organization_id ||
      actor.office_id ||
      actor.account_type !== 'platform_admin'
    ) {
      throw new ForbiddenException('Invalid Platform Administrator scope');
    }
    return actor;
  }

  private async listAdminsForOrganization(
    organizationId: string,
  ): Promise<AdminRow[]> {
    return this.dataSource.query<AdminRow[]>(
      `SELECT u.id, u.email, u.status, u.is_active, u.created_at, u.updated_at,
              sp.full_name, sp.phone,
              invitation.status AS invitation_status
       FROM user_accounts u
       JOIN user_role_assignments ura ON ura.user_account_id = u.id
       JOIN roles r ON r.id = ura.role_id AND r.code = 'ORG_ADMIN'
       JOIN staff_profiles sp ON sp.user_account_id = u.id
       LEFT JOIN LATERAL (
         SELECT oi.status FROM organization_invitations oi
         WHERE oi.user_account_id = u.id AND oi.organization_id = u.organization_id
         ORDER BY oi.created_at DESC LIMIT 1
       ) invitation ON true
       WHERE u.organization_id = $1
       ORDER BY u.created_at ASC`,
      [organizationId],
    );
  }

  private async requireOrganizationExists(organizationId: string) {
    if (
      !(await this.organizations.findOne({
        where: { id: organizationId },
      }))
    ) {
      throw new NotFoundException('Organization not found');
    }
  }

  private async requireOrganizationAdmin(
    manager: EntityManager,
    organizationId: string,
    adminId: string,
  ) {
    const rows = await manager.query<Array<{ id: string }>>(
      `SELECT u.*
       FROM user_accounts u
       JOIN user_role_assignments ura ON ura.user_account_id = u.id
       JOIN roles r ON r.id = ura.role_id AND r.code = 'ORG_ADMIN'
       WHERE u.id = $1 AND u.organization_id = $2 LIMIT 1`,
      [adminId, organizationId],
    );
    if (!rows[0])
      throw new NotFoundException('Organization Administrator not found');
    return manager.getRepository(UserAccountEntity).findOneOrFail({
      where: { id: adminId, organizationId },
    });
  }

  private async requireOrganizationWritable(
    manager: EntityManager,
    organizationId: string,
  ) {
    const organization = await manager
      .getRepository(OrganizationEntity)
      .findOne({
        where: { id: organizationId },
      });
    if (!organization) throw new NotFoundException('Organization not found');
    if (organization.status === 'archived') {
      throw new ConflictException('Archived organizations are read-only');
    }
  }

  private async audit(
    manager: EntityManager,
    actorId: string,
    organizationId: string,
    input: {
      action: string;
      entityType: string;
      entityId: string;
      before?: Record<string, unknown> | null;
      after?: Record<string, unknown> | null;
      reason?: string | null;
      ipAddress?: string | null;
      requestId?: string | null;
    },
  ) {
    const repo = manager.getRepository(AuditLogEntity);
    await repo.save(
      repo.create({
        organizationId,
        actorUserId: actorId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        beforeState: sanitizeAuditState(input.before),
        afterState: sanitizeAuditState(input.after),
        ipAddress: input.ipAddress ?? null,
        outcome: 'success',
        reason: input.reason ?? null,
        requestId: input.requestId ?? null,
      }),
    );
  }

  private organizationState(organization: OrganizationEntity) {
    return {
      id: organization.id,
      code: organization.code,
      name: organization.name,
      status: organization.status,
      policy_config: organization.policyConfig,
      suspended_at: organization.suspendedAt,
      archived_at: organization.archivedAt,
      lifecycle_reason: organization.lifecycleReason,
      created_at: organization.createdAt,
      updated_at: organization.updatedAt,
    };
  }

  private officeState(row: OfficeRow) {
    return {
      id: row.id,
      organization_id: row.organization_id,
      organization_name: row.organization_name,
      parent_office_id: row.parent_office_id,
      parent_office_name: row.parent_office_name,
      name: row.name,
      code: row.code,
      normalized_code: row.normalized_code,
      level: row.level,
      status: row.status,
      direct_child_count: Number(row.direct_child_count ?? 0),
      archived_at: row.archived_at,
      lifecycle_reason: row.lifecycle_reason,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  private rethrowConflict(error: unknown): never {
    if (
      error instanceof ConflictException ||
      error instanceof NotFoundException
    ) {
      throw error;
    }
    if (error instanceof QueryFailedError) {
      throw new ConflictException(
        'Organization code, administrator email, or creation request already exists',
      );
    }
    throw error;
  }
}
