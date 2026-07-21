import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const API_BASE = "https://hackathon-face-liveness-api.e.gov.ph";
const SPA_HOST = "hackathon-face-liveness.e.gov.ph";

/** Resolve API base; never use the SPA frontend host for /v1 calls. */
function resolveLivenessBaseUrl(): string {
  const raw = (Deno.env.get("FACE_LIVENESS_BASE_URL") ?? API_BASE).replace(
    /\/$/,
    "",
  );
  if (raw.includes(SPA_HOST) && !raw.includes("hackathon-face-liveness-api")) {
    return API_BASE;
  }
  return raw || API_BASE;
}

function resolveApiKey(): string | null {
  return (
    Deno.env.get("FACE_LIVENESS_API_KEY") ??
    Deno.env.get("FACE_LIVENESS_APIKEY") ??
    null
  );
}

function pickToken(json: Record<string, unknown>): string | null {
  const nested = json.data as Record<string, unknown> | undefined;
  const candidates = [
    json.token,
    json.session_token,
    json.sessionToken,
    nested?.token,
    nested?.session_token,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.length > 0) return c;
  }
  return null;
}

function pickUrl(json: Record<string, unknown>): string | null {
  const nested = json.data as Record<string, unknown> | undefined;
  const candidates = [
    json.url,
    json.liveness_url,
    json.verification_url,
    nested?.url,
    nested?.liveness_url,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.length > 0) return c;
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const livenessBaseUrl = resolveLivenessBaseUrl();
    const livenessApiKey = resolveApiKey();

    if (!livenessApiKey) {
      return new Response(
        JSON.stringify({
          error:
            "FACE_LIVENESS_API_KEY is not configured in Supabase secrets",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

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
      data: { user },
      error: userError,
    } = await callerClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const purpose =
      body.purpose === "application" ? "application" : "registration";
    const subjectUserId = body.user_id ?? user.id;
    const applicationId = body.application_id ?? null;
    const action = body.action ?? "close";
    const callbackUrl = body.callback_url ?? "ehelp://liveness-callback";
    const delay = typeof body.delay === "number" ? body.delay : 2000;

    const payload: Record<string, unknown> = { action, delay };
    if (action === "redirect") {
      payload.callback_url = callbackUrl;
    }

    const upstreamUrl = `${livenessBaseUrl}/v1/liveness/session`;
    const sessionRes = await fetch(upstreamUrl, {
      method: "POST",
      headers: {
        "x-api-key": livenessApiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });

    const contentType = sessionRes.headers.get("content-type") ?? "";
    const rawText = await sessionRes.text();
    let sessionJson: Record<string, unknown> = {};
    if (
      contentType.includes("application/json") ||
      rawText.trim().startsWith("{")
    ) {
      try {
        sessionJson = JSON.parse(rawText) as Record<string, unknown>;
      } catch {
        sessionJson = { parse_error: true, raw: rawText.slice(0, 300) };
      }
    } else {
      sessionJson = {
        non_json: true,
        content_type: contentType,
        raw: rawText.slice(0, 300),
      };
    }

    if (!sessionRes.ok) {
      return new Response(
        JSON.stringify({
          error: "Failed to create liveness session",
          upstream_status: sessionRes.status,
          upstream_url: upstreamUrl,
          details: sessionJson,
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const token = pickToken(sessionJson);
    const url = pickUrl(sessionJson);
    if (!token || !url) {
      return new Response(
        JSON.stringify({
          error: "Invalid liveness session response",
          upstream_status: sessionRes.status,
          upstream_url: upstreamUrl,
          details: sessionJson,
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data: row, error: insertError } = await admin
      .from("liveness_sessions")
      .insert({
        session_token: token,
        session_url: url,
        purpose,
        user_id: subjectUserId,
        application_id: applicationId,
        initiated_by: user.id,
        status: "pending",
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await admin.from("security_audits").insert({
      actor_id: user.id,
      action: "liveness_session_created",
      entity_type: "liveness_sessions",
      entity_id: row.id,
      metadata: { purpose, subject_user_id: subjectUserId, api_base: livenessBaseUrl },
    });

    return new Response(
      JSON.stringify({
        token,
        url,
        session_id: row.id,
        purpose,
      }),
      {
        status: 201,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
