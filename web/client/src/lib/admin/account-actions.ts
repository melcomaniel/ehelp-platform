"use server";

import { fetchStaffAccess } from "@/lib/admin/access";
import type { AppRole } from "@/lib/auth/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true } | { ok: false; error: string };

export type StaffAccountRow = {
  id: string;
  email: string | null;
  fullName: string;
  role: AppRole;
  regionId: string | null;
  regionCode: string | null;
  validationStatus: string;
  isActive: boolean;
};

const STAFF_ROLES: AppRole[] = [
  "satellite_admin",
  "approver",
  "evaluator",
  "dswd_admin",
];

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

export async function listStaffAccounts(): Promise<StaffAccountRow[]> {
  const { error, access, supabase } = await requireAccess();
  if (error || !access) return [];

  let query = supabase
    .from("profiles")
    .select(
      "id, email, full_name, role, region_id, validation_status, is_active, regions(code)",
    )
    .in("role", STAFF_ROLES)
    .order("created_at", { ascending: false });

  if (access.profile.role === "satellite_admin" && access.profile.regionId) {
    query = query
      .eq("region_id", access.profile.regionId)
      .in("role", ["approver", "evaluator", "satellite_admin"]);
  }

  const { data } = await query;
  return (data ?? []).map((row) => {
    const regions = row.regions as { code: string } | { code: string }[] | null;
    const regionCode = Array.isArray(regions)
      ? (regions[0]?.code ?? null)
      : (regions?.code ?? null);

    return {
      id: row.id as string,
      email: (row.email as string | null) ?? null,
      fullName: (row.full_name as string) ?? "",
      role: row.role as AppRole,
      regionId: (row.region_id as string | null) ?? null,
      regionCode,
      validationStatus: row.validation_status as string,
      isActive: Boolean(row.is_active),
    };
  });
}

export async function registerStaffAccount(input: {
  email: string;
  fullName: string;
  password: string;
  role: "approver" | "evaluator";
}): Promise<ActionResult> {
  const { error, access } = await requireAccess();
  if (error || !access) return { ok: false, error: error ?? "Unauthorized" };

  if (!access.permissions.includes("register_accounts")) {
    return { ok: false, error: "Missing register_accounts permission" };
  }

  if (access.profile.role !== "satellite_admin" || !access.profile.regionId) {
    return {
      ok: false,
      error: "Only satellite admins with a region can register staff",
    };
  }

  const email = input.email.trim().toLowerCase();
  const fullName = input.fullName.trim();
  if (!email || !fullName || input.password.length < 8) {
    return {
      ok: false,
      error: "Name, email, and password (8+ chars) are required",
    };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Admin client unavailable",
    };
  }

  const { data: created, error: createError } =
    await admin.auth.admin.createUser({
      email,
      password: input.password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        role: input.role,
      },
    });

  if (createError || !created.user) {
    return {
      ok: false,
      error: createError?.message ?? "Failed to create auth user",
    };
  }

  const { error: profileError } = await admin
    .from("profiles")
    .update({
      email,
      full_name: fullName,
      role: input.role,
      region_id: access.profile.regionId,
      validation_status: "pending",
      is_active: true,
    })
    .eq("id", created.user.id);

  if (profileError) {
    return { ok: false, error: profileError.message };
  }

  return { ok: true };
}

export async function approveStaffAccount(
  profileId: string,
): Promise<ActionResult> {
  const { error, access, supabase } = await requireAccess();
  if (error || !access) return { ok: false, error: error ?? "Unauthorized" };

  if (
    access.profile.role !== "dswd_admin" ||
    !access.permissions.includes("approve_accounts")
  ) {
    return { ok: false, error: "Missing approve_accounts permission" };
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ validation_status: "validated" })
    .eq("id", profileId);

  if (updateError) return { ok: false, error: updateError.message };
  return { ok: true };
}
