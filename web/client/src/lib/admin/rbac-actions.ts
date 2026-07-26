import { nestFetch } from "@/lib/api/nest";
import {
  type DbPermission,
  type RbacMatrixRole,
  RBAC_MATRIX_ROLES,
} from "@/lib/auth/permissions";

export type ActionResult = { ok: true } | { ok: false; error: string };

type Grant = { role: RbacMatrixRole; permission: DbPermission };
type OfficeOption = { id: string; code: string; name: string };

function unwrapResult<T>(fn: () => Promise<T>): Promise<T> {
  return fn();
}

async function toActionResult(fn: () => Promise<unknown>): Promise<ActionResult> {
  try {
    await fn();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "RBAC request failed",
    };
  }
}

export async function listRegions(): Promise<OfficeOption[]> {
  const res = await unwrapResult(() =>
    nestFetch<{ data: OfficeOption[] }>("/admin/rbac/offices"),
  );
  return res.data;
}

export async function loadRegionalRbac(regionId: string): Promise<Grant[]> {
  const res = await unwrapResult(() =>
    nestFetch<{ data: Grant[] }>(`/admin/rbac/offices/${regionId}/grants`),
  );
  return res.data.filter((r) =>
    RBAC_MATRIX_ROLES.includes(r.role as RbacMatrixRole),
  );
}

export async function loadRbacTemplate(): Promise<Grant[]> {
  const res = await unwrapResult(() =>
    nestFetch<{ data: Grant[] }>("/admin/rbac/global-template"),
  );
  return res.data.filter((r) =>
    RBAC_MATRIX_ROLES.includes(r.role as RbacMatrixRole),
  );
}

export async function setRegionalGrant(input: {
  regionId: string;
  role: RbacMatrixRole;
  permission: DbPermission;
  granted: boolean;
}): Promise<ActionResult> {
  return toActionResult(() =>
    nestFetch(`/admin/rbac/offices/${input.regionId}/grants`, {
      method: "PATCH",
      body: {
        role: input.role,
        permission: input.permission,
        granted: input.granted,
      },
    }),
  );
}

export async function setTemplateGrant(input: {
  role: RbacMatrixRole;
  permission: DbPermission;
  granted: boolean;
}): Promise<ActionResult> {
  return toActionResult(() =>
    nestFetch("/admin/rbac/global-template", {
      method: "PATCH",
      body: input,
    }),
  );
}

export async function applyTemplateToRegion(
  regionId: string,
): Promise<ActionResult> {
  return toActionResult(() =>
    nestFetch(`/admin/rbac/global-template/apply/${regionId}`, {
      method: "POST",
      body: {},
    }),
  );
}

export async function applyTemplateToAllRegions(): Promise<ActionResult> {
  return toActionResult(() =>
    nestFetch("/admin/rbac/global-template/apply-all", {
      method: "POST",
      body: {},
    }),
  );
}
