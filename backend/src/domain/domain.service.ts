import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { BeneficiaryEntity } from '../users/beneficiary.entity';
import {
  UserAccountEntity,
  UserRoleAssignmentEntity,
} from '../users/user.entity';
import {
  ApplicationAnswerEntity,
  ApplicationEntity,
  FormFieldEntity,
  OfficeEntity,
  ProgramTemplateEntity,
  ProgramTemplateVersionEntity,
  RelationshipEntity,
  WorkflowStepEntity,
  WorkflowTaskEntity,
} from './domain.entities';

/** Map ERD status → Flutter-friendly status for mobile clients. */
const TO_CLIENT_STATUS: Record<string, string> = {
  draft: 'draft',
  submitted: 'submitted',
  in_evaluation: 'under_review',
  in_approval: 'recommended',
  approved: 'approved',
  rejected: 'declined',
  disbursed: 'disbursed',
  cancelled: 'cancelled',
};

const FROM_CLIENT_STATUS: Record<string, string> = {
  draft: 'draft',
  submitted: 'submitted',
  under_review: 'in_evaluation',
  recommended: 'in_approval',
  approved: 'approved',
  declined: 'rejected',
  rejected: 'rejected',
  disbursed: 'disbursed',
  cancelled: 'cancelled',
  in_evaluation: 'in_evaluation',
  in_approval: 'in_approval',
};

