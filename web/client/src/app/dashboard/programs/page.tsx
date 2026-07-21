"use client"

import Link from "next/link"

import {
  DataTable,
  PageHeader,
  StatusPill,
  Td,
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
import { FolderOpenIcon, PlusIcon } from "lucide-react"

export default function ProgramsPage() {
  const { state } = useWorkflow()

  return (
    <>
      <PageHeader
        title="Programs"
        description="A program owns its steps — copied from a workflow or built from scratch — and publishes immutable versions"
      >
        <Button size="sm" render={<Link href="/dashboard/programs/new" />}>
          <PlusIcon /> Create Program
        </Button>
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle>All programs</CardTitle>
          <CardDescription>Applications always run against a published version</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            headers={["Name", "Classification", "Workflow", "Latest version", "Applications", "Actions"]}
            empty={state.programs.length === 0}
            emptyText="No programs yet — create one to get started."
          >
            {state.programs.map((p) => {
              const versions = state.versions
                .filter((v) => v.programId === p.id)
                .sort((a, b) => b.versionNo - a.versionNo)
              const latest = versions[0]
              const provenance = p.createdFromTemplateId
                ? state.templates.find((t) => t.id === p.createdFromTemplateId)?.name ?? "—"
                : "started blank"
              const apps = state.applications.filter((a) => a.programId === p.id).length
              return (
                <tr key={p.id} className="border-b last:border-0">
                  <Td className="font-medium">{p.name}</Td>
                  <Td className="text-xs text-muted-foreground capitalize">
                    {p.classification.replace("_", " ")}
                  </Td>
                  <Td className="text-xs text-muted-foreground">{provenance}</Td>
                  <Td>
                    {latest ? (
                      <span className="flex items-center gap-1.5">
                        <span className="text-xs tabular-nums">v{latest.versionNo}</span>
                        <StatusPill value={latest.status} />
                      </span>
                    ) : (
                      "—"
                    )}
                  </Td>
                  <Td className="tabular-nums">{apps}</Td>
                  <Td>
                    <Button size="xs" variant="outline" render={<Link href={`/dashboard/programs/${p.id}`} />}>
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
