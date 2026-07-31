"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import { nestFetch } from "@/lib/api/nest";
import { ClaimQrScanner } from "@/components/admin/claim-qr-scanner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const CLAIM_PENDING_KEY = "ehelp_claim_pending";

type BookingSummary = {
  booking_id: string;
  reference_no: string | null;
  queue_number: number;
  status: string;
  validated_at: string | null;
  beneficiary_name: string;
  beneficiary_phone: string | null;
  slot_starts_at: string;
  slot_ends_at: string;
  site_name: string | null;
  site_address: string | null;
};

type PreviewResult = {
  ok: boolean;
  requires_face_liveness?: boolean;
  already_validated?: boolean;
  message: string;
  booking: BookingSummary;
};

type ValidateResult = {
  ok: boolean;
  already_validated?: boolean;
  already_claimed?: boolean;
  face_liveness_passed?: boolean;
  message: string;
  booking: BookingSummary;
  claim?: {
    id: string | null;
    claimed_at?: string;
    status?: string;
    face_liveness?: Record<string, unknown> | null;
  } | null;
  liveness?: {
    status?: string;
    confidence_score?: number;
    face_match_pending?: boolean;
  };
};

type LivenessStartResult = {
  ok: boolean;
  already_validated?: boolean;
  message: string;
  booking?: BookingSummary;
  liveness?: { token: string; url: string };
};

/**
 * Office Admin cash-window tool: scan claim QR → beneficiary face liveness →
 * complete disbursement. Face match against PhilSys can be layered later.
 */
