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
          <SidebarInset>
            <header className="flex h-16 shrink-0 items-center gap-2">
              <div className="flex items-center gap-2 px-4">
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
            <div className="flex flex-1 flex-col gap-4 p-4 pt-0">{children}</div>
          </SidebarInset>
        </SidebarProvider>
      </PromptsProvider>
    </WorkflowProvider>
  )
}
