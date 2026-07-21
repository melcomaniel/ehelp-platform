"use client"

import * as React from "react"
import Link from "next/link"
import { useParams, useSearchParams } from "next/navigation"

import { EmptyState, PageHeader, StatusPill } from "@/components/workflow/bits"
import { StepSetBuilder } from "@/components/workflow/builder"
import { usePrompts } from "@/components/workflow/prompts"
import { Button } from "@/components/ui/button"
import { useWorkflow } from "@/lib/workflow/store"
import { ArrowLeftIcon, UploadIcon } from "lucide-react"

export default function ProgramBuilderPage() {
  return (
    <React.Suspense fallback={null}>
      <ProgramBuilder />
    </React.Suspense>
  )
}

function ProgramBuilder() {
  const { id } = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const { state, publishVersion } = useWorkflow()
  const { toast, confirm } = usePrompts()

  const program = state.programs.find((p) => p.id === id)
  if (!program) {
    return <EmptyState title="Program not found" hint="It may have been removed." />
  }

  const versions = state.versions
    .filter((v) => v.programId === program.id)
    .sort((a, b) => b.versionNo - a.versionNo)
  const requested = searchParams.get("version")
  const version =
    versions.find((v) => v.id === requested) ??
    versions.find((v) => v.status === "draft") ??
    versions[0]

  if (!version) {
    return (
      <EmptyState
        title="This program has no versions"
        hint="Create the program again or start a draft from the programs page."
      />
    )
  }

  const onPublish = async () => {
    const ok = await confirm({
      title: `Publish version ${version.versionNo}?`,
      description:
        "Publishing freezes this version — its steps and fields can no longer be edited. New applications will use it.",
      confirmLabel: "Publish",
    })
    if (!ok) return
    const result = publishVersion(version.id)
    toast(
      result.ok
        ? { title: `Version ${version.versionNo} published`, description: "The program is open for applications.", variant: "success" }
        : { title: "Could not publish", description: result.error, variant: "error" }
    )
  }

  return (
    <>
      <PageHeader
        title={`${program.name} — v${version.versionNo}`}
        description="Program builder — customizing this draft never touches the source workflow"
      >
        <div className="flex items-center gap-2">
          <StatusPill value={version.status} />
          {version.status === "draft" && (
            <Button size="sm" variant="outline" onClick={onPublish}>
              <UploadIcon /> Publish
            </Button>
          )}
          <Button size="sm" variant="ghost" render={<Link href={`/dashboard/programs/${program.id}`} />}>
            <ArrowLeftIcon /> Program
          </Button>
        </div>
      </PageHeader>

      <StepSetBuilder
        stepSetId={version.stepSetId}
        locked={version.status !== "draft"}
        lockNote={`Version ${version.versionNo} is ${version.status} and frozen — create a new draft from the program page to make changes.`}
      />
    </>
  )
}
