"use client";

import {
  useEffect,
  useEffectEvent,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useTransition,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import { searchStorefrontHrefsAction } from "@/app/admin/actions/storefront-href";
import {
  AdminFieldShell,
  useAdminFieldIds,
} from "@/components/admin/shared/admin-field-shell";
import type { AdminFieldOwner } from "@/components/admin/shared/ownership-label";
import { AdminTextControl } from "@/components/admin/shared/admin-text-field";
import {
  findExactHrefHit,
  flattenHrefHits,
  hrefTargetIssueFromSearch,
  looksLikePath,
  normalizeCommittedHref,
  normalizeHrefQuery,
  withLocaleAwareHrefDetails,
  type StorefrontHrefHit,
  type StorefrontHrefSearchResult,
} from "@/lib/admin/storefront-href";
import { cn } from "@/lib/ui";

const EMPTY_RESULT: StorefrontHrefSearchResult = { segments: [] };
const POPOVER_GAP_PX = 4;
const POPOVER_MAX_HEIGHT_PX = 256;
const POPOVER_VIEWPORT_PAD_PX = 8;

type HrefPopoverPosition = {
  left: number;
  maxHeight: number;
  top: number;
  width: number;
};

function resolveHrefPopoverPortal(anchor: HTMLElement | null): HTMLElement | null {
  if (typeof document === "undefined") return null;
  return (
    anchor?.closest<HTMLElement>(".admin-terminal, .admin-modal-root") ??
    document.body
  );
}

function measureHrefPopoverPosition(anchor: HTMLElement): HrefPopoverPosition {
  const rect = anchor.getBoundingClientRect();
  const viewportHeight = window.innerHeight;
  const spaceBelow = Math.max(
    0,
    viewportHeight - POPOVER_VIEWPORT_PAD_PX - rect.bottom - POPOVER_GAP_PX,
  );
  const spaceAbove = Math.max(0, rect.top - POPOVER_VIEWPORT_PAD_PX - POPOVER_GAP_PX);
  const placeBelow =
    spaceBelow >= Math.min(POPOVER_MAX_HEIGHT_PX, 160) || spaceBelow >= spaceAbove;
  const available = placeBelow ? spaceBelow : spaceAbove;
  const maxHeight = Math.min(POPOVER_MAX_HEIGHT_PX, available);
  const top = placeBelow
    ? rect.bottom + POPOVER_GAP_PX
    : Math.max(POPOVER_VIEWPORT_PAD_PX, rect.top - POPOVER_GAP_PX - maxHeight);

  return {
    left: rect.left,
    maxHeight: Math.max(0, maxHeight),
    top,
    width: rect.width,
  };
}

export type DetectedHrefIssue = {
  tone: "warning" | "error";
  message: string;
};

export type AdminHrefControlProps = {
  name: string;
  defaultValue?: string;
  value?: string;
  onValueChange?: (href: string) => void;
  /**
   * Active editor locale — picker detail lines show locale-prefixed paths
   * (`/pt/shop`) while the committed value stays locale-free (`/shop`).
   */
  locale?: string;
  /** Soft orange chrome (draft targets, etc.). */
  warning?: string;
  warningId?: string;
  /** Notifies parent when a draft/unlisted/missing target is detected from search. */
  onDetectedWarningChange?: (message: string | undefined) => void;
  /** Richer callback: warning vs error (missing destination). */
  onDetectedIssueChange?: (issue: DetectedHrefIssue | undefined) => void;
  controlId?: string;
  invalid?: boolean;
  disabled?: boolean;
  placeholder?: string;
  "aria-label"?: string;
  "aria-invalid"?: true | undefined;
  "aria-errormessage"?: string | undefined;
};

export function AdminHrefControl({
  name,
  defaultValue = "",
  value,
  onValueChange,
  locale,
  warning,
  warningId,
  onDetectedWarningChange,
  onDetectedIssueChange,
  controlId,
  invalid = false,
  disabled,
  placeholder = "/shop",
  "aria-label": ariaLabel,
  "aria-invalid": ariaInvalid,
  "aria-errormessage": ariaErrorMessage,
}: AdminHrefControlProps) {
  const isControlled = value !== undefined;
  const [uncontrolledHref, setUncontrolledHref] = useState(() =>
    normalizeCommittedHref(defaultValue),
  );
  const controlledHref = isControlled ? normalizeCommittedHref(value ?? "") : "";
  const href = isControlled ? controlledHref : uncontrolledHref;

  const [query, setQuery] = useState(href);
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<StorefrontHrefSearchResult>(EMPTY_RESULT);
  const [searchError, setSearchError] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const [pending, startTransition] = useTransition();

  const hiddenInputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const positionFrameRef = useRef(0);
  const resultListId = useId();
  const searchErrorId = useId();
  const [popoverPosition, setPopoverPosition] = useState<HrefPopoverPosition | null>(null);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  const flatHits = flattenHrefHits(result);

  const indexedSegments = result.segments.reduce<
    Array<{ id: string; label: string; hits: Array<{ hit: StorefrontHrefHit; index: number }> }>
  >((segments, segment) => {
    const offset = segments.reduce((sum, entry) => sum + entry.hits.length, 0);
    return [
      ...segments,
      {
        id: segment.id,
        label: segment.label,
        hits: segment.hits.map((hit, hitOffset) => ({ hit, index: offset + hitOffset })),
      },
    ];
  }, []);

  const publishDetectedIssue = (options: {
    href: string;
    hasExactHit: boolean;
    exactHitStatus?: string;
  }) => {
    const issue = hrefTargetIssueFromSearch(options);
    onDetectedIssueChange?.(issue);
    // Legacy warning-only callback: only soft warnings, not hard missing errors.
    onDetectedWarningChange?.(issue?.tone === "warning" ? issue.message : undefined);
  };

  function commitHref(next: string, options?: { knownHit?: boolean; status?: string }) {
    // CMS contract: store locale-free paths; `/pt/shop` → `/shop`.
    const normalized = normalizeCommittedHref(next);
    if (!isControlled) setUncontrolledHref(normalized);
    onValueChange?.(normalized);
    setQuery(normalized);
    if (options?.knownHit) {
      publishDetectedIssue({
        href: normalized,
        hasExactHit: true,
        exactHitStatus: options.status,
      });
    } else if (!normalized) {
      publishDetectedIssue({ href: "", hasExactHit: false });
    }
    // Unknown typed paths are classified by inspectHref after commit.
    setOpen(false);
    setResult(EMPTY_RESULT);
    setActiveIndex(-1);
    setSearchError("");
    queueMicrotask(() => {
      hiddenInputRef.current?.dispatchEvent(new Event("change", { bubbles: true }));
      hiddenInputRef.current?.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }

  const runSearch = useEffectEvent((search: string) => {
    startTransition(async () => {
      const next = await searchStorefrontHrefsAction(search);
      const decorated = withLocaleAwareHrefDetails(
        { segments: next.segments },
        locale,
      );
      setResult(decorated);
      setSearchError(next.error ?? "");
      setActiveIndex(decorated.segments.length ? 0 : -1);
    });
  });

  function inspectHrefTarget(target: string) {
    if (!target) {
      publishDetectedIssue({ href: "", hasExactHit: false });
      return;
    }
    startTransition(async () => {
      const next = await searchStorefrontHrefsAction(target);
      const hit = findExactHrefHit(next, target);
      publishDetectedIssue({
        href: target,
        hasExactHit: Boolean(hit),
        exactHitStatus: hit?.status,
      });
    });
  }

  // Effect Event for the href effect; event handlers call inspectHrefTarget directly.
  const inspectHref = useEffectEvent((target: string) => {
    inspectHrefTarget(target);
  });

  const closeWithoutCommit = useEffectEvent(() => {
    const trimmed = normalizeHrefQuery(query);
    setOpen(false);
    setResult(EMPTY_RESULT);
    setActiveIndex(-1);
    if (looksLikePath(trimmed) && trimmed !== href) {
      commitHref(trimmed);
      inspectHrefTarget(trimmed);
      return;
    }
    setQuery(href);
  });

  // Controlled value wins — adjust during render (no setState-in-effect).
  const [syncedValue, setSyncedValue] = useState(href);
  if (isControlled && controlledHref !== syncedValue) {
    setSyncedValue(controlledHref);
    setQuery(controlledHref);
  }

  useEffect(() => {
    inspectHref(href);
  }, [href]);

  useEffect(() => {
    if (!open) return;
    const timeout = window.setTimeout(() => {
      runSearch(query);
    }, query.trim() ? 200 : 0);
    return () => window.clearTimeout(timeout);
  }, [open, query]);

  function bindPortalTarget() {
    const anchor = rootRef.current;
    if (!anchor) return;
    setPortalTarget(resolveHrefPopoverPortal(anchor));
  }

  function openMenu() {
    bindPortalTarget();
    setOpen(true);
  }

  // Measure in rAF (not sync setState-in-effect) so react-hooks/set-state-in-effect stays quiet.
  const syncPopoverPosition = useEffectEvent(() => {
    const anchor = rootRef.current;
    if (!anchor) return;
    setPortalTarget(resolveHrefPopoverPortal(anchor));
    setPopoverPosition(measureHrefPopoverPosition(anchor));
  });

  const schedulePopoverPosition = useEffectEvent(() => {
    if (positionFrameRef.current) cancelAnimationFrame(positionFrameRef.current);
    positionFrameRef.current = requestAnimationFrame(() => {
      positionFrameRef.current = 0;
      syncPopoverPosition();
    });
  });

  // Clear portal/geometry on close — same render-time sync pattern as controlled `value`.
  const [menuOpen, setMenuOpen] = useState(open);
  if (open !== menuOpen) {
    setMenuOpen(open);
    if (!open) {
      setPortalTarget(null);
      setPopoverPosition(null);
    } else {
      setPopoverPosition(null);
    }
  }

  useLayoutEffect(() => {
    if (!open) return;
    schedulePopoverPosition();
  }, [open, pending, result, searchError]);

  useEffect(() => {
    if (!open || !portalTarget) return;

    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || popoverRef.current?.contains(target)) {
        return;
      }
      closeWithoutCommit();
    }

    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("resize", schedulePopoverPosition);
    // Capture: ancestor scrolls (collapse/panel) move the anchor without window scroll.
    window.addEventListener("scroll", schedulePopoverPosition, { passive: true, capture: true });

    const resizeObserver =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedulePopoverPosition);
    if (rootRef.current) resizeObserver?.observe(rootRef.current);
    if (popoverRef.current) resizeObserver?.observe(popoverRef.current);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("resize", schedulePopoverPosition);
      window.removeEventListener("scroll", schedulePopoverPosition, { capture: true });
      resizeObserver?.disconnect();
      if (positionFrameRef.current) cancelAnimationFrame(positionFrameRef.current);
    };
  }, [open, portalTarget]);

  function choose(hit: StorefrontHrefHit) {
    const known = hit.segment !== "custom";
    commitHref(hit.href, { knownHit: known, status: hit.status });
    if (!known) inspectHrefTarget(hit.href);
  }

  function clear() {
    commitHref("");
  }

  function onQueryChange(next: string) {
    setQuery(next);
    openMenu();
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      setResult(EMPTY_RESULT);
      setActiveIndex(-1);
      setQuery(href);
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) {
        openMenu();
        return;
      }
      if (!flatHits.length) return;
      setActiveIndex((index) => (index + 1) % flatHits.length);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!open || !flatHits.length) return;
      setActiveIndex((index) => (index <= 0 ? flatHits.length - 1 : index - 1));
      return;
    }

    if (event.key === "Enter" && open && activeIndex >= 0 && flatHits[activeIndex]) {
      event.preventDefault();
      choose(flatHits[activeIndex]);
    }
  }

  const describedBy = [
    searchError ? searchErrorId : null,
    !ariaInvalid && warning ? warningId : null,
  ]
    .filter(Boolean)
    .join(" ") || undefined;

  const popoverStyle: CSSProperties = {
    left: popoverPosition?.left ?? 0,
    maxHeight: popoverPosition?.maxHeight ?? POPOVER_MAX_HEIGHT_PX,
    position: "fixed",
    top: popoverPosition?.top ?? 0,
    visibility: popoverPosition ? "visible" : "hidden",
    width: popoverPosition?.width,
  };

  const listbox =
    open && portalTarget
      ? createPortal(
          <div
            ref={popoverRef}
            id={resultListId}
            role="listbox"
            data-slot="href-popover"
            style={popoverStyle}
            className={cn(
              "adm-popover overflow-auto rounded-[8px] border border-[var(--adm-border-strong)] bg-[var(--adm-bg)]",
            )}
          >
            {pending && !flatHits.length ? (
              <p className="px-3 py-1.5 text-xs text-[var(--adm-muted)]" aria-live="polite">
                Searching…
              </p>
            ) : null}
            {searchError ? (
              <p id={searchErrorId} className="px-3 py-1.5 text-xs text-[var(--adm-danger)]" role="alert">
                {searchError}
              </p>
            ) : null}
            {!pending && !searchError && !flatHits.length ? (
              <p className="px-3 py-1.5 text-xs text-[var(--adm-muted)]">No matching paths.</p>
            ) : null}
            {indexedSegments.map((segment) => (
              <div key={segment.id} role="group" aria-label={segment.label}>
                <div className="sticky top-0 border-b border-[var(--adm-border)] bg-[var(--adm-bg-soft)] px-3 py-1 text-xs font-medium text-[var(--adm-muted)]">
                  {segment.label}
                </div>
                {segment.hits.map(({ hit, index }) => {
                  const active = index === activeIndex;
                  return (
                    <button
                      key={hit.id}
                      id={`${resultListId}-${hit.id}`}
                      type="button"
                      role="option"
                      aria-selected={active || hit.href === href}
                      className={cn(
                        "flex w-full items-baseline justify-between gap-3 border-b border-[var(--adm-border)] px-3 py-2 text-left text-sm last:border-b-0",
                        active ? "bg-[var(--adm-bg-soft)]" : "hover:bg-[var(--adm-bg-soft)]",
                      )}
                      onMouseEnter={() => setActiveIndex(index)}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => choose(hit)}
                    >
                      <span className="min-w-0 font-medium text-[var(--adm-fg)]">{hit.label}</span>
                      <span className="shrink-0 text-xs text-[var(--adm-muted)]">{hit.detail}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>,
          portalTarget,
        )
      : null;

  return (
    <div ref={rootRef} data-slot="href-control" className="relative">
      <AdminTextControl
        controlId={controlId}
        clearable
        invalid={invalid}
        warning={warning}
        disabled={disabled}
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        onClear={clear}
        onFocus={() => openMenu()}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        aria-label={ariaLabel}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open && (flatHits.length > 0 || pending || Boolean(searchError))}
        aria-controls={resultListId}
        aria-activedescendant={
          activeIndex >= 0 && flatHits[activeIndex]
            ? `${resultListId}-${flatHits[activeIndex].id}`
            : undefined
        }
        aria-describedby={describedBy}
        aria-invalid={ariaInvalid}
        aria-errormessage={ariaErrorMessage}
        data-draft-autosave="ignore"
        autoComplete="off"
      />
      <input
        ref={hiddenInputRef}
        type="hidden"
        name={name}
        value={href}
      />
      {listbox}
    </div>
  );
}

export type AdminHrefFieldProps = Omit<AdminHrefControlProps, "warningId" | "onDetectedWarningChange"> & {
  label?: ReactNode;
  owner?: AdminFieldOwner;
  help?: ReactNode;
  required?: boolean;
  error?: string;
  errorId?: string;
  className?: string;
  unitId?: string;
  issue?: ReactNode;
  id?: string;
};

export function AdminHrefField({
  id,
  label,
  owner,
  help,
  required = false,
  error,
  errorId,
  warning,
  invalid,
  disabled,
  className,
  unitId,
  issue,
  ...controlProps
}: AdminHrefFieldProps) {
  const { controlId, messageId, warningId } = useAdminFieldIds(id, errorId);
  const [detectedIssue, setDetectedIssue] = useState<DetectedHrefIssue | undefined>();
  const detectedError = detectedIssue?.tone === "error" ? detectedIssue.message : undefined;
  const detectedWarning = detectedIssue?.tone === "warning" ? detectedIssue.message : undefined;
  const shellError = error ?? detectedError;
  const shellWarning = shellError ? undefined : (warning ?? detectedWarning);

  return (
    <AdminFieldShell
      id={unitId}
      component="AdminHrefField"
      label={label}
      owner={owner}
      help={help}
      required={required}
      error={shellError}
      errorId={messageId}
      warning={shellWarning}
      warningId={warningId}
      issue={issue}
      disabled={disabled}
      className={className}
      controlId={controlId}
    >
      <AdminHrefControl
        {...controlProps}
        controlId={controlId}
        invalid={invalid || Boolean(shellError)}
        disabled={disabled}
        warning={shellWarning}
        warningId={warningId}
        onDetectedIssueChange={setDetectedIssue}
        aria-invalid={shellError || invalid ? true : undefined}
        aria-errormessage={shellError || invalid ? messageId : undefined}
      />
    </AdminFieldShell>
  );
}
