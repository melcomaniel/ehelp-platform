import { NextResponse, type NextRequest } from "next/server";

import {
  decodeNestJwt,
  NEST_TOKEN_COOKIE,
} from "@/lib/auth/nest-session";
import {
  homeRouteForRole,
  isWebAdminRole,
  isWebStaffRole,
  parseAppRole,
  type AppRole,
} from "@/lib/auth/types";

const AUTH_PATHS = new Set(["/signin", "/signup", "/otp", "/auth/sso"]);
const PROTECTED_PREFIXES = ["/dashboard", "/admin", "/staff", "/social-worker"];

function isAuthPath(pathname: string) {
  return AUTH_PATHS.has(pathname);
}

function isProtectedPath(pathname: string) {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function roleFromRequest(request: NextRequest): AppRole | null {
  const token = request.cookies.get(NEST_TOKEN_COOKIE)?.value;
  if (!token) return null;
  const claims = decodeNestJwt(token);
  if (!claims?.sub) return null;
  return parseAppRole(claims.role);
}

export async function updateNestSession(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const role = roleFromRequest(request);
  const isLoggedIn = role != null;

  if (!isLoggedIn && isProtectedPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/signin";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (isLoggedIn && isAuthPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = homeRouteForRole(role);
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Role-scope route guards
  if (isLoggedIn && (pathname === "/admin" || pathname.startsWith("/admin/"))) {
    if (!isWebAdminRole(role)) {
      const url = request.nextUrl.clone();
      url.pathname = homeRouteForRole(role);
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  if (
    isLoggedIn &&
    (pathname === "/admin/organizations" ||
      pathname.startsWith("/admin/organizations/")) &&
    role !== "platform_admin"
  ) {
    const url = request.nextUrl.clone();
    url.pathname = homeRouteForRole(role);
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (isLoggedIn && (pathname === "/staff" || pathname.startsWith("/staff/"))) {
    if (!isWebStaffRole(role) && !isWebAdminRole(role)) {
      const url = request.nextUrl.clone();
      url.pathname = homeRouteForRole(role);
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next({ request });
}
