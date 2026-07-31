import { ForbiddenException } from '@nestjs/common';
import {
  ApplicationEntity,
  OfficeEntity,
  WorkflowTaskEntity,
} from './domain.entities';
import { DomainService } from './domain.service';

type CaseActionDomainService = {
  recommend(
    actorUserId: string,
    applicationId: string,
    input: { notes?: string; priority?: string },
  ): Promise<unknown>;
  decide(
    actorUserId: string,
    applicationId: string,
    input: { approve: boolean; notes?: string },
  ): Promise<unknown>;
};

function makeCaseService(options: {
  actor: {
    id: string;
    role: string;
    officeId?: string;
    organizationId?: string;
  };
  appStatus?: string;
  pendingStepType?: 'evaluation' | 'approval';
  priorEvaluatorId?: string | null;
  taskAssigneeId?: string | null;
}) {
  const office = Object.assign(new OfficeEntity(), {
    id: 'office-1',
    organizationId: 'org-1',
    status: 'active',
    archivedAt: null,
  });
  const application = Object.assign(new ApplicationEntity(), {
    id: 'application-1',
    organizationId: 'org-1',
    officeId: 'office-1',
    status: options.appStatus ?? 'in_evaluation',
    programTemplateVersionId: 'version-1',
    evaluatorNotes: null,
    approverNotes: null,
    amountApproved: null,
  });
  const pendingTask = Object.assign(new WorkflowTaskEntity(), {
    id: 'task-pending',
    applicationId: application.id,
    workflowStepId: 'step-pending',
    status: 'pending',
    assigneeUserId: options.taskAssigneeId ?? null,
    createdAt: new Date('2026-06-30T00:00:00Z'),
  });
  const completedEval =
    options.priorEvaluatorId == null
      ? null
      : Object.assign(new WorkflowTaskEntity(), {
          id: 'task-eval',
          applicationId: application.id,
          workflowStepId: 'step-eval',
          status: 'completed',
          assigneeUserId: options.priorEvaluatorId,
          completedAt: new Date('2026-06-29T00:00:00Z'),
        });

  const applications = {
    findOne: jest.fn().mockResolvedValue(application),
    save: jest.fn(async (row: ApplicationEntity) => row),
  };
  const offices = {
    findOne: jest.fn().mockResolvedValue(office),
  };
  const tasks = {
    find: jest.fn(async (opts: { where?: { status?: string } }) => {
      if (opts?.where?.status === 'pending') return [pendingTask];
      if (opts?.where?.status === 'completed') {
        return completedEval ? [completedEval] : [];
      }
      return [];
    }),
    findOne: jest.fn(),
    create: jest.fn((value: Partial<WorkflowTaskEntity>) => value),
    save: jest.fn(async (row: WorkflowTaskEntity) => row),
  };
  const steps = {
    findOne: jest.fn(async (opts: { where?: { id?: string } }) => {
      const id = opts?.where?.id;
      if (id === 'step-eval') return { id, stepType: 'evaluation' };
      if (id === 'step-pending') {
        return {
          id,
          stepType: options.pendingStepType ?? 'evaluation',
        };
      }
      return null;
    }),
  };
  const users = {
    findOne: jest.fn().mockResolvedValue({
      id: options.actor.id,
      accountType: 'staff',
      organizationId: options.actor.organizationId ?? 'org-1',
      officeId: options.actor.officeId ?? 'office-1',
      status: 'active',
      isActive: true,
      beneficiaryId: null,
    }),
  };
  const beneficiaries = {
    findOne: jest.fn().mockResolvedValue({ id: 'ben-1', fullName: 'Test' }),
  };
  const versions = {
    findOne: jest.fn().mockResolvedValue({
      id: 'version-1',
      programTemplateId: 'template-1',
    }),
  };
  const templates = {
    findOne: jest.fn().mockResolvedValue({ id: 'template-1', name: 'AICS' }),
  };
  const roleAssignments = {
    find: jest.fn().mockResolvedValue([
      { role: { code: options.actor.role } },
    ]),
  };
  const dataSource = {
    query: jest.fn((sql: string) =>
      Promise.resolve(
        sql.includes('SELECT status FROM organizations')
          ? [{ status: 'active' }]
          : sql.includes('workflow_definitions')
            ? []
            : sql.includes('application_answers')
              ? []
              : [],
      ),
    ),
  };

  const { decideRbac } = jest.requireActual(
    '../auth/rbac.policy',
  ) as typeof import('../auth/rbac.policy');
  const rbac = {
    assertPermission: jest.fn(
      async (
        userId: string,
        permission: string,
        resource: Record<string, unknown> = {},
      ) => {
        const actor = {
          userId,
          role: options.actor.role as never,
          organizationId: options.actor.organizationId ?? 'org-1',
          officeId: options.actor.officeId ?? 'office-1',
          beneficiaryId: null,
        };
        const decision = decideRbac(
          actor,
          permission as never,
          resource as never,
        );
        if (!decision.allowed) {
          throw new ForbiddenException(decision.reason);
        }
        return decision;
      },
    ),
  };

  const service = new DomainService(
    dataSource as never,
    offices as never,
    templates as never,
    versions as never,
    {} as never,
    applications as never,
    {} as never,
    steps as never,
    tasks as never,
    {} as never,
    users as never,
    beneficiaries as never,
    roleAssignments as never,
    rbac as never,
    { notifyApplicationApproved: jest.fn() } as never,
  ) as unknown as CaseActionDomainService;

  return { service, application, tasks, applications };
}

