"use client"

import Link from "next/link"
import { useParams } from "next/navigation"

import {
  DataTable,
  EmptyState,
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
import { APPLICATION_STATUS_LABEL, CLASSIFICATION_LABEL } from "@/lib/workflow/types"
import { ArrowLeftIcon, GitBranchPlusIcon, PencilRulerIcon, UploadIcon } from "lucide-react"

export default function ProgramDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { state, publishVersion, createDraftFromPublished } = useWorkflow()
  const { toast, confirm } = usePrompts()

  const program = state.programs.find((p) => p.id === id)
  if (!program) {
    return <EmptyState title="Program not found" hint="It may have been removed." />
  }

  const versions = state.versions
    .filter((v) => v.programId === program.id)
    .sort((a, b) => b.versionNo - a.versionNo)
  const provenance = program.createdFromTemplateId
    ? state.templates.find((t) => t.id === program.createdFromTemplateId)
    : null
  const apps = state.applications.filter((a) => a.programId === program.id)

  const onPublish = async (versionId: string, versionNo: number) => {
    const ok = await confirm({
      title: `Publish version ${versionNo}?`,
      description:
        "Publishing freezes this version — its steps and fields can no longer be edited. New applications will use it; in-flight applications keep the version they started on.",
      confirmLabel: "Publish",
    })
    if (!ok) return
    const result = publishVersion(versionId)
    toast(
      result.ok
        ? { title: `Version ${versionNo} published`, description: "The program is open for applications.", variant: "success" }
        : { title: "Could not publish", description: result.error, variant: "error" }
    )
  }

  const onNewDraft = () => {
    const result = createDraftFromPublished(program.id)
    toast(
      result.ok
        ? { title: "Draft created", description: "The published steps were copied into a new editable draft.", variant: "success" }
        : { title: "Could not create draft", description: result.error, variant: "error" }
    )
  }

  return (
    <>
      <PageHeader title={program.name} description={program.description || "Program detail"}>
        <Button size="sm" variant="ghost" render={<Link href="/admin/programs" />}>
          <ArrowLeftIcon /> Programs
        </Button>
      </PageHeader>

      <div className="grid gap-4 text-sm sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Classification</CardDescription>
            <CardTitle className="text-sm">{CLASSIFICATION_LABEL[program.classification]}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Assigned workflow</CardDescription>
            <CardTitle className="text-sm">
              {provenance ? provenance.name : "Started blank"}
              {provenance && (
                <span className="block text-xs font-normal text-muted-foreground">
                  informational only — no live link
                </span>
              )}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Applications</CardDescription>
            <CardTitle className="text-sm tabular-nums">{apps.length}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Versions</CardTitle>
          <CardDescription>
            Publish freezes a version; editing published steps requires a new draft
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable headers={["Version", "Status", "Steps", "Published", "Actions"]} empty={versions.length === 0}>
            {versions.map((v) => {
              const steps = stepsOf(state, v.stepSetId)
              return (
                <tr key={v.id} className="border-b last:border-0">
                  <Td className="tabular-nums">v{v.versionNo}</Td>
                  <Td>
                    <StatusPill value={v.status} />
                  </Td>
                  <Td className="text-xs text-muted-foreground">
                    {steps.length === 0 ? "—" : steps.map((s) => s.name).join(" → ")}
                  </Td>
                  <Td className="text-xs text-muted-foreground">
                    {v.publishedAt ? new Date(v.publishedAt).toLocaleDateString() : "—"}
                  </Td>
                  <Td>
                    <div className="flex flex-wrap gap-1.5">
                      <Button
                        size="xs"
                        variant="outline"
                        render={<Link href={`/admin/programs/${program.id}/builder?version=${v.id}`} />}
                      >
                        <PencilRulerIcon /> {v.status === "draft" ? "Edit in builder" : "View"}
                      </Button>
                      {v.status === "draft" && (
                        <Button size="xs" variant="outline" onClick={() => onPublish(v.id, v.versionNo)}>
                          <UploadIcon /> Publish
                        </Button>
                      )}
                    </div>
                  </Td>
                </tr>
              )
            })}
          </DataTable>
          {versions.some((v) => v.status === "published") &&
            !versions.some((v) => v.status === "draft") && (
              <Button size="sm" variant="outline" className="mt-3" onClick={onNewDraft}>
                <GitBranchPlusIcon /> New draft from published
              </Button>
            )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Applications</CardTitle>
          <CardDescription>Each application stays pinned to the version it started on</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            headers={["ID", "Applicant", "Version", "Status", "Current step", "Updated"]}
            empty={apps.length === 0}
          >
            {apps.map((a) => {
              const applicant = state.users.find((u) => u.id === a.applicantId)
              const version = state.versions.find((v) => v.id === a.programVersionId)
              const step = a.currentStepId
                ? state.steps.find((s) => s.id === a.currentStepId)
                : null
              return (
                <tr key={a.id} className="border-b last:border-0">
                  <Td className="font-mono text-xs">{a.id}</Td>
                  <Td>{applicant?.name ?? a.applicantId}</Td>
                  <Td className="tabular-nums">v{version?.versionNo ?? "?"}</Td>
                  <Td>
                    <StatusPill value={APPLICATION_STATUS_LABEL[a.status]} />
                  </Td>
                  <Td className="text-xs text-muted-foreground">{step?.name ?? "—"}</Td>
                  <Td className="text-xs text-muted-foreground">
                    {new Date(a.updatedAt).toLocaleDateString()}
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
