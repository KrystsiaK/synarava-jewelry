"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

import {
  EntityLocaleSyncControl,
  type EntitySyncScope,
} from "@/components/admin/translations/entity-locale-sync-control";

/**
 * A locale code as it appears in the admin — still whatever a caller passes
 * via `locales` (today, always the two below; no editor has real fields
 * for a third locale yet). Widened from a closed "EN" | "PT" union so a
 * form that does grow a third tab doesn't need to touch this file.
 */
export type AdminLocale = string;

export type AdminLocaleTab = { code: AdminLocale; label: string };

/** The only locale set any admin editor has real fields for today. Pass this until an editor has an actual third-locale panel to show. */
export const EN_PT_LOCALE_TABS: AdminLocaleTab[] = [
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
 * silently if sessionStorage is unavailable (private browsing, SSR), and
 * ignores a stored value that isn't one of `locales` (e.g. a tab set shrank).
 */
function readStoredLocale(storageKey: string, locales: AdminLocaleTab[]): AdminLocale | null {
  try {
    const stored = sessionStorage.getItem(storageKey);
    return stored && locales.some((locale) => locale.code === stored) ? stored : null;
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
 * `<AdminLocaleTabs>` and their own `hidden={active !== locales[0].code}` markup.
 */
export function useAdminActiveLocale(
  storageKey: string,
  locales: AdminLocaleTab[] = EN_PT_LOCALE_TABS,
  defaultLocale: AdminLocale = locales[0]?.code ?? "EN",
) {
  const scopedKey = `adm-locale:${storageKey}`;
  // Starts at defaultLocale on every render, server included, then syncs
  // from sessionStorage once mounted — sessionStorage doesn't exist during
  // SSR, so reading it in the initial state (the previous approach) made
  // the server's markup and the client's first paint disagree on which tab
  // is active whenever a visitor had picked a non-default tab before,
  // which is a hydration error, not just a mistimed default.
  const [active, setActive] = useState<AdminLocale>(defaultLocale);

  useEffect(() => {
    const stored = readStoredLocale(scopedKey, locales);
    // A one-time post-mount sync from sessionStorage, not a subscription —
    // there's no external-store "change" to react to here, just the SSR
    // render (which can't see sessionStorage) catching up to it once on
    // the client. That's exactly the documented exception to "don't
    // setState in an effect".
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored && stored !== defaultLocale) setActive(stored);
    // Only re-sync when the storage key itself changes (a different
    // record) — not on every `locales`/`defaultLocale` identity change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopedKey]);

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
  /** Which locales to render as tabs. Defaults to the EN/PT pair every editor has fields for today. */
  locales?: AdminLocaleTab[];
  /** Sync/readiness status shown next to the tabs (Shopify push/pull state). The source locale has no sync status. */
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
 * The sticky locale tab strip on its own, for forms whose shared and
 * localized fields are interleaved in one layout (see `useAdminActiveLocale`
 * above) and so render their own panels/`hidden` markup instead of using
 * `AdminLocaleWorkspace`'s three-slot shape.
 */
export function AdminLocaleTabs({
  active,
  onSelect,
  locales = EN_PT_LOCALE_TABS,
  ptStatus,
  syncScope,
  sharedHeader,
  tabId,
  panelId,
}: AdminLocaleTabsProps) {
  const tabRefs = useRef<Record<AdminLocale, HTMLButtonElement | null>>({});
  const fallbackId = useId();
  const idFor = tabId ?? ((locale: AdminLocale) => `${fallbackId}-tab-${locale}`);
  const panelIdFor = panelId;
  const sourceCode = locales[0]?.code;

  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const lastIndex = locales.length - 1;
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") nextIndex = index === lastIndex ? 0 : index + 1;
    else if (event.key === "ArrowLeft") nextIndex = index === 0 ? lastIndex : index - 1;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = lastIndex;
    if (nextIndex === null) return;

    event.preventDefault();
    const next = locales[nextIndex];
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
        {locales.map((locale, index) => (
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
          {active === sourceCode ? `// ${sourceCode} — SOURCE` : `// ${active} — TRANSLATION`}
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
  /** Sync/readiness status shown on the translation tab (Shopify push/pull state). The source locale has no sync status. */
  ptStatus?: AdminLocaleStatus;
  /** Content rendered once, above the tabs, shared between locales (e.g. media, relations, commerce fields that don't localize). */
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
 * Still EN/PT-only (named `en`/`pt` props, not a locale-keyed map) — no
 * caller has a third panel to render yet. `AdminLocaleTabs` above is the
 * part that's locale-count-generic; this wrapper covers the one shape
 * every current caller actually needs.
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
  const [active, select] = useAdminActiveLocale(storageKey, EN_PT_LOCALE_TABS, defaultLocale);
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
