"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { SignOutButton } from "@/components/auth/sign-out-button"
import { usePrompts } from "@/components/workflow/prompts"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useWorkflow } from "@/lib/workflow/store"
import type { RoleKey } from "@/lib/workflow/types"
import { ROLE_LABEL } from "@/lib/workflow/types"
import {
  ChevronsUpDownIcon,
  ClipboardListIcon,
  FolderKanbanIcon,
  GaugeIcon,
  GavelIcon,
  LayersIcon,
  type LucideIcon,
  PlusCircleIcon,
  RotateCcwIcon,
  SendIcon,
  WorkflowIcon,
} from "lucide-react"

interface NavItem {
  title: string
  url: string
  icon: LucideIcon
  roles: RoleKey[]
}

interface NavGroup {
  label: string
  items: NavItem[]
}

const GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [{ title: "Dashboard", url: "/dashboard", icon: GaugeIcon, roles: ["admin", "applicant", "reviewer", "approver"] }],
  },
  {
    label: "Workflow",
    items: [
      { title: "All Workflows", url: "/dashboard/workflows", icon: WorkflowIcon, roles: ["admin"] },
      { title: "Create Workflow", url: "/dashboard/workflows/new", icon: PlusCircleIcon, roles: ["admin"] },
    ],
  },
  {
    label: "Program",
    items: [
      { title: "All Programs", url: "/dashboard/programs", icon: FolderKanbanIcon, roles: ["admin"] },
      { title: "Create Program", url: "/dashboard/programs/new", icon: PlusCircleIcon, roles: ["admin"] },
    ],
  },
  {
    label: "Applicant",
    items: [
      { title: "Apply", url: "/dashboard/apply", icon: SendIcon, roles: ["applicant"] },
      { title: "My Applications", url: "/dashboard/applications", icon: ClipboardListIcon, roles: ["applicant"] },
    ],
  },
  {
    label: "Casework",
    items: [{ title: "Review Queue", url: "/dashboard/review", icon: GavelIcon, roles: ["reviewer", "approver", "admin"] }],
  },
]

export function WorkflowSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()
  const { state, actingUser, setActingUser, resetAll } = useWorkflow()
  const { confirm, toast } = usePrompts()

  const isActive = (url: string) =>
    url === "/dashboard" ? pathname === url : pathname.startsWith(url)

  const visibleGroups = GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((i) => i.roles.some((r) => actingUser.roles.includes(r))),
  })).filter((g) => g.items.length > 0)

  const onReset = async () => {
    const ok = await confirm({
      title: "Reset demo data?",
      description:
        "All changes made while testing will be discarded and the seeded fixtures restored. This cannot be undone.",
      confirmLabel: "Reset data",
      destructive: true,
    })
    if (!ok) return
    resetAll()
    toast({ title: "Demo data reset", description: "Fixtures restored to their original state.", variant: "success" })
  }

  const initials = (actingUser?.name ?? "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)

  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/dashboard" />}>
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-[#0040E7] text-white">
                <LayersIcon className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">Workflow Engine</span>
                <span className="truncate text-xs">Aid Orchestration</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {visibleGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarMenu>
              {group.items.map((item) => {
                const Icon = item.icon
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton isActive={isActive(item.url)} render={<Link href={item.url} />}>
                      <Icon />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <button
              onClick={onReset}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <RotateCcwIcon className="size-4" /> Reset demo data
            </button>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SignOutButton />
          </SidebarMenuItem>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <SidebarMenuButton
                    size="lg"
                    className="data-[state=open]:bg-sidebar-accent"
                  />
                }
              >
                <Avatar className="size-8 rounded-lg">
                  <AvatarFallback className="rounded-lg bg-[#0040E7]/10 text-xs text-[#0040E7]">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{actingUser?.name ?? "…"}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {actingUser?.roles.map((r) => ROLE_LABEL[r]).join(", ")}
                  </span>
                </div>
                <ChevronsUpDownIcon className="ml-auto size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="w-56">
                <DropdownMenuLabel>Switch acting user</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {state.users.map((u) => (
                  <DropdownMenuItem key={u.id} onClick={() => setActingUser(u.id)}>
                    <span className="flex-1">{u.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {u.roles.map((r) => ROLE_LABEL[r]).join(", ")}
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
