"use client";

import { useEffect, useRef } from "react";
import { GitCompareArrows, Languages, X } from "lucide-react";

import { AnimatedModal } from "@/components/ui/animated-modal";
import type { CatalogConflictProductSignal, CatalogConflictSignals } from "@/lib/shopify/catalog-conflict-signals";

function plural(count: number, singular: string, pluralWord: string) {
  return `${count} ${count === 1 ? singular : pluralWord}`;
}

function statusText(signals: CatalogConflictSignals) {
  if (signals.state === "disconnected") return "Shopify disconnected · saved conflicts may be outdated";
  if (signals.state === "failed") return "Conflict status unavailable · saved conflicts may be outdated";
  if (signals.state === "checking") return "Checking Shopify · showing saved conflicts";
  if (signals.state === "stale") return "Saved conflict status · check may be outdated";
  return signals.totalCount === 0 ? "No saved conflicts" : `${plural(signals.totalCount ?? 0, "product", "products")} with conflicts`;
}

export function CatalogConflictStatus({
  signals,
  onShow,
  compact = false,
}: {
  signals: CatalogConflictSignals;
  onShow: () => void;
  compact?: boolean;
}) {
  const hasConflicts = signals.totalCount !== null && signals.totalCount > 0;
  return (
    <div
      className={`flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2 ${compact ? "text-xs" : "text-sm"}`}
      style={{
        borderColor: "color-mix(in srgb, var(--adm-warning) 52%, var(--adm-border))",
        background: "color-mix(in srgb, var(--adm-warning) 8%, var(--adm-panel))",
        color: "var(--adm-ink)",
      }}
      role={compact ? undefined : "status"}
    >
      <GitCompareArrows className="size-4 shrink-0" style={{ color: "var(--adm-warning)" }} aria-hidden="true" />
      <span className="font-semibold">{statusText(signals)}</span>
      {signals.totalCount !== null && signals.state !== "ready" && hasConflicts ? (
        <span className="text-[var(--adm-muted)]">{plural(signals.totalCount, "saved conflict", "saved conflicts")}</span>
      ) : null}
      {signals.state !== "ready" && signals.checkedAt ? (
        <time className="text-[var(--adm-muted)]" dateTime={signals.checkedAt} title="Last full translation check">
          Last full check {new Date(signals.checkedAt).toLocaleString()}
        </time>
      ) : null}
      {hasConflicts ? (
        <button type="button" onClick={onShow} className="adm-btn-secondary min-h-11 px-3 py-1 text-xs">
          Show conflicts
        </button>
      ) : null}
    </div>
  );
}

export function CatalogConflictRowBadges({
  productName,
  signal,
  onShow,
}: {
  productName: string;
  signal: CatalogConflictProductSignal;
  onShow: () => void;
}) {
  const visible = signal.locales.slice(0, 2);
  const remaining = signal.locales.length - visible.length;
  const fullDescription = [
    signal.shared ? "Shared commerce conflict" : null,
    ...signal.locales.map((locale) => `${locale.name} (${locale.code.toUpperCase()}): ${plural(locale.count, "field", "fields")}`),
  ].filter(Boolean).join("; ");
  return (
    <button
      type="button"
      onClick={onShow}
      aria-label={`Show conflicts for ${productName}: ${fullDescription}`}
      title={fullDescription}
      className="mt-2 flex min-h-11 max-w-full flex-wrap items-center gap-1.5 rounded-lg text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--adm-warning)]"
    >
      {signal.shared ? <span className="rounded-md border px-2 py-1 text-[0.68rem] font-semibold" style={{ borderColor: "var(--adm-warning)", color: "var(--adm-ink)" }}><GitCompareArrows className="mr-1 inline size-3" aria-hidden="true" />Shared · conflict</span> : null}
      {visible.map((locale) => (
        <span key={locale.code} className="rounded-md border px-2 py-1 text-[0.68rem] font-semibold" style={{ borderColor: "var(--adm-warning)", color: "var(--adm-ink)" }} title={locale.nativeName}>
          <Languages className="mr-1 inline size-3" aria-hidden="true" />{locale.code.toUpperCase()} · {plural(locale.count, "field", "fields")}
        </span>
      ))}
      {remaining > 0 ? <span className="text-[0.68rem] font-semibold text-[var(--adm-muted)]">+{plural(remaining, "language", "languages")}</span> : null}
    </button>
  );
}

