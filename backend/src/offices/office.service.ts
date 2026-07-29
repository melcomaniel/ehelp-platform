import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { DataSource, EntityManager, QueryFailedError } from 'typeorm';
import { OfficeEntity } from '../domain/domain.entities';
import {
  AuditLogEntity,
  OrganizationInvitationEntity,
} from '../organizations/organization.entities';
import { sanitizeAuditState } from '../organizations/organization.policy';
import { StaffProfileEntity } from '../users/staff-profile.entity';
import {
  RoleEntity,
  UserAccountEntity,
  UserRoleAssignmentEntity,
} from '../users/user.entity';
import {
  CreateOfficeAdminDto,
  CreateOfficeDto,
  CreateRegionalOfficeDto,
  OfficeListQueryDto,
  UpdateOfficeDto,
} from './office.dto';
import {
  assertOfficeTransition,
  normalizeOfficeCode,
  type OfficeStatus,
} from './office.policy';

type RequestMeta = {
  ipAddress?: string | null;
  requestId?: string | null;
};

type OrgAdminActor = {
  id: string;
  organization_id: string;
  organization_name: string;
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
  status: OfficeStatus;
  direct_child_count: number;
  archived_at: Date | null;
  lifecycle_reason: string | null;
  created_at: Date;
  updated_at: Date;
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

type OfficeAdminRow = {
  id: string;
  email: string;
  status: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  full_name: string;
  phone: string | null;
  invitation_status: string | null;
};

@Injectable()
export class OfficeService {
  constructor(private readonly dataSource: DataSource) {}

  async list(actorId: string, query: OfficeListQueryDto) {
    const actor = await this.requireOrgAdmin(actorId);
    const page = query.page || 1;
    const pageSize = query.page_size || 20;
    const params: unknown[] = [actor.organization_id];
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
    if (query.parent_office_id) {
      params.push(query.parent_office_id);
      clauses.push(`o.parent_office_id = $${params.length}`);
    }

    const where = `WHERE ${clauses.join(' AND ')}`;
    const count = await this.dataSource.query<Array<{ total: number }>>(
      `SELECT count(*)::int AS total FROM offices o ${where}`,
      params,
    );

    params.push(pageSize, (page - 1) * pageSize);
    const rows = await this.dataSource.query<OfficeRow[]>(
      `${this.officeSelect()}
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
        id: actor.organization_id,
        name: actor.organization_name,
      },
      pagination: {
        page,
        page_size: pageSize,
        total,
        total_pages: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
  }

  async parentOptions(actorId: string, excludeOfficeId?: string) {
    const actor = await this.requireOrgAdmin(actorId);
    const params: unknown[] = [actor.organization_id];
    let exclude = '';
    if (excludeOfficeId) {
      params.push(excludeOfficeId);
      exclude = `AND o.id <> $${params.length}`;
    }
    const rows = await this.dataSource.query<
      Array<{ id: string; name: string; code: string; level: string }>
    >(
      `SELECT o.id, o.name, o.code, o.level
       FROM offices o
       WHERE o.organization_id = $1 AND o.status = 'active' ${exclude}
       ORDER BY o.name ASC`,
      params,
    );
    return { data: rows };
  }

  async detail(actorId: string, officeId: string) {
    const actor = await this.requireOrgAdmin(actorId);
    const office = await this.loadOffice(actor.organization_id, officeId);
    if (!office) throw new NotFoundException('Office not found');
    const children = await this.dataSource.query<OfficeRow[]>(
      `${this.officeSelect()}
       FROM offices o
       JOIN organizations org ON org.id = o.organization_id
       LEFT JOIN offices parent ON parent.id = o.parent_office_id
       LEFT JOIN LATERAL (
         SELECT count(*)::int AS direct_child_count
         FROM offices child
         WHERE child.parent_office_id = o.id
       ) children ON true
       WHERE o.organization_id = $1 AND o.parent_office_id = $2
       ORDER BY o.name ASC`,
      [actor.organization_id, officeId],
    );
    const audits = await this.dataSource.query<AuditRow[]>(
      `SELECT id, action, entity_type, entity_id, before_state, after_state,
              reason, outcome, occurred_at
       FROM audit_logs
       WHERE organization_id = $1
         AND entity_type = 'office'
         AND entity_id = $2
         AND action IN (
           'office_created', 'office_updated', 'office_parent_changed',
           'office_archived', 'office_reactivated', 'office_admin_created',
           'role_assigned', 'invitation_created'
         )
       ORDER BY occurred_at DESC LIMIT 50`,
      [actor.organization_id, officeId],
    );
    return {
      ...this.officeState(office),
      child_offices: children.map((row) => this.officeState(row)),
      audit_history: audits,
    };
  }

  async create(
    actorId: string,
    input: CreateOfficeDto,
    meta: RequestMeta = {},
  ) {
    return this.createFlatOffice(
      actorId,
      {
        name: input.name,
        code: input.code,
        level: input.level,
        parent_office_id: input.parent_office_id ?? null,
      },
      meta,
    );
  }

  async createRegionalOffice(
    actorId: string,
    organizationId: string,
    input: CreateRegionalOfficeDto,
    meta: RequestMeta = {},
  ) {
    const actor = await this.requireOrgAdmin(actorId);
    if (organizationId !== actor.organization_id) {
      throw new ForbiddenException(
        'Cannot create an office outside your organization',
      );
    }
    return this.createFlatOffice(
      actorId,
      {
        name: input.name,
        code: input.code,
        level: 'regional',
        parent_office_id: null,
      },
      meta,
      actor,
    );
  }

  async createOfficeAdmin(
    actorId: string,
    organizationId: string,
    officeId: string,
    input: CreateOfficeAdminDto,
    meta: RequestMeta = {},
  ) {
    const actor = await this.requireOrgAdmin(actorId);
    if (organizationId !== actor.organization_id) {
      throw new ForbiddenException(
        'Cannot assign an administrator to an office outside your organization',
      );
    }
    try {
      const adminId = await this.dataSource.transaction(async (manager) => {
        const office = await this.lockOffice(manager, organizationId, officeId);
        if (office.status !== 'active') {
          throw new ConflictException(
            'Office must be active to add an administrator',
          );
        }
        const existingAdmin = await manager.query<Array<{ id: string }>>(
          `SELECT u.id
           FROM user_accounts u
           JOIN user_role_assignments ura ON ura.user_account_id = u.id
           JOIN roles r ON r.id = ura.role_id AND r.code = 'OFFICE_ADMIN'
           WHERE ura.office_id = $1 AND u.is_active = true AND u.status = 'active'
           LIMIT 1`,
          [officeId],
        );
        if (existingAdmin[0]) {
          throw new ConflictException(
            'This office already has an active Administrator',
          );
        }
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
          .findOne({ where: { code: 'OFFICE_ADMIN' } });
        if (!role)
          throw new ConflictException('OFFICE_ADMIN role is not seeded');

        const userRepo = manager.getRepository(UserAccountEntity);
        const user = await userRepo.save(
          userRepo.create({
            organizationId,
            officeId,
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
          officeId,
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
          action: 'office_admin_created',
          entityId: office.id,
          after: {
            user_account_id: user.id,
            email,
            full_name: input.full_name.trim(),
            organization_id: organizationId,
            office_id: officeId,
            status: user.status,
          },
          ...meta,
        });
        await this.audit(manager, actorId, organizationId, {
          action: 'role_assigned',
          entityId: office.id,
          after: {
            user_account_id: user.id,
            role: 'OFFICE_ADMIN',
            office_id: officeId,
          },
          ...meta,
        });
        await this.audit(manager, actorId, organizationId, {
          action: 'invitation_created',
          entityId: office.id,
          after: { user_account_id: user.id, email, status: invitation.status },
          ...meta,
        });
        return user.id;
      });
      const admins = await this.listOfficeAdmins(officeId);
      return admins.find((admin) => admin.id === adminId)!;
    } catch (error) {
      this.rethrowConflict(error);
    }
  }

  private async createFlatOffice(
    actorId: string,
    input: CreateOfficeDto,
    meta: RequestMeta = {},
    resolvedActor?: OrgAdminActor,
  ) {
    const actor = resolvedActor ?? (await this.requireOrgAdmin(actorId));
    try {
      const id = await this.dataSource.transaction(async (manager) => {
        const code = normalizeOfficeCode(input.code);
        await this.ensureNameAvailable(
          manager,
          actor.organization_id,
          input.name.trim(),
          null,
        );
        await this.validateParent(
          manager,
          actor.organization_id,
          null,
          input.parent_office_id ?? null,
        );
        await this.ensureCodeAvailable(
          manager,
          actor.organization_id,
          code,
          null,
        );
        const repo = manager.getRepository(OfficeEntity);
        const office = await repo.save(
          repo.create({
            organizationId: actor.organization_id,
            parentOfficeId: input.parent_office_id ?? null,
            name: input.name.trim(),
            code,
            normalizedCode: code,
            level: input.level,
            status: 'active',
            archivedAt: null,
            lifecycleReason: null,
            createdByUserId: actor.id,
            updatedByUserId: actor.id,
          }),
        );
        await this.audit(manager, actor.id, actor.organization_id, {
          action: 'office_created',
          entityId: office.id,
          after: this.entityState(office),
          ...meta,
        });
        return office.id;
      });
      return this.detail(actorId, id);
    } catch (error) {
      this.rethrowConflict(error);
    }
  }

  async update(
    actorId: string,
    officeId: string,
    input: UpdateOfficeDto,
    meta: RequestMeta = {},
  ) {
    const actor = await this.requireOrgAdmin(actorId);
    try {
      await this.dataSource.transaction(async (manager) => {
        const office = await this.lockOffice(
          manager,
          actor.organization_id,
          officeId,
        );
        if (office.status !== 'active') {
          throw new ConflictException('Archived offices are read-only');
        }
        const before = this.entityState(office);
        if (input.name !== undefined) {
          const name = input.name.trim();
          await this.ensureNameAvailable(
            manager,
            actor.organization_id,
            name,
            officeId,
          );
          office.name = name;
        }
        if (input.level !== undefined) office.level = input.level;
        if (input.code !== undefined) {
          const code = normalizeOfficeCode(input.code);
          await this.ensureCodeAvailable(
            manager,
            actor.organization_id,
            code,
            officeId,
          );
          office.code = code;
          office.normalizedCode = code;
        }
        if (input.parent_office_id !== undefined) {
          await this.validateParent(
            manager,
            actor.organization_id,
            officeId,
            input.parent_office_id,
          );
          office.parentOfficeId = input.parent_office_id ?? null;
        }
        office.updatedByUserId = actor.id;
        await manager.getRepository(OfficeEntity).save(office);
        const action =
          before.parent_office_id !== office.parentOfficeId
            ? 'office_parent_changed'
            : 'office_updated';
        await this.audit(manager, actor.id, actor.organization_id, {
          action,
          entityId: office.id,
          before,
          after: this.entityState(office),
          ...meta,
        });
      });
      return this.detail(actorId, officeId);
    } catch (error) {
      this.rethrowConflict(error);
    }
  }

  async archive(
    actorId: string,
    officeId: string,
    reason: string,
    meta: RequestMeta = {},
  ) {
    const actor = await this.requireOrgAdmin(actorId);
    return this.archiveForActor(actorId, actor, officeId, reason, meta, false);
  }

  async archiveRegionalOffice(
    actorId: string,
    organizationId: string,
    officeId: string,
    reason: string,
    meta: RequestMeta = {},
  ) {
    const actor = await this.requireOrgAdmin(actorId);
    if (organizationId !== actor.organization_id) {
      throw new ForbiddenException(
        'Cannot archive an office outside your organization',
      );
    }
    return this.archiveForActor(actorId, actor, officeId, reason, meta, true);
  }

  private async archiveForActor(
    actorId: string,
    actor: OrgAdminActor,
    officeId: string,
    reason: string,
    meta: RequestMeta,
    requireRegional: boolean,
  ) {
    await this.dataSource.transaction(async (manager) => {
      const office = await this.lockOffice(
        manager,
        actor.organization_id,
        officeId,
      );
      if (requireRegional && office.level !== 'regional') {
        throw new ConflictException(
          'Only Regional Offices can use this archive endpoint',
        );
      }
      assertOfficeTransition(office.status as OfficeStatus, 'archived');
      const activeChildren = await manager.query<Array<{ count: number }>>(
        `SELECT count(*)::int AS count
         FROM offices
         WHERE organization_id = $1 AND parent_office_id = $2 AND status = 'active'`,
        [actor.organization_id, officeId],
      );
      if (Number(activeChildren[0]?.count ?? 0) > 0) {
        throw new ConflictException(
          'Archive child offices before archiving this office',
        );
      }
      const before = this.entityState(office);
      office.status = 'archived';
      office.archivedAt = new Date();
      office.lifecycleReason = reason;
      office.updatedByUserId = actor.id;
      await manager.getRepository(OfficeEntity).save(office);
      await this.audit(manager, actor.id, actor.organization_id, {
        action: 'office_archived',
        entityId: office.id,
        before,
        after: this.entityState(office),
        reason,
        ...meta,
      });
    });
    return this.detail(actorId, officeId);
  }

  async reactivate(actorId: string, officeId: string, meta: RequestMeta = {}) {
    const actor = await this.requireOrgAdmin(actorId);
    return this.reactivateForActor(actorId, actor, officeId, meta, false);
  }

  async reactivateRegionalOffice(
    actorId: string,
    organizationId: string,
    officeId: string,
    meta: RequestMeta = {},
  ) {
    const actor = await this.requireOrgAdmin(actorId);
    if (organizationId !== actor.organization_id) {
      throw new ForbiddenException(
        'Cannot reactivate an office outside your organization',
      );
    }
    return this.reactivateForActor(actorId, actor, officeId, meta, true);
  }

  private async reactivateForActor(
    actorId: string,
    actor: OrgAdminActor,
    officeId: string,
    meta: RequestMeta,
    requireRegional: boolean,
  ) {
    await this.dataSource.transaction(async (manager) => {
      const office = await this.lockOffice(
        manager,
        actor.organization_id,
        officeId,
      );
      if (requireRegional && office.level !== 'regional') {
        throw new ConflictException(
          'Only Regional Offices can use this reactivate endpoint',
        );
      }
      assertOfficeTransition(office.status as OfficeStatus, 'active');
      if (office.parentOfficeId) {
        await this.validateParent(
          manager,
          actor.organization_id,
          office.id,
          office.parentOfficeId,
        );
      }
      const before = this.entityState(office);
      office.status = 'active';
      office.archivedAt = null;
      office.lifecycleReason = null;
      office.updatedByUserId = actor.id;
      await manager.getRepository(OfficeEntity).save(office);
      await this.audit(manager, actor.id, actor.organization_id, {
        action: 'office_reactivated',
        entityId: office.id,
        before,
        after: this.entityState(office),
        ...meta,
      });
      await this.resumeDeferredWorkflowTasks(manager, office.id);
    });
    return this.detail(actorId, officeId);
  }

  private async listOfficeAdmins(officeId: string): Promise<OfficeAdminRow[]> {
    return this.dataSource.query<OfficeAdminRow[]>(
      `SELECT u.id, u.email, u.status, u.is_active, u.created_at, u.updated_at,
              sp.full_name, sp.phone,
              invitation.status AS invitation_status
       FROM user_accounts u
       JOIN user_role_assignments ura
         ON ura.user_account_id = u.id AND ura.office_id = $1
       JOIN roles r ON r.id = ura.role_id AND r.code = 'OFFICE_ADMIN'
       JOIN staff_profiles sp ON sp.user_account_id = u.id
       LEFT JOIN LATERAL (
         SELECT oi.status FROM organization_invitations oi
         WHERE oi.user_account_id = u.id AND oi.organization_id = u.organization_id
         ORDER BY oi.created_at DESC LIMIT 1
       ) invitation ON true
       WHERE u.office_id = $1
       ORDER BY u.created_at ASC`,
      [officeId],
    );
  }

  private async resumeDeferredWorkflowTasks(
    manager: EntityManager,
    officeId: string,
  ) {
    await manager.query(
      `INSERT INTO workflow_tasks (
         application_id, workflow_step_id, status
       )
       SELECT a.id, step.id, 'pending'
       FROM applications a
       JOIN workflow_definitions wd
         ON wd.program_template_version_id = a.program_template_version_id
       JOIN LATERAL (
         SELECT ws.id
         FROM workflow_steps ws
         WHERE ws.workflow_definition_id = wd.id
           AND ws.step_type = CASE
             WHEN a.status = 'in_evaluation' THEN 'evaluation'
             WHEN a.status = 'in_approval' THEN 'approval'
           END
         ORDER BY ws.sort_order ASC
         LIMIT 1
       ) step ON true
       WHERE a.office_id = $1
         AND a.status IN ('in_evaluation', 'in_approval')
         AND NOT EXISTS (
           SELECT 1
           FROM workflow_tasks task
           WHERE task.application_id = a.id
             AND task.workflow_step_id = step.id
             AND task.status = 'pending'
         )`,
      [officeId],
    );
  }

  private async requireOrgAdmin(actorId: string): Promise<OrgAdminActor> {
    const rows = await this.dataSource.query<
      Array<{
        id: string;
        organization_id: string | null;
        office_id: string | null;
        account_type: string;
        status: string;
        is_active: boolean;
        organization_name: string | null;
        organization_status: string | null;
      }>
    >(
      `SELECT u.id, u.organization_id, u.office_id, u.account_type,
              u.status, u.is_active, org.name AS organization_name,
              org.status AS organization_status
       FROM user_accounts u
       JOIN user_role_assignments ura ON ura.user_account_id = u.id
       JOIN roles r ON r.id = ura.role_id AND r.code = 'ORG_ADMIN'
       LEFT JOIN organizations org ON org.id = u.organization_id
       WHERE u.id = $1
       LIMIT 1`,
      [actorId],
    );
    const actor = rows[0];
    if (!actor)
      throw new ForbiddenException('Organization Administrator required');
    if (!actor.is_active || actor.status !== 'active') {
      throw new UnauthorizedException('Account is suspended');
    }
    if (
      actor.account_type !== 'staff' ||
      !actor.organization_id ||
      actor.office_id
    ) {
      throw new ForbiddenException('Invalid Organization Administrator scope');
    }
    if (!actor.organization_name || actor.organization_status !== 'active') {
      throw new ForbiddenException('Organization is suspended or archived');
    }
    return {
      id: actor.id,
      organization_id: actor.organization_id,
      organization_name: actor.organization_name,
    };
  }

  private officeSelect() {
    return `SELECT o.id, o.organization_id, org.name AS organization_name,
              o.parent_office_id, parent.name AS parent_office_name,
              o.name, o.code, o.normalized_code, o.level, o.status,
              COALESCE(children.direct_child_count, 0)::int AS direct_child_count,
              o.archived_at, o.lifecycle_reason, o.created_at, o.updated_at`;
  }

  private async loadOffice(organizationId: string, officeId: string) {
    const rows = await this.dataSource.query<OfficeRow[]>(
      `${this.officeSelect()}
       FROM offices o
       JOIN organizations org ON org.id = o.organization_id
       LEFT JOIN offices parent ON parent.id = o.parent_office_id
       LEFT JOIN LATERAL (
         SELECT count(*)::int AS direct_child_count
         FROM offices child
         WHERE child.parent_office_id = o.id
       ) children ON true
       WHERE o.id = $1 AND o.organization_id = $2 LIMIT 1`,
      [officeId, organizationId],
    );
    return rows[0] ?? null;
  }

  private async lockOffice(
    manager: EntityManager,
    organizationId: string,
    officeId: string,
  ) {
    const office = await manager.getRepository(OfficeEntity).findOne({
      where: { id: officeId, organizationId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!office) throw new NotFoundException('Office not found');
    return office;
  }

  private async ensureCodeAvailable(
    manager: EntityManager,
    organizationId: string,
    code: string,
    excludeOfficeId: string | null,
  ) {
    const params: unknown[] = [organizationId, code];
    let exclude = '';
    if (excludeOfficeId) {
      params.push(excludeOfficeId);
      exclude = `AND id <> $${params.length}`;
    }
    const existing = await manager.query<Array<{ id: string }>>(
      `SELECT id FROM offices
       WHERE organization_id = $1 AND normalized_code = $2 ${exclude}
       LIMIT 1`,
      params,
    );
    if (existing[0]) throw new ConflictException('Office code already exists');
  }

  private async ensureNameAvailable(
    manager: EntityManager,
    organizationId: string,
    name: string,
    excludeOfficeId: string | null,
  ) {
    const params: unknown[] = [organizationId, name];
    let exclude = '';
    if (excludeOfficeId) {
      params.push(excludeOfficeId);
      exclude = `AND id <> $${params.length}`;
    }
    const existing = await manager.query<Array<{ id: string }>>(
      `SELECT id FROM offices
       WHERE organization_id = $1 AND lower(trim(name)) = lower(trim($2)) ${exclude}
       LIMIT 1`,
      params,
    );
    if (existing[0]) throw new ConflictException('Office name already exists');
  }

  private async validateParent(
    manager: EntityManager,
    organizationId: string,
    officeId: string | null,
    parentOfficeId: string | null | undefined,
  ) {
    if (!parentOfficeId) return;
    if (officeId && parentOfficeId === officeId) {
      throw new ConflictException('Office cannot be its own parent');
    }
    const parent = await manager.getRepository(OfficeEntity).findOne({
      where: { id: parentOfficeId, organizationId },
    });
    if (!parent) throw new NotFoundException('Parent office not found');
    if (parent.status !== 'active') {
      throw new ConflictException('Parent office must be active');
    }
    if (!officeId) return;
    const rows = await manager.query<Array<{ id: string }>>(
      `WITH RECURSIVE descendants AS (
         SELECT id, parent_office_id
         FROM offices
         WHERE organization_id = $1 AND parent_office_id = $2
         UNION ALL
         SELECT child.id, child.parent_office_id
         FROM offices child
         JOIN descendants d ON child.parent_office_id = d.id
         WHERE child.organization_id = $1
       )
       SELECT id FROM descendants WHERE id = $3 LIMIT 1`,
      [organizationId, officeId, parentOfficeId],
    );
    if (rows[0])
      throw new ConflictException('Office hierarchy cycle is not allowed');
  }

  private async audit(
    manager: EntityManager,
    actorId: string,
    organizationId: string,
    input: {
      action: string;
      entityId: string;
      before?: Record<string, unknown> | null;
      after?: Record<string, unknown> | null;
      reason?: string | null;
      ipAddress?: string | null;
      requestId?: string | null;
    },
  ) {
    await manager.getRepository(AuditLogEntity).save({
      organizationId,
      actorUserId: actorId,
      action: input.action,
      entityType: 'office',
      entityId: input.entityId,
      beforeState: sanitizeAuditState(input.before),
      afterState: sanitizeAuditState(input.after),
      ipAddress: input.ipAddress ?? null,
      outcome: 'success',
      reason: input.reason ?? null,
      requestId: input.requestId ?? null,
    });
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

  private entityState(office: OfficeEntity) {
    return {
      id: office.id,
      organization_id: office.organizationId,
      parent_office_id: office.parentOfficeId,
      name: office.name,
      code: office.code,
      normalized_code: office.normalizedCode,
      level: office.level,
      status: office.status,
      archived_at: office.archivedAt,
      lifecycle_reason: office.lifecycleReason,
    };
  }

  private rethrowConflict(error: unknown): never {
    if (error instanceof QueryFailedError) {
      const message = String(error.message);
      if (message.includes('offices_org_normalized_code_uidx')) {
        throw new ConflictException('Office code already exists');
      }
      if (message.includes('offices_org_name_ci_uidx')) {
        throw new ConflictException('Office name already exists');
      }
      if (message.includes('Office hierarchy cycle')) {
        throw new ConflictException('Office hierarchy cycle is not allowed');
      }
      if (message.includes('Parent office must belong')) {
        throw new ConflictException(
          'Parent office must belong to the same organization',
        );
      }
      if (message.includes('user_accounts_email_key')) {
        throw new ConflictException('Administrator email already exists');
      }
    }
    throw error;
  }
}
