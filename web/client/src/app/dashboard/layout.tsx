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
          <SidebarInset id="main-content" tabIndex={-1}>
            <DashboardHeader />
            <div className="app-content">{children}</div>
          </SidebarInset>
        </SidebarProvider>
      </PromptsProvider>
    </WorkflowProvider>
  )
}
