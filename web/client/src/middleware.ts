import { type NextRequest } from "next/server";

import { updateNestSession } from "@/lib/auth/middleware";

export async function middleware(request: NextRequest) {
  return updateNestSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
