"use server";

import { fetchStaffAccess } from "@/lib/admin/access";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true } | { ok: false; error: string };

export type ProgramTemplateRow = {
  id: string;
  name: string;
  description: string | null;
  eligibilityRules: Record<string, unknown>;
  cooldownDays: number;
  isActive: boolean;
};

export type RegionTemplateRow = {
  id: string;
  regionId: string;
  templateId: string;
  localEligibilityRules: Record<string, unknown>;
  isActive: boolean;
  regionCode?: string;
};

async function requireAccess() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" as const, access: null, supabase };

  const access = await fetchStaffAccess(supabase, user.id);
  if (!access) {
    return { error: "Profile not found" as const, access: null, supabase };
  }
  return { error: null, access, supabase };
}

export async function listProgramTemplates(): Promise<ProgramTemplateRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("program_templates")
    .select(
      "id, name, description, eligibility_rules, disbursement_cooldown_days, is_active",
    )
    .order("name");

  return (data ?? []).map((t) => ({
    id: t.id as string,
    name: t.name as string,
    description: (t.description as string | null) ?? null,
    eligibilityRules: (t.eligibility_rules as Record<string, unknown>) ?? {},
    cooldownDays: Number(t.disbursement_cooldown_days ?? 90),
    isActive: Boolean(t.is_active),
  }));
}

export async function listRegionTemplates(
  regionId?: string | null,
): Promise<RegionTemplateRow[]> {
  const supabase = await createClient();
  let query = supabase
    .from("region_templates")
    .select(
      "id, region_id, template_id, local_eligibility_rules, is_active, regions(code)",
    );

  if (regionId) query = query.eq("region_id", regionId);

  const { data } = await query;
  return (data ?? []).map((r) => {
    const regions = r.regions as { code: string } | { code: string }[] | null;
    const regionCode = Array.isArray(regions)
      ? regions[0]?.code
      : regions?.code;

    return {
      id: r.id as string,
      regionId: r.region_id as string,
      templateId: r.template_id as string,
      localEligibilityRules:
        (r.local_eligibility_rules as Record<string, unknown>) ?? {},
      isActive: Boolean(r.is_active),
      regionCode,
    };
  });
}

export async function saveProgramTemplate(input: {
  id?: string;
  name: string;
  description: string;
  requirements: string;
  cooldownDays: number;
  isActive?: boolean;
}): Promise<ActionResult> {
  const { error, access, supabase } = await requireAccess();
  if (error || !access) return { ok: false, error: error ?? "Unauthorized" };

  if (!access.permissions.includes("manage_templates")) {
    return { ok: false, error: "Missing manage_templates permission" };
  }

  const payload = {
    name: input.name.trim(),
    description: input.description.trim() || null,
    eligibility_rules: {
      requirements: input.requirements.trim(),
    },
    disbursement_cooldown_days: Math.max(0, input.cooldownDays),
    is_active: input.isActive ?? true,
    created_by: access.profile.id,
    updated_at: new Date().toISOString(),
  };

  if (input.id) {
    const { error: updateError } = await supabase
      .from("program_templates")
      .update(payload)
      .eq("id", input.id);
    if (updateError) return { ok: false, error: updateError.message };
  } else {
    const { error: insertError } = await supabase
      .from("program_templates")
      .insert(payload);
    if (insertError) return { ok: false, error: insertError.message };
  }

  return { ok: true };
}

export async function toggleProgramTemplate(
  id: string,
  isActive: boolean,
): Promise<ActionResult> {
  const { error, access, supabase } = await requireAccess();
  if (error || !access) return { ok: false, error: error ?? "Unauthorized" };

  if (!access.permissions.includes("manage_templates")) {
    return { ok: false, error: "Missing manage_templates permission" };
  }

  const { error: updateError } = await supabase
    .from("program_templates")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (updateError) return { ok: false, error: updateError.message };
  return { ok: true };
}

export async function saveRegionTemplate(input: {
  templateId: string;
  eligibilityNote: string;
  cooldownDays?: number;
}): Promise<ActionResult> {
  const { error, access, supabase } = await requireAccess();
  if (error || !access) return { ok: false, error: error ?? "Unauthorized" };

  if (!access.permissions.includes("customize_templates")) {
    return { ok: false, error: "Missing customize_templates permission" };
  }

  if (!access.profile.regionId) {
    return { ok: false, error: "No region on profile" };
  }

  const local = {
    eligibility_note: input.eligibilityNote.trim(),
    ...(input.cooldownDays !== undefined
      ? { cooldown_days: Math.max(0, input.cooldownDays) }
      : {}),
  };

  const { error: upsertError } = await supabase.from("region_templates").upsert(
    {
      region_id: access.profile.regionId,
      template_id: input.templateId,
      local_eligibility_rules: local,
      is_active: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "region_id,template_id" },
  );

  if (upsertError) return { ok: false, error: upsertError.message };
  return { ok: true };
}
