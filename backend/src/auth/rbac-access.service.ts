import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  UserAccountEntity,
  UserRoleAssignmentEntity,
} from '../users/user.entity';
import {
  decideRbac,
  type ErdRoleCode,
  type RbacActor,
  type RbacDecision,
  type RbacPermission,
  type RbacResource,
} from './rbac.policy';

/** ERD role priority when picking a primary JWT role (first match wins). */
export const ERD_ROLE_PRIORITY: readonly ErdRoleCode[] = [
  'PLATFORM_ADMIN',
  'ORG_ADMIN',
  'OFFICE_ADMIN',
  'APPROVER',
  'EVALUATOR',
  'BENEFICIARY',
  'DEPENDENT',
] as const;

export function isBeneficiaryClassRole(code: string | null | undefined): boolean {
  return code === 'BENEFICIARY' || code === 'DEPENDENT';
}

export function decideAnyRole(
  actors: RbacActor[],
  permission: RbacPermission,
  resource: RbacResource = {},
): RbacDecision {
  if (!actors.length) {
    return { allowed: false, reason: 'No roles assigned' };
  }
  let last: RbacDecision = { allowed: false, reason: 'Permission is not granted' };
  for (const actor of actors) {
    const decision = decideRbac(actor, permission, resource);
    if (decision.allowed) return decision;
    last = decision;
  }
  return last;
}

export function pickPrimaryErdRole(codes: string[]): ErdRoleCode {
  for (const preferred of ERD_ROLE_PRIORITY) {
    if (codes.includes(preferred)) return preferred;
  }
  return (codes[0] as ErdRoleCode) || 'BENEFICIARY';
}

/**
 * Loads all role assignments for a user and evaluates PRD `decideRbac`.
 * Dual-role accounts (e.g. Office Admin + Evaluator) are connected here:
 * any granted role may authorize the permission.
 */
@Injectable()
export class RbacAccessService {
  constructor(
    @InjectRepository(UserAccountEntity)
    private readonly users: Repository<UserAccountEntity>,
    @InjectRepository(UserRoleAssignmentEntity)
    private readonly roleAssignments: Repository<UserRoleAssignmentEntity>,
  ) {}

  async loadActors(userId: string): Promise<RbacActor[]> {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) return [];
    const assignments = await this.roleAssignments.find({
      where: { userAccountId: userId },
      relations: ['role'],
    });
    const actors: RbacActor[] = [];
    for (const assignment of assignments) {
      const code = assignment.role?.code as ErdRoleCode | undefined;
      if (!code) continue;
      actors.push({
        userId,
        role: code,
        organizationId: user.organizationId ?? null,
        officeId: assignment.officeId ?? user.officeId ?? null,
        beneficiaryId: user.beneficiaryId ?? null,
      });
    }
    return actors;
  }

  async listErdRoles(userId: string): Promise<ErdRoleCode[]> {
    const actors = await this.loadActors(userId);
    return [...new Set(actors.map((a) => a.role))];
  }

  async assertPermission(
    userId: string,
    permission: RbacPermission,
    resource: RbacResource = {},
  ): Promise<RbacDecision> {
    const actors = await this.loadActors(userId);
    const decision = decideAnyRole(actors, permission, resource);
    if (!decision.allowed) {
      throw new ForbiddenException(decision.reason);
    }
    return decision;
  }

  async hasPermission(
    userId: string,
    permission: RbacPermission,
    resource: RbacResource = {},
  ): Promise<boolean> {
    const actors = await this.loadActors(userId);
    return decideAnyRole(actors, permission, resource).allowed;
  }
}
