import type { SupabaseClient } from "@supabase/supabase-js";

import { profileFromRow, type Profile } from "@/lib/auth/types";

export async function fetchProfile(
  client: SupabaseClient,
  userId: string,
): Promise<Profile | null> {
  const { data, error } = await client
    .from("profiles")
    .select(
      "id, email, phone, full_name, role, region_id, validation_status, is_active",
    )
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) return null;
  return profileFromRow(data as Record<string, unknown>);
}
