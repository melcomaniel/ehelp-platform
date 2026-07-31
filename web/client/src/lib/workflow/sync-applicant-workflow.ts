import { nestFetch } from "@/lib/api/nest";
import { stepsOf } from "@/lib/workflow/engine";
import type { WorkflowState } from "@/lib/workflow/types";

export type ApplicantWorkflowPayload = {
  stages: Array<{ name: string; type: string }>;
  form_title?: string;
  form_subtitle?: string | null;
  fields: Array<{
    key: string;
    type: string;
    label: string;
    help_text?: string;
    required?: boolean;
    options?: string[];
    multiline?: boolean;
  }>;
};

/** Export Form → Verify → Review → Disbursement + form fields for Nest/mobile. */
export function exportApplicantWorkflow(
  state: WorkflowState,
  stepSetId: string,
): ApplicantWorkflowPayload {
  const steps = stepsOf(state, stepSetId);
  const stages = steps.map((s) => ({
    name: s.name,
    type: s.type,
  }));
  const formStep = steps.find((s) => s.type === "form");
  const fields = formStep
    ? state.fields
        .filter((f) => f.stepId === formStep.id)
        .sort((a, b) => a.position - b.position)
        .map((f) => {
          const options = state.options
            .filter((o) => o.fieldId === f.id)
            .sort((a, b) => a.position - b.position)
            .map((o) => o.label || o.value);
          return {
            key: f.id.replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase() || `field_${f.position}`,
            type: f.type,
            label: f.label || f.type,
            help_text: f.helpText || "",
            required: f.required,
            options,
            multiline: f.type === "textarea",
          };
        })
    : [];

  return {
    stages:
      stages.length > 0
        ? stages
        : [
            { name: "Application Form", type: "form" },
            { name: "Identity Verification", type: "verify" },
            { name: "Review", type: "review" },
            { name: "Disbursement", type: "disbursement" },
          ],
    form_title: formStep?.name ?? "Application Form",
    form_subtitle: null,
    fields,
  };
}

export async function syncApplicantWorkflowToNest(
  nestProgramId: string,
  payload: ApplicantWorkflowPayload,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await nestFetch(
      `/admin/program-templates/${nestProgramId}/applicant-workflow`,
      {
        method: "PUT",
        body: payload,
      },
    );
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Sync failed",
    };
  }
}
