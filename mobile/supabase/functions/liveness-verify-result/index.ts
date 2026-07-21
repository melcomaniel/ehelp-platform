import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const API_BASE = "https://hackathon-face-liveness-api.e.gov.ph";
const SPA_HOST = "hackathon-face-liveness.e.gov.ph";
// Docs recommend 95.0; staging/emulator often scores lower. Override via secret.
const DEFAULT_MIN_CONFIDENCE = 80.0;

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

function resolveMinConfidence(): number {
  const raw = Deno.env.get("FACE_LIVENESS_MIN_CONFIDENCE");
  const n = raw ? Number(raw) : DEFAULT_MIN_CONFIDENCE;
  return Number.isFinite(n) ? n : DEFAULT_MIN_CONFIDENCE;
}

function normalizeConfidence(raw: unknown): number {
  if (raw == null) return 0;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return 0;
  // Some providers return 0–1 probability; docs/examples use 0–100.
  if (n > 0 && n <= 1) return n * 100;
  return n;
}

function extractResult(resultJson: Record<string, unknown>) {
  const nested = resultJson.data as Record<string, unknown> | undefined;
  const status = String(resultJson.status ?? nested?.status ?? "");
  const confidence = normalizeConfidence(
    resultJson.confidence_score ?? nested?.confidence_score,
  );
  const referenceImageUrl = (resultJson.reference_image_url ??
    nested?.reference_image_url) as string | undefined;
  return { status, confidence, referenceImageUrl, nested };
}

async function fetchUpstreamResult(
  upstreamUrl: string,
  apiKey: string,
): Promise<{ ok: boolean; status: number; json: Record<string, unknown> }> {
  const resultRes = await fetch(upstreamUrl, {
    method: "GET",
    headers: { "x-api-key": apiKey, Accept: "application/json" },
  });
  const contentType = resultRes.headers.get("content-type") ?? "";
  const rawText = await resultRes.text();
  let resultJson: Record<string, unknown> = {};
  if (
    contentType.includes("application/json") ||
    rawText.trim().startsWith("{")
  ) {
    try {
      resultJson = JSON.parse(rawText) as Record<string, unknown>;
    } catch {
      resultJson = { parse_error: true, raw: rawText.slice(0, 300) };
    }
  } else {
    resultJson = {
      non_json: true,
      content_type: contentType,
      raw: rawText.slice(0, 300),
    };
  }
  return { ok: resultRes.ok, status: resultRes.status, json: resultJson };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
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
    const minConfidence = resolveMinConfidence();

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
    const sessionToken = body.session_token as string | undefined;
    const applicationId = body.application_id as string | null | undefined;
    const markProfile = body.mark_profile !== false;

    if (!sessionToken) {
      return new Response(
        JSON.stringify({ error: "session_token is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const upstreamUrl =
      `${livenessBaseUrl}/v1/liveness/result/${sessionToken}`;

    // Poll until terminal status, or until SUCCEEDED has a usable score.
    let resultJson: Record<string, unknown> = {};
    let upstreamStatus = 0;
    let extracted = {
      status: "",
      confidence: 0,
      referenceImageUrl: undefined as string | undefined,
    };

    const maxAttempts = 12;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const upstream = await fetchUpstreamResult(upstreamUrl, livenessApiKey);
      upstreamStatus = upstream.status;
      resultJson = upstream.json;

      if (!upstream.ok) {
        return new Response(
          JSON.stringify({
            error: "Failed to fetch liveness result",
            upstream_status: upstreamStatus,
            upstream_url: upstreamUrl,
            details: resultJson,
          }),
          {
            status: 502,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      extracted = extractResult(resultJson);
      const { status, confidence, referenceImageUrl } = extracted;

      const pending =
        status === "CREATED" ||
        status === "IN_PROGRESS" ||
        status === "PENDING" ||
        status === "";

      // UI may show "complete" before score is finalized.
      const scoreNotReady =
        status === "SUCCEEDED" &&
        confidence < 1 &&
        !!referenceImageUrl &&
        attempt < maxAttempts - 1;

      if (!pending && !scoreNotReady) break;
      await sleep(1500);
    }

    const { status, confidence, referenceImageUrl } = extracted;
    const passed = status === "SUCCEEDED" && confidence >= minConfidence;
    const mappedStatus = passed
      ? "succeeded"
      : status === "SUCCEEDED"
        ? "rejected"
        : "failed";

    let message: string;
    if (passed) {
      message = "Liveness verified";
    } else if (status === "SUCCEEDED" && confidence < 1) {
      message =
        "Scan UI finished but API confidence is ~0. Camera stream was likely unusable (emulator/WebView). Retry in Chrome on a physical phone.";
    } else if (status === "SUCCEEDED") {
      message =
        `SUCCEEDED but confidence ${confidence.toFixed(1)} is below ${minConfidence}. Retry for a clearer scan.`;
    } else if (status === "CREATED" || status === "IN_PROGRESS") {
      message =
        "Result still processing. Wait a few seconds after “Verification complete”, then tap Verify again.";
    } else {
      message =
        `Liveness did not succeed (status: ${status || "unknown"}). Please retry.`;
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data: sessionRow } = await admin
      .from("liveness_sessions")
      .select("*")
      .eq("session_token", sessionToken)
      .maybeSingle();
    const subjectUserId = sessionRow?.user_id ?? user.id;

    await admin
      .from("liveness_sessions")
      .update({
        status: mappedStatus,
        confidence_score: confidence,
        reference_image_url: referenceImageUrl ?? null,
        raw_result: resultJson,
        verified_at: passed ? new Date().toISOString() : null,
      })
      .eq("session_token", sessionToken);

    if (passed && markProfile) {
      await admin
        .from("profiles")
        .update({
          face_scan_verified: true,
          face_scan_url: referenceImageUrl ?? null,
          liveness_session_token: sessionToken,
          liveness_confidence: confidence,
          liveness_verified_at: new Date().toISOString(),
          validation_status: "validated",
        })
        .eq("id", subjectUserId);
    }

    if (applicationId) {
      await admin
        .from("applications")
        .update({
          liveness_session_token: sessionToken,
          liveness_status: mappedStatus,
          liveness_confidence: confidence,
          liveness_reference_image_url: referenceImageUrl ?? null,
          liveness_verified_at: passed ? new Date().toISOString() : null,
        })
        .eq("id", applicationId);
    }

    await admin.from("security_audits").insert({
      actor_id: user.id,
      action: passed ? "liveness_verified" : "liveness_rejected",
      entity_type: "liveness_sessions",
      entity_id: sessionRow?.id ?? null,
      metadata: {
        status,
        confidence_score: confidence,
        passed,
        threshold: minConfidence,
        application_id: applicationId ?? null,
      },
    });

    return new Response(
      JSON.stringify({
        passed,
        status,
        confidence_score: confidence,
        reference_image_url: referenceImageUrl ?? null,
        mapped_status: mappedStatus,
        threshold: minConfidence,
        message,
      }),
      {
        status: 200,
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
