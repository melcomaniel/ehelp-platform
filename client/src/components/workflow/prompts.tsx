"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { CheckCircle2Icon, InfoIcon, XCircleIcon, XIcon } from "lucide-react"

// ---------------------------------------------------------------------------
// Global prompts: one toast stack + one confirm dialog, mounted once in the
// workflow layout. They live above routing, so a toast fired right before a
// redirect is still visible on the destination page.
// ---------------------------------------------------------------------------

type ToastVariant = "success" | "error" | "info"

interface Toast {
  id: number
  title: string
  description?: string
  variant: ToastVariant
}

interface ConfirmOptions {
  title: string
  description: string
  confirmLabel?: string
  destructive?: boolean
}

interface PromptsApi {
  toast: (t: Omit<Toast, "id">) => void
  confirm: (options: ConfirmOptions) => Promise<boolean>
}

const PromptsContext = React.createContext<PromptsApi | null>(null)

const TOAST_ICON: Record<ToastVariant, React.ReactNode> = {
  success: <CheckCircle2Icon className="size-4 text-green-600" />,
  error: <XCircleIcon className="size-4 text-red-600" />,
  info: <InfoIcon className="size-4 text-blue-600" />,
}

let toastId = 0

export function PromptsProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([])
  const [confirmState, setConfirmState] = React.useState<
    (ConfirmOptions & { resolve: (v: boolean) => void }) | null
  >(null)

  const dismiss = React.useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const api = React.useMemo<PromptsApi>(
    () => ({
      toast: (t) => {
        toastId += 1
        const id = toastId
        setToasts((prev) => [...prev, { ...t, id }])
        window.setTimeout(() => dismiss(id), 6000)
      },
      confirm: (options) =>
        new Promise<boolean>((resolve) => {
          setConfirmState({ ...options, resolve })
        }),
    }),
    [dismiss]
  )

  const settle = (value: boolean) => {
    confirmState?.resolve(value)
    setConfirmState(null)
  }

  return (
    <PromptsContext.Provider value={api}>
      {children}

      {/* toast stack */}
      <div className="pointer-events-none fixed right-4 bottom-4 z-50 flex w-80 flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto flex items-start gap-2.5 rounded-lg border bg-background p-3 shadow-lg",
              t.variant === "error" && "border-red-200",
              t.variant === "success" && "border-green-200"
            )}
            role="status"
          >
            <div className="mt-0.5 shrink-0">{TOAST_ICON[t.variant]}</div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{t.title}</p>
              {t.description && (
                <p className="mt-0.5 text-xs text-muted-foreground">{t.description}</p>
              )}
            </div>
            <button
              onClick={() => dismiss(t.id)}
              className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted"
              aria-label="Dismiss"
            >
              <XIcon className="size-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* confirm dialog */}
      {confirmState && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => settle(false)}
        >
          <div
            className="w-full max-w-md rounded-xl border bg-background p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            role="alertdialog"
            aria-modal="true"
          >
            <h2 className="font-heading text-base font-semibold">{confirmState.title}</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">{confirmState.description}</p>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => settle(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                variant={confirmState.destructive ? "destructive" : "default"}
                onClick={() => settle(true)}
              >
                {confirmState.confirmLabel ?? "Confirm"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </PromptsContext.Provider>
  )
}

export function usePrompts() {
  const ctx = React.useContext(PromptsContext)
  if (!ctx) throw new Error("usePrompts must be used inside <PromptsProvider>")
  return ctx
}
