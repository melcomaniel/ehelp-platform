"use client"

import Link from "next/link"
import { useParams } from "next/navigation"

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
import {
  applicationsOfProgram,
  isActionableByReviewer,
} from "@/app/social-worker/applications/shared"
import { ArrowLeftIcon, EyeIcon, GavelIcon } from "lucide-react"

export default function ProgramApplicants() {
  const { programId } = useParams<{ programId: string }>()
  const { state, actingUser, hasRole } = useWorkflow()

  if (!hasRole("social_worker")) {
    return <EmptyState title="Switch to the social worker" hint="Grace Villanueva is the seeded social worker." />
  }

  const program = state.programs.find((p) => p.id === programId)
  if (!program) return <EmptyState title="Program not found" hint="It may have been removed." />

  const apps = applicationsOfProgram(state, program.id)

  return (
    <>
      <PageHeader title={program.name} description="All applicants — open one to review their submission">
        <Button size="sm" variant="ghost" render={<Link href="/social-worker/applications" />}>
          <ArrowLeftIcon /> Programs
        </Button>
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle>Applicants</CardTitle>
          <CardDescription>Applications at your review step are actionable; others show progress</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            headers={["Applicant", "Application", "Status", "Current step", "Updated", "Actions"]}
            empty={apps.length === 0}
            emptyText="No applications in this program yet."
          >
            {apps.map((a) => {
              const applicant = state.users.find((u) => u.id === a.applicantId)
              const step = a.currentStepId ? state.steps.find((s) => s.id === a.currentStepId) : null
              const actionable = isActionableByReviewer(state, a, actingUser.roles)
              return (
                <tr key={a.id} className="border-b last:border-0">
                  <Td className="font-medium">{applicant?.name ?? a.applicantId}</Td>
                  <Td className="font-mono text-xs">{a.id}</Td>
                  <Td>
                    <StatusPill value={APPLICATION_STATUS_LABEL[a.status]} />
                  </Td>
                  <Td className="text-xs text-muted-foreground">{step?.name ?? "—"}</Td>
                  <Td className="text-xs text-muted-foreground">{timeAgo(a.updatedAt)}</Td>
                  <Td>
                    <Button
                      size="xs"
                      variant={actionable ? "outline" : "ghost"}
                      render={<Link href={`/social-worker/applications/${program.id}/${a.id}`} />}
                    >
                      {actionable ? <><GavelIcon /> Review</> : <><EyeIcon /> View</>}
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
