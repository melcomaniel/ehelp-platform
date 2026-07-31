import { nestFetch } from "@/lib/api/nest";

export type ActionResult = { ok: true } | { ok: false; error: string };

export type ProgramWorkflowStep = {
  id?: string;
  step_key: string;
  step_type: string;
  sort_order: number;
};

export type PeriodWindows = {
  application_start?: string | null;
  application_end?: string | null;
  review_start?: string | null;
  review_end?: string | null;
  disbursement_start?: string | null;
  disbursement_end?: string | null;
  review_leeway_days?: number;
};

export type ProgramTemplateRow = {
  id: string;
  name: string;
  description: string | null;
  eligibilityRules: Record<string, unknown>;
  periodWindows: PeriodWindows | null;
  cooldownDays: number;
  isActive: boolean;
  versionId?: string | null;
  versionNumber?: number | null;
  workflow?: {
    id: string;
    name: string;
    source_workflow_template_id?: string | null;
    steps: ProgramWorkflowStep[];
  } | null;
};

export type WorkflowTemplateRow = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  status: string;
  steps: ProgramWorkflowStep[];
};

export type RegionTemplateRow = {
  id: string;
  regionId: string;
  templateId: string;
  localEligibilityRules: Record<string, unknown>;
  isActive: boolean;
  regionCode?: string;
};

type NestTemplate = {
  id: string;
  name: string;
  description: string | null;
  eligibility_rules?: Record<string, unknown>;
  period_windows?: PeriodWindows | null;
  disbursement_cooldown_days?: number;
  is_active?: boolean;
  version_id?: string | null;
  version_number?: number | null;
  workflow?: ProgramTemplateRow["workflow"];
};

type NestOverride = {
  id: string;
  region_id: string;
  template_id: string;
  local_eligibility_rules?: Record<string, unknown>;
  is_active?: boolean;
  region_code?: string;
};

function mapTemplate(t: NestTemplate): ProgramTemplateRow {
  const rules = t.eligibility_rules ?? {};
  const fromRules =
    rules.period_windows && typeof rules.period_windows === "object"
      ? (rules.period_windows as PeriodWindows)
      : null;
  return {
    id: t.id,
    name: t.name,
    description: t.description ?? null,
    eligibilityRules: rules,
    periodWindows: t.period_windows ?? fromRules,
    cooldownDays: Number(t.disbursement_cooldown_days ?? 90),
    isActive: Boolean(t.is_active),
    versionId: t.version_id ?? null,
    versionNumber: t.version_number ?? null,
    workflow: t.workflow ?? null,
  };
}

export async function listProgramTemplates(): Promise<ProgramTemplateRow[]> {
  try {
    const data = await nestFetch<NestTemplate[]>("/admin/program-templates");
    return (Array.isArray(data) ? data : []).map(mapTemplate);
  } catch (e) {
    console.error(e);
    return [];
  }
}

export async function getProgramTemplate(
  id: string,
): Promise<ProgramTemplateRow> {
  const data = await nestFetch<NestTemplate>(`/admin/program-templates/${id}`);
  return mapTemplate(data);
}

export async function listWorkflowTemplates(): Promise<WorkflowTemplateRow[]> {
  try {
    const data = await nestFetch<WorkflowTemplateRow[]>("/workflow-templates");
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.error(e);
    return [];
  }
}

export async function applyWorkflowToProgram(input: {
  versionId: string;
  workflowTemplateId: string;
}): Promise<ActionResult> {
  try {
    await nestFetch(`/program-versions/${input.versionId}/workflow`, {
      method: "POST",
      body: { workflow_template_id: input.workflowTemplateId },
    });
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not connect workflow",
    };
  }
}

export async function listRegionTemplates(
  regionId?: string | null,
): Promise<RegionTemplateRow[]> {
  try {
    const q = regionId
      ? `?office_id=${encodeURIComponent(regionId)}`
      : "";
    const data = await nestFetch<NestOverride[]>(
      `/admin/program-templates/office-overrides${q}`,
    );
    return (Array.isArray(data) ? data : []).map((r) => ({
      id: r.id,
      regionId: r.region_id,
      templateId: r.template_id,
      localEligibilityRules: r.local_eligibility_rules ?? {},
      isActive: Boolean(r.is_active ?? true),
      regionCode: r.region_code,
    }));
  } catch (e) {
    console.error(e);
    return [];
  }
}

export async function saveProgramTemplate(input: {
  id?: string;
  name: string;
  description: string;
  requirements: string;
  cooldownDays: number;
  isActive?: boolean;
  workflowTemplateId?: string;
  minAge?: number;
  maxAge?: number;
  regions?: string[];
  municipalities?: string[];
  periodWindows?: PeriodWindows | null;
}): Promise<ActionResult> {
  try {
    const body = {
      name: input.name.trim(),
      description: input.description.trim(),
      requirements: input.requirements.trim(),
      cooldown_days: Math.max(0, input.cooldownDays),
      is_active: input.isActive ?? true,
      ...(input.workflowTemplateId
        ? { workflow_template_id: input.workflowTemplateId }
        : {}),
      eligibility: {
        ...(input.minAge != null && !Number.isNaN(input.minAge)
          ? { min_age: input.minAge }
          : {}),
        ...(input.maxAge != null && !Number.isNaN(input.maxAge)
          ? { max_age: input.maxAge }
          : {}),
        regions: input.regions ?? [],
        municipalities: input.municipalities ?? [],
      },
      ...(input.periodWindows !== undefined
        ? { period_windows: input.periodWindows }
        : {}),
    };
    if (input.id) {
      await nestFetch(`/admin/program-templates/${input.id}`, {
        method: "PATCH",
        body,
      });
    } else {
      await nestFetch("/admin/program-templates", {
        method: "POST",
        body,
      });
    }
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Save failed",
    };
  }
}

export async function toggleProgramTemplate(
  id: string,
  isActive: boolean,
): Promise<ActionResult> {
  try {
    await nestFetch(`/admin/program-templates/${id}`, {
      method: "PATCH",
      body: { is_active: isActive },
    });
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Update failed",
    };
  }
}

export async function saveRegionTemplate(input: {
  templateId: string;
  eligibilityNote: string;
  cooldownDays?: number;
  officeId?: string;
}): Promise<ActionResult> {
  try {
    await nestFetch(
      `/admin/program-templates/${input.templateId}/office-override`,
      {
        method: "PUT",
        body: {
          office_id: input.officeId,
          eligibility_note: input.eligibilityNote.trim(),
          ...(input.cooldownDays !== undefined
            ? { cooldown_days: Math.max(0, input.cooldownDays) }
            : {}),
        },
      },
    );
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Save override failed",
    };
  }
}
