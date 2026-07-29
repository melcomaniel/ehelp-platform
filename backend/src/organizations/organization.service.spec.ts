import { DataSource, Repository } from 'typeorm';
import { OrganizationEntity } from './organization.entities';
import { OrganizationService } from './organization.service';

describe('OrganizationService listing', () => {
  function setup() {
    const statements: string[] = [];
    const query = jest.fn((sql: string) => {
      statements.push(sql);
      if (statements.length === 1) {
        return Promise.resolve([
          {
            id: 'actor-id',
            organization_id: null,
            office_id: null,
            account_type: 'platform_admin',
            status: 'active',
            is_active: true,
          },
        ]);
      }
      if (statements.length === 2) {
        return Promise.resolve([{ total: 0 }]);
      }
      return Promise.resolve([]);
    });
    const dataSource = { query } as unknown as DataSource;
    const organizations = {} as Repository<OrganizationEntity>;
    const service = new OrganizationService(dataSource, organizations);
    return { service, statements };
  }

  it('excludes archived organizations from count and rows by default', async () => {
    const { service, statements } = setup();

    await service.list('actor-id', {
      include_archived: false,
      page: 1,
      page_size: 20,
    });

    expect(statements[1]).toContain(`o.status <> 'archived'`);
    expect(statements[2]).toContain(`o.status <> 'archived'`);
  });

  it('includes archived organizations when explicitly requested', async () => {
    const { service, statements } = setup();

    await service.list('actor-id', {
      include_archived: true,
      page: 1,
      page_size: 20,
    });

    expect(statements[1]).not.toContain(`o.status <> 'archived'`);
    expect(statements[2]).not.toContain(`o.status <> 'archived'`);
  });

  it('allows status=archived as an explicit history request', async () => {
    const { service, statements } = setup();

    await service.list('actor-id', {
      status: 'archived',
      include_archived: false,
      page: 1,
      page_size: 20,
    });

    expect(statements[1]).toContain('o.status = $1');
    expect(statements[1]).not.toContain(`o.status <> 'archived'`);
    expect(statements[2]).not.toContain(`o.status <> 'archived'`);
  });

  it('lists only Organization Administrators for the requested organization', async () => {
    const statements: string[] = [];
    const query = jest.fn((sql: string) => {
      statements.push(sql);
      if (statements.length === 1) {
        return Promise.resolve([
          {
            id: 'actor-id',
            organization_id: null,
            office_id: null,
            account_type: 'platform_admin',
            status: 'active',
            is_active: true,
          },
        ]);
      }
      return Promise.resolve([]);
    });
    const dataSource = { query } as unknown as DataSource;
    const organizations = {
      findOne: jest.fn().mockResolvedValue({ id: 'organization-id' }),
    } as unknown as Repository<OrganizationEntity>;
    const service = new OrganizationService(dataSource, organizations);

    await service.listAdmins('actor-id', 'organization-id');

    expect(statements[1]).toContain(`r.code = 'ORG_ADMIN'`);
    expect(statements[1]).toContain('WHERE u.organization_id = $1');
    expect(query.mock.calls[1][1]).toEqual(['organization-id']);
  });

  it('rejects an empty administrator PATCH before opening a transaction', async () => {
    const query = jest.fn().mockResolvedValue([
      {
        id: 'actor-id',
        organization_id: null,
        office_id: null,
        account_type: 'platform_admin',
        status: 'active',
        is_active: true,
      },
    ]);
    const transaction = jest.fn();
    const dataSource = { query, transaction } as unknown as DataSource;
    const organizations = {} as Repository<OrganizationEntity>;
    const service = new OrganizationService(dataSource, organizations);

    await expect(
      service.updateAdmin('actor-id', 'organization-id', 'admin-id', {}),
    ).rejects.toThrow('At least one administrator field must be provided');
    expect(transaction).not.toHaveBeenCalled();
  });
});
