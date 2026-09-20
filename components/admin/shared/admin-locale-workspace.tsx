"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

import {
  EntityLocaleSyncControl,
  type EntitySyncScope,
} from "@/components/admin/translations/entity-locale-sync-control";

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

/**
 * The session-persisted locale + activation, usable on its own by forms
 * whose shared and localized fields are interleaved in the same layout
 * (e.g. the Product editor's commerce grid) and so can't adopt
 * `AdminLocaleWorkspace`'s three-slot (sharedHeader/en/pt) render shape
 * without an unrelated visual restructure. Those forms pair this with
 * `<AdminLocaleTabs>` and their own `hidden={active !== "EN"}` markup.
 */
export function useAdminActiveLocale(storageKey: string, defaultLocale: AdminLocale = "EN") {
  const scopedKey = `adm-locale:${storageKey}`;
  const [active, setActive] = useState<AdminLocale>(() => readStoredLocale(scopedKey) ?? defaultLocale);

  function select(locale: AdminLocale) {
    setActive(locale);
    try {
      sessionStorage.setItem(scopedKey, locale);
    } catch {
      // best-effort only
    }
  }

  return [active, select] as const;
}

export type AdminLocaleTabsProps = {
  active: AdminLocale;
  onSelect: (locale: AdminLocale) => void;
  /** Sync/readiness status shown next to the tabs (Shopify push/pull state). English has no sync status — it's the source. */
  ptStatus?: AdminLocaleStatus;
  /** Existing persisted entity only. Adds locale-scoped Shopify check/review controls without changing the form fields. */
  syncScope?: EntitySyncScope;
  /** Content rendered once, sharing the sticky band with the tabs (e.g. a commerce-core banner). */
  sharedHeader?: ReactNode;
  /** ids for the panels this tab strip controls, so aria-controls/aria-labelledby line up when a caller renders its own panels instead of using AdminLocaleWorkspace. */
  tabId?: (locale: AdminLocale) => string;
  panelId?: (locale: AdminLocale) => string;
};

/**
 * The sticky EN/PT tab strip on its own, for forms whose shared and
 * localized fields are interleaved in one layout (see `useAdminActiveLocale`
 * above) and so render their own panels/`hidden` markup instead of using
 * `AdminLocaleWorkspace`'s three-slot shape.
 */
export function AdminLocaleTabs({ active, onSelect, ptStatus, syncScope, sharedHeader, tabId, panelId }: AdminLocaleTabsProps) {
  const tabRefs = useRef<Record<AdminLocale, HTMLButtonElement | null>>({ EN: null, PT: null });
  const fallbackId = useId();
  const idFor = tabId ?? ((locale: AdminLocale) => `${fallbackId}-tab-${locale}`);
  const panelIdFor = panelId;

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
    onSelect(next.code);
    tabRefs.current[next.code]?.focus();
  }

  return (
    <div className="adm-locale-workspace-header">
      {sharedHeader}
      <div
        role="tablist"
        aria-label="Content language"
        className="flex flex-wrap items-center gap-1.5 pb-4"
      >
        <span className="adm-section-tag mr-1">LOCALE /</span>
        {LOCALE_TABS.map((locale, index) => (
          <button
            key={locale.code}
            ref={(node) => { tabRefs.current[locale.code] = node; }}
            type="button"
            role="tab"
            id={idFor(locale.code)}
            aria-controls={panelIdFor?.(locale.code)}
            aria-selected={active === locale.code}
            aria-label={locale.label}
            tabIndex={active === locale.code ? 0 : -1}
            onClick={() => onSelect(locale.code)}
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
          <span className={`${statusBadgeClass(ptStatus)} ${syncScope ? "" : "ml-auto"}`} role="status" aria-live="polite">
            SHOPIFY: {statusLabel(ptStatus)}
          </span>
        ) : null}
        {syncScope ? <EntityLocaleSyncControl scope={syncScope} locale={active} /> : null}
      </div>
    </div>
  );
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
 * Sticky EN/PT tab header + panels, for a form whose shared fields are
 * cleanly separable from its localized ones. Both panels always render (as
 * `hidden`, not unmounted) so uncontrolled inputs keep their value and any
 * shared controlled draft state survives switching tabs — see
 * tasks/plan.md "Скрытие panel не размонтирует uncontrolled inputs".
 *
 * A form whose shared and localized fields are interleaved in one layout
 * (Product's commerce grid) can't adopt this three-slot shape without an
 * unrelated visual restructure — use `useAdminActiveLocale` + `AdminLocaleTabs`
 * directly instead, and keep its own `hidden={active !== "EN"}` markup.
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
  const [active, select] = useAdminActiveLocale(storageKey, defaultLocale);
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

  return (
    <div data-component="AdminLocaleWorkspace">
      <AdminLocaleTabs
        active={active}
        onSelect={activate}
        ptStatus={ptStatus}
        sharedHeader={sharedHeader}
        tabId={(locale) => `${tablistId}-tab-${locale}`}
        panelId={(locale) => `${tablistId}-panel-${locale}`}
      />

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
