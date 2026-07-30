"use client"

import * as React from "react"

import { useAdminAccess } from "@/lib/admin/access-provider"
import {
  applyTemplateToAllRegions,
  applyTemplateToRegion,
  listRegions,
  loadRbacTemplate,
  loadRegionalRbac,
  setRegionalGrant,
  setTemplateGrant,
} from "@/lib/admin/rbac-actions"
import {
  DB_PERMISSIONS,
  PERMISSION_LABEL,
  RBAC_MATRIX_ROLE_LABEL,
  RBAC_MATRIX_ROLES,
  type DbPermission,
  type RbacMatrixRole,
} from "@/lib/auth/permissions"
import { PageHeader } from "@/components/ehelp/bits"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type Grant = { role: RbacMatrixRole; permission: DbPermission }

function matrixFromGrants(grants: Grant[]) {
  const map = new Map<string, boolean>()
  for (const g of grants) map.set(`${g.role}:${g.permission}`, true)
  return map
}

function hasGrant(grants: Grant[], role: RbacMatrixRole, permission: DbPermission) {
  return grants.some((g) => g.role === role && g.permission === permission)
}

function PermissionMatrix({
  roles,
  grants,
  locked,
  onToggle,
}: {
  roles: RbacMatrixRole[]
  grants: Grant[]
  locked: (role: RbacMatrixRole) => boolean
  onToggle: (role: RbacMatrixRole, permission: DbPermission, granted: boolean) => void
}) {
  const map = matrixFromGrants(grants)

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            <th className="pb-2 pr-4 font-medium">Permission</th>
            {roles.map((r) => (
              <th key={r} className="pb-2 pr-4 font-medium whitespace-nowrap">
                {RBAC_MATRIX_ROLE_LABEL[r]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {DB_PERMISSIONS.map((p) => (
            <tr key={p} className="border-b last:border-0">
              <td className="py-2.5 pr-4">{PERMISSION_LABEL[p]}</td>
              {roles.map((r) => {
                const granted = map.has(`${r}:${p}`)
                const isLocked = locked(r)
                return (
                  <td key={r} className="py-2.5 pr-4">
                    <input
                      type="checkbox"
                      checked={granted}
                      disabled={isLocked}
                      onChange={(e) => onToggle(r, p, e.target.checked)}
                      className="size-4 accent-[var(--gov-blue)] disabled:opacity-40"
                      aria-label={`${RBAC_MATRIX_ROLE_LABEL[r]}: ${PERMISSION_LABEL[p]}`}
                    />
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

type RbacTab = "region" | "template"

export default function RbacPage() {
  const {
    can,
    isPlatformAdmin,
    isDswdAdmin,
    isSatelliteAdmin,
    region,
    loading: accessLoading,
  } = useAdminAccess()

  // Platform Admin owns global defaults. Organization Admin customizes
  // community/region grants. Office Admin can only adjust approver/evaluator
  // grants inside their assigned region when granted.
  const canEditRegion =
    !isPlatformAdmin && (can("manage-region-rbac") || can("manage-rbac"))
  const canEditTemplate = isPlatformAdmin && can("manage-rbac")
  const canApplyTemplate = isDswdAdmin && can("manage-rbac")

  const [tab, setTab] = React.useState<RbacTab>(
    isPlatformAdmin ? "template" : "region",
  )
  const [regions, setRegions] = React.useState<
    { id: string; code: string; name: string }[]
  >([])
  const [regionId, setRegionId] = React.useState<string>("")
  const [grants, setGrants] = React.useState<Grant[]>([])
  const [template, setTemplate] = React.useState<Grant[]>([])
  const [draftGrants, setDraftGrants] = React.useState<Grant[]>([])
  const [draftTemplate, setDraftTemplate] = React.useState<Grant[]>([])
  const [editing, setEditing] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [message, setMessage] = React.useState<string | null>(null)

  const regionalRoles: RbacMatrixRole[] = isDswdAdmin
    ? RBAC_MATRIX_ROLES
    : ["approver", "evaluator"]

  const reload = React.useCallback(async (rid: string) => {
    if (!rid && !isPlatformAdmin) return
    const [g, t] = await Promise.all([
      rid ? loadRegionalRbac(rid) : Promise.resolve([]),
      isPlatformAdmin || isDswdAdmin ? loadRbacTemplate() : Promise.resolve([]),
    ])
    setGrants(g)
    if (isPlatformAdmin || isDswdAdmin) setTemplate(t)
    setEditing(false)
  }, [isPlatformAdmin, isDswdAdmin])

  React.useEffect(() => {
    if (accessLoading) return
    void (async () => {
      if (isPlatformAdmin || isDswdAdmin) {
        const list = await listRegions()
        setRegions(list)
        const initial = list[0]?.id ?? ""
        setRegionId(initial)
        await reload(initial)
      } else if (region?.id) {
        setRegionId(region.id)
        setRegions([{ id: region.id, code: region.code, name: region.name }])
        await reload(region.id)
      }
    })()
  }, [accessLoading, isPlatformAdmin, isDswdAdmin, region, reload])

  const toggleDraft = (
    setDraft: React.Dispatch<React.SetStateAction<Grant[]>>,
    role: RbacMatrixRole,
    permission: DbPermission,
    granted: boolean,
  ) => {
    setDraft((g) => {
      const without = g.filter(
        (x) => !(x.role === role && x.permission === permission),
      )
      return granted ? [...without, { role, permission }] : without
    })
  }

  const beginEdit = () => {
    setMessage(null)
    if (tab === "template") {
      setDraftTemplate(template)
    } else {
      setDraftGrants(grants)
    }
    setEditing(true)
  }

  const cancelEdit = () => {
    setEditing(false)
    setDraftGrants([])
    setDraftTemplate([])
    setMessage(null)
  }

  const updateRbac = async () => {
    setBusy(true)
    setMessage(null)
    const isTemplate = tab === "template"
    const roles = isTemplate ? RBAC_MATRIX_ROLES : regionalRoles
    const before = isTemplate ? template : grants
    const after = isTemplate ? draftTemplate : draftGrants

    try {
      const updates: Promise<{ ok: true } | { ok: false; error: string }>[] = []
      for (const role of roles) {
        for (const permission of DB_PERMISSIONS) {
          const current = hasGrant(before, role, permission)
          const next = hasGrant(after, role, permission)
          if (current === next) continue
          if (isTemplate) {
            updates.push(setTemplateGrant({ role, permission, granted: next }))
          } else if (regionId) {
            updates.push(setRegionalGrant({ regionId, role, permission, granted: next }))
          }
        }
      }
      const results = await Promise.all(updates)
      const failed = results.find((result) => !result.ok)
      if (failed && !failed.ok) {
        setMessage(failed.error)
        return
      }
      if (isTemplate) {
        setTemplate(after)
      } else {
        setGrants(after)
      }
      setEditing(false)
      setMessage(updates.length ? "Permissions updated" : "No permission changes to update")
    } finally {
      setBusy(false)
    }
  }

  const applyOne = async () => {
    if (!regionId || !canApplyTemplate) return
    setBusy(true)
    setMessage(null)
    const result = await applyTemplateToRegion(regionId)
    setMessage(result.ok ? "Template applied to region" : result.error)
    if (result.ok) await reload(regionId)
    setBusy(false)
  }

  const applyAll = async () => {
    if (!canApplyTemplate) return
    if (
      !window.confirm(
        "Replace RBAC for every region with the global template?",
      )
    ) {
      return
    }
    setBusy(true)
    setMessage(null)
    const result = await applyTemplateToAllRegions()
    setMessage(result.ok ? "Template applied to all regions" : result.error)
    if (result.ok && regionId) await reload(regionId)
    setBusy(false)
  }

  const selected = regions.find((r) => r.id === regionId)

  return (
    <>
      <PageHeader
        title="RBAC Permissions"
        description={
          isPlatformAdmin
            ? "Manage global default grants reused by organization and office administrators"
            : isDswdAdmin
              ? "Customize region/community grants from the global platform defaults"
            : isSatelliteAdmin
              ? `Adjust approver and evaluator permissions for ${region?.name ?? "your region"}`
              : "Read-only — your role cannot edit permissions"
        }
      />

      {message && (
        <p className="text-sm text-muted-foreground" role="status">
          {message}
        </p>
      )}

      {(isPlatformAdmin || isDswdAdmin) && (
        <div
          role="tablist"
          aria-label="RBAC views"
          className="inline-flex h-9 items-center rounded-lg border bg-muted/40 p-0.5"
        >
          {!isPlatformAdmin && (
            <button
              type="button"
              role="tab"
              aria-selected={tab === "region"}
              id="rbac-tab-region"
              aria-controls="rbac-panel-region"
              onClick={() => setTab("region")}
              className={
                tab === "region"
                  ? "h-8 rounded-md bg-background px-3 text-sm font-medium shadow-sm"
                  : "h-8 rounded-md px-3 text-sm font-medium text-muted-foreground hover:text-foreground"
              }
            >
              Region matrix
            </button>
          )}
          <button
            type="button"
            role="tab"
            aria-selected={tab === "template"}
            id="rbac-tab-template"
            aria-controls="rbac-panel-template"
            onClick={() => setTab("template")}
            className={
              tab === "template"
                ? "h-8 rounded-md bg-background px-3 text-sm font-medium shadow-sm"
                : "h-8 rounded-md px-3 text-sm font-medium text-muted-foreground hover:text-foreground"
            }
          >
            Global defaults
          </button>
        </div>
      )}

      {(!isPlatformAdmin && (!isDswdAdmin || tab === "region")) && (
        <Card
          id="rbac-panel-region"
          role="tabpanel"
          aria-labelledby={isDswdAdmin ? "rbac-tab-region" : undefined}
        >
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Region matrix</CardTitle>
              <CardDescription>
                {selected
                  ? `${selected.code} · ${selected.name}${isDswdAdmin ? " · organization customization" : ""}`
                  : "Select a region"}
              </CardDescription>
            </div>
            {isDswdAdmin && (
              <select
                className="h-9 rounded-md border bg-background px-3 text-sm"
                value={regionId}
                onChange={(e) => {
                  const id = e.target.value
                  setRegionId(id)
                  setEditing(false)
                  void reload(id)
                }}
                disabled={busy}
              >
                {regions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.code} — {r.name}
                  </option>
                ))}
              </select>
            )}
          </CardHeader>
          <CardContent>
            {accessLoading || !regionId ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : (
              <PermissionMatrix
                roles={regionalRoles}
                grants={editing ? draftGrants : grants}
                locked={(role) => {
                  if (!editing || !canEditRegion || busy) return true
                  return role === "satellite_admin"
                }}
                onToggle={(role, permission, granted) =>
                  toggleDraft(setDraftGrants, role, permission, granted)
                }
              />
            )}
          </CardContent>
        </Card>
      )}

      {(isPlatformAdmin || isDswdAdmin) && tab === "template" && (
        <Card
          id="rbac-panel-template"
          role="tabpanel"
          aria-labelledby="rbac-tab-template"
        >
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Global RBAC template</CardTitle>
              <CardDescription>
                {isPlatformAdmin
                  ? "Platform-wide defaults for new region/community grants"
                  : "Read-only platform defaults; apply them before customizing a region"}
              </CardDescription>
            </div>
            {isDswdAdmin && (
              <div className="flex flex-wrap items-center gap-2">
              <select
                className="h-9 rounded-md border bg-background px-3 text-sm"
                value={regionId}
                onChange={(e) => {
                  setRegionId(e.target.value)
                  setEditing(false)
                }}
                disabled={busy}
                aria-label="Region to apply template to"
              >
                {regions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.code} — {r.name}
                  </option>
                ))}
              </select>
              <Button
                size="sm"
                variant="outline"
                disabled={busy || !regionId}
                onClick={() => void applyOne()}
              >
                Apply to selected region
              </Button>
              <Button
                size="sm"
                disabled={busy}
                onClick={() => void applyAll()}
              >
                Apply to all regions
              </Button>
              </div>
            )}
          </CardHeader>
          <CardContent>
            <PermissionMatrix
              roles={RBAC_MATRIX_ROLES}
              grants={editing ? draftTemplate : template}
              locked={() => busy || !editing || !canEditTemplate}
              onToggle={(role, permission, granted) =>
                toggleDraft(setDraftTemplate, role, permission, granted)
              }
            />
          </CardContent>
        </Card>
      )}
      {((tab === "template" && canEditTemplate) ||
        (tab === "region" && canEditRegion && !isPlatformAdmin)) && (
        <div className="sticky bottom-4 flex justify-end gap-2 rounded-lg border bg-card/95 p-3 shadow-[var(--shadow-soft)] backdrop-blur">
          {editing ? (
            <>
              <Button variant="outline" onClick={cancelEdit} disabled={busy}>
                Cancel
              </Button>
              <Button onClick={() => void updateRbac()} disabled={busy}>
                {busy ? "Updating..." : "Update permissions"}
              </Button>
            </>
          ) : (
            <Button onClick={beginEdit}>Edit permissions</Button>
          )}
        </div>
      )}
    </>
  )
}
