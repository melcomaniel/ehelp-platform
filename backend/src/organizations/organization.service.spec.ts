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
});
