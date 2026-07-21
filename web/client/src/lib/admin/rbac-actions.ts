"use server";

import {
  type DbPermission,
  type RbacMatrixRole,
  RBAC_MATRIX_ROLES,
} from "@/lib/auth/permissions";
import { fetchStaffAccess } from "@/lib/admin/access";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true } | { ok: false; error: string };

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

export async function listRegions(): Promise<
  { id: string; code: string; name: string }[]
> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("regions")
    .select("id, code, name")
    .eq("is_active", true)
    .order("code");
  return data ?? [];
}

export async function loadRegionalRbac(regionId: string): Promise<
  { role: RbacMatrixRole; permission: DbPermission }[]
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("regional_rbac")
    .select("role, permission")
    .eq("region_id", regionId);

  if (error) return [];
  return (data ?? [])
    .filter((r) =>
      RBAC_MATRIX_ROLES.includes(r.role as RbacMatrixRole),
    )
    .map((r) => ({
      role: r.role as RbacMatrixRole,
      permission: r.permission as DbPermission,
    }));
}

export async function loadRbacTemplate(): Promise<
  { role: RbacMatrixRole; permission: DbPermission }[]
> {
  const supabase = await createClient();
  const { data } = await supabase.from("rbac_templates").select("role, permission");
  return (data ?? [])
    .filter((r) => RBAC_MATRIX_ROLES.includes(r.role as RbacMatrixRole))
    .map((r) => ({
      role: r.role as RbacMatrixRole,
      permission: r.permission as DbPermission,
    }));
}

export async function setRegionalGrant(input: {
  regionId: string;
  role: RbacMatrixRole;
  permission: DbPermission;
  granted: boolean;
}): Promise<ActionResult> {
  const { error, access, supabase } = await requireAccess();
  if (error || !access) return { ok: false, error: error ?? "Unauthorized" };

  const { profile, permissions } = access;
  const isDswd = profile.role === "dswd_admin";
  const canRegion = permissions.includes("manage_region_rbac");
  const canAll = permissions.includes("manage_rbac");

  // Superadmin may only change regions via the global template + apply.
  if (isDswd) {
    return {
      ok: false,
      error:
        "DSWD admin cannot edit regional grants directly; use the global template",
    };
  }

  if (!canRegion && !canAll) {
    return { ok: false, error: "Missing RBAC permission" };
  }

  if (profile.regionId !== input.regionId) {
    return { ok: false, error: "Cannot edit another region" };
  }
  if (input.role === "satellite_admin") {
    return { ok: false, error: "Cannot edit satellite_admin grants" };
  }

  if (input.granted) {
    const { error: insertError } = await supabase.from("regional_rbac").insert({
      region_id: input.regionId,
      role: input.role,
      permission: input.permission,
    });
    if (insertError && insertError.code !== "23505") {
      return { ok: false, error: insertError.message };
    }
  } else {
    const { error: deleteError } = await supabase
      .from("regional_rbac")
      .delete()
      .eq("region_id", input.regionId)
      .eq("role", input.role)
      .eq("permission", input.permission);
    if (deleteError) return { ok: false, error: deleteError.message };
  }

  return { ok: true };
}

export async function setTemplateGrant(input: {
  role: RbacMatrixRole;
  permission: DbPermission;
  granted: boolean;
}): Promise<ActionResult> {
  const { error, access, supabase } = await requireAccess();
  if (error || !access) return { ok: false, error: error ?? "Unauthorized" };

  if (
    access.profile.role !== "dswd_admin" ||
    !access.permissions.includes("manage_rbac")
  ) {
    return { ok: false, error: "Only DSWD admin can edit the RBAC template" };
  }

  if (input.granted) {
    const { error: insertError } = await supabase.from("rbac_templates").insert({
      role: input.role,
      permission: input.permission,
    });
    if (insertError && insertError.code !== "23505") {
      return { ok: false, error: insertError.message };
    }
  } else {
    const { error: deleteError } = await supabase
      .from("rbac_templates")
      .delete()
      .eq("role", input.role)
      .eq("permission", input.permission);
    if (deleteError) return { ok: false, error: deleteError.message };
  }

  return { ok: true };
}

export async function applyTemplateToRegion(
  regionId: string,
): Promise<ActionResult> {
  const { error, access, supabase } = await requireAccess();
  if (error || !access) return { ok: false, error: error ?? "Unauthorized" };

  if (access.profile.role !== "dswd_admin") {
    return { ok: false, error: "Only DSWD admin can apply templates" };
  }

  const { error: rpcError } = await supabase.rpc("apply_rbac_template", {
    p_region_id: regionId,
  });
  if (rpcError) return { ok: false, error: rpcError.message };
  return { ok: true };
}

export async function applyTemplateToAllRegions(): Promise<ActionResult> {
  const { error, access, supabase } = await requireAccess();
  if (error || !access) return { ok: false, error: error ?? "Unauthorized" };

  if (access.profile.role !== "dswd_admin") {
    return { ok: false, error: "Only DSWD admin can apply templates" };
  }

  const { data: regions } = await supabase
    .from("regions")
    .select("id")
    .eq("is_active", true);

  for (const r of regions ?? []) {
    const { error: rpcError } = await supabase.rpc("apply_rbac_template", {
      p_region_id: r.id,
    });
    if (rpcError) return { ok: false, error: rpcError.message };
  }

  return { ok: true };
}
