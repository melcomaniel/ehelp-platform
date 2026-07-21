"use client"

import * as React from "react"

import { NavMain } from "@/components/nav-main"
import { NavProjects } from "@/components/nav-projects"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import {
  LayoutDashboardIcon,
  SearchIcon,
  FolderOpenIcon,
  ShieldCheckIcon,
  WalletIcon,
  FileCheckIcon,
  MegaphoneIcon,
  LifeBuoyIcon,
  SendIcon,
  HandCoinsIcon,
  HardHatIcon,
  PlaneIcon,
} from "lucide-react"

const data = {
  user: {
    name: "Jorge Fuertes",
    email: "jorge.fuertes@whitecloak.com",
    avatar: "/egov/id-woman.png",
  },
  navMain: [
    {
      title: "Overview",
      url: "/dashboard",
      icon: <LayoutDashboardIcon />,
      isActive: true,
      items: [
        { title: "Dashboard", url: "/dashboard" },
        { title: "Activity", url: "#" },
        { title: "Notifications", url: "#" },
      ],
    },
    {
      title: "Program Discovery",
      url: "#",
      icon: <SearchIcon />,
      items: [
        { title: "Program Catalog", url: "#" },
        { title: "Eligibility Pre-check", url: "#" },
        { title: "Funding Status (Compass)", url: "#" },
      ],
    },
    {
      title: "Applications",
      url: "#",
      icon: <FolderOpenIcon />,
      items: [
        { title: "All Cases", url: "#" },
        { title: "Pending Agency Review", url: "#" },
        { title: "Approved", url: "#" },
        { title: "Rejected / Appeals", url: "#" },
      ],
    },
    {
      title: "Identity & Dedup",
      url: "#",
      icon: <ShieldCheckIcon />,
      items: [
        { title: "PhilSys Verifications", url: "#" },
        { title: "Duplicates Flagged", url: "#" },
        { title: "Face Liveness Sessions", url: "#" },
      ],
    },
    {
      title: "Disbursements",
      url: "#",
      icon: <WalletIcon />,
      items: [
        { title: "Payouts (eGovPay)", url: "#" },
        { title: "Settlements", url: "#" },
        { title: "Reconciliation", url: "#" },
      ],
    },
    {
      title: "Audit Trail",
      url: "#",
      icon: <FileCheckIcon />,
      items: [
        { title: "eGovChain Anchors", url: "#" },
        { title: "Approval Log", url: "#" },
      ],
    },
    {
      title: "Grievances",
      url: "#",
      icon: <MegaphoneIcon />,
      items: [
        { title: "Appeals (eReport)", url: "#" },
        { title: "Case Status Lookup", url: "#" },
      ],
    },
  ],
  navSecondary: [
    { title: "Support", url: "#", icon: <LifeBuoyIcon /> },
    { title: "Feedback", url: "#", icon: <SendIcon /> },
  ],
  projects: [
    { name: "DSWD · AICS / AKAP", url: "#", icon: <HandCoinsIcon /> },
    { name: "DOLE · TUPAD", url: "#", icon: <HardHatIcon /> },
    { name: "OWWA · OFW Cash Aid", url: "#", icon: <PlaneIcon /> },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<a href="/dashboard" />}>
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-[#0040E7] text-white">
                <HandCoinsIcon className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">Aid Front Door</span>
                <span className="truncate text-xs">Case Console</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavProjects projects={data.projects} />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  )
}
