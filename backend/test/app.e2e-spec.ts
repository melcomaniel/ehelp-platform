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
  audit_history: Array<{
    action: string;
    before_state: { status?: string } | null;
    after_state: { status?: string } | null;
    reason?: string | null;
  }>;
};

type OrganizationAdminResponse = {
  id: string;
  email: string;
  status: string;
  is_active: boolean;
  invitation_status: string | null;
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
    const email = `citizen.${suffix}@mock.gov.ph`;
    const payload = {
      name: `E2E Organization ${suffix}`,
      code,
      creation_key: creationKey,
      policy_config: {
        mfa_required: true,
        device_registration_required: true,
        session_timeout_minutes: 20,
      },
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

    const additionalSuffix = randomUUID().replaceAll('-', '').slice(-6);
    const additionalEmail = `citizen.${additionalSuffix}@mock.gov.ph`;
    const additionalCreated = await request(app.getHttpServer())
      .post(`/platform/organizations/${organizationId}/admins`)
      .set('Authorization', `Bearer ${platformToken}`)
      .send({
        full_name: 'Additional Organization Administrator',
        email: additionalEmail,
        phone: '+639171234567',
      })
      .expect(201);
    const additionalAdmin =
      responseBody<OrganizationAdminResponse>(additionalCreated);
    expect(additionalAdmin).toMatchObject({
      email: additionalEmail,
      status: 'active',
      is_active: true,
      invitation_status: 'pending',
    });

    await request(app.getHttpServer())
      .post(`/platform/organizations/${organizationId}/admins`)
      .set('Authorization', `Bearer ${platformToken}`)
      .send({
        full_name: 'Duplicate Organization Administrator',
        email: additionalEmail,
      })
      .expect(409);

    await request(app.getHttpServer())
      .get(`/platform/organizations/${organizationId}/admins`)
      .set('Authorization', `Bearer ${platformToken}`)
      .expect(200)
      .expect((response) => {
        const admins = responseBody<OrganizationAdminResponse[]>(response);
        expect(admins).toHaveLength(2);
        expect(admins.some((admin) => admin.id === additionalAdmin.id)).toBe(
          true,
        );
      });

    await request(app.getHttpServer())
      .get(`/platform/organizations/${organizationId}/admins`)
      .set('Authorization', `Bearer ${seededOrgAdmin.access_token}`)
      .expect(403);

    await request(app.getHttpServer())
      .patch(
        `/platform/organizations/${randomUUID()}/admins/${additionalAdmin.id}`,
      )
      .set('Authorization', `Bearer ${platformToken}`)
      .send({ status: 'suspended', reason: 'Cross-tenant test' })
      .expect(404);

    await request(app.getHttpServer())
      .post('/auth/sso/exchange')
      .set('X-Client-Platform', 'web')
      .send({
        exchange_code: `mock-${additionalSuffix}`,
        client_platform: 'web',
      })
      .expect(403)
      .expect((response) => {
        expect(responseBody<{ code: string }>(response).code).toBe(
          'device_registration_required',
        );
      });

    const additionalSso = await request(app.getHttpServer())
      .post('/auth/sso/exchange')
      .set('X-Client-Platform', 'web')
      .send({
        exchange_code: `mock-${additionalSuffix}`,
        client_platform: 'web',
        device_fingerprint: `e2e:${additionalSuffix}`,
      })
      .expect(201);
    const additionalAdminToken =
      responseBody<AuthResponse>(additionalSso).access_token;

    await request(app.getHttpServer())
      .patch(
        `/platform/organizations/${organizationId}/admins/${additionalAdmin.id}`,
      )
      .set('Authorization', `Bearer ${platformToken}`)
      .send({ status: 'suspended', reason: 'E2E individual suspension' })
      .expect(200)
      .expect((response) => {
        expect(responseBody<OrganizationResponse>(response).status).toBe(
          'active',
        );
      });
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('X-Client-Platform', 'web')
      .set('Authorization', `Bearer ${additionalAdminToken}`)
      .expect(401);

    await request(app.getHttpServer())
      .patch(
        `/platform/organizations/${organizationId}/admins/${additionalAdmin.id}`,
      )
      .set('Authorization', `Bearer ${platformToken}`)
      .send({ status: 'active', reason: 'E2E individual reactivation' })
      .expect(200)
      .expect((response) => {
        const body = responseBody<OrganizationResponse>(response);
        expect(body.status).toBe('active');
        expect(body.audit_history[0]).toMatchObject({
          action: 'organization_admin_reactivated',
          reason: 'E2E individual reactivation',
        });
      });
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('X-Client-Platform', 'web')
      .set('Authorization', `Bearer ${additionalAdminToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .post('/auth/sso/exchange')
      .set('X-Client-Platform', 'web')
      .send({
        exchange_code: `mock-${suffix}`,
        client_platform: 'web',
      })
      .expect(403)
      .expect((response) => {
        expect(responseBody<{ code: string }>(response).code).toBe(
          'device_registration_required',
        );
      });

    const sso = await request(app.getHttpServer())
      .post('/auth/sso/exchange')
      .set('X-Client-Platform', 'web')
      .send({
        exchange_code: `mock-${suffix}`,
        client_platform: 'web',
        device_fingerprint: `e2e:${suffix}`,
      })
      .expect(201);
    const organizationAdmin = responseBody<AuthResponse>(sso);
    const organizationAdminToken = organizationAdmin.access_token;
    expect(organizationAdmin.user.organization_id).toBe(organizationId);

    const suspended = await request(app.getHttpServer())
      .patch(`/platform/organizations/${organizationId}/suspend`)
      .set('Authorization', `Bearer ${platformToken}`)
      .send({ reason: 'E2E tenant suspension' })
      .expect(200);
    const suspendedOrganization = responseBody<OrganizationResponse>(suspended);
    expect(suspendedOrganization.status).toBe('suspended');
    expect(suspendedOrganization.audit_history[0]).toMatchObject({
      action: 'organization_suspended',
      before_state: { status: 'active' },
      after_state: { status: 'suspended' },
    });
    await request(app.getHttpServer())
      .post(`/platform/organizations/${organizationId}/admins`)
      .set('Authorization', `Bearer ${platformToken}`)
      .send({
        full_name: 'Blocked Administrator',
        email: `blocked.${suffix}@mock.gov.ph`,
      })
      .expect(409);
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('X-Client-Platform', 'web')
      .set('Authorization', `Bearer ${organizationAdminToken}`)
      .expect(403);

    const reactivated = await request(app.getHttpServer())
      .patch(`/platform/organizations/${organizationId}/reactivate`)
      .set('Authorization', `Bearer ${platformToken}`)
      .send({})
      .expect(200);
    const reactivatedOrganization =
      responseBody<OrganizationResponse>(reactivated);
    expect(reactivatedOrganization.status).toBe('active');
    expect(reactivatedOrganization.audit_history[0]).toMatchObject({
      action: 'organization_reactivated',
      before_state: { status: 'suspended' },
      after_state: { status: 'active' },
    });
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

    const archived = await request(app.getHttpServer())
      .patch(`/platform/organizations/${organizationId}/archive`)
      .set('Authorization', `Bearer ${platformToken}`)
      .send({ reason: 'E2E direct active archive' })
      .expect(200);
    const archivedOrganization = responseBody<OrganizationResponse>(archived);
    expect(archivedOrganization.status).toBe('archived');
    expect(archivedOrganization.audit_history[0]).toMatchObject({
      action: 'organization_archived',
      before_state: { status: 'active' },
      after_state: { status: 'archived' },
    });
    await request(app.getHttpServer())
      .post(`/platform/organizations/${organizationId}/admins`)
      .set('Authorization', `Bearer ${platformToken}`)
      .send({
        full_name: 'Archived Organization Administrator',
        email: `archived.${suffix}@mock.gov.ph`,
      })
      .expect(409);

    await request(app.getHttpServer())
      .post(`/admin/organizations/${organizationId}/archive`)
      .set('Authorization', `Bearer ${platformToken}`)
      .send({ reason: 'Compatibility route remains available' })
      .expect(409);

    await request(app.getHttpServer())
      .get('/admin/organizations')
      .set('Authorization', `Bearer ${platformToken}`)
      .expect(200)
      .expect((response) => {
        const body = responseBody<{ data: Array<{ id: string }> }>(response);
        expect(body.data.some((item) => item.id === organizationId)).toBe(
          false,
        );
      });

    await request(app.getHttpServer())
      .get('/admin/organizations?include_archived=true')
      .set('Authorization', `Bearer ${platformToken}`)
      .expect(200)
      .expect((response) => {
        const body = responseBody<{ data: Array<{ id: string }> }>(response);
        expect(body.data.some((item) => item.id === organizationId)).toBe(true);
      });

    await request(app.getHttpServer())
      .get('/admin/organizations?status=archived')
      .set('Authorization', `Bearer ${platformToken}`)
      .expect(200)
      .expect((response) => {
        const body = responseBody<{ data: Array<{ id: string }> }>(response);
        expect(body.data.some((item) => item.id === organizationId)).toBe(true);
      });
  });

  afterAll(async () => {
    if (app) await app.close();
  });
});
