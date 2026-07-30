"use client"

import * as React from "react"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"
import { ChevronRightIcon } from "lucide-react"

type NavItem = {
  title: string
  url: string
  icon: React.ReactNode
  isActive?: boolean
  items?: {
    title: string
    url: string
  }[]
}

function NavCollapsibleItem({ item }: { item: NavItem }) {
  const [open, setOpen] = React.useState(Boolean(item.isActive))

  React.useEffect(() => {
    if (!item.isActive) return
    const timer = window.setTimeout(() => setOpen(true), 0)
    return () => window.clearTimeout(timer)
  }, [item.isActive])

  return (
    <Collapsible open={open} onOpenChange={setOpen} render={<SidebarMenuItem />}>
      <SidebarMenuButton tooltip={item.title} render={<a href={item.url} />}>
        {item.icon}
        <span>{item.title}</span>
      </SidebarMenuButton>
      {item.items?.length ? (
        <>
          <CollapsibleTrigger
            render={<SidebarMenuAction className="aria-expanded:rotate-90" />}
          >
            <ChevronRightIcon />
            <span className="sr-only">Toggle</span>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <SidebarMenuSub>
              {item.items.map((subItem) => (
                <SidebarMenuSubItem key={subItem.title}>
                  <SidebarMenuSubButton render={<a href={subItem.url} />}>
                    <span>{subItem.title}</span>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              ))}
            </SidebarMenuSub>
          </CollapsibleContent>
        </>
      ) : null}
    </Collapsible>
  )
}

export function NavMain({ items }: { items: NavItem[] }) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>Aid Orchestration</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => (
          <NavCollapsibleItem key={item.title} item={item} />
        ))}
      </SidebarMenu>
    </SidebarGroup>
  )
}
