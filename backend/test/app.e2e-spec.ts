import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

type AuthResponse = {
  access_token: string;
  user: { organization_id: string | null };
};

type OrganizationResponse = {
  id: string;
  status: string;
  admins: Array<{ id: string; invitation_status: string }>;
  audit_history: unknown[];
};

function responseBody<T>(response: { body: unknown }): T {
  return response.body as T;
}

describe('EHELP API (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  it('reports the configured auth provider', async () => {
    await request(app.getHttpServer())
      .get('/auth/provider-mode')
      .expect(200)
      .expect((response) => {
        expect(['mock', 'live']).toContain(
          responseBody<{ mode: string }>(response).mode,
        );
      });
  });

  it('enforces the Platform Administrator organization vertical slice', async () => {
    const platformLogin = await request(app.getHttpServer())
      .post('/auth/dev/login')
      .set('X-Client-Platform', 'web')
      .send({
        email: 'platform@ehelp.local',
        password: 'PlatformAdmin123!',
        client_platform: 'web',
      })
      .expect(201);
    const platform = responseBody<AuthResponse>(platformLogin);
    const platformToken = platform.access_token;
    expect(platform.user.organization_id).toBeNull();

    const orgAdminLogin = await request(app.getHttpServer())
      .post('/auth/dev/login')
      .set('X-Client-Platform', 'web')
      .send({
        email: 'orgadmin@ehelp.local',
        password: 'OrgAdmin123!',
        client_platform: 'web',
      })
      .expect(201);
    const seededOrgAdmin = responseBody<AuthResponse>(orgAdminLogin);
    await request(app.getHttpServer())
      .get('/admin/organizations')
      .set('Authorization', `Bearer ${seededOrgAdmin.access_token}`)
      .expect(403);

    await request(app.getHttpServer())
      .get('/applications/queue')
      .set('Authorization', `Bearer ${platformToken}`)
      .expect(403);

    const suffix = randomUUID().replaceAll('-', '').slice(-6);
    const creationKey = randomUUID();
    const code = `QA${suffix}`.toUpperCase();
    const email = `citizen.${suffix}@example.local`;
    const payload = {
      name: `E2E Organization ${suffix}`,
      code,
      creation_key: creationKey,
      initial_admin: {
        full_name: 'E2E Organization Administrator',
        email,
      },
    };
    const created = await request(app.getHttpServer())
      .post('/admin/organizations')
      .set('Authorization', `Bearer ${platformToken}`)
      .send(payload)
      .expect(201);
    const createdOrganization = responseBody<OrganizationResponse>(created);
    const organizationId = createdOrganization.id;
    const adminId = createdOrganization.admins[0].id;
    expect(createdOrganization.status).toBe('active');
    expect(createdOrganization.admins[0].invitation_status).toBe('pending');

    const repeated = await request(app.getHttpServer())
      .post('/admin/organizations')
      .set('Authorization', `Bearer ${platformToken}`)
      .send(payload)
      .expect(201);
    const repeatedOrganization = responseBody<OrganizationResponse>(repeated);
    expect(repeatedOrganization.id).toBe(organizationId);
    expect(repeatedOrganization.admins).toHaveLength(1);

    const sso = await request(app.getHttpServer())
      .post('/auth/sso/exchange')
      .set('X-Client-Platform', 'web')
      .send({
        exchange_code: `mock-${suffix}`,
        client_platform: 'web',
      })
      .expect(201);
    const organizationAdmin = responseBody<AuthResponse>(sso);
    const organizationAdminToken = organizationAdmin.access_token;
    expect(organizationAdmin.user.organization_id).toBe(organizationId);

    await request(app.getHttpServer())
      .post(`/admin/organizations/${organizationId}/suspend`)
      .set('Authorization', `Bearer ${platformToken}`)
      .send({ reason: 'E2E tenant suspension' })
      .expect(201);
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('X-Client-Platform', 'web')
      .set('Authorization', `Bearer ${organizationAdminToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .post(`/admin/organizations/${organizationId}/reactivate`)
      .set('Authorization', `Bearer ${platformToken}`)
      .send({})
      .expect(201);
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('X-Client-Platform', 'web')
      .set('Authorization', `Bearer ${organizationAdminToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .post(`/admin/organizations/${organizationId}/admins/${adminId}/suspend`)
      .set('Authorization', `Bearer ${platformToken}`)
      .send({ reason: 'E2E account suspension' })
      .expect(201);
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('X-Client-Platform', 'web')
      .set('Authorization', `Bearer ${organizationAdminToken}`)
      .expect(401);

    await request(app.getHttpServer())
      .post(`/admin/organizations/${organizationId}/suspend`)
      .set('Authorization', `Bearer ${platformToken}`)
      .send({ reason: 'Prepare E2E tenant for archive' })
      .expect(201);
    const archived = await request(app.getHttpServer())
      .post(`/admin/organizations/${organizationId}/archive`)
      .set('Authorization', `Bearer ${platformToken}`)
      .send({ reason: 'E2E cleanup archive' })
      .expect(201);
    const archivedOrganization = responseBody<OrganizationResponse>(archived);
    expect(archivedOrganization.status).toBe('archived');
    expect(archivedOrganization.audit_history.length).toBeGreaterThanOrEqual(9);
  });

  afterAll(async () => {
    await app.close();
  });
});
