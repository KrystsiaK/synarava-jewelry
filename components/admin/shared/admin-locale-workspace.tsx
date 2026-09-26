"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

import { AdminStatusBadge, type AdminStatusBadgeTone } from "@/components/synarava-cms";

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

function localeSyncTone(status: AdminLocaleStatus): AdminStatusBadgeTone {
  if (status === "SYNCED") return "published";
  if (status === "FAILED") return "error";
  if (status === "CONFLICT") return "conflict";
  if (status === "PENDING") return "pending";
  return "draft";
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
  /**
   * Trailing slot for entity-scoped controls (e.g. product conflict entry).
   * Callers close over the active locale; this file stays free of product imports.
   */
  trailing?: ReactNode;
  /** Content rendered once, sharing the sticky band with the tabs (e.g. a commerce-core banner). */
  sharedHeader?: ReactNode;
  /** ids for the panels this tab strip controls, so aria-controls/aria-labelledby line up when a caller renders its own panels instead of using AdminLocaleWorkspace. */
  tabId?: (locale: AdminLocale) => string;
  panelId?: (locale: AdminLocale) => string;
  /** Locale codes with unsaved edits — shows a dirty marker on that tab. */
  dirtyLocales?: ReadonlySet<string> | readonly string[];
  /** Locale codes with open language-scoped QA issues — tints that tab. */
  issueLocales?: ReadonlySet<string> | readonly string[];
  /**
   * Locale shells that should show a commerce conflict mark.
   * Shared fields (price, …) mark every language; locale-only copy marks one.
   */
  conflictLocales?: ReadonlySet<string> | readonly string[];
  /**
   * Nest inside a parent locale shell (product editor). Drops default sticky
   * chrome. Prefer wrapping with `AdminPanel.Header sticky` so the band occupies
   * the panel radius (`top: stickyAbove - radius`) instead of sitting below it.
   */
  embedded?: boolean;
  /**
   * @deprecated Prefer `AdminPanel.Header sticky`. Legacy: stick under workspace
   * with `top: workspaceHeight - panelRadius`.
   */
  stacked?: boolean;
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
  trailing,
  sharedHeader,
  tabId,
  panelId,
  dirtyLocales,
  issueLocales,
  conflictLocales,
  embedded = false,
  stacked = false,
}: AdminLocaleTabsProps) {
  const tabRefs = useRef<Record<AdminLocale, HTMLButtonElement | null>>({});
  const fallbackId = useId();
  const idFor = tabId ?? ((locale: AdminLocale) => `${fallbackId}-tab-${locale}`);
  const panelIdFor = panelId;
  const dirtySet = dirtyLocales instanceof Set
    ? dirtyLocales
    : new Set(dirtyLocales ?? []);
  const issueSet = issueLocales instanceof Set
    ? issueLocales
    : new Set(issueLocales ?? []);
  const conflictSet = conflictLocales instanceof Set
    ? conflictLocales
    : new Set(conflictLocales ?? []);

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
    <div
      className={[
        "adm-locale-workspace-header",
        embedded ? "adm-locale-workspace-header--embedded" : "",
        stacked ? "adm-locale-workspace-header--stacked" : "",
      ].filter(Boolean).join(" ")}
    >
      {sharedHeader}
      <div
        role="tablist"
        aria-label="Content language"
        className={`flex w-full flex-wrap items-center gap-1.5 ${embedded ? "" : "pb-4"}`}
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
            data-dirty={dirtySet.has(locale.code) ? "true" : undefined}
            data-issue={issueSet.has(locale.code) ? "true" : undefined}
            data-conflict={conflictSet.has(locale.code) ? "true" : undefined}
            className="adm-locale-tab"
          >
            {locale.code}
            {dirtySet.has(locale.code) ? (
              <span
                className="ml-1 inline-block size-1.5 rounded-full bg-[var(--adm-warning)]"
                title="Unsaved edits"
                aria-label="Unsaved edits"
              />
            ) : null}
            {issueSet.has(locale.code) ? (
              <span
                className="ml-1 inline-block size-1.5 rounded-full bg-[var(--adm-danger)]"
                title="Open problem"
                aria-label="Open problem"
              />
            ) : null}
            {conflictSet.has(locale.code) ? (
              <span
                className="ml-1 inline-block size-1.5 rounded-full bg-[var(--adm-conflict)]"
                title="Shopify conflict"
                aria-label="Shopify conflict"
              />
            ) : null}
          </button>
        ))}
        {ptStatus ? (
          <AdminStatusBadge
            tone={localeSyncTone(ptStatus)}
            className={trailing ? undefined : "ml-auto"}
            role="status"
            aria-live="polite"
          >
            SHOPIFY: {statusLabel(ptStatus)}
          </AdminStatusBadge>
        ) : null}
        {trailing ? <div className="ml-auto flex items-center gap-2">{trailing}</div> : null}
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
