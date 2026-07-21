"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import type { Step } from "@/lib/workflow/types"
import { cn } from "@/lib/utils"
import { CameraIcon, CheckCircle2Icon, Loader2Icon, ScanFaceIcon } from "lucide-react"

type Phase = "idle" | "starting" | "live" | "scanning" | "done" | "denied"

/**
 * Applicant-facing face check for a verify step. Opens the real webcam via
 * getUserMedia, then runs a mocked liveness "scan" (no real eVerify call) and
 * reports a pass/fail with a face score.
 */
export function FaceCheck({
  step,
  onResult,
}: {
  step: Step
  onResult: (passed: boolean, faceScore: number) => void
}) {
  const config = step.verifyConfig
  const videoRef = React.useRef<HTMLVideoElement>(null)
  const streamRef = React.useRef<MediaStream | null>(null)
  const [phase, setPhase] = React.useState<Phase>("idle")
  const [error, setError] = React.useState<string | null>(null)

  const stop = React.useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  React.useEffect(() => stop, [stop])

  const start = async () => {
    setError(null)
    setPhase("starting")
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setPhase("live")
    } catch {
      setPhase("denied")
      setError("Camera access was blocked. Allow the camera to run the face check.")
    }
  }

  const scan = () => {
    setPhase("scanning")
    // mocked liveness — deterministic-ish pass with a plausible score
    window.setTimeout(() => {
      const faceScore = 88 + Math.floor((Date.now() % 1000) / 100) // 88–97
      stop()
      setPhase("done")
      onResult(true, faceScore)
    }, 1800)
  }

  const providerName = config?.provider ?? "eVerify"

  return (
    <div className="grid gap-3">
      <div className="relative aspect-video w-full max-w-md overflow-hidden rounded-xl border bg-muted">
        <video
          ref={videoRef}
          muted
          playsInline
          className={cn("h-full w-full object-cover", (phase === "idle" || phase === "denied" || phase === "starting") && "hidden")}
        />
        {(phase === "idle" || phase === "starting" || phase === "denied") && (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
            <ScanFaceIcon className="size-10" />
            <p className="text-sm">{phase === "starting" ? "Starting camera…" : "Camera preview"}</p>
          </div>
        )}
        {phase === "scanning" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <div className="flex items-center gap-2 rounded-lg bg-background/90 px-3 py-2 text-sm">
              <Loader2Icon className="size-4 animate-spin" /> Checking liveness…
            </div>
          </div>
        )}
        {phase === "done" && (
          <div className="absolute inset-0 flex items-center justify-center bg-green-600/20">
            <div className="flex items-center gap-2 rounded-lg bg-background/90 px-3 py-2 text-sm text-green-700">
              <CheckCircle2Icon className="size-4" /> Face verified
            </div>
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        {providerName} · {config?.faceLiveness ? "face liveness" : "identity check"}
        {config?.philsysMatch ? " + PhilSys match" : ""}
      </p>
      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex gap-2">
        {(phase === "idle" || phase === "denied") && (
          <Button size="sm" onClick={start}>
            <CameraIcon /> Open camera
          </Button>
        )}
        {phase === "live" && (
          <Button size="sm" onClick={scan}>
            <ScanFaceIcon /> Scan face
          </Button>
        )}
        {phase === "scanning" && (
          <Button size="sm" disabled>
            <Loader2Icon className="animate-spin" /> Scanning…
          </Button>
        )}
      </div>
    </div>
  )
}
