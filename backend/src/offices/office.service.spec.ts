import { ConflictException, ForbiddenException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { OfficeEntity } from '../domain/domain.entities';
import { AuditLogEntity } from '../organizations/organization.entities';
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
      .mockResolvedValueOnce([]),
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
