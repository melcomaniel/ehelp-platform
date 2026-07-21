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
import { FOURPS_PROGRAM_ID, useFourPsQueue } from "@/app/social-worker/queue/shared"

export default function SocialWorkerDashboard() {
  const { state, actingUser, hasRole } = useWorkflow()

  const queue = useFourPsQueue()

  if (!hasRole("social_worker")) {
    return (
      <EmptyState
        title="Switch to the social worker to review 4Ps"
        hint="Use the user switcher at the bottom of the sidebar — Grace Villanueva is the seeded social worker."
      />
    )
  }

  const fourPs = state.applications.filter((a) => a.programId === FOURPS_PROGRAM_ID)
  const count = (s: string) => fourPs.filter((a) => a.status === s).length
  const atVerify = fourPs.filter((a) => a.status === "verifying").length

  const stats = [
    { label: "Waiting for your review", value: queue.length, href: "/social-worker/queue" },
    { label: "Awaiting identity", value: atVerify },
    { label: "Approved (to disburse)", value: count("approved") },
    { label: "Disbursed", value: count("disbursed") },
  ]

  return (
    <>
      <PageHeader
        title="4Ps Case Review"
        description={`Acting as ${actingUser.name}. Review each application's inputs and documents, verify every item, then approve.`}
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
            <Link key={s.label} href={s.href}>
              {card}
            </Link>
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
          <p>1. Open the <Link href="/social-worker/queue" className="font-medium text-foreground underline">4Ps Review Queue</Link> and pick an applicant.</p>
          <p>2. You land on their Review step — every input and uploaded document is a checklist item.</p>
          <p>3. Verify each item one by one. The progress bar fills toward 100%.</p>
          <p>4. At 100%, <span className="font-medium text-foreground">Approve</span> unlocks. Approve sends the application to Disbursement.</p>
          <p>5. Anytime, you can Return (for compliance) or Reject with a reason.</p>
        </CardContent>
      </Card>
    </>
  )
}
