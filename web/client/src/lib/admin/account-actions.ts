"use server";

import {
  getNestAccessToken,
  nestServerFetch,
  type NestAuthUser,
} from "@/lib/auth/nest-client";
import type { AppRole } from "@/lib/auth/types";

export type StaffAccountRow = {
  id: string;
  email: string | null;
  fullName: string;
  role: AppRole;
  validationStatus: string;
  isActive: boolean;
  regionId: string | null;
  officeName: string | null;
};

function toRow(user: NestAuthUser): StaffAccountRow {
  return {
    id: user.id,
    email: user.email,
    fullName: user.full_name ?? "",
    role: user.role as AppRole,
    validationStatus: user.validation_status ?? "validated",
    isActive: user.is_active ?? true,
    regionId: user.region_id ?? user.office_id ?? null,
    officeName: user.office_name ?? null,
  };
}

export async function listStaffAccounts(): Promise<StaffAccountRow[]> {
  const token = await getNestAccessToken();
  if (!token) return [];
  try {
    const rows = await nestServerFetch<NestAuthUser[]>("/auth/staff", {
      token,
    });
    return (rows ?? []).map(toRow);
  } catch {
    return [];
  }
}

export async function registerStaffAccount(input: {
  email: string;
  fullName: string;
  password: string;
  role: "approver" | "evaluator" | "satellite_admin" | "dswd_admin" | "platform_admin";
  officeId?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await nestServerFetch("/auth/staff", {
      method: "POST",
      body: {
        email: input.email.trim().toLowerCase(),
        full_name: input.fullName.trim(),
        password: input.password,
        role: input.role,
        office_id: input.officeId,
      },
    });
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

/** Nest staff are active on create — keep API for UI compatibility. */
export async function approveStaffAccount(
  _id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  return { ok: true };
}
