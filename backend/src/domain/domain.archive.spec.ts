import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
  ApplicationEntity,
  OfficeEntity,
  WorkflowTaskEntity,
} from './domain.entities';
import { DomainService } from './domain.service';

type ArchiveAwareDomainService = {
  assertOfficeAcceptsNewWork(officeId: string): Promise<void>;
  requireActionableTask(
    actorUserId: string,
    app: ApplicationEntity,
    stepType: 'evaluation' | 'approval',
  ): Promise<WorkflowTaskEntity>;
  spawnApprovalTask(app: ApplicationEntity): Promise<void>;
};

function makeService(options?: {
  officeStatus?: string;
  archivedAt?: Date;
  taskCreatedAt?: Date;
  actorOfficeId?: string;
}) {
  const archivedAt = options?.archivedAt ?? new Date('2026-07-01T00:00:00Z');
  const office = Object.assign(new OfficeEntity(), {
    id: 'office-1',
    organizationId: 'org-1',
    status: options?.officeStatus ?? 'archived',
    archivedAt,
  });
  const application = Object.assign(new ApplicationEntity(), {
    id: 'application-1',
    organizationId: 'org-1',
    officeId: 'office-1',
    status: 'in_evaluation',
    programTemplateVersionId: 'version-1',
  });
  const task = Object.assign(new WorkflowTaskEntity(), {
    id: 'task-1',
    applicationId: application.id,
    workflowStepId: 'step-1',
    status: 'pending',
    createdAt: options?.taskCreatedAt ?? new Date('2026-06-30T00:00:00Z'),
  });
  const taskSave = jest.fn();
  const dataSource = {
    query: jest.fn((sql: string) =>
      Promise.resolve(
        sql.includes('SELECT status FROM organizations')
          ? [{ status: 'active' }]
          : [],
      ),
    ),
  };
  const offices = {
    findOne: jest.fn().mockResolvedValue(office),
  };
  const tasks = {
    find: jest.fn().mockResolvedValue([task]),
    findOne: jest.fn(),
    create: jest.fn((value: Partial<WorkflowTaskEntity>) => value),
    save: taskSave,
  };
  const steps = {
    findOne: jest.fn().mockResolvedValue({
      id: 'step-1',
      stepType: 'evaluation',
    }),
  };
  const users = {
    findOne: jest.fn().mockResolvedValue({
      id: 'evaluator-1',
      accountType: 'staff',
      organizationId: 'org-1',
      officeId: options?.actorOfficeId ?? 'office-1',
      status: 'active',
      isActive: true,
    }),
  };
  const roleAssignments = {
    find: jest.fn().mockResolvedValue([]),
  };

  const service = new DomainService(
    dataSource as never,
    offices as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    steps as never,
    tasks as never,
    {} as never,
    users as never,
    {} as never,
    roleAssignments as never,
  ) as unknown as ArchiveAwareDomainService;

  return {
    service,
    application,
    task,
    taskSave,
    dataSource,
  };
}

describe('DomainService archived office work enforcement', () => {
  it('rejects new work for an archived office', async () => {
    const { service } = makeService();

    await expect(
      service.assertOfficeAcceptsNewWork('office-1'),
    ).rejects.toThrow(BadRequestException);
  });

  it('allows a pending task created before archival to be completed', async () => {
    const { service, application, task } = makeService();

    await expect(
      service.requireActionableTask('evaluator-1', application, 'evaluation'),
    ).resolves.toBe(task);
  });

  it('rejects a task created after archival', async () => {
    const { service, application } = makeService({
      taskCreatedAt: new Date('2026-07-02T00:00:00Z'),
    });

    await expect(
      service.requireActionableTask('evaluator-1', application, 'evaluation'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects staff assigned to another office', async () => {
    const { service, application } = makeService({
      actorOfficeId: 'office-2',
    });

    await expect(
      service.requireActionableTask('evaluator-1', application, 'evaluation'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('defers creation of downstream tasks while archived', async () => {
    const { service, application, taskSave, dataSource } = makeService();

    await service.spawnApprovalTask(application);

    expect(taskSave).not.toHaveBeenCalled();
    expect(dataSource.query).not.toHaveBeenCalled();
  });
});
