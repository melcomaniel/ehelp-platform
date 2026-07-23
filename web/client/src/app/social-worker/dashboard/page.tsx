"use client"

import Link from "next/link"

import { EmptyState, PageHeader } from "@/components/workflow/bits"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useWorkflow } from "@/lib/workflow/store"
import {
  applicationsOfProgram,
  isActionableByReviewer,
  useReviewablePrograms,
} from "@/app/social-worker/applications/shared"

export default function SocialWorkerDashboard() {
  const { state, actingUser, hasRole } = useWorkflow()
  const programs = useReviewablePrograms()

  if (!hasRole("social_worker")) {
    return (
      <EmptyState
        title="Switch to the social worker to review applications"
        hint="Use the user switcher at the bottom of the sidebar — Grace Villanueva is the seeded social worker."
      />
    )
  }

  const allApps = programs.flatMap((p) => applicationsOfProgram(state, p.id))
  const toReview = allApps.filter((a) => isActionableByReviewer(state, a, actingUser.roles)).length
  const count = (s: string) => allApps.filter((a) => a.status === s).length

  const stats = [
    { label: "To review", value: toReview, href: "/social-worker/applications" },
    { label: "Awaiting identity", value: count("verifying") },
    { label: "Approved (to disburse)", value: count("approved") },
    { label: "Disbursed", value: count("disbursed") },
  ]

  return (
    <>
      <PageHeader
        title="Evaluator"
        description={`Acting as ${actingUser.name}. Open a program, pick an applicant, verify each item, then approve.`}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => {
          const card = (
            <Card className="h-full transition-colors hover:bg-muted/40">
              <CardHeader>
                <CardDescription>{s.label}</CardDescription>
                <CardTitle className="text-3xl tabular-nums">{s.value}</CardTitle>
              </CardHeader>
            </Card>
          )
          return s.href ? (
            <Link key={s.label} href={s.href}>{card}</Link>
          ) : (
            <div key={s.label}>{card}</div>
          )
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>How the review works</CardTitle>
          <CardDescription>The demo flow, step by step</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm text-muted-foreground">
          <p>1. Open <Link href="/social-worker/applications" className="font-medium text-foreground underline">Applications</Link> and pick a program (e.g. 4Ps).</p>
          <p>2. See all applicants in that program; open a specific one.</p>
          <p>3. At their Review step, every input and uploaded document is a checklist item.</p>
          <p>4. Verify each item one by one — the progress bar fills toward 100%.</p>
          <p>5. At 100%, <span className="font-medium text-foreground">Approve</span> unlocks and sends the application to Disbursement.</p>
          <p>6. Anytime, you can Return (for compliance) or Reject with a reason.</p>
        </CardContent>
      </Card>
    </>
  )
}
