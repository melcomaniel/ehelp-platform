import { NextResponse } from "next/server";

import {
  nestApiBase,
  setNestSessionCookie,
  type NestAuthResponse,
} from "@/lib/auth/nest-client";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const email = String(body.email ?? "").trim();
  const password = String(body.password ?? "");
  const deviceFingerprint = String(body.device_fingerprint ?? "").trim();
  if (!email || !password) {
    return NextResponse.json(
      { message: "Email and password are required" },
      { status: 400 },
    );
  }

  const res = await fetch(`${nestApiBase()}/auth/dev/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Client-Platform": "web",
    },
    body: JSON.stringify({
      email,
      password,
      client_platform: "web",
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
          : "Login failed";
    return NextResponse.json({ message }, { status: res.status });
  }

  await setNestSessionCookie(data.access_token);
  return NextResponse.json({ user: data.user });
}
