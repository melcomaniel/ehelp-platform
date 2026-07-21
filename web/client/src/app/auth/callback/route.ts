import { NextResponse } from "next/server";

import { fetchProfile } from "@/lib/auth/profile";
import { homeRouteForRole } from "@/lib/auth/types";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      let destination = next;
      if (!destination && user) {
        const profile = await fetchProfile(supabase, user.id);
        destination = homeRouteForRole(profile?.role ?? "customer");
      }

      return NextResponse.redirect(`${origin}${destination ?? "/dashboard"}`);
    }
  }

  return NextResponse.redirect(`${origin}/signin?error=auth_callback`);
}
