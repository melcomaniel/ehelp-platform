import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { OfficeEntity } from '../domain/domain.entities';
import {
  AuditLogEntity,
  OrganizationInvitationEntity,
} from '../organizations/organization.entities';
import { StaffProfileEntity } from '../users/staff-profile.entity';
import {
  RoleEntity,
  UserAccountEntity,
  UserRoleAssignmentEntity,
} from '../users/user.entity';
import { OfficeService } from './office.service';

const actor = {
  id: 'user-1',
  organization_id: 'org-1',
  office_id: null,
  account_type: 'staff',
  status: 'active',
  is_active: true,
  organization_name: 'Agency',
  organization_status: 'active',
};

const officeRow = {
  id: 'office-1',
  organization_id: 'org-1',
  organization_name: 'Agency',
  parent_office_id: null,
  parent_office_name: null,
  name: 'Region III',
  code: 'REGION_III',
  normalized_code: 'REGION_III',
  level: 'regional',
  status: 'active',
  direct_child_count: 0,
  archived_at: null,
  lifecycle_reason: null,
  created_at: new Date('2026-01-01T00:00:00Z'),
  updated_at: new Date('2026-01-01T00:00:00Z'),
};

function makeService(options?: {
  actorOrganizationId?: string;
  nameExists?: boolean;
}) {
  const savedOffices: Array<Record<string, unknown>> = [];
  const auditSaves: Array<Record<string, unknown>> = [];
  const managerQueries: Array<{ sql: string; params?: unknown[] }> = [];

  const manager = {
    query: jest.fn(async (sql: string, params?: unknown[]) => {
      managerQueries.push({ sql, params });
      if (sql.includes('lower(trim(name))')) {
        return options?.nameExists ? [{ id: 'existing-office' }] : [];
      }
      if (sql.includes('normalized_code')) return [];
      return [];
    }),
    getRepository: jest.fn((entity: unknown) => {
      if (entity === OfficeEntity) {
        return {
          save: jest.fn(async (office: Record<string, unknown>) => {
            savedOffices.push(office);
            return {
              ...office,
              id: 'office-1',
              createdAt: officeRow.created_at,
              updatedAt: officeRow.updated_at,
            };
          }),
          create: jest.fn((office: Record<string, unknown>) => office),
        };
      }
      if (entity === AuditLogEntity) {
        return {
          save: jest.fn(async (audit: Record<string, unknown>) => {
            auditSaves.push(audit);
            return audit;
          }),
        };
      }
      throw new Error('Unexpected repository');
    }),
  };

  const dataSource = {
    query: jest
      .fn()
      .mockResolvedValueOnce([
        {
          ...actor,
          organization_id: options?.actorOrganizationId ?? 'org-1',
        },
      ])
      .mockResolvedValueOnce([actor])
      .mockResolvedValueOnce([officeRow])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValue([]),
    transaction: jest.fn(async (callback) => callback(manager)),
  } as unknown as DataSource;

  return {
    service: new OfficeService(dataSource),
    dataSource,
    savedOffices,
    auditSaves,
    managerQueries,
  };
}

