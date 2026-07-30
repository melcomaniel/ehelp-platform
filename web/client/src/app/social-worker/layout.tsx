"use client"

import Link from "next/link"

import { PromptsProvider } from "@/components/workflow/prompts"
import { SocialWorkerSidebar } from "@/components/workflow/sw-sidebar"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { WorkflowProvider } from "@/lib/workflow/store"

export default function SocialWorkerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <WorkflowProvider>
      <PromptsProvider>
        <SidebarProvider>
          <SocialWorkerSidebar />
          <SidebarInset id="main-content" tabIndex={-1}>
            <header className="app-shell-header">
              <div className="flex min-w-0 items-center gap-2">
                <SidebarTrigger className="-ml-1" />
                <Separator orientation="vertical" className="mr-2 data-vertical:h-4 data-vertical:self-auto" />
                <Breadcrumb>
                  <BreadcrumbList>
                    <BreadcrumbItem>
                      <BreadcrumbPage>
                        <Link href="/social-worker/dashboard">4Ps Case Review</Link>
                      </BreadcrumbPage>
                    </BreadcrumbItem>
                  </BreadcrumbList>
                </Breadcrumb>
              </div>
            </header>
            <div className="app-content">{children}</div>
          </SidebarInset>
        </SidebarProvider>
      </PromptsProvider>
    </WorkflowProvider>
  )
}
