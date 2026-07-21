"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { useEhelp } from "@/lib/ehelp/store"
import type { Permission } from "@/lib/ehelp/types"
import { ROLE_LABEL, ROLE_TIER } from "@/lib/ehelp/types"
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
import {
  LayoutDashboardIcon,
  FolderOpenIcon,
  UserPlusIcon,
  FileSlidersIcon,
  MegaphoneIcon,
  UsersIcon,
  ShieldCheckIcon,
  ScrollTextIcon,
  HandHeartIcon,
} from "lucide-react"

interface NavItem {
  title: string
  url: string
  icon: React.ReactNode
  needsAny?: Permission[]
}

const NAV: NavItem[] = [
  { title: "Overview", url: "/admin", icon: <LayoutDashboardIcon /> },
  {
    title: "Applications",
    url: "/admin/applications",
    icon: <FolderOpenIcon />,
  },
  {
    title: "Registrations",
    url: "/admin/registrations",
    icon: <UserPlusIcon />,
  },
  {
    title: "Templates",
    url: "/admin/templates",
    icon: <FileSlidersIcon />,
    needsAny: ["manage-templates", "customize-templates"],
  },
  {
    title: "Recommendations",
    url: "/admin/recommendations",
    icon: <MegaphoneIcon />,
    needsAny: ["submit-recommendations", "act-recommendations"],
  },
  {
    title: "Internal Accounts",
    url: "/admin/accounts",
    icon: <UsersIcon />,
    needsAny: ["approve-accounts", "register-accounts"],
  },
  {
    title: "RBAC",
    url: "/admin/rbac",
    icon: <ShieldCheckIcon />,
    needsAny: ["manage-rbac", "manage-region-rbac"],
  },
  {
    title: "Audit Log",
    url: "/admin/audit",
    icon: <ScrollTextIcon />,
    needsAny: ["view-audit"],
  },
]

export function AdminSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()
  const { state, can } = useEhelp()
  const { role, region } = state.session

  const visible = NAV.filter(
    (item) => !item.needsAny || item.needsAny.some((p) => can(p))
  )

  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/admin" />}>
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-[#0040E7] text-white">
                <HandHeartIcon className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">EHELP</span>
                <span className="truncate text-xs">DSWD Admin Console</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarMenu>
            {visible.map((item) => (
              <SidebarMenuItem key={item.url}>
                <SidebarMenuButton
                  isActive={pathname === item.url}
                  render={<Link href={item.url} />}
                >
                  {item.icon}
                  <span>{item.title}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="flex items-center gap-2 rounded-lg p-2">
          <Avatar className="size-8 rounded-lg">
            <AvatarFallback className="rounded-lg bg-[#0040E7]/10 text-xs text-[#0040E7]">
              {ROLE_LABEL[role]
                .split(" ")
                .map((w) => w[0])
                .join("")}
            </AvatarFallback>
          </Avatar>
          <div className="grid text-left text-sm leading-tight">
            <span className="truncate font-medium">{ROLE_LABEL[role]}</span>
            <span className="truncate text-xs text-muted-foreground">
              {ROLE_TIER[role]}
              {role !== "dswd-admin" ? ` · ${region}` : ""}
            </span>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
