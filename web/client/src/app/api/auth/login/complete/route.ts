import { NextResponse } from "next/server";

import {
  nestApiBase,
  setNestSessionCookie,
  type NestAuthResponse,
} from "@/lib/auth/nest-client";

/** Complete SSO login after face liveness — sets session cookie. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const pending = String(body.pending_login_token ?? "").trim();
  const liveness = String(body.liveness_session_token ?? "").trim();
  const deviceFingerprint = String(body.device_fingerprint ?? "").trim();
  if (!pending || !liveness) {
    return NextResponse.json(
      {
        message:
          "pending_login_token and liveness_session_token are required",
      },
      { status: 400 },
    );
  }

  const res = await fetch(`${nestApiBase()}/auth/login/complete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Client-Platform": "web",
    },
    body: JSON.stringify({
      pending_login_token: pending,
      liveness_session_token: liveness,
      device_fingerprint: deviceFingerprint || undefined,
    }),
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as NestAuthResponse & {
    message?: string | string[];
  };
  if (!res.ok) {
    const message =
      typeof data.message === "string"
        ? data.message
        : Array.isArray(data.message)
          ? data.message.join(", ")
          : "Login complete failed";
    return NextResponse.json({ message }, { status: res.status });
  }

  if (!data.access_token) {
    return NextResponse.json(
      { message: "No access token returned" },
      { status: 502 },
    );
  }

  await setNestSessionCookie(data.access_token);
  return NextResponse.json({ user: data.user });
}
