"use client"

import * as React from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"

import {
  EmptyState,
  Field,
  NativeSelect,
  PageHeader,
  StatusPill,
  Textarea,
} from "@/components/workflow/bits"
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
import { Label } from "@/components/ui/label"
import { actionsOf, reasonCodesOf } from "@/lib/workflow/engine"
import { useWorkflow } from "@/lib/workflow/store"
import type { DisbursementInstrument, DecisionAction, Step } from "@/lib/workflow/types"
import { APPLICATION_STATUS_LABEL, INSTRUMENT_LABEL } from "@/lib/workflow/types"
import { ArrowLeftIcon, BanknoteIcon, CheckIcon, Undo2Icon, XIcon } from "lucide-react"

const ACTION_VERB: Record<DecisionAction, string> = {
  approve: "Approve",
  return: "Return for compliance",
  reject: "Reject",
}

export default function ReviewDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { state, actingUser, allowedActionsFor, decideApplication } = useWorkflow()
  const { toast, confirm } = usePrompts()

  const [action, setAction] = React.useState<DecisionAction | null>(null)
  const [reasonCodeId, setReasonCodeId] = React.useState("")
  const [comment, setComment] = React.useState("")

  const app = state.applications.find((a) => a.id === id)
  if (!app) {
    return <EmptyState title="Application not found" hint="It may have been decided already." />
  }

  const program = state.programs.find((p) => p.id === app.programId)
  const version = state.versions.find((v) => v.id === app.programVersionId)
  const step = app.currentStepId ? state.steps.find((s) => s.id === app.currentStepId) : null
  const applicant = state.users.find((u) => u.id === app.applicantId)
  if (!program || !version) {
    return <EmptyState title="Program version missing" hint="Reset the demo data to recover." />
  }

  const allowed = allowedActionsFor(app)
  const stepAction =
    action && step ? actionsOf(state, step.id).find((a) => a.action === action) : null
  const reasons = stepAction ? reasonCodesOf(state, stepAction.id) : []
  const needsReason = action === "return" || action === "reject"
  const commentMissing = !!stepAction?.commentRequired && comment.trim() === ""
  const reasonMissing = needsReason && reasons.length > 0 && !reasonCodeId

  const pick = (a: DecisionAction) => {
    setAction(a)
    setReasonCodeId("")
    setComment("")
  }

  const onDecide = async () => {
    if (!action) return
    if (action === "reject") {
      const ok = await confirm({
        title: "Reject this application?",
        description:
          "Rejection is final — the applicant cannot edit or resubmit it. The reason and comment are recorded in the audit trail.",
        confirmLabel: "Reject",
        destructive: true,
      })
      if (!ok) return
    }
    const result = decideApplication({
      applicationId: app.id,
      action,
      reasonCodeId: reasonCodeId || undefined,
      comment,
    })
    if (!result.ok) {
      toast({ title: "Action refused", description: result.error, variant: "error" })
      return
    }
    const outcome: Record<DecisionAction, string> = {
      approve: `${app.id} approved${step ? ` at ${step.name}` : ""}.`,
      return: `${app.id} returned to ${applicant?.name ?? "the applicant"} for compliance.`,
      reject: `${app.id} rejected.`,
    }
    toast({ title: ACTION_VERB[action], description: outcome[action], variant: "success" })
    router.push("/dashboard/review")
  }

  return (
    <>
      <PageHeader
        title={`${program.name} — ${app.id}`}
        description={`${applicant?.name ?? app.applicantId} · version ${version.versionNo}${
          step ? ` · waiting at ${step.name}` : ""
        }`}
      >
        <div className="flex items-center gap-2">
          <StatusPill value={APPLICATION_STATUS_LABEL[app.status]} />
          <Button size="sm" variant="ghost" render={<Link href="/dashboard/review" />}>
            <ArrowLeftIcon /> Queue
          </Button>
        </div>
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="grid gap-4 self-start">
          <Card>
            <CardHeader>
              <CardTitle>Submitted answers</CardTitle>
              <CardDescription>
                Rendered against version {version.versionNo} — the version this application is pinned to
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FormRenderer stepSetId={version.stepSetId} applicationId={app.id} readOnly />
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 self-start">
          {step?.type === "disbursement" && app.status === "approved" && (
            <DisbursementReleaseCard step={step} applicationId={app.id} applicantName={applicant?.name ?? app.applicantId} />
          )}

          {step?.type !== "disbursement" && (
          <Card>
            <CardHeader>
              <CardTitle>Decision</CardTitle>
              <CardDescription>
                {allowed.length > 0
                  ? `Acting as ${actingUser.name}`
                  : "No actions available to you on this application"}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {allowed.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {allowed.includes("approve") && (
                    <Button
                      size="sm"
                      variant={action === "approve" ? "default" : "outline"}
                      onClick={() => pick("approve")}
                    >
                      <CheckIcon /> Approve
                    </Button>
                  )}
                  {allowed.includes("return") && (
                    <Button
                      size="sm"
                      variant={action === "return" ? "default" : "outline"}
                      onClick={() => pick("return")}
                    >
                      <Undo2Icon /> Return
                    </Button>
                  )}
                  {allowed.includes("reject") && (
                    <Button
                      size="sm"
                      variant={action === "reject" ? "destructive" : "outline"}
                      onClick={() => pick("reject")}
                    >
                      <XIcon /> Reject
                    </Button>
                  )}
                </div>
              )}

              {action && (
                <>
                  {needsReason && reasons.length > 0 && (
                    <div className="grid gap-1.5">
                      <Label>Reason</Label>
                      <NativeSelect
                        value={reasonCodeId}
                        onChange={(e) => setReasonCodeId(e.target.value)}
                      >
                        <option value="">Select a reason…</option>
                        {reasons.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.label}
                          </option>
                        ))}
                      </NativeSelect>
                    </div>
                  )}
                  <div className="grid gap-1.5">
                    <Label>
                      Comment{stepAction?.commentRequired ? " (required)" : " (optional)"}
                    </Label>
                    <Textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder={
                        action === "approve"
                          ? "Optional note for the record"
                          : "Explain the decision — the applicant will see this"
                      }
                    />
                  </div>
                  <Button
                    size="sm"
                    className="justify-self-start"
                    variant={action === "reject" ? "destructive" : "default"}
                    disabled={commentMissing || reasonMissing}
                    onClick={onDecide}
                  >
                    Confirm: {ACTION_VERB[action]}
                  </Button>
                  {(commentMissing || reasonMissing) && (
                    <p className="text-xs text-muted-foreground">
                      {reasonMissing ? "Pick a reason code. " : ""}
                      {commentMissing ? "A comment is required for this action." : ""}
                    </p>
                  )}
                </>
              )}
            </CardContent>
          </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>History</CardTitle>
              <CardDescription>Append-only audit trail</CardDescription>
            </CardHeader>
            <CardContent>
              <EventHistory applicationId={app.id} />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}

