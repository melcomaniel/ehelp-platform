"use client"

import * as React from "react"

import { Field, NativeSelect } from "@/components/workflow/bits"
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
import type { DisbursementInstrument, Step } from "@/lib/workflow/types"
import { INSTRUMENT_LABEL } from "@/lib/workflow/types"
import {
  BanknoteIcon,
  CheckCircle2Icon,
  QrCodeIcon,
} from "lucide-react"

/** Release form for an approved application waiting at a disbursement step. */
export function DisbursementReleaseCard({
  step,
  applicationId,
  applicantName,
}: {
  step: Step
  applicationId: string
  applicantName: string
}) {
  const { disburseApplication } = useWorkflow()
  const { toast } = usePrompts()
  const instruments = Object.keys(INSTRUMENT_LABEL) as DisbursementInstrument[]

  const [payee, setPayee] = React.useState(applicantName)
  const [amount, setAmount] = React.useState("")
  const [instrument, setInstrument] = React.useState<DisbursementInstrument>("cash")
  const [scanOpen, setScanOpen] = React.useState(false)

  const amountNum = Number(amount)
  const valid = payee.trim() !== "" && amountNum > 0

  const onScanned = () => {
    setScanOpen(false)
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
        <Button size="sm" className="justify-self-start" disabled={!valid} onClick={() => setScanOpen(true)}>
          <BanknoteIcon /> Release funds
        </Button>
      </CardContent>

      {scanOpen && (
        <QrScanModal
          description={`₱${amountNum.toLocaleString()} to ${payee.trim()} via ${INSTRUMENT_LABEL[instrument]}. Ask the applicant to present their payout QR code — a successful scan releases the funds.`}
          onScanned={onScanned}
          onCancel={() => setScanOpen(false)}
        />
      )}
    </Card>
  )
}

type ScanStatus = "scanning" | "success"

// How long the mocked scan animation runs before auto-succeeding.
const SCAN_MS = 5000

/**
 * Mocked payout-QR scan for the demo. No real camera or BarcodeDetector —
 * shows an animated QR + scanning line for a few seconds, then auto-succeeds
 * and releases the funds. Cancel is available until it completes.
 */
function QrScanModal({
  description,
  onScanned,
  onCancel,
}: {
  description: string
  onScanned: (payload: string) => void
  onCancel: () => void
}) {
  const [status, setStatus] = React.useState<ScanStatus>("scanning")

  const doneRef = React.useRef(false)
  // Kept in a ref so the timer effect doesn't restart when the parent
  // re-renders and hands us a new callback identity.
  const onScannedRef = React.useRef(onScanned)
  React.useEffect(() => {
    onScannedRef.current = onScanned
  }, [onScanned])

  React.useEffect(() => {
    const flash = window.setTimeout(() => {
      if (doneRef.current) return
      doneRef.current = true
      setStatus("success")
      // Hold the success state briefly so the scan feels acknowledged.
      window.setTimeout(() => onScannedRef.current("demo-mock-scan"), 900)
    }, SCAN_MS)
    return () => window.clearTimeout(flash)
  }, [])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-xl border bg-background p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center gap-2">
          <QrCodeIcon className="size-4" />
          <h2 className="font-heading text-base font-semibold">Scan payout QR</h2>
        </div>
        <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>

        <div className="relative mt-4 aspect-square w-full overflow-hidden rounded-lg bg-neutral-900">
          {status === "scanning" && (
            <>
              {/* mock QR — flashing to read as "acquiring" */}
              <div className="absolute inset-0 flex items-center justify-center">
                <MockQr className="size-2/3 animate-pulse text-white" />
              </div>
              {/* scan viewport + travelling line */}
              <div className="pointer-events-none absolute inset-8 overflow-hidden rounded-lg border-2 border-white/70 @container-size">
                <div className="absolute inset-x-0 top-0 h-0.5 animate-scan-line bg-primary shadow-[0_0_12px_2px] shadow-primary" />
              </div>
              <p className="absolute inset-x-0 bottom-3 text-center text-xs text-white/70">
                Reading QR…
              </p>
            </>
          )}
          {status === "success" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-green-600/90 text-white">
              <CheckCircle2Icon className="size-10" />
              <p className="text-sm font-medium">QR scanned</p>
            </div>
          )}
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" disabled={status === "success"} onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  )
}

/** Decorative fake QR glyph (not a real scannable code). */
function MockQr({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" fill="currentColor" className={className} aria-hidden>
      {/* finder patterns */}
      <path d="M0 0h28v28H0zM6 6v16h16V6z" />
      <rect x="10" y="10" width="8" height="8" />
      <path d="M72 0h28v28H72zM78 6v16h16V6z" />
      <rect x="82" y="10" width="8" height="8" />
      <path d="M0 72h28v28H0zM6 78v16h16V78z" />
      <rect x="10" y="82" width="8" height="8" />
      {/* scattered data modules */}
      <rect x="36" y="4" width="8" height="8" />
      <rect x="52" y="4" width="8" height="8" />
      <rect x="36" y="20" width="8" height="8" />
      <rect x="60" y="20" width="8" height="8" />
      <rect x="4" y="36" width="8" height="8" />
      <rect x="20" y="36" width="8" height="8" />
      <rect x="40" y="40" width="8" height="8" />
      <rect x="56" y="36" width="8" height="8" />
      <rect x="72" y="40" width="8" height="8" />
      <rect x="88" y="36" width="8" height="8" />
      <rect x="36" y="52" width="8" height="8" />
      <rect x="52" y="56" width="8" height="8" />
      <rect x="68" y="56" width="8" height="8" />
      <rect x="88" y="52" width="8" height="8" />
      <rect x="40" y="72" width="8" height="8" />
      <rect x="56" y="72" width="8" height="8" />
      <rect x="72" y="72" width="8" height="8" />
      <rect x="88" y="72" width="8" height="8" />
      <rect x="40" y="88" width="8" height="8" />
      <rect x="60" y="88" width="8" height="8" />
      <rect x="76" y="88" width="8" height="8" />
      <rect x="92" y="88" width="8" height="8" />
    </svg>
  )
}
