import { NextResponse } from "next/server";

/** Legacy Supabase PKCE callback — web auth now uses Nest JWT. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const exchange = url.searchParams.get("exchange_code");
  if (exchange) {
    return NextResponse.redirect(
      new URL(`/auth/sso?exchange_code=${encodeURIComponent(exchange)}`, url.origin),
    );
  }
  return NextResponse.redirect(new URL("/signin", url.origin));
}
