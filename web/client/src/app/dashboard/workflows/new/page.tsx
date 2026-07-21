"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { Field, PageHeader, Textarea } from "@/components/workflow/bits"
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
import { useWorkflow } from "@/lib/workflow/store"
import { ArrowLeftIcon } from "lucide-react"

export default function CreateWorkflowPage() {
  const { createTemplate } = useWorkflow()
  const { toast } = usePrompts()
  const router = useRouter()

  const [name, setName] = React.useState("")
  const [description, setDescription] = React.useState("")

  const onCreate = () => {
    const result = createTemplate(name, description)
    if (!result.ok) {
      toast({ title: "Could not create workflow", description: result.error, variant: "error" })
      return
    }
    toast({ title: "Workflow created", description: "Opening the builder…", variant: "success" })
    router.push(`/dashboard/workflows/${result.id}/builder`)
  }

  return (
    <>
      <PageHeader title="Create Workflow" description="Name it, then assemble its steps in the builder">
        <Button size="sm" variant="ghost" render={<Link href="/dashboard/workflows" />}>
          <ArrowLeftIcon /> Workflows
        </Button>
      </PageHeader>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Details</CardTitle>
          <CardDescription>A workflow is a reusable step flow you can assign to any program</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Field
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Standard Assistance Flow"
          />
          <div className="grid gap-1.5">
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What kind of programs is this flow for?"
            />
          </div>
          <Button className="justify-self-start" disabled={!name.trim()} onClick={onCreate}>
            Create and open builder
          </Button>
        </CardContent>
      </Card>
    </>
  )
}
