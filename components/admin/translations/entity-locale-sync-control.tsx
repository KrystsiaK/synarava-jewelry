"use client";

import { Check, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import type { AdminLocale } from "@/components/admin/shared/admin-locale-workspace";
import type { ReconcileRunSummary } from "@/lib/shopify/reconciliation-run";

export type EntitySyncScope = {
  entityType: "PRODUCT" | "COLLECTION" | "PAGE" | "STOREFRONT_COPY";
  entityId: string;
};

type EntityState = { run: ReconcileRunSummary | null; differenceCount: number };

function shopifyLocale(locale: AdminLocale) {
  return locale === "EN" ? "en" : "pt-PT";
}

function stateLabel(state: EntityState | null, checking: boolean, error: string | null) {
  if (checking) return "Checking…";
  if (error) return "Check unavailable";
  if (!state?.run) return "Not checked";
  if (state.run.status === "FAILED" || state.run.status === "PARTIAL") return "Check incomplete";
  if (state.differenceCount > 0) {
    return `${state.differenceCount} difference${state.differenceCount === 1 ? "" : "s"}`;
  }
  return "In sync";
}

async function responseJson(response: Response) {
  const payload = await response.json().catch(() => ({})) as EntityState & { error?: string };
  if (!response.ok) throw new Error(payload.error || "Shopify could not be checked.");
  return payload;
}

export function EntityLocaleSyncControl({ scope, locale }: { scope: EntitySyncScope; locale: AdminLocale }) {
  const [state, setState] = useState<EntityState | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const remoteLocale = shopifyLocale(locale);
  const query = new URLSearchParams({ ...scope, locale: remoteLocale }).toString();

  const refreshState = useCallback(async () => {
    const next = await responseJson(await fetch(`/admin/api/shopify/reconcile?${query}`, {
      method: "GET",
      cache: "no-store",
      headers: { Accept: "application/json" },
    }));
    setState(next);
    return next;
  }, [query]);

  useEffect(() => {
    let active = true;
    async function check() {
      try {
        await refreshState();
        if (active) setError(null);
      } catch (caught) {
        if (active) setError(caught instanceof Error ? caught.message : "Shopify could not be checked.");
      }
    }
    void check();
    return () => { active = false; };
  }, [refreshState]);

  async function checkLanguage() {
    setChecking(true);
    setError(null);
    try {
      await responseJson(await fetch("/admin/api/shopify/reconcile", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ trigger: "LOCALE", scope: { ...scope, locale: remoteLocale } }),
      }));
      await refreshState();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Shopify could not be checked.");
    } finally {
      setChecking(false);
    }
  }

  const count = state?.differenceCount ?? 0;
  const label = stateLabel(state, checking, error);
  const reviewHref = `/admin/translations?${query}`;
  const title = error ?? state?.run?.error ?? `${locale} content: ${label}`;

  return (
    <div className="adm-entity-sync" data-state={error ? "error" : count > 0 ? "differences" : "current"} title={title}>
      <span className="adm-entity-sync__status" role="status" aria-live="polite">
        {count === 0 && state?.run?.status === "SUCCEEDED" ? <Check size={14} aria-hidden="true" /> : null}
        {label}
      </span>
      {count > 0 ? (
        <Link className="adm-entity-sync__review" href={reviewHref}>Review</Link>
      ) : null}
      <button
        type="button"
        className="adm-entity-sync__check"
        onClick={() => void checkLanguage()}
        disabled={checking}
        aria-label={`Check ${locale === "EN" ? "English" : "Portuguese"} against Shopify`}
      >
        <RefreshCw size={14} aria-hidden="true" />
        <span>Check</span>
      </button>
    </div>
  );
}
