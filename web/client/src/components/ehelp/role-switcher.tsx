"use client"

import { useEhelp } from "@/lib/ehelp/store"
import type { Region, Role } from "@/lib/ehelp/types"
import { REGIONS, ROLE_LABEL, ROLE_TIER } from "@/lib/ehelp/types"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuGroup,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { CheckIcon, ChevronDownIcon, RotateCcwIcon, UserCogIcon } from "lucide-react"

const ROLES: Role[] = ["dswd-admin", "satellite-admin", "approver", "evaluator"]

export function RoleSwitcher() {
  const { state, setSession, resetAll } = useEhelp()
  const { role, region } = state.session

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
        <UserCogIcon />
        {ROLE_LABEL[role]}
        {role !== "dswd-admin" && (
          <span className="text-muted-foreground">· {region}</span>
        )}
        <ChevronDownIcon className="size-3.5 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Act as role</DropdownMenuLabel>
          {ROLES.map((r) => (
            <DropdownMenuItem key={r} onClick={() => setSession(r, region)}>
              <span className="flex-1">{ROLE_LABEL[r]}</span>
              <span className="text-xs text-muted-foreground">
                {ROLE_TIER[r].split(" · ")[0]}
              </span>
              {r === role && <CheckIcon />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>Region (regional roles)</DropdownMenuLabel>
          {REGIONS.map((rg: Region) => (
            <DropdownMenuItem key={rg} onClick={() => setSession(role, rg)}>
              <span className="flex-1">{rg}</span>
              {rg === region && <CheckIcon />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={resetAll}>
          <RotateCcwIcon />
          Reset demo data
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
