"use client";

import { RefreshCw } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import type { ReconcileRunSummary } from "@/lib/shopify/reconciliation-run";

type SyncSignalState =
  | { kind: "checking"; label: "Checking Shopify" }
  | { kind: "current"; label: "Shopify current" }
  | { kind: "differences"; label: string }
  | { kind: "partial"; label: "Check incomplete" }
  | { kind: "unavailable"; label: "Shopify unavailable" };

function signalState(run: ReconcileRunSummary | null): SyncSignalState {
  if (!run || run.status === "QUEUED" || run.status === "RUNNING") {
    return { kind: "checking", label: "Checking Shopify" };
  }
  if (run.status === "FAILED") return { kind: "unavailable", label: "Shopify unavailable" };
  if (run.status === "PARTIAL") return { kind: "partial", label: "Check incomplete" };
  if (run.differenceCount > 0) {
    return {
      kind: "differences",
      label: `${run.differenceCount} change${run.differenceCount === 1 ? "" : "s"} to review`,
    };
  }
  return { kind: "current", label: "Shopify current" };
}

async function readResponse(response: Response) {
  const payload = await response.json().catch(() => ({})) as {
    run?: ReconcileRunSummary | null;
    error?: string;
  };
  if (!response.ok) throw new Error(payload.error || "Shopify check could not be completed.");
  return payload.run ?? null;
}

export function AdminShopifySyncSignal({ initialRun }: { initialRun: ReconcileRunSummary | null }) {
  const [run, setRun] = useState(initialRun);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [autoChecking, setAutoChecking] = useState(true);
  const [manualChecking, setManualChecking] = useState(false);
  const mounted = useRef(true);
  const started = useRef(false);
  const isChecking = autoChecking || manualChecking;
  const state = isChecking
    ? { kind: "checking", label: "Checking Shopify" } as const
    : requestError
    ? { kind: "unavailable", label: "Shopify unavailable" } as const
    : signalState(run);

  const poll = useCallback(async (candidate: ReconcileRunSummary | null) => {
    let current = candidate;
    while (mounted.current && current && (current.status === "QUEUED" || current.status === "RUNNING")) {
      await new Promise((resolve) => window.setTimeout(resolve, 1800));
      if (!mounted.current) return current;
      current = await readResponse(await fetch("/admin/api/shopify/reconcile", {
        method: "GET",
        cache: "no-store",
        headers: { Accept: "application/json" },
      }));
      if (mounted.current) setRun(current);
    }
    return current;
  }, []);

  const performCheck = useCallback(async (trigger: "AUTO" | "MANUAL") => {
    const next = await readResponse(await fetch("/admin/api/shopify/reconcile", {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ trigger }),
    }));
    if (!mounted.current) return;
    setRun(next);
    await poll(next);
  }, [poll]);

  useEffect(() => {
    mounted.current = true;
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
  }, [performCheck]);

  async function checkNow() {
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
      ? `Last checked ${new Date(run.completedAt).toLocaleString("en")}`
      : "Translation sync is checked when the admin opens.");

  return (
    <div className="adm-sync-signal" data-state={state.kind} title={title}>
      <Link href="/admin/translations" className="adm-sync-signal__link" aria-label={`${state.label}. Open Shopify sync.`}>
        <span className="adm-sync-signal__dot" aria-hidden="true" />
        <span className="adm-sync-signal__label">{state.label}</span>
      </Link>
      <button
        type="button"
        className="adm-sync-signal__refresh"
        aria-label="Check Shopify sync now"
        disabled={state.kind === "checking"}
        onClick={() => void checkNow()}
      >
        <RefreshCw size={13} aria-hidden="true" />
      </button>
      <span className="sr-only" role="status" aria-live="polite">{state.label}</span>
    </div>
  );
}
