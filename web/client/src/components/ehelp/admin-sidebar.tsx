"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { SignOutButton } from "@/components/auth/sign-out-button"
import { useAdminAccess } from "@/lib/admin/access-provider"
import type { UiPermission } from "@/lib/auth/permissions"
import { APP_ROLE_LABEL } from "@/lib/auth/types"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
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
  ChevronRightIcon,
  WorkflowIcon,
  FolderKanbanIcon,
  Building2Icon,
} from "lucide-react"

interface NavLeaf {
  title: string
  url: string
  icon: React.ReactNode
  /** If set, visible when user has any of these permissions. */
  needsAny?: UiPermission[]
  /** Platform / Org / Office admin visibility (PRD §§4.1–4.3). */
  adminRoles?: Array<"platform_admin" | "dswd_admin" | "satellite_admin">
}

interface NavGroup {
  title: string
  icon: React.ReactNode
  items: NavLeaf[]
}

type NavEntry = NavLeaf | NavGroup

function isNavGroup(entry: NavEntry): entry is NavGroup {
  return "items" in entry
}

/** Admin console nav — Platform / Org / Office Admin only (not Evaluator/Approver). */
const NAV: NavEntry[] = [
  {
    title: "Organizations",
    url: "/admin/organizations",
    icon: <Building2Icon />,
    adminRoles: ["platform_admin"],
  },
  {
    title: "Overview",
    url: "/admin",
    icon: <LayoutDashboardIcon />,
    adminRoles: ["platform_admin", "dswd_admin", "satellite_admin"],
  },
  {
    title: "Applications",
    url: "/admin/applications",
    icon: <FolderOpenIcon />,
    // Org/Office oversight only — Platform Admin has no case PII (PRD 4.1 F)
    adminRoles: ["dswd_admin", "satellite_admin"],
  },
  {
    title: "Registrations",
    url: "/admin/registrations",
    icon: <UserPlusIcon />,
    adminRoles: ["dswd_admin", "satellite_admin"],
    needsAny: ["approve-accounts", "register-accounts"],
  },
  {
    title: "Templates",
    url: "/admin/templates",
    icon: <FileSlidersIcon />,
    adminRoles: ["dswd_admin", "satellite_admin"],
    needsAny: ["manage-templates", "customize-templates"],
  },
  {
    title: "Programs & Workflows",
    icon: <WorkflowIcon />,
    items: [
      {
        title: "Workflows",
        url: "/admin/workflows",
        icon: <WorkflowIcon />,
        adminRoles: ["dswd_admin"],
        needsAny: ["manage-templates"],
      },
      {
        title: "Programs",
        url: "/admin/programs",
        icon: <FolderKanbanIcon />,
        adminRoles: ["dswd_admin", "satellite_admin"],
        needsAny: ["manage-templates", "customize-templates"],
      },
    ],
  },
  {
    title: "Recommendations",
    url: "/admin/recommendations",
    icon: <MegaphoneIcon />,
    adminRoles: ["dswd_admin", "satellite_admin"],
    needsAny: ["submit-recommendations", "act-recommendations"],
  },
  {
    title: "Users",
    icon: <UsersIcon />,
    items: [
      {
        title: "RBAC",
        url: "/admin/rbac",
        icon: <ShieldCheckIcon />,
        adminRoles: ["platform_admin", "dswd_admin", "satellite_admin"],
        needsAny: ["manage-rbac", "manage-region-rbac"],
      },
      {
        title: "Accounts",
        url: "/admin/accounts",
        icon: <UsersIcon />,
        adminRoles: ["dswd_admin", "satellite_admin"],
        needsAny: ["approve-accounts", "register-accounts"],
      },
    ],
  },
  {
    title: "Audit Log",
    url: "/admin/audit",
    icon: <ScrollTextIcon />,
    adminRoles: ["dswd_admin"],
    needsAny: ["view-audit"],
  },
]

function isVisible(
  item: NavLeaf,
  can: (p: UiPermission) => boolean,
  role: string | undefined,
) {
  if (item.adminRoles && role && !item.adminRoles.includes(role as never)) {
    return false
  }
  return !item.needsAny || item.needsAny.some((p) => can(p))
}

function pathActive(pathname: string, url: string) {
  if (url === "/admin") return pathname === "/admin"
  return pathname === url || pathname.startsWith(`${url}/`)
}

/** Controlled collapsible — avoids Base UI warning when route changes `defaultOpen`. */
function AdminNavGroup({
  title,
  icon,
  items,
  pathname,
}: {
  title: string
  icon: React.ReactNode
  items: NavLeaf[]
  pathname: string
}) {
  const groupActive = items.some((item) => pathActive(pathname, item.url))
  const [open, setOpen] = React.useState(groupActive)

  React.useEffect(() => {
    if (groupActive) {
      const timer = window.setTimeout(() => setOpen(true), 0)
      return () => window.clearTimeout(timer)
    }
  }, [groupActive])

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      render={<SidebarMenuItem />}
    >
      <SidebarMenuButton isActive={groupActive}>
        {icon}
        <span>{title}</span>
      </SidebarMenuButton>
      <CollapsibleTrigger
        render={<SidebarMenuAction className="aria-expanded:rotate-90" />}
      >
        <ChevronRightIcon />
        <span className="sr-only">Toggle</span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <SidebarMenuSub>
          {items.map((item) => (
            <SidebarMenuSubItem key={item.url}>
              <SidebarMenuSubButton
                isActive={pathActive(pathname, item.url)}
                render={<Link href={item.url} />}
              >
                <span>{item.title}</span>
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>
          ))}
        </SidebarMenuSub>
      </CollapsibleContent>
    </Collapsible>
  )
}

export function AdminSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()
  const { can, profile, region, loading } = useAdminAccess()
  const role = profile?.role

  const visible: NavEntry[] = NAV.flatMap((entry): NavEntry[] => {
    if (!isNavGroup(entry)) {
      return isVisible(entry, can, role) ? [entry] : []
    }
    const items = entry.items.filter((item) => isVisible(item, can, role))
    return items.length > 0 ? [{ ...entry, items }] : []
  })

  const roleLabel = profile ? APP_ROLE_LABEL[profile.role] : "Staff"
  const initials = roleLabel
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)

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
                <span className="truncate text-xs">Admin Console</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarMenu>
            {loading ? (
              <SidebarMenuItem>
                <SidebarMenuButton disabled>
                  <span>Loading…</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ) : (
              visible.map((entry) => {
                if (!isNavGroup(entry)) {
                  return (
                    <SidebarMenuItem key={entry.url}>
                      <SidebarMenuButton
                        isActive={pathActive(pathname, entry.url)}
                        render={<Link href={entry.url} />}
                      >
                        {entry.icon}
                        <span>{entry.title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                }

                return (
                  <AdminNavGroup
                    key={entry.title}
                    title={entry.title}
                    icon={entry.icon}
                    items={entry.items}
                    pathname={pathname}
                  />
                )
              })
            )}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SignOutButton />
          </SidebarMenuItem>
          <SidebarMenuItem>
            <div className="flex items-center gap-2 rounded-lg p-2">
              <Avatar className="size-8 rounded-lg">
                <AvatarFallback className="rounded-lg bg-[#0040E7]/10 text-xs text-[#0040E7]">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="grid text-left text-sm leading-tight">
                <span className="truncate font-medium">
                  {profile?.fullName || roleLabel}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {roleLabel}
                  {region ? ` · ${region.code}` : ""}
                </span>
              </div>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
