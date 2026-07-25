"use client"

import Link from "next/link"
import { useParams } from "next/navigation"

import { EmptyState, PageHeader, StatusPill } from "@/components/workflow/bits"
import { StepSetBuilder } from "@/components/workflow/builder"
import { usePrompts } from "@/components/workflow/prompts"
import { Button } from "@/components/ui/button"
import { useWorkflow } from "@/lib/workflow/store"
import { ArrowLeftIcon, UploadIcon } from "lucide-react"

export default function WorkflowBuilderPage() {
  const { id } = useParams<{ id: string }>()
  const { state, publishTemplate } = useWorkflow()
  const { toast } = usePrompts()

  const template = state.templates.find((t) => t.id === id)
  if (!template) {
    return (
      <EmptyState
        title="Workflow not found"
        hint="It may have been removed. Head back to the workflows list."
      />
    )
  }

  const onPublish = () => {
    const result = publishTemplate(template.id)
    toast(
      result.ok
        ? { title: "Workflow published", description: "It can now be assigned to programs.", variant: "success" }
        : { title: "Could not publish", description: result.error, variant: "error" }
    )
  }

  return (
    <>
      <PageHeader title={template.name} description={template.description || "Workflow builder"}>
        <div className="flex items-center gap-2">
          <StatusPill value={template.status} />
          {template.status === "draft" && (
            <Button size="sm" variant="outline" onClick={onPublish}>
              <UploadIcon /> Publish
            </Button>
          )}
          <Button size="sm" variant="ghost" render={<Link href="/admin/workflows" />}>
            <ArrowLeftIcon /> Workflows
          </Button>
        </div>
      </PageHeader>

      <StepSetBuilder
        stepSetId={template.stepSetId}
        locked={template.status === "archived"}
        lockNote="This workflow is archived and read-only."
      />
    </>
  )
}
