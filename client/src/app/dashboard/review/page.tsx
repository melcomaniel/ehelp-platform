"use client"

import Link from "next/link"

import {
  DataTable,
  EmptyState,
  PageHeader,
  Td,
  timeAgo,
} from "@/components/workflow/bits"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useWorkflow } from "@/lib/workflow/store"
import { GavelIcon } from "lucide-react"

export default function ReviewQueuePage() {
  const { state, actingUser, hasRole } = useWorkflow()

  if (!hasRole("reviewer") && !hasRole("approver") && !hasRole("admin")) {
    return (
      <EmptyState
        title="Switch to a reviewer, approver, or admin to see the queue"
        hint="Rosa Dizon (Reviewer), Diego Ramos (Approver), and Amara Santos (Admin) are seeded."
      />
    )
  }

  const queue = state.applications
    .filter((a) => {
      // decision steps (submitted) and disbursement steps (approved, awaiting release)
      const waiting = a.status === "submitted" || a.status === "approved"
      if (!waiting || !a.currentStepId) return false
      const step = state.steps.find((s) => s.id === a.currentStepId)
      return !!step?.assignedRole && actingUser.roles.includes(step.assignedRole)
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))

  return (
    <>
      <PageHeader
        title="Review Queue"
        description={`Applications waiting at steps assigned to ${actingUser.roles.join(" / ")}`}
      />
      <Card>
        <CardHeader>
          <CardTitle>Waiting for your decision</CardTitle>
          <CardDescription>
            Approve to advance, return for compliance, or reject with a reason
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            headers={["ID", "Applicant", "Program", "Step", "Waiting", "Actions"]}
            empty={queue.length === 0}
            emptyText="Queue is clear — nothing waiting at your steps."
          >
            {queue.map((a) => {
              const applicant = state.users.find((u) => u.id === a.applicantId)
              const program = state.programs.find((p) => p.id === a.programId)
              const step = state.steps.find((s) => s.id === a.currentStepId)
              return (
                <tr key={a.id} className="border-b last:border-0">
                  <Td className="font-mono text-xs">{a.id}</Td>
                  <Td>{applicant?.name ?? a.applicantId}</Td>
                  <Td className="text-muted-foreground">{program?.name ?? a.programId}</Td>
                  <Td className="text-xs text-muted-foreground">{step?.name ?? "—"}</Td>
                  <Td className="text-xs text-muted-foreground">{timeAgo(a.updatedAt)}</Td>
                  <Td>
                    <Button size="xs" variant="outline" render={<Link href={`/dashboard/review/${a.id}`} />}>
                      <GavelIcon /> Decide
                    </Button>
                  </Td>
                </tr>
              )
            })}
          </DataTable>
        </CardContent>
      </Card>
    </>
  )
}
