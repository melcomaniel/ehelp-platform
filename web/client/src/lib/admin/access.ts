import type { SupabaseClient } from "@supabase/supabase-js";

import {
  permissionsForRole,
  type DbPermission,
} from "@/lib/auth/permissions";
import { fetchProfile } from "@/lib/auth/profile";
import type { Profile } from "@/lib/auth/types";

export type RegionRow = {
  id: string;
  code: string;
  name: string;
};

export type StaffAccess = {
  profile: Profile;
  region: RegionRow | null;
  permissions: DbPermission[];
};

export async function fetchStaffAccess(
  client: SupabaseClient,
  userId: string,
): Promise<StaffAccess | null> {
  const profile = await fetchProfile(client, userId);
  if (!profile) return null;

  let region: RegionRow | null = null;
  if (profile.regionId) {
    const { data } = await client
      .from("regions")
      .select("id, code, name")
      .eq("id", profile.regionId)
      .maybeSingle();
    if (data) region = data as RegionRow;
  }

  let regional: DbPermission[] = [];
  if (
    profile.role !== "dswd_admin" &&
    profile.regionId &&
    (profile.role === "satellite_admin" ||
      profile.role === "approver" ||
      profile.role === "evaluator")
  ) {
    const { data } = await client
      .from("regional_rbac")
      .select("permission")
      .eq("region_id", profile.regionId)
      .eq("role", profile.role);

    regional = (data ?? []).map((r) => r.permission as DbPermission);
  }

  return {
    profile,
    region,
    permissions: permissionsForRole(profile.role, regional),
  };
}
