"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"

const CRUMB: { prefix: string; label: string }[] = [
  { prefix: "/admin/workflows/new", label: "Create Workflow" },
  { prefix: "/admin/workflows", label: "Workflows" },
  { prefix: "/admin/programs/new", label: "Create Program" },
  { prefix: "/admin/programs", label: "Programs" },
  { prefix: "/dashboard/apply", label: "Apply" },
  { prefix: "/dashboard/applications", label: "My Applications" },
  { prefix: "/dashboard/review", label: "Review Queue" },
  { prefix: "/dashboard", label: "Overview" },
]

export function DashboardHeader() {
  const pathname = usePathname()
  const current = CRUMB.find((c) => pathname.startsWith(c.prefix))?.label ?? "Overview"

  return (
    <header className="flex h-16 shrink-0 items-center gap-2">
      <div className="flex items-center gap-2 px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 data-vertical:h-4 data-vertical:self-auto" />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem className="hidden md:block">
              <BreadcrumbLink render={<Link href="/dashboard" />}>Workflow Engine</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="hidden md:block" />
            <BreadcrumbItem>
              <BreadcrumbPage>{current}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>
    </header>
  )
}