export function CatalogConflictListModal({
  open,
  onClose,
  signals,
  products,
  focusedProductId,
}: {
  open: boolean;
  onClose: () => void;
  signals: CatalogConflictSignals;
  products: Array<{ id: string; name: string; sku: string | null }>;
  focusedProductId: string | null;
}) {
  const focusedRef = useRef<HTMLElement>(null);
  const productsById = new Map(products.map((product) => [product.id, product]));
  const productIds = Object.keys(signals.products).sort((a, b) => {
    if (a === focusedProductId) return -1;
    if (b === focusedProductId) return 1;
    return (productsById.get(a)?.name ?? a).localeCompare(productsById.get(b)?.name ?? b);
  });

  useEffect(() => {
    if (!open || !focusedProductId) return;
    let nextFrame = 0;
    const frame = window.requestAnimationFrame(() => {
      nextFrame = window.requestAnimationFrame(() => {
        focusedRef.current?.focus();
        focusedRef.current?.scrollIntoView?.({ block: "nearest" });
      });
    });
    return () => {
      window.cancelAnimationFrame(frame);
      window.cancelAnimationFrame(nextFrame);
    };
  }, [open, focusedProductId]);

  return (
    <AnimatedModal
      open={open}
      onClose={onClose}
      className="adm-panel pointer-events-auto grid max-h-[min(85vh,56rem)] w-full max-w-3xl grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden p-0"
      portalClassName="admin-modal-root"
      zIndexClassName="z-[200]"
      backdropZIndexClassName="z-[190]"
      ariaLabel="Catalog conflicts"
    >
      <div className="flex items-start justify-between gap-3 border-b border-[var(--adm-border)] p-5">
        <div>
          <p className="adm-section-tag">[ CATALOG CONFLICTS ]</p>
          <h2 className="adm-title-sm mt-2">{plural(signals.totalCount ?? productIds.length, "product", "products")} with conflicts</h2>
          <p className="mt-1 text-xs text-[var(--adm-muted)]">
            Saved differences{signals.checkedAt ? ` · last full translation check ${new Date(signals.checkedAt).toLocaleString()}` : " · last full check unknown"}. This list is read-only; no changes are applied here.
          </p>
        </div>
        <button type="button" onClick={onClose} className="adm-btn-ghost grid size-11 shrink-0 place-items-center p-0" aria-label="Close catalog conflicts"><X className="size-4" aria-hidden="true" /></button>
      </div>
      <div className="min-h-0 space-y-3 overflow-y-auto p-5">
        {productIds.map((productId) => {
          const signal = signals.products[productId];
          const product = productsById.get(productId);
          return (
            <article
              key={productId}
              ref={productId === focusedProductId ? focusedRef : undefined}
              tabIndex={productId === focusedProductId ? -1 : undefined}
              className="rounded-xl border p-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--adm-warning)]"
              style={{ borderColor: productId === focusedProductId ? "var(--adm-warning)" : "var(--adm-border)" }}
            >
              <h3 className="text-sm font-semibold text-[var(--adm-ink)]">{product?.name ?? `Product ${productId}`}</h3>
              {product?.sku ? <p className="mt-1 text-xs text-[var(--adm-muted)]">SKU {product.sku}</p> : null}
              <div className="mt-3 flex flex-wrap gap-2">
                {signal?.shared ? <span className="rounded-md border border-[var(--adm-warning)] px-2 py-1 text-xs"><GitCompareArrows className="mr-1 inline size-3" aria-hidden="true" />Shared · commerce conflict</span> : null}
                {signal?.locales.map((locale) => (
                  <span key={locale.code} className="rounded-md border border-[var(--adm-warning)] px-2 py-1 text-xs">
                    <Languages className="mr-1 inline size-3" aria-hidden="true" />{locale.code.toUpperCase()} · {locale.nativeName} · {plural(locale.count, "field", "fields")}
                  </span>
                ))}
              </div>
            </article>
          );
        })}
      </div>
      <div className="flex justify-end border-t border-[var(--adm-border)] p-4">
        <button type="button" onClick={onClose} className="adm-btn-secondary">Close</button>
      </div>
    </AnimatedModal>
  );
}