describe('DomainService case RBAC (PRD §§4.1–4.5)', () => {
  it('denies organization admins from deciding applications', async () => {
    const { service } = makeCaseService({
      actor: { id: 'orgadmin-1', role: 'ORG_ADMIN' },
      appStatus: 'in_approval',
      pendingStepType: 'approval',
      priorEvaluatorId: 'evaluator-1',
    });

    await expect(
      service.decide('orgadmin-1', 'application-1', { approve: true }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('denies office admins from recommending applications', async () => {
    const { service } = makeCaseService({
      actor: { id: 'officeadmin-1', role: 'OFFICE_ADMIN' },
      appStatus: 'in_evaluation',
      pendingStepType: 'evaluation',
    });

    await expect(
      service.recommend('officeadmin-1', 'application-1', { notes: 'ok' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('allows an evaluator to endorse an office-pool evaluation task', async () => {
    const { service, tasks } = makeCaseService({
      actor: { id: 'evaluator-1', role: 'EVALUATOR' },
      appStatus: 'in_evaluation',
      pendingStepType: 'evaluation',
    });

    await expect(
      service.recommend('evaluator-1', 'application-1', { notes: 'endorse' }),
    ).resolves.toMatchObject({
      application_id: 'application-1',
      recommended_by: 'evaluator-1',
    });
    expect(tasks.save).toHaveBeenCalled();
  });

  it('enforces SOD when the endorsing evaluator tries to decide', async () => {
    const { service } = makeCaseService({
      actor: { id: 'evaluator-1', role: 'APPROVER' },
      appStatus: 'in_approval',
      pendingStepType: 'approval',
      priorEvaluatorId: 'evaluator-1',
    });

    await expect(
      service.decide('evaluator-1', 'application-1', { approve: true }),
    ).rejects.toThrow(/different users/i);
  });

  it('allows an approver to decide a case they did not endorse', async () => {
    const { service, applications } = makeCaseService({
      actor: { id: 'approver-1', role: 'APPROVER' },
      appStatus: 'in_approval',
      pendingStepType: 'approval',
      priorEvaluatorId: 'evaluator-1',
    });

    await expect(
      service.decide('approver-1', 'application-1', {
        approve: true,
        notes: 'ok',
      }),
    ).resolves.toBeTruthy();
    expect(applications.save).toHaveBeenCalled();
  });
});
