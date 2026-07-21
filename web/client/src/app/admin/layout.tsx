"use client"

import { usePathname } from "next/navigation"

import { AdminAccessProvider } from "@/lib/admin/access-provider"
import { EhelpProvider } from "@/lib/ehelp/store"
import { AdminSidebar } from "@/components/ehelp/admin-sidebar"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"

const SECTION_TITLE: Record<string, string> = {
  "/admin": "Overview",
  "/admin/applications": "Applications",
  "/admin/registrations": "Registrations",
  "/admin/templates": "Templates",
  "/admin/recommendations": "Recommendations",
  "/admin/accounts": "Internal Accounts",
  "/admin/rbac": "RBAC",
  "/admin/audit": "Audit Log",
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  return (
    <AdminAccessProvider>
      <EhelpProvider>
        <SidebarProvider>
          <AdminSidebar />
          <SidebarInset>
            <header className="flex h-16 shrink-0 items-center gap-2">
              <div className="flex items-center gap-2 px-4">
                <SidebarTrigger className="-ml-1" />
                <Separator
                  orientation="vertical"
                  className="mr-2 data-vertical:h-4 data-vertical:self-auto"
                />
                <Breadcrumb>
                  <BreadcrumbList>
                    <BreadcrumbItem className="hidden md:block">
                      <BreadcrumbLink href="/admin">
                        EHELP Console
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator className="hidden md:block" />
                    <BreadcrumbItem>
                      <BreadcrumbPage>
                        {SECTION_TITLE[pathname] ?? "Overview"}
                      </BreadcrumbPage>
                    </BreadcrumbItem>
                  </BreadcrumbList>
                </Breadcrumb>
              </div>
            </header>
            <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
              {children}
            </div>
          </SidebarInset>
        </SidebarProvider>
      </EhelpProvider>
    </AdminAccessProvider>
  )
}
