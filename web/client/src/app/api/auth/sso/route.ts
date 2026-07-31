import { NextResponse } from "next/server";

import { nestApiBase } from "@/lib/auth/nest-client";

/** SSO exchange → pending_login_token (no session cookie until liveness). */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const exchangeCode = String(body.exchange_code ?? "").trim();
  if (!exchangeCode) {
    return NextResponse.json(
      { message: "exchange_code is required" },
      { status: 400 },
    );
  }

  const res = await fetch(`${nestApiBase()}/auth/sso/exchange`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Client-Platform": "web",
    },
    body: JSON.stringify({
      exchange_code: exchangeCode,
      client_platform: "web",
    }),
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as {
    pending_login_token?: string;
    user?: unknown;
    next?: string;
    message?: string | string[];
  };
  if (!res.ok) {
    const message =
      typeof data.message === "string"
        ? data.message
        : Array.isArray(data.message)
          ? data.message.join(", ")
          : "SSO exchange failed";
    return NextResponse.json({ message }, { status: res.status });
  }

  if (!data.pending_login_token) {
    return NextResponse.json(
      { message: "SSO did not return a pending login token" },
      { status: 502 },
    );
  }

  return NextResponse.json({
    pending_login_token: data.pending_login_token,
    user: data.user,
    next: data.next ?? "face_liveness",
  });
}
