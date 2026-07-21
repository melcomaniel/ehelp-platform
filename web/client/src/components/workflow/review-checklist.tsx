"use client"

import * as React from "react"

import { NativeSelect, Textarea } from "@/components/workflow/bits"
import { usePrompts } from "@/components/workflow/prompts"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  actionsOf,
  itemVerdict,
  reasonCodesOf,
  reviewItemsOf,
  reviewProgress,
  type ReviewItem,
} from "@/lib/workflow/engine"
import { useWorkflow } from "@/lib/workflow/store"
import type { Step, WorkflowApplication } from "@/lib/workflow/types"
import { cn } from "@/lib/utils"
import {
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClipboardCheckIcon,
  FileTextIcon,
  Undo2Icon,
  XIcon,
} from "lucide-react"

/**
 * Requirements checklist for a review step, in the licensing-portal style:
 * one row per submitted input/document with a check-off box (= approved),
 * a Review button to open documents, and a per-item Return that sends the
 * whole application back with a reason + comment (modal). Approving the
 * application unlocks only at 100% checked; verdicts reset on resubmit.
 */
export function ReviewChecklist({
  app,
  step,
  stepSetId,
  onReturned,
}: {
  app: WorkflowApplication
  step: Step
  stepSetId: string
  /** called after an item-return successfully returns the application */
  onReturned?: () => void
}) {
  const { state, setReviewVerdict, decideApplication } = useWorkflow()
  const { toast } = usePrompts()

  const [returning, setReturning] = React.useState<ReviewItem | null>(null)
  const [reasonCodeId, setReasonCodeId] = React.useState("")
  const [comment, setComment] = React.useState("")
  const [viewerIdx, setViewerIdx] = React.useState<number | null>(null)

  const items = reviewItemsOf(state, app.id, stepSetId)
  const fileItems = items.filter((i) => i.kind === "file")

  // Verdicts only mutate while the application actually sits at this review
  // step; once returned (awaiting resubmit) the checklist is read-only.
  const reviewable = app.status === "submitted" && app.currentStepId === step.id
  const progress = reviewProgress(state, app, step)
  const pct = progress.total === 0 ? 100 : Math.round((progress.verified / progress.total) * 100)

  const returnAction = actionsOf(state, step.id).find((a) => a.action === "return" && a.enabled)
  const reasons = returnAction ? reasonCodesOf(state, returnAction.id) : []
  const canConfirm = comment.trim() !== "" && (reasons.length === 0 || reasonCodeId !== "")

  const onCheck = (key: string) => {
    const r = setReviewVerdict(app.id, step.id, key, "approved")
    if (!r.ok) toast({ title: "Cannot check item", description: r.error, variant: "error" })
  }

  const openReturn = (item: ReviewItem) => {
    setReturning(item)
    setReasonCodeId("")
    setComment("")
  }

  const openViewer = (item: ReviewItem) => {
    const idx = fileItems.findIndex((f) => f.key === item.key)
    if (idx >= 0) setViewerIdx(idx)
  }

  const confirmReturn = () => {
    if (!returning) return
    const r = decideApplication({
      applicationId: app.id,
      action: "return",
      reasonCodeId: reasonCodeId || undefined,
      comment: `${returning.label}: ${comment.trim()}`,
    })
    if (!r.ok) {
      toast({ title: "Cannot return", description: r.error, variant: "error" })
      return
    }
    setReturning(null)
    setViewerIdx(null)
    toast({
      title: "Returned to the applicant",
      description: `"${returning.label}" flagged — the applicant will fix it and resubmit.`,
      variant: "success",
    })
    onReturned?.()
  }

  return (
    <Card className="self-start">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-heading text-lg font-semibold">
              <ClipboardCheckIcon className="size-4.5 text-muted-foreground" />
              Requirements Checklist
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Review and check off each requirement as you verify them.
            </p>
            {!reviewable && (
              <p className="mt-1.5 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-800">
                {app.status === "returned"
                  ? "Returned to the applicant — reviewing unlocks after they resubmit."
                  : "Application is not at this review step — checklist is read-only."}
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="font-heading text-2xl font-semibold tabular-nums">{pct}%</p>
            <p className="text-xs text-muted-foreground">
              {progress.verified} of {progress.total} requirements checked
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-2">
        {items.map((item) => {
          const approved = itemVerdict(state, app.id, step.id, item.key) === "approved"
          return (
            <div
              key={item.key}
              className={cn(
                "flex flex-wrap items-center gap-3 rounded-lg border p-3",
                approved && "border-green-200 bg-green-50/60"
              )}
            >
              <span className="min-w-0 flex-1 basis-52">
                <span className="block text-sm font-medium">{item.label}</span>
                <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                  {item.kind === "file" ? (
                    <button
                      onClick={() => openViewer(item)}
                      className="cursor-pointer underline hover:text-foreground"
                      title="Preview document"
                    >
                      {item.value}
                    </button>
                  ) : (
                    item.value
                  )}
                </span>
              </span>

              <span className="flex shrink-0 gap-1.5">
                <Button
                  size="xs"
                  variant={approved ? "default" : "outline"}
                  className={cn(approved && "bg-green-600 text-white disabled:opacity-100")}
                  disabled={!reviewable || approved}
                  onClick={() => onCheck(item.key)}
                >
                  <CheckIcon /> {approved ? "Approved" : "Approve"}
                </Button>
                <Button
                  size="xs"
                  variant="outline"
                  disabled={!reviewable || approved}
                  onClick={() => openReturn(item)}
                >
                  <Undo2Icon /> Return
                </Button>
              </span>
            </div>
          )
        })}
      </CardContent>

      {/* document viewer modal: preview + approve / return / skip, navigates all file items */}
      {viewerIdx !== null && fileItems[viewerIdx] && (
        <DocumentViewerModal
          items={fileItems}
          idx={viewerIdx}
          reviewable={reviewable}
          isApproved={(item) => itemVerdict(state, app.id, step.id, item.key) === "approved"}
          onNavigate={setViewerIdx}
          onApprove={(item) => {
            if (itemVerdict(state, app.id, step.id, item.key) !== "approved") onCheck(item.key)
            if (viewerIdx < fileItems.length - 1) setViewerIdx(viewerIdx + 1)
            else setViewerIdx(null)
          }}
          onReturn={openReturn}
          onClose={() => setViewerIdx(null)}
        />
      )}

      {/* return-item modal: reason + comment + confirm → returns the whole application.
          Rendered after the viewer so it stacks on top when opened from it. */}
      {returning && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setReturning(null)}
        >
          <div
            className="w-full max-w-md rounded-xl border bg-background p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <h2 className="font-heading text-base font-semibold">Return: {returning.label}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              The whole application goes back to the applicant to fix this item,
              then they resubmit for a fresh review.
            </p>
            <div className="mt-4 grid gap-3">
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
                  placeholder="Tell the applicant what to fix — they will see this"
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setReturning(null)}>
                Cancel
              </Button>
              <Button size="sm" disabled={!canConfirm} onClick={confirmReturn}>
                <Undo2Icon /> Confirm return
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}

/**
 * Modal document viewer for the checklist's uploaded files, rendered by the
 * browser's native viewer in an iframe. Seeded fixtures carry metadata only
 * (no blob), so those fall back to the bundled dummy PDF.
 */
function DocumentViewerModal({
  items,
  idx,
  reviewable,
  isApproved,
  onNavigate,
  onApprove,
  onReturn,
  onClose,
}: {
  items: ReviewItem[]
  idx: number
  /** false once the application left this review step (e.g. returned) — verdict buttons lock */
  reviewable: boolean
  isApproved: (item: ReviewItem) => boolean
  onNavigate: (idx: number) => void
  onApprove: (item: ReviewItem) => void
  onReturn: (item: ReviewItem) => void
  onClose: () => void
}) {
  const item = items[idx]
  const approved = isApproved(item)
  const atLast = idx === items.length - 1

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border bg-background shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* header */}
        <div className="flex items-center gap-2.5 border-b px-5 py-3.5">
          <FileTextIcon className="size-4.5 text-muted-foreground" />
          <h2 className="font-heading text-base font-semibold">Document Preview</h2>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            {items.length} {items.length === 1 ? "Item" : "Items"}
          </span>
          <button
            onClick={onClose}
            className="ml-auto rounded p-1 text-muted-foreground hover:bg-muted"
            aria-label="Close"
          >
            <XIcon className="size-4" />
          </button>
        </div>

        {/* toolbar: position + prev/next + jump-to dropdown */}
        <div className="flex flex-wrap items-center gap-2 border-b px-5 py-2.5">
          <p className="text-sm font-medium">
            Requirement {idx + 1} of {items.length}
          </p>
          <div className="ml-auto flex items-center gap-1.5">
            <Button
              size="xs"
              variant="outline"
              disabled={idx === 0}
              onClick={() => onNavigate(idx - 1)}
              aria-label="Previous document"
            >
              <ChevronLeftIcon />
            </Button>
            <NativeSelect
              className="w-56"
              value={String(idx)}
              onChange={(e) => onNavigate(Number(e.target.value))}
            >
              {items.map((it, i) => (
                <option key={it.key} value={i}>
                  {it.label}{isApproved(it) ? " ✓" : ""}
                </option>
              ))}
            </NativeSelect>
            <Button
              size="xs"
              variant="outline"
              disabled={atLast}
              onClick={() => onNavigate(idx + 1)}
              aria-label="Next document"
            >
              <ChevronRightIcon />
            </Button>
          </div>
        </div>

        {/* document — browser-native PDF viewer; seeded fixtures carry no blob,
            so they fall back to the bundled dummy PDF */}
        <div className="min-h-0 flex-1 bg-[#525659]">
          <iframe
            src={item.fileUrl ?? "/demo-document.pdf"}
            title={item.fileName ?? item.label}
            className="size-full min-h-120"
          />
        </div>

        {/* footer */}
        <div className="flex flex-wrap items-center gap-2 border-t px-5 py-3.5">
          <span className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
            <FileTextIcon className="size-4 shrink-0" />
            <span className="truncate">{item.fileName ?? item.value}</span>
            {approved && (
              <span className="ml-1 shrink-0 rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                Approved
              </span>
            )}
          </span>
          <div className="ml-auto flex shrink-0 gap-2">
            <Button
              size="sm"
              variant="outline"
              className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
              disabled={!reviewable || approved}
              onClick={() => onReturn(item)}
            >
              <Undo2Icon /> Return
            </Button>
            <Button
              size="sm"
              disabled={!reviewable || approved}
              onClick={() => onApprove(item)}
            >
              <CheckIcon /> {approved ? "Approved" : "Approve and Continue"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