describe('OfficeService regional office creation', () => {
  it('creates a flat regional office scoped to the actor organization', async () => {
    const { service, savedOffices, auditSaves, managerQueries } = makeService();

    const result = await service.createRegionalOffice(
      'user-1',
      'org-1',
      {
        name: ' Region III ',
        code: 'region iii',
        parent_office_id: 'ignored-parent',
      } as never,
      { requestId: 'req-1', ipAddress: '127.0.0.1' },
    );

    expect(result).toMatchObject({
      id: 'office-1',
      organization_id: 'org-1',
      parent_office_id: null,
      name: 'Region III',
      code: 'REGION_III',
      level: 'regional',
    });
    expect(savedOffices[0]).toMatchObject({
      organizationId: 'org-1',
      parentOfficeId: null,
      name: 'Region III',
      code: 'REGION_III',
      normalizedCode: 'REGION_III',
      level: 'regional',
      status: 'active',
      createdByUserId: 'user-1',
      updatedByUserId: 'user-1',
    });
    expect(managerQueries[0]?.params).toEqual(['org-1', 'Region III']);
    expect(managerQueries[1]?.params).toEqual(['org-1', 'REGION_III']);
    expect(auditSaves[0]).toMatchObject({
      organizationId: 'org-1',
      actorUserId: 'user-1',
      action: 'office_created',
      entityType: 'office',
      entityId: 'office-1',
      outcome: 'success',
      requestId: 'req-1',
    });
  });

  it('rejects creation for a different organization route id', async () => {
    const { service, dataSource } = makeService();

    await expect(
      service.createRegionalOffice('user-1', 'org-2', {
        name: 'Region IV-A',
        code: 'R4A',
      }),
    ).rejects.toThrow(ForbiddenException);
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('rejects duplicate office names only within the actor organization', async () => {
    const { service } = makeService({ nameExists: true });

    await expect(
      service.createRegionalOffice('user-1', 'org-1', {
        name: 'Region III',
        code: 'R3',
      }),
    ).rejects.toThrow(ConflictException);
  });
});

function makeArchiveService(options?: {
  actorOrganizationId?: string;
  actorStatus?: string;
  actorActive?: boolean;
  organizationStatus?: string;
  includeActor?: boolean;
  level?: string;
  status?: string;
  activeChildren?: number;
  officeFound?: boolean;
}) {
  const office = {
    id: 'office-1',
    organizationId: 'org-1',
    parentOfficeId: null,
    name: 'Region III',
    code: 'REGION_III',
    normalizedCode: 'REGION_III',
    level: options?.level ?? 'regional',
    status: options?.status ?? 'active',
    archivedAt: null as Date | null,
    lifecycleReason: null as string | null,
    createdByUserId: 'user-1',
    updatedByUserId: 'user-1',
  };
  const auditSaves: Array<Record<string, unknown>> = [];
  const officeSaves: Array<Record<string, unknown>> = [];
  const manager = {
    query: jest.fn(async (sql: string) => {
      if (sql.includes('count(*)::int AS count')) {
        return [{ count: options?.activeChildren ?? 0 }];
      }
      return [];
    }),
    getRepository: jest.fn((entity: unknown) => {
      if (entity === OfficeEntity) {
        return {
          findOne: jest.fn(async () =>
            options?.officeFound === false ? null : office,
          ),
          save: jest.fn(async (value: Record<string, unknown>) => {
            officeSaves.push({ ...value });
            return value;
          }),
        };
      }
      if (entity === AuditLogEntity) {
        return {
          save: jest.fn(async (value: Record<string, unknown>) => {
            auditSaves.push(value);
            return value;
          }),
        };
      }
      throw new Error('Unexpected repository');
    }),
  };
  const detailRow = () => ({
    ...officeRow,
    level: office.level,
    status: office.status,
    archived_at: office.archivedAt,
    lifecycle_reason: office.lifecycleReason,
  });
  const dataSource = {
    query: jest.fn(async (sql: string) => {
      if (sql.includes('FROM user_accounts u')) {
        if (options?.includeActor === false) return [];
        return [
          {
            ...actor,
            organization_id: options?.actorOrganizationId ?? 'org-1',
            status: options?.actorStatus ?? 'active',
            is_active: options?.actorActive ?? true,
            organization_status: options?.organizationStatus ?? 'active',
          },
        ];
      }
      if (sql.includes('WHERE o.id = $1')) return [detailRow()];
      return [];
    }),
    transaction: jest.fn(async (callback) => callback(manager)),
  } as unknown as DataSource;

  return {
    service: new OfficeService(dataSource),
    dataSource,
    office,
    officeSaves,
    auditSaves,
    manager,
  };
}

describe('OfficeService regional office archive', () => {
  it('archives an owned Regional Office and writes one audit record', async () => {
    const { service, office, officeSaves, auditSaves } = makeArchiveService();

    const result = await service.archiveRegionalOffice(
      'user-1',
      'org-1',
      'office-1',
      'Regional consolidation',
      { requestId: 'req-archive', ipAddress: '127.0.0.1' },
    );

    expect(result).toMatchObject({
      id: 'office-1',
      status: 'archived',
      lifecycle_reason: 'Regional consolidation',
    });
    expect(office.status).toBe('archived');
    expect(office.archivedAt).toBeInstanceOf(Date);
    expect(officeSaves).toHaveLength(1);
    expect(auditSaves).toHaveLength(1);
    expect(auditSaves[0]).toMatchObject({
      organizationId: 'org-1',
      actorUserId: 'user-1',
      action: 'office_archived',
      entityType: 'office',
      entityId: 'office-1',
      reason: 'Regional consolidation',
      outcome: 'success',
      requestId: 'req-archive',
    });
  });

  it('rejects a mismatched organization before starting a transaction', async () => {
    const { service, dataSource } = makeArchiveService();

    await expect(
      service.archiveRegionalOffice(
        'user-1',
        'org-2',
        'office-1',
        'Invalid scope',
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('rejects actors without the active Organization Administrator context', async () => {
    const missingRole = makeArchiveService({ includeActor: false });
    const inactive = makeArchiveService({ actorActive: false });
    const suspendedOrganization = makeArchiveService({
      organizationStatus: 'suspended',
    });

    await expect(
      missingRole.service.archiveRegionalOffice(
        'user-1',
        'org-1',
        'office-1',
        'Missing role',
      ),
    ).rejects.toThrow(ForbiddenException);
    await expect(
      inactive.service.archiveRegionalOffice(
        'user-1',
        'org-1',
        'office-1',
        'Inactive account',
      ),
    ).rejects.toThrow(UnauthorizedException);
    await expect(
      suspendedOrganization.service.archiveRegionalOffice(
        'user-1',
        'org-1',
        'office-1',
        'Suspended organization',
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('does not reveal an office outside the scoped organization', async () => {
    const { service } = makeArchiveService({ officeFound: false });

    await expect(
      service.archiveRegionalOffice(
        'user-1',
        'org-1',
        'office-from-another-org',
        'Cross-tenant request',
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects non-regional offices on the canonical endpoint', async () => {
    const { service, auditSaves } = makeArchiveService({
      level: 'provincial',
    });

    await expect(
      service.archiveRegionalOffice(
        'user-1',
        'org-1',
        'office-1',
        'Wrong endpoint',
      ),
    ).rejects.toThrow(ConflictException);
    expect(auditSaves).toHaveLength(0);
  });

  it('retains the active-child restriction', async () => {
    const { service, officeSaves, auditSaves } = makeArchiveService({
      activeChildren: 1,
    });

    await expect(
      service.archiveRegionalOffice(
        'user-1',
        'org-1',
        'office-1',
        'Parent closure',
      ),
    ).rejects.toThrow(ConflictException);
    expect(officeSaves).toHaveLength(0);
    expect(auditSaves).toHaveLength(0);
  });

  it('keeps the legacy route behavior through the shared archive operation', async () => {
    const { service, office, auditSaves } = makeArchiveService();

    await service.archive('user-1', 'office-1', 'Legacy client request');

    expect(office.status).toBe('archived');
    expect(auditSaves).toHaveLength(1);
  });

  it('idempotently backfills deferred workflow tasks on reactivation', async () => {
    const { service, manager } = makeArchiveService({
      status: 'archived',
    });

    await service.reactivate('user-1', 'office-1');

    expect(manager.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO workflow_tasks'),
      ['office-1'],
    );
    expect(manager.query).toHaveBeenCalledWith(
      expect.stringContaining('NOT EXISTS'),
      ['office-1'],
    );
  });
});

describe('OfficeService regional office reactivation', () => {
  it('reactivates an owned archived Regional Office and writes one audit record', async () => {
    const { service, office, officeSaves, auditSaves } = makeArchiveService({
      status: 'archived',
    });

    const result = await service.reactivateRegionalOffice(
      'user-1',
      'org-1',
      'office-1',
      { requestId: 'req-reactivate', ipAddress: '127.0.0.1' },
    );

    expect(result).toMatchObject({ id: 'office-1', status: 'active' });
    expect(office.status).toBe('active');
    expect(office.archivedAt).toBeNull();
    expect(office.lifecycleReason).toBeNull();
    expect(officeSaves).toHaveLength(1);
    expect(auditSaves).toHaveLength(1);
    expect(auditSaves[0]).toMatchObject({
      organizationId: 'org-1',
      actorUserId: 'user-1',
      action: 'office_reactivated',
      entityType: 'office',
      entityId: 'office-1',
      outcome: 'success',
      requestId: 'req-reactivate',
    });
  });

  it('rejects a mismatched organization before starting a transaction', async () => {
    const { service, dataSource } = makeArchiveService({
      status: 'archived',
    });

    await expect(
      service.reactivateRegionalOffice('user-1', 'org-2', 'office-1'),
    ).rejects.toThrow(ForbiddenException);
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('rejects actors without the active Organization Administrator context', async () => {
    const missingRole = makeArchiveService({
      status: 'archived',
      includeActor: false,
    });
    const inactive = makeArchiveService({
      status: 'archived',
      actorActive: false,
    });
    const suspendedOrganization = makeArchiveService({
      status: 'archived',
      organizationStatus: 'suspended',
    });

    await expect(
      missingRole.service.reactivateRegionalOffice('user-1', 'org-1', 'office-1'),
    ).rejects.toThrow(ForbiddenException);
    await expect(
      inactive.service.reactivateRegionalOffice('user-1', 'org-1', 'office-1'),
    ).rejects.toThrow(UnauthorizedException);
    await expect(
      suspendedOrganization.service.reactivateRegionalOffice(
        'user-1',
        'org-1',
        'office-1',
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('does not reveal an office outside the scoped organization', async () => {
    const { service } = makeArchiveService({
      status: 'archived',
      officeFound: false,
    });

    await expect(
      service.reactivateRegionalOffice(
        'user-1',
        'org-1',
        'office-from-another-org',
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects non-regional offices on the canonical endpoint', async () => {
    const { service, auditSaves } = makeArchiveService({
      status: 'archived',
      level: 'provincial',
    });

    await expect(
      service.reactivateRegionalOffice('user-1', 'org-1', 'office-1'),
    ).rejects.toThrow(ConflictException);
    expect(auditSaves).toHaveLength(0);
  });

  it('rejects reactivating an office that is already active', async () => {
    const { service, auditSaves } = makeArchiveService({ status: 'active' });

    await expect(
      service.reactivateRegionalOffice('user-1', 'org-1', 'office-1'),
    ).rejects.toThrow(ConflictException);
    expect(auditSaves).toHaveLength(0);
  });

  it('keeps the legacy route behavior through the shared reactivate operation', async () => {
    const { service, office, auditSaves } = makeArchiveService({
      status: 'archived',
    });

    await service.reactivate('user-1', 'office-1');

    expect(office.status).toBe('active');
    expect(auditSaves).toHaveLength(1);
  });
});

function makeOfficeAdminService(options?: {
  actorOrganizationId?: string;
  officeStatus?: 'active' | 'archived';
  existingActiveAdmin?: boolean;
  existingEmail?: boolean;
  createdAdminRow?: Record<string, unknown>;
}) {
  const office = {
    id: 'office-1',
    organizationId: 'org-1',
    parentOfficeId: null,
    name: 'Region III',
    code: 'REGION_III',
    normalizedCode: 'REGION_III',
    level: 'regional',
    status: options?.officeStatus ?? 'active',
    archivedAt: null as Date | null,
    lifecycleReason: null as string | null,
    createdByUserId: 'user-1',
    updatedByUserId: 'user-1',
  };
  const auditSaves: Array<Record<string, unknown>> = [];
  const savedUserAccounts: Array<Record<string, unknown>> = [];
  const savedProfiles: Array<Record<string, unknown>> = [];
  const savedRoleAssignments: Array<Record<string, unknown>> = [];
  const savedInvitations: Array<Record<string, unknown>> = [];

  const manager = {
    query: jest.fn(async (sql: string) => {
      if (sql.includes("r.code = 'OFFICE_ADMIN'") && sql.includes('is_active')) {
        return options?.existingActiveAdmin ? [{ id: 'existing-admin' }] : [];
      }
      return [];
    }),
    getRepository: jest.fn((entity: unknown) => {
      if (entity === OfficeEntity) {
        return {
          findOne: jest.fn(async () => office),
        };
      }
      if (entity === UserAccountEntity) {
        return {
          findOne: jest.fn(async () =>
            options?.existingEmail ? { id: 'existing-user' } : null,
          ),
          create: jest.fn((value: Record<string, unknown>) => value),
          save: jest.fn(async (value: Record<string, unknown>) => {
            savedUserAccounts.push(value);
            return { ...value, id: 'admin-1' };
          }),
        };
      }
      if (entity === RoleEntity) {
        return {
          findOne: jest.fn(async () => ({ id: 'role-office-admin' })),
        };
      }
      if (entity === StaffProfileEntity) {
        return {
          save: jest.fn(async (value: Record<string, unknown>) => {
            savedProfiles.push(value);
            return value;
          }),
        };
      }
      if (entity === UserRoleAssignmentEntity) {
        return {
          save: jest.fn(async (value: Record<string, unknown>) => {
            savedRoleAssignments.push(value);
            return value;
          }),
        };
      }
      if (entity === OrganizationInvitationEntity) {
        return {
          save: jest.fn(async (value: Record<string, unknown>) => {
            savedInvitations.push(value);
            return { ...value, id: 'invitation-1' };
          }),
        };
      }
      if (entity === AuditLogEntity) {
        return {
          save: jest.fn(async (value: Record<string, unknown>) => {
            auditSaves.push(value);
            return value;
          }),
        };
      }
      throw new Error('Unexpected repository');
    }),
  };

  const dataSource = {
    query: jest.fn(async (sql: string) => {
      if (sql.includes('FROM user_accounts u') && sql.includes("'ORG_ADMIN'")) {
        return [
          {
            ...actor,
            organization_id: options?.actorOrganizationId ?? 'org-1',
          },
        ];
      }
      if (sql.includes("r.code = 'OFFICE_ADMIN'")) {
        return [
          options?.createdAdminRow ?? {
            id: 'admin-1',
            email: 'admin@region.gov.ph',
            status: 'active',
            is_active: true,
            created_at: new Date('2026-01-01T00:00:00Z'),
            updated_at: new Date('2026-01-01T00:00:00Z'),
            full_name: 'Regional Admin',
            phone: null,
            invitation_status: 'pending',
          },
        ];
      }
      return [];
    }),
    transaction: jest.fn(async (callback) => callback(manager)),
  } as unknown as DataSource;

  return {
    service: new OfficeService(dataSource),
    dataSource,
    manager,
    auditSaves,
    savedUserAccounts,
    savedProfiles,
    savedRoleAssignments,
    savedInvitations,
  };
}

describe('OfficeService office administrator assignment', () => {
  const validInput = {
    full_name: 'Regional Admin',
    email: 'admin@region.gov.ph',
    phone: undefined,
  };

  it('creates an Office Administrator scoped to the office and writes audit records', async () => {
    const {
      service,
      auditSaves,
      savedUserAccounts,
      savedRoleAssignments,
      savedInvitations,
    } = makeOfficeAdminService();

    const result = await service.createOfficeAdmin(
      'user-1',
      'org-1',
      'office-1',
      validInput,
      { requestId: 'req-office-admin', ipAddress: '127.0.0.1' },
    );

    expect(result).toMatchObject({ id: 'admin-1', email: 'admin@region.gov.ph' });
    expect(savedUserAccounts).toHaveLength(1);
    expect(savedUserAccounts[0]).toMatchObject({
      organizationId: 'org-1',
      officeId: 'office-1',
      accountType: 'staff',
    });
    expect(savedRoleAssignments).toHaveLength(1);
    expect(savedRoleAssignments[0]).toMatchObject({
      officeId: 'office-1',
      roleId: 'role-office-admin',
    });
    expect(savedInvitations).toHaveLength(1);
    expect(auditSaves).toHaveLength(3);
    expect(auditSaves.map((a) => a.action)).toEqual([
      'office_admin_created',
      'role_assigned',
      'invitation_created',
    ]);
  });

  it('rejects a mismatched organization before starting a transaction', async () => {
    const { service, dataSource } = makeOfficeAdminService({
      actorOrganizationId: 'org-2',
    });

    await expect(
      service.createOfficeAdmin('user-1', 'org-1', 'office-1', validInput),
    ).rejects.toThrow(ForbiddenException);
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('rejects assigning an administrator to an archived office', async () => {
    const { service, auditSaves } = makeOfficeAdminService({
      officeStatus: 'archived',
    });

    await expect(
      service.createOfficeAdmin('user-1', 'org-1', 'office-1', validInput),
    ).rejects.toThrow(ConflictException);
    expect(auditSaves).toHaveLength(0);
  });

  it('allows multiple administrators for the same office', async () => {
    const { service, auditSaves } = makeOfficeAdminService({
      existingActiveAdmin: true,
    });

    await expect(
      service.createOfficeAdmin('user-1', 'org-1', 'office-1', validInput),
    ).resolves.toMatchObject({ id: 'admin-1' });
    expect(auditSaves).toHaveLength(3);
  });

  it('rejects a duplicate administrator email', async () => {
    const { service, auditSaves } = makeOfficeAdminService({
      existingEmail: true,
    });

    await expect(
      service.createOfficeAdmin('user-1', 'org-1', 'office-1', validInput),
    ).rejects.toThrow(ConflictException);
    expect(auditSaves).toHaveLength(0);
  });
});

function makeStaffRequestService(options?: {
  actorOfficeId?: string;
  officeStatus?: 'active' | 'archived';
  existingEmail?: boolean;
  createdRequestRow?: Record<string, unknown>;
}) {
  const office = {
    id: 'office-1',
    organizationId: 'org-1',
    status: options?.officeStatus ?? 'active',
  };
  const auditSaves: Array<Record<string, unknown>> = [];
  const savedUserAccounts: Array<Record<string, unknown>> = [];
  const savedProfiles: Array<Record<string, unknown>> = [];
  const savedRoleAssignments: Array<Record<string, unknown>> = [];

  const manager = {
    getRepository: jest.fn((entity: unknown) => {
      if (entity === OfficeEntity) {
        return { findOne: jest.fn(async () => office) };
      }
      if (entity === UserAccountEntity) {
        return {
          findOne: jest.fn(async () =>
            options?.existingEmail ? { id: 'existing-user' } : null,
          ),
          create: jest.fn((value: Record<string, unknown>) => value),
          save: jest.fn(async (value: Record<string, unknown>) => {
            savedUserAccounts.push(value);
            return { ...value, id: 'staff-1' };
          }),
        };
      }
      if (entity === RoleEntity) {
        return {
          findOne: jest.fn(async () => ({ id: 'role-evaluator', code: 'EVALUATOR' })),
        };
      }
      if (entity === StaffProfileEntity) {
        return {
          save: jest.fn(async (value: Record<string, unknown>) => {
            savedProfiles.push(value);
            return value;
          }),
        };
      }
      if (entity === UserRoleAssignmentEntity) {
        return {
          save: jest.fn(async (value: Record<string, unknown>) => {
            savedRoleAssignments.push(value);
            return value;
          }),
        };
      }
      if (entity === AuditLogEntity) {
        return {
          save: jest.fn(async (value: Record<string, unknown>) => {
            auditSaves.push(value);
            return value;
          }),
        };
      }
      throw new Error('Unexpected repository');
    }),
  };

  const dataSource = {
    query: jest.fn(async (sql: string) => {
      if (sql.includes("r.code = 'OFFICE_ADMIN'")) {
        return [
          {
            id: 'user-1',
            organization_id: 'org-1',
            office_id: options?.actorOfficeId ?? 'office-1',
            account_type: 'staff',
            status: 'active',
            is_active: true,
            organization_status: 'active',
          },
        ];
      }
      if (sql.includes("r.code IN ('EVALUATOR', 'APPROVER')")) {
        return [
          options?.createdRequestRow ?? {
            id: 'staff-1',
            email: 'officer@region.gov.ph',
            status: 'pending',
            is_active: true,
            role: 'EVALUATOR',
            created_at: new Date('2026-01-01T00:00:00Z'),
            updated_at: new Date('2026-01-01T00:00:00Z'),
            full_name: 'New Officer',
            phone: null,
            invitation_status: null,
          },
        ];
      }
      return [];
    }),
    transaction: jest.fn(async (callback) => callback(manager)),
  } as unknown as DataSource;

  return {
    service: new OfficeService(dataSource),
    dataSource,
    manager,
    auditSaves,
    savedUserAccounts,
    savedProfiles,
    savedRoleAssignments,
  };
}

describe('OfficeService staff account requests', () => {
  const validInput = {
    full_name: 'New Officer',
    email: 'officer@region.gov.ph',
    phone: undefined,
    role: 'evaluator' as const,
  };

  it('creates a pending Evaluator account scoped to the requesting Office Administrator office', async () => {
    const {
      service,
      auditSaves,
      savedUserAccounts,
      savedRoleAssignments,
    } = makeStaffRequestService();

    const result = await service.requestStaffAccount(
      'user-1',
      'office-1',
      validInput,
      { requestId: 'req-staff', ipAddress: '127.0.0.1' },
    );

    expect(result).toMatchObject({
      id: 'staff-1',
      email: 'officer@region.gov.ph',
      status: 'pending',
      role: 'EVALUATOR',
    });
    expect(savedUserAccounts).toHaveLength(1);
    expect(savedUserAccounts[0]).toMatchObject({
      organizationId: 'org-1',
      officeId: 'office-1',
      accountType: 'staff',
      status: 'pending',
    });
    expect(savedRoleAssignments).toHaveLength(1);
    expect(savedRoleAssignments[0]).toMatchObject({
      officeId: 'office-1',
      roleId: 'role-evaluator',
    });
    expect(auditSaves).toHaveLength(1);
    expect(auditSaves[0]).toMatchObject({
      organizationId: 'org-1',
      actorUserId: 'user-1',
      action: 'staff_account_requested',
      outcome: 'success',
      requestId: 'req-staff',
    });
  });

  it('rejects requesting staff for a different office', async () => {
    const { service, dataSource } = makeStaffRequestService({
      actorOfficeId: 'office-2',
    });

    await expect(
      service.requestStaffAccount('user-1', 'office-1', validInput),
    ).rejects.toThrow(ForbiddenException);
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('rejects requesting staff for an archived office', async () => {
    const { service, auditSaves } = makeStaffRequestService({
      officeStatus: 'archived',
    });

    await expect(
      service.requestStaffAccount('user-1', 'office-1', validInput),
    ).rejects.toThrow(ConflictException);
    expect(auditSaves).toHaveLength(0);
  });

  it('rejects a duplicate staff email', async () => {
    const { service, auditSaves } = makeStaffRequestService({
      existingEmail: true,
    });

    await expect(
      service.requestStaffAccount('user-1', 'office-1', validInput),
    ).rejects.toThrow(ConflictException);
    expect(auditSaves).toHaveLength(0);
  });
});

function makeApproveStaffRequestService(options?: {
  actorOrganizationId?: string;
  targetStatus?: string;
  targetFound?: boolean;
  roleCode?: string | null;
}) {
  const auditSaves: Array<Record<string, unknown>> = [];
  const savedUsers: Array<Record<string, unknown>> = [];
  const savedInvitations: Array<Record<string, unknown>> = [];
  const targetUser = {
    id: 'staff-1',
    organizationId: 'org-1',
    officeId: 'office-1',
    email: 'officer@region.gov.ph',
    status: options?.targetStatus ?? 'pending',
    verifiedAt: null as Date | null,
  };

  const manager = {
    getRepository: jest.fn((entity: unknown) => {
      if (entity === UserAccountEntity) {
        return {
          findOne: jest.fn(async () =>
            options?.targetFound === false ? null : targetUser,
          ),
          save: jest.fn(async (value: Record<string, unknown>) => {
            savedUsers.push({ ...value });
            return value;
          }),
        };
      }
      if (entity === UserRoleAssignmentEntity) {
        return {
          findOne: jest.fn(async () =>
            options?.roleCode === null
              ? null
              : {
                  userAccountId: 'staff-1',
                  officeId: 'office-1',
                  role: { code: options?.roleCode ?? 'EVALUATOR' },
                },
          ),
        };
      }
      if (entity === OrganizationInvitationEntity) {
        return {
          save: jest.fn(async (value: Record<string, unknown>) => {
            savedInvitations.push(value);
            return { ...value, id: 'invitation-1' };
          }),
        };
      }
      if (entity === AuditLogEntity) {
        return {
          save: jest.fn(async (value: Record<string, unknown>) => {
            auditSaves.push(value);
            return value;
          }),
        };
      }
      throw new Error('Unexpected repository');
    }),
  };

  const dataSource = {
    query: jest.fn(async (sql: string) => {
      if (sql.includes("r.code = 'ORG_ADMIN'")) {
        return [
          {
            ...actor,
            organization_id: options?.actorOrganizationId ?? 'org-1',
          },
        ];
      }
      if (sql.includes("r.code IN ('EVALUATOR', 'APPROVER')")) {
        return [
          {
            id: 'staff-1',
            email: 'officer@region.gov.ph',
            status: 'active',
            is_active: true,
            role: 'EVALUATOR',
            created_at: new Date('2026-01-01T00:00:00Z'),
            updated_at: new Date('2026-01-01T00:00:00Z'),
            full_name: 'New Officer',
            phone: null,
            invitation_status: 'pending',
          },
        ];
      }
      return [];
    }),
    transaction: jest.fn(async (callback) => callback(manager)),
  } as unknown as DataSource;

  return {
    service: new OfficeService(dataSource),
    dataSource,
    manager,
    auditSaves,
    savedUsers,
    savedInvitations,
    targetUser,
  };
}

describe('OfficeService staff account approval', () => {
  it('approves a pending Evaluator request and records both audit steps distinctly', async () => {
    const { service, auditSaves, savedUsers, savedInvitations, targetUser } =
      makeApproveStaffRequestService();

    const result = await service.approveStaffRequest(
      'user-1',
      'org-1',
      'office-1',
      'staff-1',
      { requestId: 'req-approve', ipAddress: '127.0.0.1' },
    );

    expect(result).toMatchObject({ id: 'staff-1', status: 'active' });
    expect(savedUsers).toHaveLength(1);
    expect(targetUser.status).toBe('active');
    expect(targetUser.verifiedAt).toBeInstanceOf(Date);
    expect(savedInvitations).toHaveLength(1);
    expect(savedInvitations[0]).toMatchObject({
      organizationId: 'org-1',
      userAccountId: 'staff-1',
      status: 'pending',
    });
    expect(auditSaves.map((a) => a.action)).toEqual([
      'staff_account_approved',
      'invitation_created',
    ]);
    expect(auditSaves[0]).toMatchObject({
      organizationId: 'org-1',
      actorUserId: 'user-1',
      action: 'staff_account_approved',
      outcome: 'success',
      requestId: 'req-approve',
    });
  });

  it('rejects a mismatched organization before starting a transaction', async () => {
    const { service, dataSource } = makeApproveStaffRequestService();

    await expect(
      service.approveStaffRequest('user-1', 'org-2', 'office-1', 'staff-1'),
    ).rejects.toThrow(ForbiddenException);
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('rejects approving a request that no longer exists in this office', async () => {
    const { service, auditSaves } = makeApproveStaffRequestService({
      targetFound: false,
    });

    await expect(
      service.approveStaffRequest('user-1', 'org-1', 'office-1', 'staff-1'),
    ).rejects.toThrow(NotFoundException);
    expect(auditSaves).toHaveLength(0);
  });

  it('rejects approving a request that is not pending', async () => {
    const { service, auditSaves } = makeApproveStaffRequestService({
      targetStatus: 'active',
    });

    await expect(
      service.approveStaffRequest('user-1', 'org-1', 'office-1', 'staff-1'),
    ).rejects.toThrow(ConflictException);
    expect(auditSaves).toHaveLength(0);
  });

  it('rejects approving an account that is not an Evaluator/Approver request', async () => {
    const { service, auditSaves } = makeApproveStaffRequestService({
      roleCode: null,
    });

    await expect(
      service.approveStaffRequest('user-1', 'org-1', 'office-1', 'staff-1'),
    ).rejects.toThrow(ConflictException);
    expect(auditSaves).toHaveLength(0);
  });
});
