"use client";

import { usePathname } from "next/navigation";

import { AdminAccessProvider } from "@/lib/admin/access-provider";
import { EhelpProvider } from "@/lib/ehelp/store";
import { AdminSidebar } from "@/components/ehelp/admin-sidebar";
import { PromptsProvider } from "@/components/workflow/prompts";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { WorkflowProvider } from "@/lib/workflow/store";

const SECTION_TITLE: { prefix: string; label: string }[] = [
  { prefix: "/admin/organizations/new", label: "Create Organization" },
  { prefix: "/admin/organizations", label: "Organizations" },
  { prefix: "/admin/offices/new", label: "Create Office" },
  { prefix: "/admin/offices", label: "Offices" },
  { prefix: "/admin/workflows/new", label: "Create Workflow" },
  { prefix: "/admin/workflows", label: "Workflows" },
  { prefix: "/admin/programs/new", label: "Create Program" },
  { prefix: "/admin/programs", label: "Programs" },
  { prefix: "/admin/applications", label: "Applications" },
  { prefix: "/admin/registrations", label: "Registrations" },
  { prefix: "/admin/templates", label: "Templates" },
  { prefix: "/admin/recommendations", label: "Recommendations" },
  { prefix: "/admin/accounts", label: "Internal Accounts" },
  { prefix: "/admin/rbac", label: "RBAC" },
  { prefix: "/admin/audit", label: "Audit Log" },
  { prefix: "/admin", label: "Overview" },
];

function sectionTitle(pathname: string) {
  return (
    SECTION_TITLE.find(
      (s) => pathname === s.prefix || pathname.startsWith(`${s.prefix}/`),
    )?.label ?? "Overview"
  );
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <AdminAccessProvider>
      <EhelpProvider>
        <WorkflowProvider>
          <PromptsProvider>
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
                            {sectionTitle(pathname)}
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
          </PromptsProvider>
        </WorkflowProvider>
      </EhelpProvider>
    </AdminAccessProvider>
  );
}
