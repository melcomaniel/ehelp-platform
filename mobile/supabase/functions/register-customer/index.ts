import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user: caller },
      error: callerError,
    } = await callerClient.auth.getUser();

    if (callerError || !caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    const { data: callerProfile, error: profileError } = await admin
      .from("profiles")
      .select("id, role, region_id")
      .eq("id", caller.id)
      .single();

    if (
      profileError ||
      !callerProfile ||
      !["evaluator", "satellite_admin", "dswd_admin"].includes(
        callerProfile.role,
      )
    ) {
      return new Response(
        JSON.stringify({
          error: "Only evaluators/admins can register customers",
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const body = await req.json();
    const {
      email,
      password,
      full_name,
      phone,
      id_type,
      id_number,
      face_scan_verified = false,
      region_id,
    } = body;

    if (!email || !password || !full_name) {
      return new Response(
        JSON.stringify({
          error: "email, password, and full_name are required",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { data: created, error: createError } = await admin.auth.admin
      .createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name,
          role: "customer",
          phone: phone ?? null,
        },
      });

    if (createError || !created.user) {
      return new Response(
        JSON.stringify({ error: createError?.message ?? "Create failed" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const userId = created.user.id;
    const assignedRegion = region_id ?? callerProfile.region_id;

    await admin
      .from("profiles")
      .update({
        full_name,
        phone: phone ?? null,
        id_type: id_type ?? null,
        id_number: id_number ?? null,
        face_scan_verified: !!face_scan_verified,
        validation_status: "validated",
        region_id: assignedRegion,
        role: "customer",
      })
      .eq("id", userId);

    await admin.from("security_audits").insert({
      actor_id: caller.id,
      action: "evaluator_register_customer",
      entity_type: "profiles",
      entity_id: userId,
      metadata: {
        face_scan_verified: !!face_scan_verified,
        id_type: id_type ?? null,
      },
    });

    return new Response(JSON.stringify({ user_id: userId, email }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
