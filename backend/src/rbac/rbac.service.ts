import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  DB_PERMISSIONS,
  RBAC_MATRIX_ROLES,
  type DbPermission,
  type RbacMatrixRole,
} from './rbac.types';

type Actor = {
  id: string;
  role: 'platform_admin' | 'dswd_admin' | 'satellite_admin' | 'evaluator' | 'approver' | 'customer' | 'dependent';
  organization_id: string | null;
  office_id: string | null;
};

type OfficeRow = {
  id: string;
  code: string;
  name: string;
  organization_id: string;
};

type GrantInput = {
  role: string;
  permission: string;
  granted: boolean;
};

@Injectable()
export class RbacService {
  constructor(private readonly dataSource: DataSource) {}

  async listOffices(actorId: string) {
    const actor = await this.requireActor(actorId);
    if (actor.role === 'platform_admin') return { data: [] };
    if (actor.role === 'dswd_admin') {
      const rows = await this.dataSource.query<OfficeRow[]>(
        `SELECT id, code, name, organization_id
         FROM offices
         WHERE organization_id = $1 AND status = 'active'
         ORDER BY code, name`,
        [actor.organization_id],
      );
      return { data: rows.map(this.officeOption) };
    }
    if (actor.role === 'satellite_admin' && actor.office_id) {
      const rows = await this.dataSource.query<OfficeRow[]>(
        `SELECT id, code, name, organization_id
         FROM offices
         WHERE id = $1 AND status = 'active'`,
        [actor.office_id],
      );
      return { data: rows.map(this.officeOption) };
    }
    throw new ForbiddenException('RBAC office list is admin-only');
  }

  async officeGrants(actorId: string, officeId: string) {
    const actor = await this.requireActor(actorId);
    await this.requireOfficeAccess(actor, officeId, false);
    const rows = await this.dataSource.query<
      Array<{ role: RbacMatrixRole; permission: DbPermission }>
    >(
      `SELECT role, permission
       FROM office_rbac_grants
       WHERE office_id = $1
       ORDER BY role, permission`,
      [officeId],
    );
    return { data: rows };
  }

  async setOfficeGrant(actorId: string, officeId: string, input: GrantInput) {
    const actor = await this.requireActor(actorId);
    const grant = this.parseGrant(input);
    await this.requireOfficeAccess(actor, officeId, true);

    if (actor.role === 'platform_admin') {
      throw new ForbiddenException(
        'Platform admin edits global defaults, not office grants',
      );
    }
    if (actor.role === 'satellite_admin' && grant.role === 'satellite_admin') {
      throw new ForbiddenException('Office admin cannot edit office admin grants');
    }

    if (grant.granted) {
      await this.dataSource.query(
        `INSERT INTO office_rbac_grants (office_id, role, permission, updated_at)
         VALUES ($1, $2, $3, now())
         ON CONFLICT (office_id, role, permission)
         DO UPDATE SET updated_at = now()`,
        [officeId, grant.role, grant.permission],
      );
    } else {
      await this.dataSource.query(
        `DELETE FROM office_rbac_grants
         WHERE office_id = $1 AND role = $2 AND permission = $3`,
        [officeId, grant.role, grant.permission],
      );
    }

    return { ok: true };
  }

  async globalTemplate(actorId: string) {
    await this.requireAdminActor(actorId);
    const rows = await this.dataSource.query<
      Array<{ role: RbacMatrixRole; permission: DbPermission }>
    >(
      `SELECT role, permission
       FROM rbac_global_grants
       ORDER BY role, permission`,
    );
    return { data: rows };
  }

