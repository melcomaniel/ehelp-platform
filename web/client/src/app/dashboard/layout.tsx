"use client"

import { DashboardHeader } from "@/components/workflow/dashboard-header"
import { PromptsProvider } from "@/components/workflow/prompts"
import { WorkflowSidebar } from "@/components/workflow/sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { WorkflowProvider } from "@/lib/workflow/store"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <WorkflowProvider>
      <PromptsProvider>
        <SidebarProvider>
          <WorkflowSidebar />
          <SidebarInset>
            <DashboardHeader />
            <div className="flex flex-1 flex-col gap-4 p-4 pt-0">{children}</div>
          </SidebarInset>
        </SidebarProvider>
      </PromptsProvider>
    </WorkflowProvider>
  )
}