function DisbursementReleaseCard({
  step,
  applicationId,
  applicantName,
}: {
  step: Step
  applicationId: string
  applicantName: string
}) {
  const { disburseApplication } = useWorkflow()
  const { toast, confirm } = usePrompts()
  const instruments = Object.keys(INSTRUMENT_LABEL) as DisbursementInstrument[]

  const [payee, setPayee] = React.useState(applicantName)
  const [amount, setAmount] = React.useState("")
  const [instrument, setInstrument] = React.useState<DisbursementInstrument>("cash")

  const amountNum = Number(amount)
  const valid = payee.trim() !== "" && amountNum > 0

  const onRelease = async () => {
    const ok = await confirm({
      title: "Release funds?",
      description: `₱${amountNum.toLocaleString()} to ${payee.trim()} via ${INSTRUMENT_LABEL[instrument]}. This marks the application disbursed.`,
      confirmLabel: "Release",
    })
    if (!ok) return
    const result = disburseApplication({ applicationId, payee, amount: amountNum, instrument })
    toast(
      result.ok
        ? { title: "Funds released", description: `₱${amountNum.toLocaleString()} to ${payee.trim()}.`, variant: "success" }
        : { title: "Could not release", description: result.error, variant: "error" }
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{step.name}</CardTitle>
        <CardDescription>Release funds to complete the application</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <Field label="Payee" value={payee} onChange={(e) => setPayee(e.target.value)} />
        <Field
          label="Amount (PHP)"
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="10000"
        />
        <div className="grid gap-1.5">
          <Label>Instrument</Label>
          <NativeSelect value={instrument} onChange={(e) => setInstrument(e.target.value as DisbursementInstrument)}>
            {instruments.map((i) => (
              <option key={i} value={i}>
                {INSTRUMENT_LABEL[i]}
              </option>
            ))}
          </NativeSelect>
        </div>
        <Button size="sm" className="justify-self-start" disabled={!valid} onClick={onRelease}>
          <BanknoteIcon /> Release funds
        </Button>
      </CardContent>
    </Card>
  )
}
