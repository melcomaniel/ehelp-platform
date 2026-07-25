import { NextResponse } from "next/server";

import { clearNestSessionCookie } from "@/lib/auth/nest-client";

export async function POST() {
  await clearNestSessionCookie();
  return NextResponse.json({ ok: true });
}
