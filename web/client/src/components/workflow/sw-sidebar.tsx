"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { SignOutButton } from "@/components/auth/sign-out-button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { ROLE_LABEL } from "@/lib/workflow/types"
import {
  ChevronsUpDownIcon,
  FolderKanbanIcon,
  GaugeIcon,
} from "lucide-react"

export function SocialWorkerSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()
  const { state, actingUser, setActingUser } = useWorkflow()

  const links = [
    { href: "/social-worker/dashboard", label: "Dashboard", icon: GaugeIcon },
    { href: "/social-worker/applications", label: "Applications", icon: FolderKanbanIcon },
  ]
  const isActive = (url: string) => pathname === url || pathname.startsWith(url + "/")

  const initials = (actingUser?.name ?? "?").split(" ").map((w) => w[0]).join("").slice(0, 2)

  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/social-worker/dashboard" />}>
              <div className="flex aspect-square size-9 items-center justify-center rounded-lg bg-white shadow-sm ring-1 ring-border">
                <Image
                  src="/brand/heart-egov.png"
                  alt=""
                  width={72}
                  height={58}
                  className="size-5 object-contain"
                />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">Social Worker</span>
                <span className="truncate text-xs text-muted-foreground">
                  Evaluator
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Casework</SidebarGroupLabel>
          <SidebarMenu>
            {links.map((l) => {
              const Icon = l.icon
              return (
                <SidebarMenuItem key={l.href}>
                  <SidebarMenuButton isActive={isActive(l.href)} render={<Link href={l.href} />}>
                    <Icon />
                    <span>{l.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SignOutButton />
          </SidebarMenuItem>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger render={<SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent" />}>
                <Avatar className="size-8 rounded-lg">
                  <AvatarFallback className="rounded-lg bg-primary/10 text-xs font-semibold text-primary">{initials}</AvatarFallback>
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
                <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">Switch acting user</div>
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
