"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { useAdminShopifyCheckControls } from "@/components/admin/translations/admin-shopify-check-context";
import { formatAdminDateTime } from "@/lib/format/admin-date";
import { isLanguagesMissingReconcileWarning } from "@/lib/shopify/shop-locale-write-gate";
import type { ReconcileRunSummary } from "@/lib/shopify/reconciliation-run";

export type SyncSignalState =
  | { kind: "checking"; label: "Checking Shopify…" }
  | { kind: "current"; label: string }
  | { kind: "failed"; label: "Check failed" }
  | { kind: "languages-missing"; label: "Languages missing in Shopify" }
  | { kind: "disconnected"; label: "Shopify disconnected" };

function formatCheckedAt(iso: string | null | undefined): string | null {
  if (!iso) return null;
  try {
    return formatAdminDateTime(iso);
  } catch {
    return null;
  }
}

function isActiveRunStatus(status: ReconcileRunSummary["status"] | undefined): boolean {
  return status === "QUEUED" || status === "RUNNING";
}

/** Pure signal derivation — exported for mutation-proof unit tests. */
export function signalState(
  run: ReconcileRunSummary | null,
  connected: boolean,
  requestError: string | null,
): SyncSignalState {
  if (!connected) {
    return { kind: "disconnected", label: "Shopify disconnected" };
  }
  // Audit: requestError before the !run branch — a failed first AUTO must not
  // look like an endless "Checking…" and must stay retryable.
  if (requestError || run?.status === "FAILED" || run?.status === "PARTIAL") {
    return { kind: "failed", label: "Check failed" };
  }
  if (run?.status === "SUCCEEDED" && isLanguagesMissingReconcileWarning(run.error)) {
    return { kind: "languages-missing", label: "Languages missing in Shopify" };
  }
  if (!run || isActiveRunStatus(run.status)) {
    return { kind: "checking", label: "Checking Shopify…" };
  }
  const when = formatCheckedAt(run.completedAt);
  return {
    kind: "current",
    label: when ? `Shopify current ${when}` : "Shopify current",
  };
}

/** Error / warning text for tooltip and the line under the badge. */
export function syncSignalDetail(
  run: ReconcileRunSummary | null,
  requestError: string | null,
  stateKind: SyncSignalState["kind"],
): string | null {
  if (requestError) return requestError;
  if (stateKind === "failed" || stateKind === "languages-missing") {
    return run?.error ?? null;
  }
  return null;
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
  const serverChecking = Boolean(run && isActiveRunStatus(run.status));
  // Do not OR context checkRunning here — that would latch true forever when we publish it.
  const isChecking = connected && !requestError && (clientChecking || serverChecking);
  // Publish to provider in an effect — calling setCheckRunning during render updates
  // AdminShopifyCheckProvider while this child renders (React setState-in-render error → Next Issues badge).
  useEffect(() => {
    if (checkRunning !== isChecking) {
      setCheckRunning(isChecking);
    }
  }, [checkRunning, isChecking, setCheckRunning]);

  const state = !connected
    ? ({ kind: "disconnected", label: "Shopify disconnected" } as const)
    : requestError
      ? ({ kind: "failed", label: "Check failed" } as const)
      : isChecking
        ? ({ kind: "checking", label: "Checking Shopify…" } as const)
        : signalState(run, connected, requestError);

  const detail = syncSignalDetail(run, requestError, state.kind);

  const poll = useCallback(async (candidate: ReconcileRunSummary | null) => {
    let current = candidate;
    while (mounted.current && current && isActiveRunStatus(current.status)) {
      await new Promise((resolve) => window.setTimeout(resolve, 1800));
      if (!mounted.current) return current;
      try {
        const payload = await readResponse(await fetch("/admin/api/shopify/reconcile", {
          method: "GET",
          cache: "no-store",
          headers: { Accept: "application/json" },
        }));
        current = payload.run ?? null;
        if (mounted.current) setRun(current);
      } catch (error) {
        // Audit: reset run on poll failure so UI does not stay locked on Checking.
        if (mounted.current) {
          setRun(null);
          setRequestError(error instanceof Error ? error.message : "Shopify check could not be completed.");
        }
        return null;
      }
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
    setRequestError(null);
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
            setRun(null);
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
        setRun(null);
      }
    } finally {
      if (mounted.current) setManualChecking(false);
    }
  }

  // Detail stays in title/aria only — never in-flow under the chip. The topbar
  // height token is a hard budget; a second line overflows into page titles.
  const title = detail
    ?? (run?.completedAt
      ? `Last checked ${formatCheckedAt(run.completedAt)}`
      : connected
        ? "Shopify catalog sync runs once when the admin session opens."
        : "Shopify Admin API credentials are not configured.");

  // Failed / languages-missing are always retryable via the label or refresh.
  const retryClickable = state.kind === "failed" || state.kind === "languages-missing";
  const refreshDisabled = state.kind === "checking" || state.kind === "disconnected";
  const linkAria = detail
    ? (retryClickable ? `${state.label}. ${detail}. Retry check.` : `${state.label}. ${detail}`)
    : (retryClickable ? `${state.label}. Retry check.` : state.label);
  const liveStatus = detail ? `${state.label}. ${detail}` : state.label;

  return (
    <div className="adm-sync-signal" data-state={state.kind} title={title}>
      {retryClickable ? (
        <button
          type="button"
          className="adm-sync-signal__link"
          aria-label={linkAria}
          onClick={() => void checkNow()}
        >
          <span className="adm-sync-signal__dot" aria-hidden="true" />
          <span className="adm-sync-signal__label">{state.label}</span>
        </button>
      ) : (
        <span className="adm-sync-signal__link" role="img" aria-label={linkAria}>
          <span className="adm-sync-signal__dot" aria-hidden="true" />
          <span className="adm-sync-signal__label">{state.label}</span>
        </span>
      )}
      <button
        type="button"
        className="adm-sync-signal__refresh"
        aria-label="Check Shopify sync now"
        disabled={refreshDisabled}
        onClick={() => void checkNow()}
      >
        <RefreshCw size={13} aria-hidden="true" />
      </button>
      <span className="sr-only" role="status" aria-live="polite">{liveStatus}</span>
    </div>
  );
}