@Injectable()
export class DomainService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(OfficeEntity)
    private readonly offices: Repository<OfficeEntity>,
    @InjectRepository(ProgramTemplateEntity)
    private readonly templates: Repository<ProgramTemplateEntity>,
    @InjectRepository(ProgramTemplateVersionEntity)
    private readonly versions: Repository<ProgramTemplateVersionEntity>,
    @InjectRepository(FormFieldEntity)
    private readonly formFields: Repository<FormFieldEntity>,
    @InjectRepository(ApplicationEntity)
    private readonly applications: Repository<ApplicationEntity>,
    @InjectRepository(ApplicationAnswerEntity)
    private readonly answers: Repository<ApplicationAnswerEntity>,
    @InjectRepository(WorkflowStepEntity)
    private readonly steps: Repository<WorkflowStepEntity>,
    @InjectRepository(WorkflowTaskEntity)
    private readonly tasks: Repository<WorkflowTaskEntity>,
    @InjectRepository(RelationshipEntity)
    private readonly relationships: Repository<RelationshipEntity>,
    @InjectRepository(UserAccountEntity)
    private readonly users: Repository<UserAccountEntity>,
    @InjectRepository(BeneficiaryEntity)
    private readonly beneficiaries: Repository<BeneficiaryEntity>,
    @InjectRepository(UserRoleAssignmentEntity)
    private readonly roleAssignments: Repository<UserRoleAssignmentEntity>,
  ) {}

  async listOffices(actorUserId: string) {
    const actor = await this.requireUser(actorUserId);
    const rows = await this.offices.find({
      where: {
        status: 'active',
        ...(actor.organizationId
          ? { organizationId: actor.organizationId }
          : {}),
      },
      order: { name: 'ASC' },
    });
    return rows.map((o) => ({
      id: o.id,
      code: o.level.toUpperCase(),
      name: o.name,
      level: o.level,
      organization_id: o.organizationId,
    }));
  }

  async listPrograms(actorUserId: string) {
    const actor = await this.requireUser(actorUserId);
    const templates = await this.templates.find({
      where: {
        status: 'published',
        ...(actor.organizationId
          ? { organizationId: actor.organizationId }
          : {}),
      },
      order: { name: 'ASC' },
    });
    const result = [];
    for (const t of templates) {
      const version = await this.versions.findOne({
        where: { programTemplateId: t.id },
        order: { versionNumber: 'DESC' },
      });
      const cooldownDays = this.intervalToDays(version?.cooldownPeriod);
      result.push({
        id: t.id,
        code: t.code,
        name: t.name,
        description: version?.description ?? null,
        disbursement_cooldown_days: cooldownDays,
        version_id: version?.id ?? null,
        version_number: version?.versionNumber ?? null,
      });
    }
    return result;
  }

  async getProgram(actorUserId: string, id: string) {
    const actor = await this.requireUser(actorUserId);
    const template = await this.templates.findOne({ where: { id } });
    if (!template) throw new NotFoundException('Program not found');
    if (
      actor.organizationId &&
      template.organizationId !== actor.organizationId
    ) {
      throw new ForbiddenException('Not allowed to access this program');
    }
    const version = await this.versions.findOne({
      where: { programTemplateId: id },
      order: { versionNumber: 'DESC' },
    });
    if (!version) throw new NotFoundException('Program version not found');

    const form = await this.dataSource.query(
      `SELECT id, name FROM form_definitions WHERE program_template_version_id = $1 LIMIT 1`,
      [version.id],
    );
    const formId = form[0]?.id as string | undefined;
    const fields = formId
      ? await this.formFields.find({
          where: { formDefinitionId: formId },
          order: { sortOrder: 'ASC' },
        })
      : [];

    const wf = await this.dataSource.query(
      `SELECT id, name FROM workflow_definitions WHERE program_template_version_id = $1 LIMIT 1`,
      [version.id],
    );
    const wfSteps = wf[0]?.id
      ? await this.steps.find({
          where: { workflowDefinitionId: wf[0].id },
          order: { sortOrder: 'ASC' },
        })
      : [];

    return {
      id: template.id,
      code: template.code,
      name: template.name,
      description: version.description,
      disbursement_cooldown_days: this.intervalToDays(version.cooldownPeriod),
      version_id: version.id,
      fields: fields.map((f) => ({
        id: f.id,
        key: f.fieldKey,
        type: f.fieldType,
        required: f.required,
        sort_order: f.sortOrder,
        config: f.config,
      })),
      stages: [
        { name: 'Application Form', type: 'form' },
        { name: 'Identity Verification', type: 'verify' },
        ...wfSteps.map((s) => ({
          name: s.stepKey,
          type: s.stepType,
        })),
      ],
    };
  }

  async createApplication(
    actorUserId: string,
    input: {
      office_id: string;
      template_id: string;
      form_data?: Record<string, unknown>;
      amount_requested?: number;
      submit?: boolean;
      customer_user_id?: string;
    },
  ) {
    await this.requireUser(actorUserId);
    const beneficiaryAccountId = input.customer_user_id ?? actorUserId;
    const beneficiaryUser = await this.requireUser(beneficiaryAccountId);
    if (!beneficiaryUser.beneficiaryId || !beneficiaryUser.beneficiary) {
      throw new BadRequestException('Customer has no beneficiary profile');
    }

    const version = await this.resolveVersion(input.template_id);
    const office = await this.offices.findOne({
      where: { id: input.office_id },
    });
    if (!office) throw new BadRequestException('Invalid office_id');

    const orgId =
      beneficiaryUser.organizationId ??
      office.organizationId ??
      (
        await this.dataSource.query(
          `SELECT id FROM organizations WHERE code = 'DSWD' LIMIT 1`,
        )
      )[0]?.id;
    if (!orgId) throw new BadRequestException('Organization missing');

    const ref = `APP-${Date.now().toString(36).toUpperCase()}`;
    const status = input.submit ? 'submitted' : 'draft';

    const app = await this.applications.save(
      this.applications.create({
        organizationId: orgId,
        officeId: office.id,
        beneficiaryId: beneficiaryUser.beneficiaryId,
        programTemplateVersionId: version.id,
        status,
        referenceNo: ref,
        amountRequested:
          input.amount_requested != null
            ? String(input.amount_requested)
            : null,
        submittedAt: input.submit ? new Date() : null,
      }),
    );

    await this.upsertAnswers(app.id, version.id, input.form_data ?? {});

    if (input.submit) {
      await this.spawnEvaluationTask(app);
      app.status = 'in_evaluation';
      await this.applications.save(app);
    }

    return this.serializeApplication(app.id);
  }

  async updateApplication(
    actorUserId: string,
    id: string,
    updates: {
      form_data?: Record<string, unknown>;
      amount_requested?: number;
      status?: string;
    },
  ) {
    const app = await this.applications.findOne({ where: { id } });
    if (!app) throw new NotFoundException('Application not found');
    await this.assertCanAccess(actorUserId, app);

    if (updates.form_data) {
      await this.upsertAnswers(
        app.id,
        app.programTemplateVersionId,
        updates.form_data,
      );
    }
    if (updates.amount_requested != null) {
      app.amountRequested = String(updates.amount_requested);
    }
    if (updates.status) {
      app.status = FROM_CLIENT_STATUS[updates.status] ?? updates.status;
    }
    await this.applications.save(app);
    return this.serializeApplication(app.id);
  }

  async submitApplication(actorUserId: string, id: string) {
    const app = await this.applications.findOne({ where: { id } });
    if (!app) throw new NotFoundException('Application not found');
    await this.assertCanAccess(actorUserId, app);
    if (app.status !== 'draft' && app.status !== 'submitted') {
      throw new BadRequestException('Only draft applications can be submitted');
    }
    app.status = 'in_evaluation';
    app.submittedAt = new Date();
    await this.applications.save(app);
    await this.spawnEvaluationTask(app);
    return this.serializeApplication(app.id);
  }

  async listMyApplications(userId: string) {
    const user = await this.requireUser(userId);
    if (!user.beneficiaryId) return [];
    const rows = await this.applications.find({
      where: { beneficiaryId: user.beneficiaryId },
      order: { createdAt: 'DESC' },
    });
    return Promise.all(rows.map((r) => this.serializeApplication(r.id)));
  }

  async listQueue(actorUserId: string, statuses?: string[]) {
    const actor = await this.requireUser(actorUserId);
    const erdStatuses = (statuses ?? []).map((s) => FROM_CLIENT_STATUS[s] ?? s);
    const qb = this.applications.createQueryBuilder('a');
    if (actor.officeId) {
      qb.andWhere('a.office_id = :officeId', { officeId: actor.officeId });
    } else if (actor.organizationId) {
      qb.andWhere('a.organization_id = :orgId', {
        orgId: actor.organizationId,
      });
    }
    if (erdStatuses.length) {
      qb.andWhere('a.status IN (:...statuses)', { statuses: erdStatuses });
    }
    qb.orderBy('a.created_at', 'DESC');
    const rows = await qb.getMany();
    return Promise.all(rows.map((r) => this.serializeApplication(r.id)));
  }

  async getApplication(actorUserId: string, id: string) {
    const app = await this.applications.findOne({ where: { id } });
    if (!app) throw new NotFoundException('Application not found');
    await this.assertCanAccess(actorUserId, app);
    return this.serializeApplication(id);
  }

  async recommend(
    actorUserId: string,
    applicationId: string,
    input: { notes?: string; priority?: string },
  ) {
    const app = await this.applications.findOne({
      where: { id: applicationId },
    });
    if (!app) throw new NotFoundException('Application not found');
    await this.assertEvaluator(actorUserId);
    await this.assertCanAccess(actorUserId, app);
    app.evaluatorNotes = input.notes ?? app.evaluatorNotes;
    app.status = 'in_approval';
    await this.applications.save(app);

    const pending = await this.tasks.find({
      where: { applicationId: app.id, status: 'pending' },
    });
    for (const t of pending) {
      const step = await this.steps.findOne({
        where: { id: t.workflowStepId },
      });
      if (step?.stepType === 'evaluation') {
        t.status = 'completed';
        t.decision = 'endorse';
        t.notes = input.notes ?? null;
        t.assigneeUserId = actorUserId;
        t.completedAt = new Date();
        await this.tasks.save(t);
      }
    }
    await this.spawnApprovalTask(app);

    return {
      id: `rec-${app.id}`,
      application_id: app.id,
      recommended_by: actorUserId,
      priority: input.priority ?? 'medium',
      rationale: input.notes ?? null,
      is_acted_on: false,
      created_at: new Date().toISOString(),
      applications: await this.serializeApplication(app.id),
    };
  }

  async listPendingRecommendations(actorUserId: string) {
    const apps = await this.listQueue(actorUserId, [
      'recommended',
      'in_approval',
    ]);
    return apps.map((a) => ({
      id: `rec-${a.id}`,
      application_id: a.id,
      recommended_by: 'evaluator',
      priority: a.priority ?? 'medium',
      rationale: a.evaluator_notes,
      is_acted_on: false,
      created_at: a.submitted_at,
      applications: a,
    }));
  }

  async decide(
    actorUserId: string,
    applicationId: string,
    input: {
      approve: boolean;
      notes?: string;
      amount_approved?: number;
    },
  ) {
    const app = await this.applications.findOne({
      where: { id: applicationId },
    });
    if (!app) throw new NotFoundException('Application not found');
    await this.assertApprover(actorUserId);
    await this.assertCanAccess(actorUserId, app);

    app.approverNotes = input.notes ?? null;
    app.decidedAt = new Date();
    if (input.amount_approved != null) {
      app.amountApproved = String(input.amount_approved);
    }
    app.status = input.approve ? 'approved' : 'rejected';
    await this.applications.save(app);

    const pending = await this.tasks.find({
      where: { applicationId: app.id, status: 'pending' },
    });
    for (const t of pending) {
      t.status = 'completed';
      t.decision = input.approve ? 'approve' : 'reject';
      t.notes = input.notes ?? null;
      t.assigneeUserId = actorUserId;
      t.completedAt = new Date();
      await this.tasks.save(t);
    }

    return this.serializeApplication(app.id);
  }

  async listDependents(userId: string) {
    const user = await this.requireUser(userId);
    if (!user.beneficiaryId) return [];
    const rows = await this.relationships.find({
      where: {
        requesterBeneficiaryId: user.beneficiaryId,
        type: In(['dependent', 'child', 'guardian']),
      },
    });
    return Promise.all(rows.map((r) => this.serializeRelationship(r)));
  }

  async listLinkedPrincipals(userId: string) {
    const user = await this.requireUser(userId);
    if (!user.beneficiaryId) return [];
    const rows = await this.relationships.find({
      where: { relatedBeneficiaryId: user.beneficiaryId },
    });
    return Promise.all(rows.map((r) => this.serializeRelationship(r)));
  }

  async registerDependent(
    actorUserId: string,
    input: {
      principal_user_id: string;
      dependent_user_id: string;
      relationship: string;
      notes?: string;
    },
  ) {
    await this.assertStaff(actorUserId);
    const principal = await this.requireUser(input.principal_user_id);
    const dependent = await this.requireUser(input.dependent_user_id);
    if (!principal.beneficiaryId || !dependent.beneficiaryId) {
      throw new BadRequestException('Both parties need beneficiary profiles');
    }
    const orgId =
      principal.organizationId ??
      (
        await this.dataSource.query(
          `SELECT id FROM organizations WHERE code = 'DSWD' LIMIT 1`,
        )
      )[0]?.id;
    const rel = await this.relationships.save(
      this.relationships.create({
        organizationId: orgId,
        requesterBeneficiaryId: principal.beneficiaryId,
        relatedBeneficiaryId: dependent.beneficiaryId,
        type: input.relationship || 'dependent',
        status: 'approved',
        activatedAt: new Date(),
      }),
    );
    return this.serializeRelationship(rel);
  }

  // ── helpers ──────────────────────────────────────────────

  private intervalToDays(interval: string | null | undefined): number {
    if (!interval) return 90;
    const m = String(interval).match(/(\d+)/);
    return m ? Number(m[1]) : 90;
  }

  private async requireUser(id: string) {
    const user = await this.users.findOne({ where: { id } });
    if (!user) throw new UnauthorizedException();
    if (!user.isActive || user.status !== 'active') {
      throw new UnauthorizedException('Account is not active');
    }
    const roles = await this.roleAssignments.find({
      where: { userAccountId: id },
      relations: ['role'],
    });
    if (
      roles.some((assignment) => assignment.role?.code === 'PLATFORM_ADMIN')
    ) {
      throw new ForbiddenException(
        'Platform Administrators cannot access tenant business operations',
      );
    }
    if (user.accountType === 'staff') {
      if (!user.organizationId) {
        throw new ForbiddenException('Staff account has no organization');
      }
      const organization = await this.dataSource.query<
        Array<{ status: string }>
      >(`SELECT status FROM organizations WHERE id = $1 LIMIT 1`, [
        user.organizationId,
      ]);
      if (!organization[0] || organization[0].status !== 'active') {
        throw new ForbiddenException('Organization is suspended or archived');
      }
    }
    return user;
  }

  private async assertRole(userId: string, allowed: string[], message: string) {
    await this.requireUser(userId);
    const assignments = await this.roleAssignments.find({
      where: { userAccountId: userId },
      relations: ['role'],
    });
    const codes = assignments.map((a) => a.role?.code);
    const ok = codes.some((c) => allowed.includes(c ?? ''));
    if (!ok) throw new ForbiddenException(message);
  }

  private async assertStaff(userId: string) {
    await this.assertRole(
      userId,
      ['EVALUATOR', 'APPROVER', 'OFFICE_ADMIN', 'ORG_ADMIN'],
      'Staff role required',
    );
  }

  private async assertEvaluator(userId: string) {
    await this.assertRole(
      userId,
      ['EVALUATOR', 'OFFICE_ADMIN', 'ORG_ADMIN'],
      'Evaluator role required',
    );
  }

  private async assertApprover(userId: string) {
    await this.assertRole(
      userId,
      ['APPROVER', 'OFFICE_ADMIN', 'ORG_ADMIN'],
      'Approver role required',
    );
  }

  private async assertCanAccess(userId: string, app: ApplicationEntity) {
    const user = await this.requireUser(userId);
    if (user.beneficiaryId && user.beneficiaryId === app.beneficiaryId) return;
    try {
      await this.assertStaff(userId);
    } catch {
      throw new ForbiddenException('Not allowed to access this application');
    }
    if (user.organizationId !== app.organizationId) {
      throw new ForbiddenException('Not allowed to access this application');
    }
  }

  private async resolveVersion(templateId: string) {
    let version = await this.versions.findOne({
      where: { id: templateId },
    });
    if (version) return version;
    version = await this.versions.findOne({
      where: { programTemplateId: templateId },
      order: { versionNumber: 'DESC' },
    });
    if (!version) throw new BadRequestException('Unknown program template');
    return version;
  }

  private async upsertAnswers(
    applicationId: string,
    versionId: string,
    formData: Record<string, unknown>,
  ) {
    const form = await this.dataSource.query(
      `SELECT id FROM form_definitions WHERE program_template_version_id = $1 LIMIT 1`,
      [versionId],
    );
    const formId = form[0]?.id as string | undefined;
    if (!formId) return;
    const fields = await this.formFields.find({
      where: { formDefinitionId: formId },
    });
    const byKey = new Map(fields.map((f) => [f.fieldKey, f]));

    for (const [key, value] of Object.entries(formData)) {
      const field = byKey.get(key);
      if (!field) continue;
      const existing = await this.answers.findOne({
        where: { applicationId, formFieldId: field.id },
      });
      if (existing) {
        existing.value = value;
        await this.answers.save(existing);
      } else {
        await this.answers.save(
          this.answers.create({
            applicationId,
            formFieldId: field.id,
            value,
          }),
        );
      }
    }
  }

  private async spawnEvaluationTask(app: ApplicationEntity) {
    const wf = await this.dataSource.query(
      `SELECT id FROM workflow_definitions WHERE program_template_version_id = $1 LIMIT 1`,
      [app.programTemplateVersionId],
    );
    if (!wf[0]?.id) return;
    const step = await this.steps.findOne({
      where: { workflowDefinitionId: wf[0].id, stepType: 'evaluation' },
    });
    if (!step) return;
    const existing = await this.tasks.findOne({
      where: {
        applicationId: app.id,
        workflowStepId: step.id,
        status: 'pending',
      },
    });
    if (existing) return;
    await this.tasks.save(
      this.tasks.create({
        applicationId: app.id,
        workflowStepId: step.id,
        status: 'pending',
      }),
    );
  }

  private async spawnApprovalTask(app: ApplicationEntity) {
    const wf = await this.dataSource.query(
      `SELECT id FROM workflow_definitions WHERE program_template_version_id = $1 LIMIT 1`,
      [app.programTemplateVersionId],
    );
    if (!wf[0]?.id) return;
    const step = await this.steps.findOne({
      where: { workflowDefinitionId: wf[0].id, stepType: 'approval' },
    });
    if (!step) return;
    await this.tasks.save(
      this.tasks.create({
        applicationId: app.id,
        workflowStepId: step.id,
        status: 'pending',
      }),
    );
  }

  private async serializeApplication(id: string) {
    const app = await this.applications.findOne({ where: { id } });
    if (!app) throw new NotFoundException('Application not found');

    const beneficiary = await this.beneficiaries.findOne({
      where: { id: app.beneficiaryId },
    });
    const account = await this.users.findOne({
      where: { beneficiary: { id: app.beneficiaryId } },
    });
    const version = await this.versions.findOne({
      where: { id: app.programTemplateVersionId },
    });
    const template = version
      ? await this.templates.findOne({
          where: { id: version.programTemplateId },
        })
      : null;

    const answerRows = await this.dataSource.query(
      `SELECT ff.field_key, aa.value
       FROM application_answers aa
       JOIN form_fields ff ON ff.id = aa.form_field_id
       WHERE aa.application_id = $1`,
      [id],
    );
    const formData: Record<string, unknown> = {};
    for (const row of answerRows) {
      formData[row.field_key] = row.value;
    }

    return {
      id: app.id,
      reference_no: app.referenceNo ?? `APP-${app.id.slice(0, 8)}`,
      customer_id: account?.id ?? app.beneficiaryId,
      submitted_by: account?.id ?? null,
      region_id: app.officeId,
      template_id: template?.id ?? version?.programTemplateId ?? '',
      program_template_version_id: app.programTemplateVersionId,
      status: TO_CLIENT_STATUS[app.status] ?? app.status,
      form_data: formData,
      amount_requested: app.amountRequested
        ? Number(app.amountRequested)
        : null,
      amount_approved: app.amountApproved ? Number(app.amountApproved) : null,
      priority: 'medium',
      evaluator_notes: app.evaluatorNotes,
      approver_notes: app.approverNotes,
      submitted_at: app.submittedAt?.toISOString() ?? null,
      decided_at: app.decidedAt?.toISOString() ?? null,
      created_at: app.createdAt?.toISOString() ?? null,
      profiles: beneficiary
        ? { full_name: beneficiary.fullName, id: account?.id }
        : null,
      program_templates: template
        ? { id: template.id, name: template.name, code: template.code }
        : null,
      customer_name: beneficiary?.fullName ?? null,
      template_name: template?.name ?? null,
    };
  }

  private async serializeRelationship(r: RelationshipEntity) {
    const requester = await this.beneficiaries.findOne({
      where: { id: r.requesterBeneficiaryId },
    });
    const related = await this.beneficiaries.findOne({
      where: { id: r.relatedBeneficiaryId },
    });
    const principalAccount = await this.users.findOne({
      where: { beneficiary: { id: r.requesterBeneficiaryId } },
    });
    const dependentAccount = await this.users.findOne({
      where: { beneficiary: { id: r.relatedBeneficiaryId } },
    });
    return {
      id: r.id,
      principal_id: principalAccount?.id ?? r.requesterBeneficiaryId,
      dependent_id: dependentAccount?.id ?? r.relatedBeneficiaryId,
      relationship: r.type,
      is_notarized: false,
      is_validated: r.status === 'approved' || r.status === 'validated',
      notes: null,
      dependent: related ? { full_name: related.fullName } : null,
      principal: requester ? { full_name: requester.fullName } : null,
    };
  }
}
