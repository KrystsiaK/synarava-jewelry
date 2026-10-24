import type { SyncNavCounts } from "@/lib/sync";

/**
 * Summary-only view of values that differ — counts from selectSyncCounts,
 * links into the owning admin sections. No field merge/apply here.
 */
export function TranslationsSyncSummary({
  counts,
  checkedAt,
  state,
}: {
  counts: SyncNavCounts;
  checkedAt: string | null;
  state: "ready" | "checking" | "disconnected" | "error" | string;
}) {
  const sections = [
    { key: "products" as const, label: "Products", href: "/admin/products", count: counts.products },
    { key: "collections" as const, label: "Collections", href: "/admin/collections", count: counts.collections },
    { key: "pages" as const, label: "Pages", href: "/admin/pages", count: counts.pages },
    { key: "settings" as const, label: "Settings", href: "/admin/settings", count: counts.settings },
  ];

  const checkedLabel = checkedAt
    ? new Date(checkedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
    : null;

  return (
    <section className="adm-panel grid gap-4 p-5 md:p-6" data-component="TranslationsSyncSummary">
      <div>
        <h2 className="text-lg font-semibold">What differs</h2>
        <p className="text-sm text-[var(--adm-muted)]">
          Counts match the badges elsewhere in admin. Open a section to choose Keep ours or Take Shopify.
          This page does not apply field changes.
        </p>
      </div>

      {state === "disconnected" || state === "error" ? (
        <p role="status" className="rounded-lg border border-[var(--adm-border)] p-3 text-sm text-[var(--adm-muted)]">
          Shopify could not be checked right now. Open Products or Collections and run a check there, then come back.
        </p>
      ) : null}

      {counts.total === 0 && state === "ready" ? (
        <p role="status" className="rounded-lg border border-[var(--adm-border)] p-3 text-sm text-[var(--adm-muted)]">
          Nothing differs right now.
          {checkedLabel ? ` Last check: ${checkedLabel}.` : ""}
        </p>
      ) : null}

      {counts.total > 0 ? (
        <>
          <p className="text-sm font-semibold">
            {counts.total}
            {" "}
            {counts.total === 1 ? "place" : "places"}
            {" "}
            need a decision
            {checkedLabel ? ` · checked ${checkedLabel}` : ""}
          </p>
          <ul className="grid gap-3 sm:grid-cols-2">
            {sections.map((section) => (
              <li key={section.key}>
                <a
                  href={section.href}
                  className="flex items-center justify-between gap-3 rounded-xl border border-[var(--adm-border)] p-4 text-sm motion-safe:transition-colors hover:border-[var(--adm-warning)] focus-visible:outline-2 focus-visible:outline-[var(--adm-warning)]"
                >
                  <span className="font-semibold">{section.label}</span>
                  <span className="text-[var(--adm-muted)]">
                    {section.count === 0
                      ? "Up to date"
                      : `${section.count} ${section.count === 1 ? "differs" : "differ"}`}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}
