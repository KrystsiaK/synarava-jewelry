"use client";

import {
  useEffect,
  useEffectEvent,
  useId,
  useRef,
  useState,
  useTransition,
  type KeyboardEvent,
  type ReactNode,
} from "react";

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
  hrefTargetWarning,
  looksLikePath,
  normalizeHrefQuery,
  type StorefrontHrefHit,
  type StorefrontHrefSearchResult,
} from "@/lib/admin/storefront-href";
import { cn } from "@/lib/ui";

const EMPTY_RESULT: StorefrontHrefSearchResult = { segments: [] };

export type AdminHrefControlProps = {
  name: string;
  defaultValue?: string;
  value?: string;
  onValueChange?: (href: string) => void;
  /** Soft orange chrome (draft targets, etc.). */
  warning?: string;
  warningId?: string;
  /** Notifies parent when a draft/unlisted target is detected from search. */
  onDetectedWarningChange?: (message: string | undefined) => void;
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
  warning,
  warningId,
  onDetectedWarningChange,
  controlId,
  invalid = false,
  disabled,
  placeholder = "/shop",
  "aria-label": ariaLabel,
  "aria-invalid": ariaInvalid,
  "aria-errormessage": ariaErrorMessage,
}: AdminHrefControlProps) {
  const isControlled = value !== undefined;
  const [uncontrolledHref, setUncontrolledHref] = useState(defaultValue);
  const href = isControlled ? value : uncontrolledHref;

  const [query, setQuery] = useState(href);
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<StorefrontHrefSearchResult>(EMPTY_RESULT);
  const [searchError, setSearchError] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const [pending, startTransition] = useTransition();

  const hiddenInputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const resultListId = useId();
  const searchErrorId = useId();

  const flatHits = flattenHrefHits(result);

  let runningIndex = 0;
  const indexedSegments = result.segments.map((segment) => ({
    id: segment.id,
    label: segment.label,
    hits: segment.hits.map((hit) => {
      const index = runningIndex;
      runningIndex += 1;
      return { hit, index };
    }),
  }));

  const publishDetectedWarning = useEffectEvent((status?: string) => {
    onDetectedWarningChange?.(hrefTargetWarning(status));
  });

  const commitHref = useEffectEvent((next: string, status?: string) => {
    const normalized = normalizeHrefQuery(next);
    if (!isControlled) setUncontrolledHref(normalized);
    onValueChange?.(normalized);
    setQuery(normalized);
    publishDetectedWarning(status);
    setOpen(false);
    setResult(EMPTY_RESULT);
    setActiveIndex(-1);
    setSearchError("");
    queueMicrotask(() => {
      hiddenInputRef.current?.dispatchEvent(new Event("change", { bubbles: true }));
      hiddenInputRef.current?.dispatchEvent(new Event("input", { bubbles: true }));
    });
  });

  const runSearch = useEffectEvent((search: string) => {
    startTransition(async () => {
      const next = await searchStorefrontHrefsAction(search);
      setResult({ segments: next.segments });
      setSearchError(next.error ?? "");
      setActiveIndex(next.segments.length ? 0 : -1);
    });
  });

  const inspectHref = useEffectEvent((target: string) => {
    if (!target) {
      publishDetectedWarning(undefined);
      return;
    }
    startTransition(async () => {
      const next = await searchStorefrontHrefsAction(target);
      const hit = findExactHrefHit(next, target);
      publishDetectedWarning(hit?.status);
    });
  });

  const closeWithoutCommit = useEffectEvent(() => {
    const trimmed = normalizeHrefQuery(query);
    setOpen(false);
    setResult(EMPTY_RESULT);
    setActiveIndex(-1);
    if (looksLikePath(trimmed) && trimmed !== href) {
      commitHref(trimmed);
      inspectHref(trimmed);
      return;
    }
    setQuery(href);
  });

  useEffect(() => {
    if (isControlled) setQuery(value);
  }, [isControlled, value]);

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

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        closeWithoutCommit();
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function choose(hit: StorefrontHrefHit) {
    commitHref(hit.href, hit.status);
  }

  function clear() {
    commitHref("");
  }

  function onQueryChange(next: string) {
    setQuery(next);
    setOpen(true);
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
        setOpen(true);
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
        onFocus={() => setOpen(true)}
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
      {open ? (
        <div
          id={resultListId}
          role="listbox"
          className={cn(
            "absolute left-0 right-0 top-full z-20 mt-1 max-h-80 overflow-auto border border-[var(--adm-border-strong)] bg-[var(--adm-bg)] shadow-lg",
          )}
        >
          {pending && !flatHits.length ? (
            <p className="px-3 py-2 text-xs text-[var(--adm-muted)]" aria-live="polite">
              Searching…
            </p>
          ) : null}
          {searchError ? (
            <p id={searchErrorId} className="px-3 py-2 text-xs text-[var(--adm-danger)]" role="alert">
              {searchError}
            </p>
          ) : null}
          {!pending && !searchError && !flatHits.length ? (
            <p className="px-3 py-2 text-xs text-[var(--adm-muted)]">No matching paths.</p>
          ) : null}
          {indexedSegments.map((segment) => (
            <div key={segment.id} role="group" aria-label={segment.label}>
              <div className="sticky top-0 border-b border-[var(--adm-border)] bg-[var(--adm-bg-soft)] px-3 py-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-[var(--adm-muted)]">
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
                      "flex w-full items-baseline justify-between gap-3 border-b border-[var(--adm-border)] px-3 py-2.5 text-left text-sm last:border-b-0",
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
        </div>
      ) : null}
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
  const [detectedWarning, setDetectedWarning] = useState<string | undefined>();
  const shellWarning = error ? undefined : (warning ?? detectedWarning);

  return (
    <AdminFieldShell
      id={unitId}
      component="AdminHrefField"
      label={label}
      owner={owner}
      help={help}
      required={required}
      error={error}
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
        invalid={invalid}
        disabled={disabled}
        warning={shellWarning}
        warningId={warningId}
        onDetectedWarningChange={setDetectedWarning}
        aria-invalid={error || invalid ? true : undefined}
        aria-errormessage={error || invalid ? messageId : undefined}
      />
    </AdminFieldShell>
  );
}
