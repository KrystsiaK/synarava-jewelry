"use client";

import Link from "next/link";
import { AlertTriangle, CheckCircle2, GitCompareArrows, Languages, Clock3 } from "lucide-react";

import { AdminSignalChip, type AdminSignalTone } from "@/components/synarava-cms";
import type { AdminProductListItem, AdminProductLocaleSignal } from "@/lib/admin/list-products-shared";
import type { CatalogConflictProductSignal } from "@/lib/shopify/catalog-conflict-signals";

/** Locale readiness is progress — never map incomplete copy to danger red. */
export function localeTone(locale: AdminProductLocaleSignal): AdminSignalTone {
  if (locale.syncStatus === "CONFLICT" || locale.syncStatus === "FAILED") return "conflict";
  if (locale.syncStatus === "PENDING") return "pending";
  if (locale.complete && locale.reviewed) return "ok";
  if (locale.complete && !locale.reviewed) return "warn";
  if (locale.percent >= 60) return "progress";
  if (locale.percent > 0) return "partial";
  return "empty";
}

function localeTooltip(locale: AdminProductLocaleSignal): string {
  const parts = [
    `${locale.label} (${locale.code.toUpperCase()})`,
    `${locale.percent}% of required fields filled`,
  ];
  if (locale.missing.length > 0) {
    parts.push(`Missing: ${locale.missing.slice(0, 4).join(", ")}${locale.missing.length > 4 ? "…" : ""}`);
  }
  if (locale.code !== "en") {
    parts.push(locale.reviewed ? "Marked reviewed" : "Not reviewed yet");
    if (locale.syncStatus && locale.syncStatus !== "NOT_APPLICABLE") {
      const syncLabel =
        locale.syncStatus === "SYNCED"
          ? "Synced with Shopify"
          : locale.syncStatus === "PENDING"
            ? "Shopify sync pending"
            : locale.syncStatus === "FAILED"
              ? "Shopify sync failed"
              : locale.syncStatus === "CONFLICT"
                ? "Shopify translation conflict"
                : locale.syncStatus;
      parts.push(syncLabel);
    }
  }
  return parts.join(" · ");
}

function localeIcon(locale: AdminProductLocaleSignal) {
  if (locale.syncStatus === "PENDING") return <Clock3 strokeWidth={2.4} />;
  if (locale.complete && locale.reviewed) return <CheckCircle2 strokeWidth={2.4} />;
  return <Languages strokeWidth={2.4} />;
}

function conflictTooltip(signal: CatalogConflictProductSignal): string {
  const parts = [
    signal.shared ? "Shared commerce conflict" : null,
    ...signal.locales.map(
      (locale) => `${locale.name} (${locale.code.toUpperCase()}): ${locale.count} field${locale.count === 1 ? "" : "s"}`,
    ),
  ].filter(Boolean);
  return parts.length > 0 ? parts.join("; ") : "Shopify conflict detected";
}

export function ProductListSignals({
  product,
  conflict,
  onShowConflicts,
}: {
  product: AdminProductListItem;
  conflict?: CatalogConflictProductSignal;
  onShowConflicts?: () => void;
}) {
  return (
    <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-1">
      {product.locales.map((locale) => (
        <AdminSignalChip
          key={locale.code}
          label={`${locale.label} translation ${locale.percent}%`}
          tooltip={localeTooltip(locale)}
          tone={localeTone(locale)}
          icon={localeIcon(locale)}
          value={`${locale.code.toUpperCase()} ${locale.percent}%`}
        />
      ))}
      {product.issueCount > 0 ? (
        <AdminSignalChip
          label={`${product.issueCount} open problem${product.issueCount === 1 ? "" : "s"}`}
          tooltip={`${product.issueCount} open problem${product.issueCount === 1 ? "" : "s"}. Open the editor to fix them.`}
          tone="danger"
          icon={<AlertTriangle strokeWidth={2.4} />}
          value={product.issueCount}
          href={product.issueHref ?? `/admin/products/${product.id}`}
        />
      ) : null}
      {conflict ? (
        <AdminSignalChip
          label={`Conflicts for ${product.name}`}
          tooltip={conflictTooltip(conflict)}
          tone="conflict"
          icon={<GitCompareArrows strokeWidth={2.4} />}
          value={
            conflict.locales.reduce((sum, entry) => sum + entry.count, 0)
            + (conflict.shared || conflict.presence ? 1 : 0)
            || undefined
          }
          onClick={onShowConflicts}
        />
      ) : null}
    </div>
  );
}

export function ProductListMetaLine({ product }: { product: AdminProductListItem }) {
  const updated = new Intl.DateTimeFormat("en-IE", { dateStyle: "medium" }).format(new Date(product.updatedAt));
  const published = product.publishedAt
    ? new Intl.DateTimeFormat("en-IE", { dateStyle: "medium" }).format(new Date(product.publishedAt))
    : null;

  return (
    <p className="mt-1 truncate text-[0.68rem]" style={{ color: "var(--adm-subtle)" }}>
      Updated {updated}
      {published ? ` · Published ${published}` : " · Not published"}
      {" · "}
      <Link
        href={`/admin/products/${product.id}`}
        className="underline-offset-2 hover:underline"
        style={{ color: "var(--adm-muted)" }}
      >
        /{product.slug}
      </Link>
    </p>
  );
}
