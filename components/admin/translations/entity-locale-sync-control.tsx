"use client";

import { AlertTriangle, Check, ExternalLink, RefreshCw, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import type { AdminLocale } from "@/components/admin/shared/admin-locale-workspace";
import { AnimatedModal } from "@/components/ui/animated-modal";
import type { ReconcileDifferenceView, ReconcileRunSummary } from "@/lib/shopify/reconciliation-run";

export type EntitySyncScope = {
  entityType: "PRODUCT" | "COLLECTION" | "PAGE" | "STOREFRONT_COPY";
  entityId: string;
};

type EntityState = {
  run: ReconcileRunSummary | null;
  differenceCount: number;
  differences?: ReconcileDifferenceView[];
};

function stateLabel(state: EntityState | null, checking: boolean, error: string | null) {
  if (checking) return "Checking…";
  if (error) return "Check unavailable";
  if (!state?.run) return "Not checked";
  if (state.run.status === "QUEUED" || state.run.status === "RUNNING") return "Check in progress";
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

export function EntityLocaleSyncControl({
  scope,
  locale,
  localeLabel,
}: {
  scope: EntitySyncScope;
  /** The registry locale code (e.g. "pt", "ru") — the API route resolves this to Shopify's own locale code, so this component never needs that mapping itself. */
  locale: AdminLocale;
  /** Human-readable name for `locale` (e.g. "Português"), for display only. */
  localeLabel: string;
}) {
  const [state, setState] = useState<EntityState | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const query = new URLSearchParams({ ...scope, locale }).toString();

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
        body: JSON.stringify({ trigger: "LOCALE", scope: { ...scope, locale } }),
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
  const title = error ?? state?.run?.error ?? `${localeLabel} content: ${label}`;

  return (
    <>
      <div className="adm-entity-sync" data-state={error ? "error" : count > 0 ? "differences" : "current"} title={title}>
      <span className="adm-entity-sync__status" role="status" aria-live="polite">
        {count === 0 && state?.run?.status === "SUCCEEDED" ? <Check size={14} aria-hidden="true" /> : null}
        {label}
      </span>
      <button type="button" className="adm-entity-sync__review" onClick={() => setOpen(true)}>
        {count > 0 ? "Review" : "Sync details"}
      </button>
      <button
        type="button"
        className="adm-entity-sync__check"
        onClick={() => void checkLanguage()}
        disabled={checking}
        aria-label={`Check ${localeLabel} against Shopify`}
      >
        <RefreshCw size={14} aria-hidden="true" />
        <span>Check</span>
      </button>
      </div>
      <AnimatedModal
        open={open}
        onClose={() => setOpen(false)}
        className="adm-sync-modal pointer-events-auto w-full max-w-xl"
        portalClassName="admin-modal-root"
        zIndexClassName="z-[200]"
        backdropZIndexClassName="z-[190]"
      >
        <header className="adm-sync-modal__header">
          <div>
            <h2>Shopify sync · {localeLabel}</h2>
            <p>{error ?? stateLabel(state, checking, null)}</p>
          </div>
          <button type="button" className="adm-sync-modal__close" onClick={() => setOpen(false)} aria-label="Close sync details">
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        {count > 0 ? (
          <div className="adm-sync-modal__content">
            <p className="adm-sync-modal__intro">
              These are the only fields that need a decision. Shared commerce data, media and collections are not included.
            </p>
            <ul className="adm-sync-modal__list">
              {state?.differences?.map((difference) => (
                <li key={difference.id}>
                  <AlertTriangle size={15} aria-hidden="true" />
                  <span><strong>{difference.fieldLabel}</strong><small>{difference.kind === "CONFLICT" ? "Changed in both places" : difference.kind === "LOCAL_ONLY" ? "Changed in Synarava" : "Changed in Shopify"}</small></span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="adm-sync-modal__content">
            <p className="adm-sync-modal__intro">
              {state?.run?.status === "SUCCEEDED"
                ? "This language matches Shopify. There is nothing to apply."
                : "Run a language check to see whether any copy needs review. The check never changes content."}
            </p>
          </div>
        )}

        <footer className="adm-sync-modal__footer">
          <button type="button" className="adm-btn-ghost" onClick={() => void checkLanguage()} disabled={checking}>
            <RefreshCw size={15} className={checking ? "animate-spin" : ""} aria-hidden="true" />
            {checking ? "Checking…" : "Check this language"}
          </button>
          {count > 0 ? (
            <Link className="adm-btn-primary" href={reviewHref} onClick={() => setOpen(false)}>
              Compare and decide <ExternalLink size={15} aria-hidden="true" />
            </Link>
          ) : null}
        </footer>
      </AnimatedModal>
    </>
  );
}
