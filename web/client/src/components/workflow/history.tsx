"use client"

import { useWorkflow } from "@/lib/workflow/store"
import { cn } from "@/lib/utils"
import {
  BanknoteIcon,
  CheckIcon,
  MessageSquareIcon,
  ScanFaceIcon,
  SendIcon,
  Undo2Icon,
  XIcon,
} from "lucide-react"

const ACTION_META: Record<
  string,
  { label: string; icon: React.ReactNode; tone: string }
> = {
  submit: { label: "Submitted", icon: <SendIcon className="size-3" />, tone: "bg-blue-100 text-blue-700" },
  resubmit: { label: "Resubmitted", icon: <SendIcon className="size-3" />, tone: "bg-blue-100 text-blue-700" },
  verify: { label: "Identity verified", icon: <ScanFaceIcon className="size-3" />, tone: "bg-indigo-100 text-indigo-700" },
  approve: { label: "Approved", icon: <CheckIcon className="size-3" />, tone: "bg-green-100 text-green-700" },
  return: { label: "Returned", icon: <Undo2Icon className="size-3" />, tone: "bg-amber-100 text-amber-700" },
  reject: { label: "Rejected", icon: <XIcon className="size-3" />, tone: "bg-red-100 text-red-700" },
  disburse: { label: "Disbursed", icon: <BanknoteIcon className="size-3" />, tone: "bg-emerald-100 text-emerald-700" },
  comment: { label: "Comment", icon: <MessageSquareIcon className="size-3" />, tone: "bg-slate-100 text-slate-700" },
}

/** Append-only audit trail of an application: who, when, what, why. */
export function EventHistory({ applicationId }: { applicationId: string }) {
  const { state } = useWorkflow()
  const events = state.events
    .filter((e) => e.applicationId === applicationId)
    .sort((a, b) => a.at.localeCompare(b.at))

  if (events.length === 0)
    return <p className="text-sm text-muted-foreground">No events yet.</p>

  return (
    <ol className="grid gap-3">
      {events.map((e) => {
        const meta = ACTION_META[e.action]
        const actor = state.users.find((u) => u.id === e.actorId)
        const step = e.fromStepId
          ? state.steps.find((s) => s.id === e.fromStepId)
          : null
        const reason = e.reasonCodeId
          ? state.reasonCodes.find((r) => r.id === e.reasonCodeId)
          : null
        return (
          <li key={e.id} className="flex gap-3">
            <span
              className={cn(
                "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full",
                meta?.tone ?? "bg-muted text-muted-foreground"
              )}
            >
              {meta?.icon}
            </span>
            <div className="min-w-0">
              <p className="text-sm">
                <span className="font-medium">{meta?.label ?? e.action}</span>
                {step && <span className="text-muted-foreground"> · {step.name}</span>}
                <span className="text-muted-foreground"> — {actor?.name ?? e.actorId}</span>
              </p>
              {reason && (
                <p className="text-xs text-muted-foreground">
                  Reason: <span className="font-medium text-foreground">{reason.label}</span>
                </p>
              )}
              {e.comment && (
                <p className="mt-0.5 rounded-lg bg-muted px-2.5 py-1.5 text-xs">{e.comment}</p>
              )}
              <p className="mt-0.5 text-xs text-muted-foreground">
                {new Date(e.at).toLocaleString()}
              </p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
