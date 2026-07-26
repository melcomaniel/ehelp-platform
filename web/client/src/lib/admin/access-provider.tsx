"use client";

import * as React from "react";

import {
  toUiPermission,
  type DbPermission,
  type UiPermission,
} from "@/lib/auth/permissions";
import { permissionsForRole } from "@/lib/auth/permissions";
import type { Profile } from "@/lib/auth/types";
import type { RegionRow, StaffAccess } from "@/lib/admin/access";

type AdminAccessValue = {
  loading: boolean;
  error: string | null;
  profile: Profile | null;
  region: RegionRow | null;
  permissions: DbPermission[];
  can: (permission: UiPermission | DbPermission) => boolean;
  isPlatformAdmin: boolean;
  isDswdAdmin: boolean;
  isSatelliteAdmin: boolean;
  refresh: () => Promise<void>;
};

const AdminAccessContext = React.createContext<AdminAccessValue | null>(null);

function normalizePermission(p: UiPermission | DbPermission): DbPermission {
  return p.replaceAll("-", "_") as DbPermission;
}

export function AdminAccessProvider({
  children,
  initial,
}: {
  children: React.ReactNode;
  initial?: StaffAccess | null;
}) {
  const [loading, setLoading] = React.useState(!initial);
  const [error, setError] = React.useState<string | null>(null);
  const [access, setAccess] = React.useState<StaffAccess | null>(
    initial ?? null,
  );

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/session", { cache: "no-store" });
      if (!res.ok) {
        setAccess(null);
        setError("Not signed in");
        return;
      }
      const data = (await res.json()) as { user: Profile | null };
      if (!data.user) {
        setAccess(null);
        setError("Profile not found");
        return;
      }
      const profile = data.user;
      const region: RegionRow | null = profile.regionId
        ? {
            id: profile.regionId,
            code: "office",
            name: "Assigned office",
          }
        : null;
      setAccess({
        profile,
        region,
        permissions: permissionsForRole(profile.role),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load access");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (initial) return;
    const timer = window.setTimeout(() => {
      void refresh();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [initial, refresh]);

  const permissions = React.useMemo(
    () => access?.permissions ?? [],
    [access?.permissions],
  );
  const permSet = React.useMemo(() => new Set(permissions), [permissions]);

  const value: AdminAccessValue = {
    loading,
    error,
    profile: access?.profile ?? null,
    region: access?.region ?? null,
    permissions,
    can: (permission) => permSet.has(normalizePermission(permission)),
    isPlatformAdmin: access?.profile.role === "platform_admin",
    isDswdAdmin: access?.profile.role === "dswd_admin",
    isSatelliteAdmin: access?.profile.role === "satellite_admin",
    refresh,
  };

  return (
    <AdminAccessContext.Provider value={value}>
      {children}
    </AdminAccessContext.Provider>
  );
}

export function useAdminAccess() {
  const ctx = React.useContext(AdminAccessContext);
  if (!ctx) {
    throw new Error("useAdminAccess must be used within AdminAccessProvider");
  }
  return ctx;
}

/** Convenience: also expose UI kebab form list if needed. */
export function useAdminUiPermissions(): UiPermission[] {
  const { permissions } = useAdminAccess();
  return permissions.map(toUiPermission);
}
