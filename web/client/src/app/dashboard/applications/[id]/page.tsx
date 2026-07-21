"use client"

import * as React from "react"
import Link from "next/link"
import { useParams } from "next/navigation"

import { EmptyState, PageHeader, StatusPill } from "@/components/workflow/bits"
import { FaceCheck } from "@/components/workflow/face-check"
import { FormRenderer } from "@/components/workflow/form-renderer"
import { EventHistory } from "@/components/workflow/history"
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
import { APPLICATION_STATUS_LABEL } from "@/lib/workflow/types"
import { cn } from "@/lib/utils"
import { ArrowLeftIcon, CheckIcon, SendIcon } from "lucide-react"

export default function ApplicationDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { state, actingUser, validate, submitApplication, verifyApplication } = useWorkflow()
  const { toast } = usePrompts()
  const [errors, setErrors] = React.useState<Record<string, string>>({})

  const app = state.applications.find((a) => a.id === id)
  if (!app) {
    return <EmptyState title="Application not found" hint="It may have been removed." />
  }

  const program = state.programs.find((p) => p.id === app.programId)
  const version = state.versions.find((v) => v.id === app.programVersionId)
  if (!program || !version) {
    return <EmptyState title="Program version missing" hint="Reset the demo data to recover." />
  }

  const isApplicant = app.applicantId === actingUser.id
  const editable = isApplicant && (app.status === "draft" || app.status === "returned")
  const verifyStep =
    app.status === "verifying" && app.currentStepId
      ? state.steps.find((s) => s.id === app.currentStepId && s.type === "verify")
      : null

  const onVerify = (passed: boolean, faceScore: number) => {
    const result = verifyApplication(app.id, passed, faceScore)
    toast(
      result.ok
        ? { title: "Identity verified", description: "Face check passed — moving to the next step.", variant: "success" }
        : { title: "Verification failed", description: result.error, variant: "error" }
    )
  }
  const lastDecision = [...state.events]
    .reverse()
    .find((e) => e.applicationId === app.id && (e.action === "return" || e.action === "reject"))
  const lastReason = lastDecision?.reasonCodeId
    ? state.reasonCodes.find((r) => r.id === lastDecision.reasonCodeId)
    : null
  const decidedBy = lastDecision
    ? state.users.find((u) => u.id === lastDecision.actorId)?.name ?? "the reviewer"
    : null
  const applicantName = state.users.find((u) => u.id === app.applicantId)?.name ?? "Applicant"

  const onSubmit = () => {
    const validation = validate(app.id)
    setErrors(validation)
    if (Object.keys(validation).length > 0) {
      toast({
        title: "Please fix the highlighted fields",
        description: `${Object.keys(validation).length} field(s) need attention.`,
        variant: "error",
      })
      return
    }
    const result = submitApplication(app.id)
    toast(
      result.ok
        ? {
            title: app.status === "returned" ? "Application resubmitted" : "Application submitted",
            description: "It is now waiting for review. Every decision will appear in the history below.",
            variant: "success",
          }
        : { title: "Could not submit", description: result.error, variant: "error" }
    )
  }

  return (
    <>
      <PageHeader
        title={`${program.name} — ${app.id}`}
        description={`Version ${version.versionNo} · filed by ${
          state.users.find((u) => u.id === app.applicantId)?.name ?? app.applicantId
        }`}
      >
        <div className="flex items-center gap-2">
          <StatusPill value={APPLICATION_STATUS_LABEL[app.status]} />
          <Button size="sm" variant="ghost" render={<Link href="/dashboard/applications" />}>
            <ArrowLeftIcon /> My applications
          </Button>
        </div>
      </PageHeader>

      <Stepper appStatus={app.status} currentStepId={app.currentStepId} stepSetId={version.stepSetId} />

      {app.status === "returned" && lastDecision && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
          <p className="font-medium">
            {applicantName}, {decidedBy} returned your application{lastReason ? ` — ${lastReason.label}` : ""}
          </p>
          {lastDecision.comment && (
            <p className="mt-1 rounded-md bg-amber-100 px-2.5 py-1.5 text-xs">
              &ldquo;{lastDecision.comment}&rdquo;
            </p>
          )}
          <p className="mt-1.5 text-xs font-medium">
            Please fix your answers below and resubmit — it goes back to {decidedBy} for another look.
          </p>
        </div>
      )}
      {app.status === "rejected" && lastDecision && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-900">
          <p className="font-medium">
            {applicantName}, {decidedBy} rejected your application{lastReason ? ` — ${lastReason.label}` : ""}
          </p>
          {lastDecision.comment && (
            <p className="mt-1 rounded-md bg-red-100 px-2.5 py-1.5 text-xs">
              &ldquo;{lastDecision.comment}&rdquo;
            </p>
          )}
          <p className="mt-1.5 text-xs">This decision is final; the application can no longer be edited or resubmitted.</p>
        </div>
      )}
      {app.status === "disbursed" && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-900">
          <p className="font-medium">Funds disbursed</p>
          <p className="mt-0.5 text-xs">This application is complete. See the release details in the history.</p>
        </div>
      )}

      {verifyStep && isApplicant && (
        <Card>
          <CardHeader>
            <CardTitle>{verifyStep.name}</CardTitle>
            <CardDescription>
              Complete the face check to continue. Your camera is used only for this check.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FaceCheck step={verifyStep} onResult={onVerify} />
          </CardContent>
        </Card>
      )}
      {verifyStep && !isApplicant && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 text-sm text-blue-900">
          Waiting on the applicant to complete identity verification ({verifyStep.name}).
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Application form</CardTitle>
            <CardDescription>
              {editable
                ? "Fill in the fields and submit"
                : "Answers are read-only in this status"}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5">
            <FormRenderer
              stepSetId={version.stepSetId}
              applicationId={app.id}
              readOnly={!editable}
              errors={errors}
            />
            {editable && (
              <Button className="justify-self-start" onClick={onSubmit}>
                <SendIcon /> {app.status === "returned" ? "Resubmit" : "Submit application"}
              </Button>
            )}
          </CardContent>
        </Card>

        <Card className="self-start">
          <CardHeader>
            <CardTitle>History</CardTitle>
            <CardDescription>Every decision, with reason and comment</CardDescription>
          </CardHeader>
          <CardContent>
            <EventHistory applicationId={app.id} />
          </CardContent>
        </Card>
      </div>
    </>
  )
}

