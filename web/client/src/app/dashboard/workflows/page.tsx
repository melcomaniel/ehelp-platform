"use client"

import Link from "next/link"

import {
  DataTable,
  PageHeader,
  StatusPill,
  Td,
} from "@/components/workflow/bits"
import { usePrompts } from "@/components/workflow/prompts"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { stepsOf } from "@/lib/workflow/engine"
import { useWorkflow } from "@/lib/workflow/store"
import { ArchiveIcon, PencilRulerIcon, PlusIcon, UploadIcon } from "lucide-react"

export default function WorkflowsPage() {
  const { state, publishTemplate, archiveTemplate } = useWorkflow()
  const { toast, confirm } = usePrompts()

  const onPublish = (id: string, name: string) => {
    const result = publishTemplate(id)
    toast(
      result.ok
        ? { title: "Workflow published", description: `"${name}" can now be assigned to programs.`, variant: "success" }
        : { title: "Could not publish", description: result.error, variant: "error" }
    )
  }

  const onArchive = async (id: string, name: string) => {
    const ok = await confirm({
      title: `Archive "${name}"?`,
      description:
        "Archived workflows can no longer be assigned to new programs or edited. Programs already using it are not affected.",
      confirmLabel: "Archive",
      destructive: true,
    })
    if (!ok) return
    const result = archiveTemplate(id)
    toast(
      result.ok
        ? { title: "Workflow archived", variant: "success" }
        : { title: "Could not archive", description: result.error, variant: "error" }
    )
  }

  return (
    <>
      <PageHeader
        title="Workflows"
        description="Reusable step flows — assigning one to a program deep-copies its steps"
      >
        <Button size="sm" render={<Link href="/dashboard/workflows/new" />}>
          <PlusIcon /> Create Workflow
        </Button>
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle>All workflows</CardTitle>
          <CardDescription>
            Editing a workflow never affects programs already created from it
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            headers={["Name", "Description", "Steps", "Status", "Actions"]}
            empty={state.templates.length === 0}
            emptyText="No workflows yet — create one to get started."
          >
            {state.templates.map((t) => {
              const steps = stepsOf(state, t.stepSetId)
              return (
                <tr key={t.id} className="border-b last:border-0">
                  <Td className="font-medium">{t.name}</Td>
                  <Td className="max-w-72 text-xs text-muted-foreground">{t.description || "—"}</Td>
                  <Td className="text-xs text-muted-foreground">
                    {steps.length === 0 ? "—" : steps.map((s) => s.name).join(" → ")}
                  </Td>
                  <Td>
                    <StatusPill value={t.status} />
                  </Td>
                  <Td>
                    <div className="flex flex-wrap gap-1.5">
                      <Button
                        size="xs"
                        variant="outline"
                        render={<Link href={`/dashboard/workflows/${t.id}/builder`} />}
                      >
                        <PencilRulerIcon /> {t.status === "archived" ? "View" : "Builder"}
                      </Button>
                      {t.status === "draft" && (
                        <Button size="xs" variant="outline" onClick={() => onPublish(t.id, t.name)}>
                          <UploadIcon /> Publish
                        </Button>
                      )}
                      {t.status !== "archived" && (
                        <Button size="xs" variant="ghost" onClick={() => onArchive(t.id, t.name)}>
                          <ArchiveIcon /> Archive
                        </Button>
                      )}
                    </div>
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
