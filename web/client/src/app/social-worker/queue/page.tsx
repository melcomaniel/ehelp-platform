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
import { useFourPsQueue } from "@/app/social-worker/queue/shared"
import { GavelIcon } from "lucide-react"

export default function SocialWorkerQueue() {
  const { state, hasRole } = useWorkflow()
  const queue = useFourPsQueue()

  if (!hasRole("social_worker")) {
    return (
      <EmptyState
        title="Switch to the social worker to review 4Ps"
        hint="Grace Villanueva is the seeded social worker."
      />
    )
  }

  return (
    <>
      <PageHeader
        title="4Ps Review Queue"
        description="Applications waiting for your item-by-item review"
      />
      <Card>
        <CardHeader>
          <CardTitle>Waiting for review</CardTitle>
          <CardDescription>Open one to verify its inputs and documents</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            headers={["Applicant", "Application", "Step", "Waiting", "Actions"]}
            empty={queue.length === 0}
            emptyText="Queue is clear — nothing waiting for review."
          >
            {queue.map((a) => {
              const applicant = state.users.find((u) => u.id === a.applicantId)
              const step = state.steps.find((s) => s.id === a.currentStepId)
              return (
                <tr key={a.id} className="border-b last:border-0">
                  <Td className="font-medium">{applicant?.name ?? a.applicantId}</Td>
                  <Td className="font-mono text-xs">{a.id}</Td>
                  <Td className="text-xs text-muted-foreground">{step?.name ?? "—"}</Td>
                  <Td className="text-xs text-muted-foreground">{timeAgo(a.updatedAt)}</Td>
                  <Td>
                    <Button size="xs" variant="outline" render={<Link href={`/social-worker/queue/${a.id}`} />}>
                      <GavelIcon /> Review
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
