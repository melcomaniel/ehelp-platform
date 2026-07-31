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

const AUTH_PATHS = new Set([
  "/signin",
  "/signup",
  "/otp",
  "/auth/sso",
  "/auth/liveness",
]);
const PROTECTED_PREFIXES = ["/dashboard", "/admin", "/staff", "/social-worker"];

const ERD_TO_APP: Record<string, AppRole> = {
  PLATFORM_ADMIN: "platform_admin",
  ORG_ADMIN: "dswd_admin",
  OFFICE_ADMIN: "satellite_admin",
  EVALUATOR: "evaluator",
  APPROVER: "approver",
  BENEFICIARY: "customer",
  DEPENDENT: "dependent",
};

function isAuthPath(pathname: string) {
  return AUTH_PATHS.has(pathname);
}

function isProtectedPath(pathname: string) {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function rolesFromRequest(request: NextRequest): AppRole[] {
  const token = request.cookies.get(NEST_TOKEN_COOKIE)?.value;
  if (!token) return [];
  const claims = decodeNestJwt(token);
  if (!claims?.sub) return [];
  // Pending SSO tokens are not a usable session.
  if (claims.purpose === "login_pending") return [];
  const fromErd = (claims.erd_roles ?? [])
    .map((code) => ERD_TO_APP[code])
    .filter(Boolean) as AppRole[];
  const primary = parseAppRole(claims.role);
  const roles = [...new Set([primary, ...fromErd])];
  return roles;
}

function primaryRole(roles: AppRole[]): AppRole | null {
  return roles[0] ?? null;
}

export async function updateNestSession(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const roles = rolesFromRequest(request);
  const role = primaryRole(roles);
  const isLoggedIn = role != null;
  const hasAdmin = roles.some(isWebAdminRole);
  const hasStaff = roles.some(isWebStaffRole);
  const hasPlatform = roles.includes("platform_admin");

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

  // Dual-role: any admin assignment may open /admin; any staff assignment /staff.
  if (isLoggedIn && (pathname === "/admin" || pathname.startsWith("/admin/"))) {
    if (!hasAdmin) {
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
    !hasPlatform
  ) {
    const url = request.nextUrl.clone();
    url.pathname = homeRouteForRole(role);
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (isLoggedIn && (pathname === "/staff" || pathname.startsWith("/staff/"))) {
    if (!hasStaff) {
      const url = request.nextUrl.clone();
      url.pathname = homeRouteForRole(role);
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  if (
    isLoggedIn &&
    hasPlatform &&
    (pathname === "/admin/applications" ||
      pathname.startsWith("/admin/applications/") ||
      pathname === "/admin/recommendations" ||
      pathname.startsWith("/admin/recommendations/") ||
      pathname === "/admin/templates" ||
      pathname.startsWith("/admin/templates/") ||
      pathname === "/admin/workflows" ||
      pathname.startsWith("/admin/workflows/") ||
      pathname === "/admin/programs" ||
      pathname.startsWith("/admin/programs/"))
  ) {
    const url = request.nextUrl.clone();
    url.pathname = homeRouteForRole(role);
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next({ request });
}
