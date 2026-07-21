"use client";

import * as React from "react";

import {
  toUiPermission,
  type DbPermission,
  type UiPermission,
} from "@/lib/auth/permissions";
import type { Profile } from "@/lib/auth/types";
import {
  fetchStaffAccess,
  type RegionRow,
  type StaffAccess,
} from "@/lib/admin/access";
import { createClient } from "@/lib/supabase/client";

type AdminAccessValue = {
  loading: boolean;
  error: string | null;
  profile: Profile | null;
  region: RegionRow | null;
  permissions: DbPermission[];
  can: (permission: UiPermission | DbPermission) => boolean;
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
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setAccess(null);
        setError("Not signed in");
        return;
      }
      const next = await fetchStaffAccess(supabase, user.id);
      setAccess(next);
      if (!next) setError("Profile not found");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load access");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (!initial) void refresh();
  }, [initial, refresh]);

  const permissions = access?.permissions ?? [];
  const permSet = React.useMemo(() => new Set(permissions), [permissions]);

  const value: AdminAccessValue = {
    loading,
    error,
    profile: access?.profile ?? null,
    region: access?.region ?? null,
    permissions,
    can: (permission) => permSet.has(normalizePermission(permission)),
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
