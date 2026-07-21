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
  CameraOffIcon,
  CheckCircle2Icon,
  QrCodeIcon,
} from "lucide-react"

// Native BarcodeDetector is not in the TS DOM lib yet (Chromium-only API).
interface DetectedBarcode {
  rawValue: string
}
interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>
}
declare global {
  interface Window {
    BarcodeDetector?: new (options?: { formats?: string[] }) => BarcodeDetectorLike
  }
}

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

type ScanStatus = "starting" | "scanning" | "no-camera" | "success"

/**
 * Camera QR scanner in a modal. Uses the native BarcodeDetector where
 * available; the simulate button covers browsers without it (demo escape
 * hatch, also works when no camera is present).
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
  const videoRef = React.useRef<HTMLVideoElement>(null)
  const [status, setStatus] = React.useState<ScanStatus>("starting")
  const [detectorMissing, setDetectorMissing] = React.useState(false)

  const doneRef = React.useRef(false)
  // Kept in a ref so the camera effect doesn't restart when the parent
  // re-renders and hands us a new callback identity.
  const onScannedRef = React.useRef(onScanned)
  React.useEffect(() => {
    onScannedRef.current = onScanned
  }, [onScanned])

  const succeed = React.useCallback((payload: string) => {
    if (doneRef.current) return
    doneRef.current = true
    setStatus("success")
    // Hold the success state briefly so the scan feels acknowledged.
    window.setTimeout(() => onScannedRef.current(payload), 900)
  }, [])

  React.useEffect(() => {
    let cancelled = false
    let stream: MediaStream | null = null
    let timer: number | undefined

    const start = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        })
      } catch {
        if (!cancelled) setStatus("no-camera")
        return
      }
      const video = videoRef.current
      if (cancelled || !video) {
        stream.getTracks().forEach((t) => t.stop())
        return
      }
      video.srcObject = stream
      try {
        await video.play()
      } catch {
        // play() rejects if the modal unmounts mid-start; cleanup handles it
      }
      if (cancelled) return
      setStatus("scanning")

      if (!window.BarcodeDetector) {
        setDetectorMissing(true)
        return
      }
      const detector = new window.BarcodeDetector({ formats: ["qr_code"] })
      timer = window.setInterval(async () => {
        const v = videoRef.current
        if (cancelled || doneRef.current || !v || v.readyState < 2) return
        try {
          const codes = await detector.detect(v)
          if (!cancelled && codes.length > 0) {
            window.clearInterval(timer)
            succeed(codes[0].rawValue)
          }
        } catch {
          // frame not decodable yet — keep polling
        }
      }, 250)
    }

    start()
    return () => {
      cancelled = true
      if (timer) window.clearInterval(timer)
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [succeed])

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

        <div className="relative mt-4 aspect-square w-full overflow-hidden rounded-lg bg-black">
          <video
            ref={videoRef}
            muted
            playsInline
            className="absolute inset-0 size-full object-cover"
          />
          {status === "scanning" && (
            <div className="pointer-events-none absolute inset-8 rounded-lg border-2 border-white/70" />
          )}
          {status === "starting" && (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-white/80">
              Starting camera…
            </div>
          )}
          {status === "no-camera" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center text-white/80">
              <CameraOffIcon className="size-6" />
              <p className="text-sm">
                Camera unavailable. Grant camera access, or simulate the scan below.
              </p>
            </div>
          )}
          {status === "success" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-green-600/90 text-white">
              <CheckCircle2Icon className="size-10" />
              <p className="text-sm font-medium">QR scanned</p>
            </div>
          )}
        </div>

        {detectorMissing && status === "scanning" && (
          <p className="mt-2 text-xs text-muted-foreground">
            This browser cannot decode QR codes natively — use the simulate button below.
          </p>
        )}

        <div className="mt-5 flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            disabled={status === "success"}
            onClick={() => succeed("demo-simulated-scan")}
          >
            Simulate scan
          </Button>
          <Button variant="outline" size="sm" disabled={status === "success"} onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  )
}
