"use client"

import { useRouter } from "next/navigation"

import { EmptyState, PageHeader } from "@/components/workflow/bits"
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
import { CLASSIFICATION_LABEL } from "@/lib/workflow/types"
import { SendIcon } from "lucide-react"

export default function ApplyPage() {
  const { state, startApplication, hasRole } = useWorkflow()
  const { toast } = usePrompts()
  const router = useRouter()

  const open = state.programs
    .map((program) => ({
      program,
      version: state.versions.find(
        (v) => v.programId === program.id && v.status === "published"
      ),
    }))
    .filter((x) => !!x.version)

  const onStart = (programId: string, programName: string) => {
    const result = startApplication(programId)
    if (!result.ok) {
      toast({ title: "Could not start application", description: result.error, variant: "error" })
      return
    }
    toast({ title: "Application started", description: `Fill in the ${programName} form and submit.`, variant: "success" })
    router.push(`/dashboard/applications/${result.id}`)
  }

  if (!hasRole("applicant")) {
    return (
      <EmptyState
        title="Switch to an applicant to apply"
        hint="Use the user switcher at the bottom of the sidebar — any of the seeded applicants works."
      />
    )
  }

  return (
    <>
      <PageHeader title="Apply" description="Programs currently accepting applications" />
      {open.length === 0 ? (
        <EmptyState
          title="No programs are open right now"
          hint="An admin needs to publish a program version first."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {open.map(({ program, version }) => (
            <Card key={program.id}>
              <CardHeader>
                <CardTitle>{program.name}</CardTitle>
                <CardDescription>{program.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <p className="text-xs text-muted-foreground">
                  {CLASSIFICATION_LABEL[program.classification]}
                </p>
                <p className="text-xs text-muted-foreground">
                  Steps: {stepsOf(state, version!.stepSetId).map((s) => s.name).join(" → ")}
                </p>
                <Button size="sm" className="self-start" onClick={() => onStart(program.id, program.name)}>
                  <SendIcon /> Start application
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  )
}
