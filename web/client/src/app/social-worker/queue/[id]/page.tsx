"use client"

import * as React from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"

import {
  EmptyState,
  NativeSelect,
  PageHeader,
  StatusPill,
  Textarea,
} from "@/components/workflow/bits"
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
import {
  actionsOf,
  isItemVerified,
  reasonCodesOf,
  reviewItemsOf,
  reviewProgress,
  stepsOf,
} from "@/lib/workflow/engine"
import { useWorkflow } from "@/lib/workflow/store"
import { APPLICATION_STATUS_LABEL } from "@/lib/workflow/types"
import { cn } from "@/lib/utils"
import {
  ArrowLeftIcon,
  CheckIcon,
  FileIcon,
  Undo2Icon,
  XIcon,
} from "lucide-react"

export default function SocialWorkerReview() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { state, hasRole, toggleReviewItem, decideApplication } = useWorkflow()
  const { toast, confirm } = usePrompts()

  const [decision, setDecision] = React.useState<"return" | "reject" | null>(null)
  const [reasonCodeId, setReasonCodeId] = React.useState("")
  const [comment, setComment] = React.useState("")

  const app = state.applications.find((a) => a.id === id)
  if (!app) return <EmptyState title="Application not found" hint="It may have been decided already." />
  if (!hasRole("social_worker"))
    return <EmptyState title="Switch to the social worker" hint="Grace Villanueva is the seeded social worker." />

  const version = state.versions.find((v) => v.id === app.programVersionId)
  const step = app.currentStepId ? state.steps.find((s) => s.id === app.currentStepId) : null
  const applicant = state.users.find((u) => u.id === app.applicantId)
  if (!version || !step || step.type !== "review") {
    return <EmptyState title="Not at a review step" hint="This application is not currently in your review queue." />
  }

  const items = reviewItemsOf(state, app.id, version.stepSetId)
  const progress = reviewProgress(state, app, step)
  const pct = progress.total === 0 ? 100 : Math.round((progress.verified / progress.total) * 100)

  const stepAction = (a: "approve" | "return" | "reject") =>
    actionsOf(state, step.id).find((x) => x.action === a && x.enabled)
  const reasons = decision ? reasonCodesOf(state, stepAction(decision)?.id ?? "") : []
  const commentMissing = !!(decision && stepAction(decision)?.commentRequired && comment.trim() === "")
  const reasonMissing = !!(decision && reasons.length > 0 && !reasonCodeId)

  const onToggle = (key: string) => {
    const r = toggleReviewItem(app.id, step.id, key)
    if (!r.ok) toast({ title: "Cannot verify", description: r.error, variant: "error" })
  }

  const onApprove = () => {
    const r = decideApplication({ applicationId: app.id, action: "approve", comment: comment.trim() || undefined })
    if (!r.ok) {
      toast({ title: "Cannot approve", description: r.error, variant: "error" })
      return
    }
    toast({ title: "Approved", description: `${app.id} sent to disbursement.`, variant: "success" })
    router.push("/social-worker/queue")
  }

  const onDecide = async () => {
    if (!decision) return
    if (decision === "reject") {
      const ok = await confirm({
        title: "Reject this application?",
        description: "Rejection is final — the applicant cannot resubmit. The reason and comment are recorded.",
        confirmLabel: "Reject",
        destructive: true,
      })
      if (!ok) return
    }
    const r = decideApplication({
      applicationId: app.id,
      action: decision,
      reasonCodeId: reasonCodeId || undefined,
      comment,
    })
    if (!r.ok) {
      toast({ title: "Action refused", description: r.error, variant: "error" })
      return
    }
    toast({
      title: decision === "return" ? "Returned" : "Rejected",
      description: `${app.id} ${decision === "return" ? "sent back for compliance" : "rejected"}.`,
      variant: "success",
    })
    router.push("/social-worker/queue")
  }

  const steps = stepsOf(state, version.stepSetId)
  const currentIdx = steps.findIndex((s) => s.id === step.id)

  return (
    <>
      <PageHeader
        title={`${applicant?.name ?? app.applicantId} — ${app.id}`}
        description={`4Ps Financial Aid · ${step.name}`}
      >
        <div className="flex items-center gap-2">
          <StatusPill value={APPLICATION_STATUS_LABEL[app.status]} />
          <Button size="sm" variant="ghost" render={<Link href="/social-worker/queue" />}>
            <ArrowLeftIcon /> Queue
          </Button>
        </div>
      </PageHeader>

      {/* stepper */}
      <ol className="flex flex-wrap items-center gap-2">
        {steps.map((s, i) => (
          <li key={s.id} className="flex items-center gap-2">
            <span
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs",
                i < currentIdx && "border-green-200 bg-green-50 text-green-700",
                i === currentIdx && "border-primary bg-primary/10 font-medium text-primary",
                i > currentIdx && "text-muted-foreground"
              )}
            >
              {i < currentIdx ? <CheckIcon className="size-3" /> : <span>{i + 1}.</span>}
              {s.name}
            </span>
            {i < steps.length - 1 && <span className="text-muted-foreground">→</span>}
          </li>
        ))}
      </ol>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card className="self-start">
          <CardHeader>
            <CardTitle>Verification checklist</CardTitle>
            <CardDescription>
              Verify each submitted input and document. Approve unlocks at 100%.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {/* progress */}
            <div className="grid gap-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">
                  {progress.verified} / {progress.total} verified
                </span>
                <span className="tabular-nums text-muted-foreground">{pct}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn("h-full rounded-full transition-all", pct === 100 ? "bg-green-600" : "bg-primary")}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>

            <ul className="grid gap-2">
              {items.map((item) => {
                const verified = isItemVerified(state, app.id, step.id, item.key)
                return (
                  <li key={item.key}>
                    <label
                      className={cn(
                        "flex cursor-pointer items-start gap-3 rounded-lg border p-2.5",
                        verified && "border-green-200 bg-green-50"
                      )}
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5 size-4 accent-green-600"
                        checked={verified}
                        onChange={() => onToggle(item.key)}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs text-muted-foreground">{item.label}</span>
                        {item.kind === "file" ? (
                          <span className="flex items-center gap-1.5 text-sm">
                            <FileIcon className="size-3.5 shrink-0 text-muted-foreground" />
                            {item.fileUrl ? (
                              <a
                                href={item.fileUrl}
                                download={item.fileName}
                                className="truncate hover:underline"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {item.value}
                              </a>
                            ) : (
                              <span className="truncate">{item.value}</span>
                            )}
                          </span>
                        ) : (
                          <span className="block text-sm break-words">{item.value}</span>
                        )}
                      </span>
                      {verified && <CheckIcon className="mt-0.5 size-4 shrink-0 text-green-600" />}
                    </label>
                  </li>
                )
              })}
            </ul>
          </CardContent>
        </Card>

        <div className="grid gap-4 self-start">
          <Card>
            <CardHeader>
              <CardTitle>Decision</CardTitle>
              <CardDescription>
                {progress.complete
                  ? "All items verified — you can approve"
                  : `Verify all items to approve (${progress.verified}/${progress.total})`}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <Button size="sm" disabled={!progress.complete} onClick={onApprove}>
                <CheckIcon /> Approve
              </Button>
              <div className="flex gap-1.5">
                <Button
                  size="sm"
                  variant={decision === "return" ? "default" : "outline"}
                  onClick={() => {
                    setDecision("return")
                    setReasonCodeId("")
                    setComment("")
                  }}
                >
                  <Undo2Icon /> Return
                </Button>
                <Button
                  size="sm"
                  variant={decision === "reject" ? "destructive" : "outline"}
                  onClick={() => {
                    setDecision("reject")
                    setReasonCodeId("")
                    setComment("")
                  }}
                >
                  <XIcon /> Reject
                </Button>
              </div>

              {decision && (
                <>
                  {reasons.length > 0 && (
                    <div className="grid gap-1.5">
                      <Label>Reason</Label>
                      <NativeSelect value={reasonCodeId} onChange={(e) => setReasonCodeId(e.target.value)}>
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
                    <Label>Comment (required)</Label>
                    <Textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Explain the decision — the applicant sees this"
                    />
                  </div>
                  <Button
                    size="sm"
                    variant={decision === "reject" ? "destructive" : "default"}
                    disabled={commentMissing || reasonMissing}
                    onClick={onDecide}
                  >
                    Confirm: {decision === "return" ? "Return" : "Reject"}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

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
