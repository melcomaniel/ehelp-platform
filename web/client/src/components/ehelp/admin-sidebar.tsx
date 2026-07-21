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
} from "lucide-react"

interface NavLeaf {
  title: string
  url: string
  icon: React.ReactNode
  needsAny?: UiPermission[]
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

const NAV: NavEntry[] = [
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
    title: "Users",
    icon: <UsersIcon />,
    items: [
      {
        title: "RBAC",
        url: "/admin/rbac",
        icon: <ShieldCheckIcon />,
        needsAny: ["manage-rbac", "manage-region-rbac"],
      },
      {
        title: "Users",
        url: "/admin/accounts",
        icon: <UsersIcon />,
        needsAny: ["approve-accounts", "register-accounts"],
      },
    ],
  },
  {
    title: "Audit Log",
    url: "/admin/audit",
    icon: <ScrollTextIcon />,
    needsAny: ["view-audit"],
  },
]

function isVisible(
  item: NavLeaf,
  can: (p: UiPermission) => boolean,
) {
  return !item.needsAny || item.needsAny.some((p) => can(p))
}

export function AdminSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()
  const { can, profile, region, loading } = useAdminAccess()

  const visible: NavEntry[] = NAV.flatMap((entry): NavEntry[] => {
    if (!isNavGroup(entry)) {
      return isVisible(entry, can) ? [entry] : []
    }
    const items = entry.items.filter((item) => isVisible(item, can))
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
                        isActive={pathname === entry.url}
                        render={<Link href={entry.url} />}
                      >
                        {entry.icon}
                        <span>{entry.title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                }

                const groupActive = entry.items.some(
                  (item) => pathname === item.url,
                )

                return (
                  <Collapsible
                    key={entry.title}
                    defaultOpen={groupActive}
                    render={<SidebarMenuItem />}
                  >
                    <SidebarMenuButton isActive={groupActive}>
                      {entry.icon}
                      <span>{entry.title}</span>
                    </SidebarMenuButton>
                    <CollapsibleTrigger
                      render={
                        <SidebarMenuAction className="aria-expanded:rotate-90" />
                      }
                    >
                      <ChevronRightIcon />
                      <span className="sr-only">Toggle</span>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {entry.items.map((item) => (
                          <SidebarMenuSubItem key={item.url}>
                            <SidebarMenuSubButton
                              isActive={pathname === item.url}
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
