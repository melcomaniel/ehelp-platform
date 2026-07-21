"use client"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { usePrompts } from "@/components/workflow/prompts"
import {
  isItemVerified,
  reviewItemsOf,
  reviewProgress,
} from "@/lib/workflow/engine"
import { useWorkflow } from "@/lib/workflow/store"
import type { Step, WorkflowApplication } from "@/lib/workflow/types"
import { cn } from "@/lib/utils"
import { CheckIcon, FileIcon } from "lucide-react"

/**
 * Verification checklist for a review step: one row per submitted answer and
 * per uploaded document, each showing the real value. Ticking items fills a
 * progress bar; the engine blocks approve until 100%.
 */
export function ReviewChecklist({
  app,
  step,
  stepSetId,
}: {
  app: WorkflowApplication
  step: Step
  stepSetId: string
}) {
  const { state, toggleReviewItem } = useWorkflow()
  const { toast } = usePrompts()

  const items = reviewItemsOf(state, app.id, stepSetId)
  const progress = reviewProgress(state, app, step)
  const pct = progress.total === 0 ? 100 : Math.round((progress.verified / progress.total) * 100)

  const onToggle = (key: string) => {
    const r = toggleReviewItem(app.id, step.id, key)
    if (!r.ok) toast({ title: "Cannot verify", description: r.error, variant: "error" })
  }

  return (
    <Card className="self-start">
      <CardHeader>
        <CardTitle>Verification checklist</CardTitle>
        <CardDescription>Verify each submitted input and document. Approve unlocks at 100%.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="grid gap-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">{progress.verified} / {progress.total} verified</span>
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
  )
}
