import { NextResponse } from "next/server";

import { nestApiBase } from "@/lib/auth/nest-client";

/** Create login liveness session from pending SSO token. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const pending = String(body.pending_login_token ?? "").trim();
  const callbackUrl = String(body.callback_url ?? "").trim();
  if (!pending) {
    return NextResponse.json(
      { message: "pending_login_token is required" },
      { status: 400 },
    );
  }

  const res = await fetch(`${nestApiBase()}/auth/liveness/session/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Client-Platform": "web",
    },
    body: JSON.stringify({
      pending_login_token: pending,
      callback_url: callbackUrl || undefined,
      action: "redirect",
    }),
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      typeof data.message === "string"
        ? data.message
        : Array.isArray(data.message)
          ? data.message.join(", ")
          : "Could not start face liveness";
    return NextResponse.json({ message }, { status: res.status });
  }
  return NextResponse.json(data);
}