  async setGlobalGrant(actorId: string, input: GrantInput) {
    const actor = await this.requireActor(actorId);
    if (actor.role !== 'platform_admin') {
      throw new ForbiddenException('Only Platform admin can edit global defaults');
    }
    const grant = this.parseGrant(input);
    if (grant.granted) {
      await this.dataSource.query(
        `INSERT INTO rbac_global_grants (role, permission)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [grant.role, grant.permission],
      );
    } else {
      await this.dataSource.query(
        `DELETE FROM rbac_global_grants WHERE role = $1 AND permission = $2`,
        [grant.role, grant.permission],
      );
    }
    return { ok: true };
  }

  async applyGlobalTemplateToOffice(actorId: string, officeId: string) {
    const actor = await this.requireActor(actorId);
    if (actor.role !== 'dswd_admin') {
      throw new ForbiddenException(
        'Only Organization admin can apply global defaults to an office',
      );
    }
    await this.requireOfficeAccess(actor, officeId, true);
    await this.replaceOfficeGrants(officeId);
    return { ok: true };
  }

  async applyGlobalTemplateToAll(actorId: string) {
    const actor = await this.requireActor(actorId);
    if (actor.role !== 'dswd_admin' || !actor.organization_id) {
      throw new ForbiddenException(
        'Only Organization admin can apply global defaults',
      );
    }
    const rows = await this.dataSource.query<Array<{ id: string }>>(
      `SELECT id FROM offices WHERE organization_id = $1 AND status = 'active'`,
      [actor.organization_id],
    );
    for (const row of rows) {
      await this.replaceOfficeGrants(row.id);
    }
    return { ok: true };
  }

  private async replaceOfficeGrants(officeId: string) {
    await this.dataSource.transaction(async (manager) => {
      await manager.query(`DELETE FROM office_rbac_grants WHERE office_id = $1`, [
        officeId,
      ]);
      await manager.query(
        `INSERT INTO office_rbac_grants (office_id, role, permission)
         SELECT $1, role, permission FROM rbac_global_grants
         ON CONFLICT DO NOTHING`,
        [officeId],
      );
    });
  }

  private parseGrant(input: GrantInput): {
    role: RbacMatrixRole;
    permission: DbPermission;
    granted: boolean;
  } {
    if (!RBAC_MATRIX_ROLES.includes(input.role as RbacMatrixRole)) {
      throw new BadRequestException('Invalid RBAC role');
    }
    if (!DB_PERMISSIONS.includes(input.permission as DbPermission)) {
      throw new BadRequestException('Invalid RBAC permission');
    }
    return {
      role: input.role as RbacMatrixRole,
      permission: input.permission as DbPermission,
      granted: Boolean(input.granted),
    };
  }

  private async requireOfficeAccess(
    actor: Actor,
    officeId: string,
    write: boolean,
  ) {
    const rows = await this.dataSource.query<OfficeRow[]>(
      `SELECT id, code, name, organization_id FROM offices WHERE id = $1`,
      [officeId],
    );
    const office = rows[0];
    if (!office) throw new NotFoundException('Office not found');
    if (actor.role === 'platform_admin') {
      if (write) {
        throw new ForbiddenException(
          'Platform admin edits global defaults, not office grants',
        );
      }
      return office;
    }
    if (
      actor.role === 'dswd_admin' &&
      actor.organization_id === office.organization_id
    ) {
      return office;
    }
    if (actor.role === 'satellite_admin' && actor.office_id === office.id) {
      return office;
    }
    throw new ForbiddenException('Office is outside RBAC scope');
  }

  private async requireAdminActor(actorId: string) {
    const actor = await this.requireActor(actorId);
    if (
      !['platform_admin', 'dswd_admin', 'satellite_admin'].includes(actor.role)
    ) {
      throw new ForbiddenException('RBAC is admin-only');
    }
    return actor;
  }

  private async requireActor(actorId: string): Promise<Actor> {
    const rows = await this.dataSource.query<Actor[]>(
      `SELECT
         u.id,
         u.organization_id,
         u.office_id,
         CASE r.code
           WHEN 'PLATFORM_ADMIN' THEN 'platform_admin'
           WHEN 'ORG_ADMIN' THEN 'dswd_admin'
           WHEN 'OFFICE_ADMIN' THEN 'satellite_admin'
           WHEN 'EVALUATOR' THEN 'evaluator'
           WHEN 'APPROVER' THEN 'approver'
           WHEN 'BENEFICIARY' THEN 'customer'
           ELSE 'dependent'
         END AS role
       FROM user_accounts u
       LEFT JOIN user_role_assignments ura ON ura.user_account_id = u.id
       LEFT JOIN roles r ON r.id = ura.role_id
       WHERE u.id = $1 AND u.is_active = true
       ORDER BY ura.created_at ASC
       LIMIT 1`,
      [actorId],
    );
    const actor = rows[0];
    if (!actor) throw new UnauthorizedException('Active user not found');
    return actor;
  }

  private officeOption(row: OfficeRow) {
    return { id: row.id, code: row.code, name: row.name };
  }
}
