"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";

import { Button } from "@/components/ui/button";

type ClaimQrScannerProps = {
  disabled?: boolean;
  onScan: (value: string) => void;
};

/**
 * Camera QR scanner for Office Admin cash-window claim codes.
 * Prefers rear camera; falls back to paste when camera is denied.
 */
export function ClaimQrScanner({ disabled, onScan }: ClaimQrScannerProps) {
  const reactId = useId().replace(/:/g, "");
  const regionId = `claim-qr-reader-${reactId}`;
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const handledRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    handledRef.current = false;
    setError(null);
    setStarting(true);

    async function start() {
      try {
        const scanner = new Html5Qrcode(regionId, {
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
          verbose: false,
        });
        scannerRef.current = scanner;

        const cameras = await Html5Qrcode.getCameras();
        if (!cameras.length) {
          throw new Error("No camera found on this device.");
        }
        const rear =
          cameras.find((c) => /back|rear|environment/i.test(c.label)) ??
          cameras[cameras.length - 1];

        await scanner.start(
          rear.id,
          {
            fps: 8,
            qrbox: { width: 240, height: 240 },
            aspectRatio: 1,
          },
          (decoded) => {
            if (handledRef.current || cancelled) return;
            const value = decoded.trim();
            if (!value) return;
            handledRef.current = true;
            onScan(value);
            void stopScanner();
            setOpen(false);
          },
          () => {
            /* ignore frame-level no-match errors */
          },
        );
        if (!cancelled) setStarting(false);
      } catch (e) {
        if (cancelled) return;
        setStarting(false);
        setError(
          e instanceof Error
            ? e.message
            : "Could not open camera. Allow camera access or paste the QR text.",
        );
      }
    }

    void start();

    return () => {
      cancelled = true;
      void stopScanner();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- start once per open
  }, [open, regionId]);

  async function stopScanner() {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    if (!scanner) return;
    try {
      if (scanner.isScanning) {
        await scanner.stop();
      }
      scanner.clear();
    } catch {
      /* already stopped */
    }
  }

  async function close() {
    await stopScanner();
    setOpen(false);
    setStarting(false);
  }

  if (!open) {
    return (
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        Scan QR with camera
      </Button>
    );
  }

  return (
    <div className="space-y-2 rounded-md border bg-muted/30 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">Point camera at beneficiary QR</p>
        <Button type="button" size="sm" variant="ghost" onClick={() => void close()}>
          Close
        </Button>
      </div>
      <div
        id={regionId}
        className="overflow-hidden rounded-md bg-black [&_video]:max-h-72 [&_video]:w-full [&_video]:object-cover"
      />
      {starting ? (
        <p className="text-xs text-muted-foreground">Starting camera…</p>
      ) : null}
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Hold steady until the code is recognized. You can still paste manually
          below.
        </p>
      )}
    </div>
  );
}
