"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { useAdminShopifyCheckControls } from "@/components/admin/translations/admin-shopify-check-context";
import type { ReconcileRunSummary } from "@/lib/shopify/reconciliation-run";
import { formatAdminDateTime } from "@/lib/format/admin-date";

type SyncSignalState =
  | { kind: "checking"; label: "Checking Shopify…" }
  | { kind: "current"; label: string }
  | { kind: "failed"; label: "Check failed" }
  | { kind: "disconnected"; label: "Shopify disconnected" };

function formatCheckedAt(iso: string | null | undefined): string | null {
  if (!iso) return null;
  try {
    return formatAdminDateTime(iso);
  } catch {
    return null;
  }
}

function signalState(
  run: ReconcileRunSummary | null,
  connected: boolean,
  requestError: string | null,
): SyncSignalState {
  if (!connected) {
    return { kind: "disconnected", label: "Shopify disconnected" };
  }
  if (!run || run.status === "QUEUED" || run.status === "RUNNING") {
    return { kind: "checking", label: "Checking Shopify…" };
  }
  if (run.status === "FAILED" || run.status === "PARTIAL" || requestError) {
    return { kind: "failed", label: "Check failed" };
  }
  const when = formatCheckedAt(run.completedAt);
  return {
    kind: "current",
    label: when ? `Shopify current ${when}` : "Shopify current",
  };
}

async function readResponse(response: Response) {
  const payload = await response.json().catch(() => ({})) as {
    run?: ReconcileRunSummary | null;
    error?: string;
    alreadyRunning?: boolean;
  };
  if (!response.ok) throw new Error(payload.error || "Shopify check could not be completed.");
  return payload;
}

export function AdminShopifySyncSignal({
  initialRun,
  connected = true,
}: {
  initialRun: ReconcileRunSummary | null;
  /** False when Admin API credentials are missing. */
  connected?: boolean;
}) {
  const router = useRouter();
  const { checkRunning, setCheckRunning } = useAdminShopifyCheckControls();
  const [run, setRun] = useState(initialRun);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [autoChecking, setAutoChecking] = useState(connected);
  const [manualChecking, setManualChecking] = useState(false);
  const [prevConnected, setPrevConnected] = useState(connected);
  const mounted = useRef(true);
  const started = useRef(false);

  if (connected !== prevConnected) {
    setPrevConnected(connected);
    if (!connected) setAutoChecking(false);
  }

  const clientChecking = autoChecking || manualChecking;
  const serverChecking = Boolean(
    run && (run.status === "QUEUED" || run.status === "RUNNING"),
  );
  // Do not OR context checkRunning here — that would latch true forever when we publish it.
  const isChecking = connected && (clientChecking || serverChecking);
  if (checkRunning !== isChecking) {
    setCheckRunning(isChecking);
  }

  const state = !connected
    ? ({ kind: "disconnected", label: "Shopify disconnected" } as const)
    : isChecking
      ? ({ kind: "checking", label: "Checking Shopify…" } as const)
      : signalState(run, connected, requestError);

  const poll = useCallback(async (candidate: ReconcileRunSummary | null) => {
    let current = candidate;
    while (mounted.current && current && (current.status === "QUEUED" || current.status === "RUNNING")) {
      await new Promise((resolve) => window.setTimeout(resolve, 1800));
      if (!mounted.current) return current;
      const payload = await readResponse(await fetch("/admin/api/shopify/reconcile", {
        method: "GET",
        cache: "no-store",
        headers: { Accept: "application/json" },
      }));
      current = payload.run ?? null;
      if (mounted.current) setRun(current);
    }
    return current;
  }, []);

  const performCheck = useCallback(async (trigger: "AUTO" | "MANUAL") => {
    const payload = await readResponse(await fetch("/admin/api/shopify/reconcile", {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ trigger }),
    }));
    if (!mounted.current) return;
    const next = payload.run ?? null;
    setRun(next);
    await poll(next);
    // Refresh RSC banners / nav counters from the same waterfall result.
    router.refresh();
  }, [poll, router]);

  useEffect(() => {
    mounted.current = true;
    if (!connected) {
      return () => {
        mounted.current = false;
      };
    }
    if (!started.current) {
      started.current = true;
      void performCheck("AUTO")
        .catch((error) => {
          if (mounted.current) {
            setRequestError(error instanceof Error ? error.message : "Shopify check could not be completed.");
          }
        })
        .finally(() => {
          if (mounted.current) setAutoChecking(false);
        });
    }
    return () => {
      mounted.current = false;
    };
  }, [connected, performCheck]);

  async function checkNow() {
    if (!connected || state.kind === "checking") return;
    setRequestError(null);
    setManualChecking(true);
    try {
      await performCheck("MANUAL");
    } catch (error) {
      if (mounted.current) {
        setRequestError(error instanceof Error ? error.message : "Shopify check could not be completed.");
      }
    } finally {
      if (mounted.current) setManualChecking(false);
    }
  }

  const title = requestError
    ?? run?.error
    ?? (run?.completedAt
      ? `Last checked ${formatCheckedAt(run.completedAt)}`
      : connected
        ? "Shopify catalog sync runs once when the admin session opens."
        : "Shopify Admin API credentials are not configured.");

  const failedClickable = state.kind === "failed";

  return (
    <div className="adm-sync-signal" data-state={state.kind} title={title}>
      {failedClickable ? (
        <button
          type="button"
          className="adm-sync-signal__link"
          aria-label={`${state.label}. Retry check.`}
          onClick={() => void checkNow()}
        >
          <span className="adm-sync-signal__dot" aria-hidden="true" />
          <span className="adm-sync-signal__label">{state.label}</span>
        </button>
      ) : (
        <span className="adm-sync-signal__link" aria-label={state.label}>
          <span className="adm-sync-signal__dot" aria-hidden="true" />
          <span className="adm-sync-signal__label">{state.label}</span>
        </span>
      )}
      <button
        type="button"
        className="adm-sync-signal__refresh"
        aria-label="Check Shopify sync now"
        disabled={state.kind === "checking" || state.kind === "disconnected"}
        onClick={() => void checkNow()}
      >
        <RefreshCw size={13} aria-hidden="true" />
      </button>
      <span className="sr-only" role="status" aria-live="polite">{state.label}</span>
    </div>
  );
}
