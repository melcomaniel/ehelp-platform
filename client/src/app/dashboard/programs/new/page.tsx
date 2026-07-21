"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import {
  Field,
  NativeSelect,
  PageHeader,
  Textarea,
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
import { Label } from "@/components/ui/label"
import { stepsOf } from "@/lib/workflow/engine"
import { useWorkflow } from "@/lib/workflow/store"
import type { Classification } from "@/lib/workflow/types"
import { CLASSIFICATION_LABEL } from "@/lib/workflow/types"
import { ArrowLeftIcon } from "lucide-react"

export default function CreateProgramPage() {
  const { state, createProgram } = useWorkflow()
  const { toast } = usePrompts()
  const router = useRouter()

  const [name, setName] = React.useState("")
  const [description, setDescription] = React.useState("")
  const [classification, setClassification] = React.useState<Classification>("simple")
  const [templateId, setTemplateId] = React.useState("")

  const publishedWorkflows = state.templates.filter((t) => t.status === "published")
  const selected = publishedWorkflows.find((t) => t.id === templateId)

  const onCreate = () => {
    const result = createProgram({
      name,
      description,
      classification,
      templateId: templateId || null,
    })
    if (!result.ok) {
      toast({ title: "Could not create program", description: result.error, variant: "error" })
      return
    }
    toast({
      title: "Program created",
      description: selected
        ? `Steps copied from "${selected.name}" — customize, then publish.`
        : "Blank draft created — assemble its steps, then publish.",
      variant: "success",
    })
    router.push(`/dashboard/programs/${result.id}`)
  }

  return (
    <>
      <PageHeader title="Create Program" description="Name the program and assign a workflow">
        <Button size="sm" variant="ghost" render={<Link href="/dashboard/programs" />}>
          <ArrowLeftIcon /> Programs
        </Button>
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
            <CardDescription>
              Assigning a workflow deep-copies its steps — the program stays independent of later workflow edits
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <Field label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Financial Assistance" />
            <div className="grid gap-1.5">
              <Label>Description</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Classification (RA 11032 SLA tier)</Label>
              <NativeSelect value={classification} onChange={(e) => setClassification(e.target.value as Classification)}>
                {(Object.keys(CLASSIFICATION_LABEL) as Classification[]).map((c) => (
                  <option key={c} value={c}>
                    {CLASSIFICATION_LABEL[c]}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="grid gap-1.5">
              <Label>Workflow</Label>
              <NativeSelect value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
                <option value="">Start blank</option>
                {publishedWorkflows.map((t) => (
                  <option key={t.id} value={t.id}>
                    Assign workflow: {t.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <Button className="justify-self-start" disabled={!name.trim()} onClick={onCreate}>
              Create program
            </Button>
          </CardContent>
        </Card>

        <Card className="self-start">
          <CardHeader>
            <CardTitle>Workflow preview</CardTitle>
            <CardDescription>
              {selected ? "Steps that will be copied into this program" : "Pick a workflow to preview its steps"}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            {selected ? (
              stepsOf(state, selected.stepSetId).map((s, i) => (
                <div key={s.id} className="flex items-center gap-2 rounded-lg border px-2.5 py-1.5">
                  <span className="text-xs text-muted-foreground">{i + 1}.</span>
                  <span className="flex-1">{s.name}</span>
                  <span className="text-xs text-muted-foreground capitalize">{s.type}</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                Or start blank and build the steps yourself after creating the program.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