export default function DisbursementValidateClient() {
  const searchParams = useSearchParams();
  const livenessCallbackToken = searchParams.get("token")?.trim() ?? "";
  const finishingRef = useRef(false);

  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [result, setResult] = useState<ValidateResult | null>(null);

  useEffect(() => {
    if (!livenessCallbackToken || finishingRef.current) return;
    finishingRef.current = true;

    const pendingRaw = sessionStorage.getItem(CLAIM_PENDING_KEY);
    if (!pendingRaw) {
      setError(
        "Missing pending claim after face check. Scan the QR again, then complete face liveness.",
      );
      return;
    }

    let pending: { claim_token: string };
    try {
      pending = JSON.parse(pendingRaw) as { claim_token: string };
    } catch {
      setError("Could not restore pending claim. Scan the QR again.");
      return;
    }

    async function finish() {
      setBusy(true);
      setError(null);
      setStatus("Confirming beneficiary face liveness…");
      try {
        const res = await nestFetch<ValidateResult>(
          "/admin/disbursement-claims/validate",
          {
            method: "POST",
            body: {
              claim_token: pending.claim_token,
              liveness_session_token: livenessCallbackToken,
            },
          },
        );
        sessionStorage.removeItem(CLAIM_PENDING_KEY);
        setResult(res);
        setPreview(null);
        setToken("");
        setStatus(null);
        // Drop ?token= from the URL without a full navigation.
        window.history.replaceState({}, "", "/admin/disbursement-validate");
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setStatus(null);
        finishingRef.current = false;
      } finally {
        setBusy(false);
      }
    }

    void finish();
  }, [livenessCallbackToken]);

  async function lookupClaim(raw?: string) {
    const claim = (raw ?? token).trim();
    if (!claim) {
      setError("Scan, paste, or type the claim QR payload / token.");
      return;
    }
    if (raw != null) setToken(claim);
    setBusy(true);
    setError(null);
    setResult(null);
    setPreview(null);
    setStatus("Looking up claim…");
    try {
      const res = await nestFetch<PreviewResult>(
        "/admin/disbursement-claims/preview",
        {
          method: "POST",
          body: { claim_token: claim },
        },
      );
      setPreview(res);
      setStatus(null);
      if (res.already_validated) {
        setResult({
          ok: true,
          already_validated: true,
          message: res.message,
          booking: res.booking,
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus(null);
    } finally {
      setBusy(false);
    }
  }

  async function startFaceLiveness() {
    const claimToken = token.trim();
    if (!claimToken) {
      setError("Paste the claim QR before starting face liveness.");
      return;
    }
    setBusy(true);
    setError(null);
    setStatus("Starting beneficiary face liveness…");
    try {
      const callbackUrl = `${window.location.origin}/admin/disbursement-validate`;
      const res = await nestFetch<LivenessStartResult>(
        "/admin/disbursement-claims/liveness-session",
        {
          method: "POST",
          body: {
            claim_token: claimToken,
            callback_url: callbackUrl,
          },
        },
      );
      if (res.already_validated && res.booking) {
        setResult({
          ok: true,
          already_validated: true,
          message: res.message,
          booking: res.booking,
        });
        setStatus(null);
        setBusy(false);
        return;
      }
      if (!res.liveness?.url) {
        throw new Error("Liveness URL missing");
      }
      sessionStorage.setItem(
        CLAIM_PENDING_KEY,
        JSON.stringify({ claim_token: claimToken }),
      );
      window.location.href = res.liveness.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus(null);
      setBusy(false);
    }
  }

  const showPreviewCard =
    preview && !result && !preview.already_validated ? preview : null;

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Validate disbursement QR
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Office Admin only. Scan the unique claim code from the beneficiary
          phone, then have the beneficiary complete face liveness on this device
          before releasing the cash grant.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Claim code</CardTitle>
          <CardDescription>
            Accepts the full QR text (
            <code className="text-xs">EHELP|claim=…|action=disburse_claim</code>
            ) or the raw claim token.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <ClaimQrScanner
            disabled={busy}
            onScan={(value) => {
              void lookupClaim(value);
            }}
          />
          <div className="space-y-1.5">
            <Label htmlFor="claim">Or paste QR payload / token</Label>
            <Input
              id="claim"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="EHELP|claim=… or paste token"
              autoComplete="off"
              disabled={busy}
              onKeyDown={(e) => {
                if (e.key === "Enter") void lookupClaim();
              }}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={busy} onClick={() => void lookupClaim()}>
              {busy && !livenessCallbackToken ? "Working…" : "Look up claim"}
            </Button>
            {showPreviewCard?.requires_face_liveness ? (
              <Button
                size="sm"
                variant="default"
                disabled={busy}
                onClick={() => void startFaceLiveness()}
              >
                Verify face &amp; complete
              </Button>
            ) : null}
          </div>
          {status ? (
            <p className="text-sm text-muted-foreground">{status}</p>
          ) : null}
          {error ? (
            <p
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {showPreviewCard ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Claimant ready</CardTitle>
            <CardDescription>{showPreviewCard.message}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <BookingDetails booking={showPreviewCard.booking} />
            <p className="text-sm text-muted-foreground">
              Hand this device to the beneficiary for face liveness. Face match
              against PhilSys can be added later; liveness is required now.
            </p>
            <Button
              size="sm"
              disabled={busy}
              onClick={() => void startFaceLiveness()}
            >
              Start beneficiary face liveness
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {result ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {result.already_claimed || result.already_validated
                ? "Already claimed"
                : result.face_liveness_passed
                  ? "Claimed — face liveness saved"
                  : "Claimed"}
            </CardTitle>
            <CardDescription>{result.message}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
              <p className="text-xs text-muted-foreground">Application status</p>
              <p className="font-medium">claimed</p>
              {result.claim?.claimed_at ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Claimed at{" "}
                  {new Date(result.claim.claimed_at).toLocaleString()}
                </p>
              ) : null}
            </div>
            <BookingDetails booking={result.booking} />
            {result.liveness?.face_match_pending ||
            result.claim?.face_liveness ? (
              <p className="text-xs text-muted-foreground">
                Face liveness is stored on this claim for a future PhilSys /
                enrollment face match. Application is completed.
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function BookingDetails({ booking }: { booking: BookingSummary }) {
  return (
    <div className="grid gap-2 text-sm sm:grid-cols-2">
      <div>
        <p className="text-xs text-muted-foreground">Beneficiary</p>
        <p className="font-medium">{booking.beneficiary_name}</p>
      </div>
      <div>
        <p className="text-xs text-muted-foreground">Contact</p>
        <p>{booking.beneficiary_phone || "—"}</p>
      </div>
      <div>
        <p className="text-xs text-muted-foreground">Application</p>
        <p>{booking.reference_no || booking.booking_id}</p>
      </div>
      <div>
        <p className="text-xs text-muted-foreground">Queue #</p>
        <p className="tabular-nums">{booking.queue_number}</p>
      </div>
      <div className="sm:col-span-2">
        <p className="text-xs text-muted-foreground">Slot / site</p>
        <p>
          {new Date(booking.slot_starts_at).toLocaleString()} →{" "}
          {new Date(booking.slot_ends_at).toLocaleString()}
        </p>
        <p className="text-muted-foreground">
          {[booking.site_name, booking.site_address].filter(Boolean).join(" — ") ||
            "—"}
        </p>
      </div>
    </div>
  );
}
