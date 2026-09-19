"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

export type AdminLocale = "EN" | "PT";

const LOCALE_TABS: Array<{ code: AdminLocale; label: string }> = [
  { code: "EN", label: "English" },
  { code: "PT", label: "Português" },
];

export type AdminLocaleStatus = "SYNCED" | "PENDING" | "CONFLICT" | "FAILED" | "NOT_APPLICABLE";

function statusLabel(status: AdminLocaleStatus) {
  return status === "NOT_APPLICABLE" ? "LOCAL ONLY" : status;
}

function statusBadgeClass(status: AdminLocaleStatus) {
  if (status === "SYNCED") return "adm-badge-published";
  if (status === "CONFLICT" || status === "FAILED") return "adm-badge-error";
  return "adm-badge-draft";
}

/**
 * Session-persisted active locale, scoped by `storageKey` so unrelated forms
 * (Product vs Collection vs Page) don't fight over the same tab. Falls back
 * silently if sessionStorage is unavailable (private browsing, SSR).
 */
function readStoredLocale(storageKey: string): AdminLocale | null {
  try {
    const stored = sessionStorage.getItem(storageKey);
    return stored === "EN" || stored === "PT" ? stored : null;
  } catch {
    return null;
  }
}

function useActiveLocale(storageKey: string, initial: AdminLocale) {
  const [active, setActive] = useState<AdminLocale>(() => readStoredLocale(storageKey) ?? initial);

  function select(locale: AdminLocale) {
    setActive(locale);
    try {
      sessionStorage.setItem(storageKey, locale);
    } catch {
      // best-effort only
    }
  }

  return [active, select] as const;
}

export type AdminLocaleWorkspaceProps = {
  /** Distinguishes this form's remembered tab from others on the same admin session, e.g. "product", "collection:cmxyz". */
  storageKey: string;
  /** Which locale's panel should render first if nothing is remembered yet. */
  defaultLocale?: AdminLocale;
  /** Locale to force-open, e.g. the locale of the first validation error. Takes priority over the remembered tab. */
  forceLocale?: AdminLocale;
  /** Sync/readiness status shown on the PT tab (Shopify push/pull state). English has no sync status — it's the source. */
  ptStatus?: AdminLocaleStatus;
  /** Content rendered once, above the tabs, shared between EN and PT (e.g. media, relations, commerce fields that don't localize). */
  sharedHeader?: ReactNode;
  en: ReactNode;
  pt: ReactNode;
  /** Called whenever the active tab changes, e.g. so a parent can hide/show shared fields that only make sense for one locale. */
  onLocaleChange?: (locale: AdminLocale) => void;
};

/**
 * Sticky EN/PT tab header + panels. Both panels always render (as `hidden`,
 * not unmounted) so uncontrolled inputs keep their value and any shared
 * controlled draft state survives switching tabs — see tasks/plan.md
 * "Скрытие panel не размонтирует uncontrolled inputs".
 */
export function AdminLocaleWorkspace({
  storageKey,
  defaultLocale = "EN",
  forceLocale,
  ptStatus,
  sharedHeader,
  en,
  pt,
  onLocaleChange,
}: AdminLocaleWorkspaceProps) {
  const [active, select] = useActiveLocale(`adm-locale:${storageKey}`, defaultLocale);
  const tabRefs = useRef<Record<AdminLocale, HTMLButtonElement | null>>({ EN: null, PT: null });
  const tablistId = useId();

  useEffect(() => {
    if (forceLocale) select(forceLocale);
    // Only react to forceLocale changing (e.g. a new validation pass) — not to `select` identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forceLocale]);

  function activate(locale: AdminLocale) {
    select(locale);
    onLocaleChange?.(locale);
  }

  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const lastIndex = LOCALE_TABS.length - 1;
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") nextIndex = index === lastIndex ? 0 : index + 1;
    else if (event.key === "ArrowLeft") nextIndex = index === 0 ? lastIndex : index - 1;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = lastIndex;
    if (nextIndex === null) return;

    event.preventDefault();
    const next = LOCALE_TABS[nextIndex];
    activate(next.code);
    tabRefs.current[next.code]?.focus();
  }

  return (
    <div data-component="AdminLocaleWorkspace">
      <div className="adm-locale-workspace-header">
        {sharedHeader}
        <div
          role="tablist"
          aria-label="Content language"
          id={tablistId}
          className="flex flex-wrap items-center gap-1.5 pb-4"
        >
          <span className="adm-section-tag mr-1">LOCALE /</span>
          {LOCALE_TABS.map((locale, index) => (
            <button
              key={locale.code}
              ref={(node) => { tabRefs.current[locale.code] = node; }}
              type="button"
              role="tab"
              id={`${tablistId}-tab-${locale.code}`}
              aria-controls={`${tablistId}-panel-${locale.code}`}
              aria-selected={active === locale.code}
              aria-label={locale.label}
              tabIndex={active === locale.code ? 0 : -1}
              onClick={() => activate(locale.code)}
              onKeyDown={(event) => onTabKeyDown(event, index)}
              data-active={active === locale.code ? "true" : undefined}
              className="adm-locale-tab"
            >
              {locale.code}
            </button>
          ))}
          <span className="adm-section-tag ml-2">
            {active === "EN" ? "// EN — SOURCE" : "// PT — TRANSLATION"}
          </span>
          {ptStatus ? (
            <span className={`${statusBadgeClass(ptStatus)} ml-auto`}>
              SHOPIFY: {statusLabel(ptStatus)}
            </span>
          ) : null}
        </div>
      </div>

      <div
        role="tabpanel"
        id={`${tablistId}-panel-EN`}
        aria-labelledby={`${tablistId}-tab-EN`}
        hidden={active !== "EN"}
      >
        {en}
      </div>
      <div
        role="tabpanel"
        id={`${tablistId}-panel-PT`}
        aria-labelledby={`${tablistId}-tab-PT`}
        hidden={active !== "PT"}
      >
        {pt}
      </div>
    </div>
  );
}
