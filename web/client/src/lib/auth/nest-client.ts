import { cookies } from "next/headers";

import {
  nestCookieOptions,
  NEST_TOKEN_COOKIE,
} from "@/lib/auth/nest-session";
import type { AppRole, Profile } from "@/lib/auth/types";
import { parseAppRole } from "@/lib/auth/types";

export type NestAuthUser = {
  id: string;
  email: string | null;
  phone: string | null;
  full_name: string;
  role: string;
  erd_role?: string;
  region_id?: string | null;
  office_id?: string | null;
  office_name?: string | null;
  organization_id?: string | null;
  validation_status?: string;
  is_active?: boolean;
};

export type NestAuthResponse = {
  access_token: string;
  token_type?: string;
  user: NestAuthUser;
};

export function nestApiBase() {
  return (
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    process.env.API_BASE_URL ??
    "http://127.0.0.1:3001"
  ).replace(/\/$/, "");
}

export function profileFromNestUser(user: NestAuthUser): Profile {
  return {
    id: user.id,
    email: user.email,
    phone: user.phone,
    fullName: user.full_name ?? "",
    role: parseAppRole(user.role) as AppRole,
    organizationId: user.organization_id ?? null,
    regionId: user.region_id ?? user.office_id ?? null,
    validationStatus:
      (user.validation_status as Profile["validationStatus"]) ?? "validated",
    isActive: user.is_active ?? true,
  };
}

export async function setNestSessionCookie(accessToken: string) {
  const jar = await cookies();
  jar.set(NEST_TOKEN_COOKIE, accessToken, nestCookieOptions());
}

export async function clearNestSessionCookie() {
  const jar = await cookies();
  jar.delete(NEST_TOKEN_COOKIE);
}

export async function getNestAccessToken(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(NEST_TOKEN_COOKIE)?.value ?? null;
}

export async function nestServerFetch<T>(
  path: string,
  opts: {
    method?: string;
    body?: unknown;
    token?: string | null;
  } = {},
): Promise<T> {
  const token = opts.token ?? (await getNestAccessToken());
  const res = await fetch(`${nestApiBase()}${path}`, {
    method: opts.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      "X-Client-Platform": "web",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: opts.body != null ? JSON.stringify(opts.body) : undefined,
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      typeof data?.message === "string"
        ? data.message
        : Array.isArray(data?.message)
          ? data.message.join(", ")
          : `Nest request failed (${res.status})`;
    throw new Error(msg);
  }
  return data as T;
}
