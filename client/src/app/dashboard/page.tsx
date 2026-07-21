"use client"

import Link from "next/link"

import { PageHeader } from "@/components/workflow/bits"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useWorkflow } from "@/lib/workflow/store"

export default function DashboardOverviewPage() {
  const { state, hasRole, actingUser } = useWorkflow()

  const openPrograms = state.programs.filter((p) =>
    state.versions.some((v) => v.programId === p.id && v.status === "published")
  )
  const byStatus = (status: string) =>
    state.applications.filter((a) => a.status === status).length
  const waitingForMe = state.applications.filter((a) => {
    if (a.status !== "submitted" || !a.currentStepId) return false
    const step = state.steps.find((s) => s.id === a.currentStepId)
    return !!step?.assignedRole && actingUser.roles.includes(step.assignedRole)
  }).length
  const mine = state.applications.filter((a) => a.applicantId === actingUser.id).length

  const stats: { label: string; value: number; href?: string; show: boolean }[] = [
    { label: "Workflows", value: state.templates.filter((t) => t.status !== "archived").length, href: "/dashboard/workflows", show: hasRole("admin") },
    { label: "Open programs", value: openPrograms.length, href: hasRole("applicant") ? "/dashboard/apply" : "/dashboard/programs", show: true },
    { label: "Waiting for your decision", value: waitingForMe, href: "/dashboard/review", show: hasRole("reviewer") || hasRole("approver") },
    { label: "Your applications", value: mine, href: "/dashboard/applications", show: hasRole("applicant") },
    { label: "Submitted", value: byStatus("submitted"), show: hasRole("admin") },
    { label: "Returned", value: byStatus("returned"), show: hasRole("admin") },
    { label: "Approved", value: byStatus("approved"), show: hasRole("admin") },
    { label: "Rejected", value: byStatus("rejected"), show: hasRole("admin") },
  ]

  return (
    <>
      <PageHeader
        title="Workflow Engine"
        description={`Acting as ${actingUser.name}. Switch users from the sidebar to test other roles.`}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats
          .filter((s) => s.show)
          .map((s) => {
            const card = (
              <Card key={s.label} className="h-full transition-colors hover:bg-muted/40">
                <CardHeader>
                  <CardDescription>{s.label}</CardDescription>
                  <CardTitle className="text-3xl tabular-nums">{s.value}</CardTitle>
                </CardHeader>
              </Card>
            )
            return s.href ? (
              <Link key={s.label} href={s.href}>
                {card}
              </Link>
            ) : (
              card
            )
          })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Demo walkthrough</CardTitle>
          <CardDescription>The seeded data covers every path end to end</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm text-muted-foreground">
          <p>1. As <span className="font-medium text-foreground">Amara Santos (Admin)</span> — open Workflows to inspect the Standard Assistance Flow, or create a program and assign a workflow.</p>
          <p>2. As any <span className="font-medium text-foreground">applicant</span> — Apply to Financial Assistance, fill the form, submit. Or open the returned application (Jose Bautista) and resubmit.</p>
          <p>3. As <span className="font-medium text-foreground">Rosa Dizon (Reviewer)</span> — the queue holds seeded submissions: approve, return with a reason, or reject.</p>
          <p>4. As <span className="font-medium text-foreground">Diego Ramos (Approver)</span> — decide the applications the reviewer endorsed.</p>
        </CardContent>
      </Card>
    </>
  )
}
