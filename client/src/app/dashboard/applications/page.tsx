"use client"

import Link from "next/link"

import {
  DataTable,
  EmptyState,
  PageHeader,
  StatusPill,
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
import { APPLICATION_STATUS_LABEL } from "@/lib/workflow/types"
import { FolderOpenIcon } from "lucide-react"

export default function MyApplicationsPage() {
  const { state, actingUser, hasRole } = useWorkflow()

  if (!hasRole("applicant")) {
    return (
      <EmptyState
        title="Switch to an applicant to see their applications"
        hint="Use the user switcher at the bottom of the sidebar."
      />
    )
  }

  const mine = state.applications
    .filter((a) => a.applicantId === actingUser.id)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))

  return (
    <>
      <PageHeader
        title="My Applications"
        description={`Applications filed by ${actingUser.name}`}
      />
      <Card>
        <CardHeader>
          <CardTitle>Applications</CardTitle>
          <CardDescription>
            Returned applications can be fixed and resubmitted; rejected ones are final
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            headers={["ID", "Program", "Status", "Current step", "Updated", "Actions"]}
            empty={mine.length === 0}
            emptyText="No applications yet — start one from the Apply page."
          >
            {mine.map((a) => {
              const program = state.programs.find((p) => p.id === a.programId)
              const step = a.currentStepId
                ? state.steps.find((s) => s.id === a.currentStepId)
                : null
              return (
                <tr key={a.id} className="border-b last:border-0">
                  <Td className="font-mono text-xs">{a.id}</Td>
                  <Td>{program?.name ?? a.programId}</Td>
                  <Td>
                    <StatusPill value={APPLICATION_STATUS_LABEL[a.status]} />
                  </Td>
                  <Td className="text-xs text-muted-foreground">
                    {a.status === "submitted" ? step?.name ?? "—" : "—"}
                  </Td>
                  <Td className="text-xs text-muted-foreground">{timeAgo(a.updatedAt)}</Td>
                  <Td>
                    <Button size="xs" variant="outline" render={<Link href={`/dashboard/applications/${a.id}`} />}>
                      <FolderOpenIcon /> Open
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
