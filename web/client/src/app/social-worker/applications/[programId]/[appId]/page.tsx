"use client"

import * as React from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"

import {
  EmptyState,
  NativeSelect,
  StatusPill,
  Textarea,
  timeAgo,
} from "@/components/workflow/bits"
import { DisbursementReleaseCard } from "@/components/workflow/disburse-card"
import { usePrompts } from "@/components/workflow/prompts"
import { ReviewChecklist } from "@/components/workflow/review-checklist"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  actionsOf,
  reasonCodesOf,
  reviewProgress,
  stepsOf,
} from "@/lib/workflow/engine"
import { useWorkflow } from "@/lib/workflow/store"
import { APPLICATION_STATUS_LABEL } from "@/lib/workflow/types"
import { cn } from "@/lib/utils"
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  CheckCircle2Icon,
  XIcon,
} from "lucide-react"

export default function ApplicationReview() {
  const { programId, appId } = useParams<{ programId: string; appId: string }>()
  const router = useRouter()
  const { state, actingUser, hasRole, decideApplication } = useWorkflow()
  const { toast, confirm } = usePrompts()

  const [rejecting, setRejecting] = React.useState(false)
  const [reasonCodeId, setReasonCodeId] = React.useState("")
  const [comment, setComment] = React.useState("")
  const [guidanceDismissed, setGuidanceDismissed] = React.useState(false)

  const app = state.applications.find((a) => a.id === appId)
  if (!hasRole("social_worker"))
    return <EmptyState title="Switch to the social worker" hint="Grace Villanueva is the seeded social worker." />
  if (!app) return <EmptyState title="Application not found" hint="It may have been removed." />

  const version = state.versions.find((v) => v.id === app.programVersionId)
  const program = state.programs.find((p) => p.id === app.programId)
  const applicant = state.users.find((u) => u.id === app.applicantId)
  const step = app.currentStepId ? state.steps.find((s) => s.id === app.currentStepId) : null
  if (!version || !program) return <EmptyState title="Program version missing" hint="Reset the demo data to recover." />

  const atReview =
    app.status === "submitted" &&
    step?.type === "review" &&
    !!step.assignedRole &&
    actingUser.roles.includes(step.assignedRole)

  const atDisbursement =
    app.status === "approved" &&
    step?.type === "disbursement" &&
    !!step.assignedRole &&
    actingUser.roles.includes(step.assignedRole)

  const progress = step
    ? reviewProgress(state, app, step)
    : { verified: 0, rejected: 0, total: 0, complete: true }

  const rejectAction =
    atReview && step ? actionsOf(state, step.id).find((x) => x.action === "reject" && x.enabled) : undefined
  const rejectReasons = rejectAction ? reasonCodesOf(state, rejectAction.id) : []
  const rejectReady =
    comment.trim() !== "" && (rejectReasons.length === 0 || reasonCodeId !== "")

  const steps = stepsOf(state, version.stepSetId)
  const currentIdx = step ? steps.findIndex((s) => s.id === step.id) : steps.length
  const allDone = app.status === "disbursed"

  const assignedTo = step?.assignedRole
    ? state.users.find((u) => u.roles.includes(step.assignedRole!))
    : null

  const onApprove = () => {
    const r = decideApplication({ applicationId: app.id, action: "approve" })
    if (!r.ok) {
      toast({ title: "Cannot approve", description: r.error, variant: "error" })
      return
    }
    toast({ title: "Approved", description: `${app.id} advanced to the next step.`, variant: "success" })
  }

  const onReject = async () => {
    const ok = await confirm({
      title: "Reject this application?",
      description: "Rejection is final — the applicant cannot resubmit. The reason and comment are recorded.",
      confirmLabel: "Reject",
      destructive: true,
    })
    if (!ok) return
    const r = decideApplication({
      applicationId: app.id,
      action: "reject",
      reasonCodeId: reasonCodeId || undefined,
      comment,
    })
    if (!r.ok) {
      toast({ title: "Action refused", description: r.error, variant: "error" })
      return
    }
    toast({ title: "Rejected", description: `${app.id} rejected.`, variant: "success" })
    router.push(`/social-worker/applications/${programId}`)
  }

  const onItemReturned = () => {
    router.push(`/social-worker/applications/${programId}`)
  }

  const initials = (applicant?.name ?? "?").split(" ").map((w) => w[0]).join("").slice(0, 2)

  return (
    <div className="mx-auto grid w-full max-w-4xl gap-4">
      <div>
        <Button size="sm" variant="ghost" render={<Link href={`/social-worker/applications/${programId}`} />}>
          <ArrowLeftIcon /> Back to Applicants
        </Button>
      </div>

      {/* header card */}
      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <Avatar className="size-11 rounded-lg">
              <AvatarFallback className="rounded-lg bg-[#0040E7]/10 font-heading text-sm text-[#0040E7]">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <h1 className="font-heading text-2xl font-semibold">{applicant?.name ?? app.applicantId}</h1>
              <p className="text-sm text-muted-foreground">
                {app.id} · {program.name}
              </p>
            </div>
            <StatusPill value={APPLICATION_STATUS_LABEL[app.status]} />
          </div>
          <div className="mt-4 grid gap-4 text-sm sm:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground">Assigned to</p>
              <p className="font-medium">{assignedTo?.name ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Type</p>
              <p className="font-medium">{program.name}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Submitted on</p>
              <p className="font-medium">{new Date(app.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Last update</p>
              <p className="font-medium">{timeAgo(app.updatedAt)}</p>
            </div>
          </div>
        </CardHeader>

        {/* pipeline strip */}
        <CardContent className="border-t pt-4">
          <div className="mb-4 flex items-center justify-between">
            <p className="font-heading text-sm font-semibold">{step?.name ?? "Completed"}</p>
            <span
              className={cn(
                "rounded-full border px-2.5 py-0.5 text-xs font-medium",
                allDone || app.status === "approved"
                  ? "border-green-200 bg-green-50 text-green-700"
                  : app.status === "rejected"
                    ? "border-red-200 bg-red-50 text-red-700"
                    : "border-blue-200 bg-blue-50 text-blue-700"
              )}
            >
              {allDone ? "Completed" : app.status === "rejected" ? "Rejected" : "Ongoing"}
            </span>
          </div>
          <ol className="flex w-full">
            {steps.map((s, i) => {
              const done = allDone || i < currentIdx
              const current = !allDone && i === currentIdx
              return (
                <li key={s.id} className="relative flex flex-1 flex-col items-center gap-1.5">
                  {i > 0 && (
                    <span
                      className={cn(
                        "absolute top-[11px] right-1/2 left-[-50%] h-0.5",
                        done || current ? "bg-green-300" : "bg-border"
                      )}
                    />
                  )}
                  <span
                    className={cn(
                      "z-10 flex size-6 items-center justify-center rounded-full border-2 bg-background",
                      done && "border-green-600 bg-green-600 text-white",
                      current && "border-primary",
                      !done && !current && "border-border"
                    )}
                  >
                    {done ? (
                      <CheckIcon className="size-3.5" />
                    ) : current ? (
                      <span className="size-2 rounded-full bg-primary" />
                    ) : null}
                  </span>
                  <span
                    className={cn(
                      "px-1 text-center text-xs",
                      current ? "font-medium text-foreground" : "text-muted-foreground"
                    )}
                  >
                    {s.name}
                  </span>
                </li>
              )
            })}
          </ol>

          {/* guidance banner */}
          {atReview && !guidanceDismissed && (
            <div className="mt-4 flex flex-wrap items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
              <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-amber-600" />
              <div className="min-w-0 flex-1 text-sm text-amber-900">
                <p className="font-medium">Review the requirements</p>
                <p className="mt-0.5 text-xs">
                  Check off each requirement below as you verify it, or return one to the
                  applicant. Press <span className="font-semibold">Approve application</span> once
                  everything is checked.
                </p>
              </div>
              <Button size="xs" variant="outline" onClick={() => setGuidanceDismissed(true)}>
                Got it
              </Button>
            </div>
          )}
          {atDisbursement && (
            <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2.5 text-sm text-green-900">
              <p className="font-medium">Application approved — ready for disbursement</p>
              <p className="mt-0.5 text-xs">
                All requirements passed your review. Release the cash grant below to complete this application.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* disbursement */}
      {atDisbursement && step && (
        <DisbursementReleaseCard
          step={step}
          applicationId={app.id}
          applicantName={applicant?.name ?? app.applicantId}
        />
      )}

      {/* requirements checklist */}
      {atReview && step && (
        <ReviewChecklist app={app} step={step} stepSetId={version.stepSetId} onReturned={onItemReturned} />
      )}

      {/* action bar */}
      {atReview && (
        <div className="grid gap-3">
          {rejecting && (
            <Card>
              <CardHeader>
                <CardTitle>Reject application</CardTitle>
                <CardDescription>Terminal — the applicant cannot resubmit</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                {rejectReasons.length > 0 && (
                  <div className="grid gap-1.5">
                    <Label>Reason</Label>
                    <NativeSelect value={reasonCodeId} onChange={(e) => setReasonCodeId(e.target.value)}>
                      <option value="">Select a reason…</option>
                      {rejectReasons.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.label}
                        </option>
                      ))}
                    </NativeSelect>
                  </div>
                )}
                <div className="grid gap-1.5">
                  <Label>Comment (required)</Label>
                  <Textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Explain the rejection — the applicant sees this"
                  />
                </div>
                <Button
                  size="sm"
                  variant="destructive"
                  className="justify-self-start"
                  disabled={!rejectReady}
                  onClick={onReject}
                >
                  Confirm: Reject application
                </Button>
              </CardContent>
            </Card>
          )}
          <div className="flex items-center justify-end gap-2">
            <Button
              size="sm"
              variant={rejecting ? "destructive" : "outline"}
              onClick={() => {
                setRejecting(!rejecting)
                setReasonCodeId("")
                setComment("")
              }}
            >
              <XIcon /> Reject
            </Button>
            <Button
              disabled={!progress.complete}
              title={progress.complete ? undefined : `Check all requirements first (${progress.verified}/${progress.total})`}
              onClick={onApprove}
            >
              Approve application <ArrowRightIcon />
            </Button>
          </div>
        </div>
      )}

    </div>
  )
}
