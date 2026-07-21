"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"

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
import { ROLE_LABEL } from "@/lib/workflow/types"
import {
  ChevronsUpDownIcon,
  GaugeIcon,
  HandHeartIcon,
  InboxIcon,
  RotateCcwIcon,
} from "lucide-react"

export function SocialWorkerSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()
  const { state, actingUser, setActingUser, resetAll } = useWorkflow()
  const { confirm, toast } = usePrompts()

  const links = [
    { href: "/social-worker/dashboard", label: "Dashboard", icon: GaugeIcon },
    { href: "/social-worker/queue", label: "4Ps Review Queue", icon: InboxIcon },
  ]
  const isActive = (url: string) => pathname === url || pathname.startsWith(url + "/")

  const onReset = async () => {
    const ok = await confirm({
      title: "Reset demo data?",
      description: "All changes made while testing will be discarded and the seeded fixtures restored.",
      confirmLabel: "Reset data",
      destructive: true,
    })
    if (!ok) return
    resetAll()
    toast({ title: "Demo data reset", variant: "success" })
  }

  const initials = (actingUser?.name ?? "?").split(" ").map((w) => w[0]).join("").slice(0, 2)

  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/social-worker/dashboard" />}>
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-[#0040E7] text-white">
                <HandHeartIcon className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">Social Worker</span>
                <span className="truncate text-xs">4Ps Case Review</span>
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
            <button
              onClick={onReset}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <RotateCcwIcon className="size-4" /> Reset demo data
            </button>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger render={<SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent" />}>
                <Avatar className="size-8 rounded-lg">
                  <AvatarFallback className="rounded-lg bg-[#0040E7]/10 text-xs text-[#0040E7]">{initials}</AvatarFallback>
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