function Stepper({
  appStatus,
  currentStepId,
  stepSetId,
}: {
  appStatus: string
  currentStepId: string | null
  stepSetId: string
}) {
  const { state } = useWorkflow()
  const steps = stepsOf(state, stepSetId)
  const terminalDone = appStatus === "disbursed"
  const currentIdx = currentStepId
    ? steps.findIndex((s) => s.id === currentStepId)
    : appStatus === "approved" || terminalDone
      ? steps.length
      : 0

  return (
    <ol className="flex flex-wrap items-center gap-2">
      {steps.map((s, i) => {
        const done =
          appStatus === "approved" || terminalDone || i < currentIdx || (i === 0 && appStatus !== "draft")
        const current =
          appStatus !== "approved" && !terminalDone && (currentStepId ? s.id === currentStepId : i === 0)
        return (
          <li key={s.id} className="flex items-center gap-2">
            <span
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs",
                done && !current && "border-green-200 bg-green-50 text-green-700",
                current && "border-primary bg-primary/10 font-medium text-primary",
                !done && !current && "text-muted-foreground"
              )}
            >
              {done && !current ? <CheckIcon className="size-3" /> : <span>{i + 1}.</span>}
              {s.name}
            </span>
            {i < steps.length - 1 && <span className="text-muted-foreground">→</span>}
          </li>
        )
      })}
    </ol>
  )
}
