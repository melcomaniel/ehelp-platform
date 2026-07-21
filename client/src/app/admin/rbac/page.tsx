"use client"

import { useEhelp } from "@/lib/ehelp/store"
import type { Permission, Role } from "@/lib/ehelp/types"
import { PERMISSION_LABEL, ROLE_LABEL, ROLE_TIER } from "@/lib/ehelp/types"
import { PageHeader } from "@/components/ehelp/bits"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

const ROLES: Role[] = ["dswd-admin", "satellite-admin", "approver", "evaluator"]
const PERMISSIONS = Object.keys(PERMISSION_LABEL) as Permission[]
const REGION_EDITABLE: Role[] = ["approver", "evaluator"]

export default function RbacPage() {
  const { state, can, setRbac } = useEhelp()
  const full = can("manage-rbac")
  const regional = can("manage-region-rbac")

  const editable = (target: Role) => {
    if (full) return true
    if (regional) return REGION_EDITABLE.includes(target)
    return false
  }

  return (
    <>
      <PageHeader
        title="RBAC Permissions"
        description={
          full
            ? "Tier 1 — full control across every role"
            : regional
              ? `Tier 2 — you can adjust regional roles (approver, evaluator) for ${state.session.region}`
              : "Read-only — your role cannot edit permissions"
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Permission Matrix</CardTitle>
          <CardDescription>
            Toggles apply immediately — switch roles to feel the gate close
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Permission</th>
                  {ROLES.map((r) => (
                    <th key={r} className="pb-2 pr-4 font-medium whitespace-nowrap">
                      {ROLE_LABEL[r]}
                      <div className="font-normal text-muted-foreground/70">
                        {ROLE_TIER[r].split(" · ")[0]}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERMISSIONS.map((p) => (
                  <tr key={p} className="border-b last:border-0">
                    <td className="py-2.5 pr-4">{PERMISSION_LABEL[p]}</td>
                    {ROLES.map((r) => {
                      const granted = state.rbac[r].includes(p)
                      const locked = !editable(r)
                      return (
                        <td key={r} className="py-2.5 pr-4">
                          <input
                            type="checkbox"
                            checked={granted}
                            disabled={locked}
                            onChange={(e) => setRbac(r, p, e.target.checked)}
                            className="size-4 accent-[#0040E7] disabled:opacity-40"
                            aria-label={`${ROLE_LABEL[r]}: ${PERMISSION_LABEL[p]}`}
                          />
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </>
  )
}
