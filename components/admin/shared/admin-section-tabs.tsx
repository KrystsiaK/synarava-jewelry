"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/ui";

/** Visual attention on a section tab. Issue wins over conflict when both apply. */
export type AdminSectionTabTone = "default" | "issue" | "conflict";

/**
 * Optional cluster in the tab strip (e.g. Shopify commerce vs Synarava editorial).
 * When `groups` is set, every item should reference a `group` id.
 */
export type AdminSectionTabGroup = {
  id: string;
  /** Full cluster name — also the accessible name. */
  label: string;
  /** Shorter chip on narrow viewports. Falls back to `label`. */
  compactLabel?: string;
};

export type AdminSectionTabItem = {
  id: string;
  /** Full name. Stays in the accessible name even when `stripLabel` is set. */
  label: string;
  /** Visible chip. Falls back to `label`. */
  stripLabel?: string;
  /** Secondary hint (tooltip + accessible name). Not shown as a second line. */
  detail?: string;
  icon?: LucideIcon;
  tone?: AdminSectionTabTone;
  /** Unsaved local edits — amber dot, independent of tone. */
  dirty?: boolean;
  /** Optional group id when `AdminSectionTabs.groups` is provided. */
  group?: string;
};

export type AdminSectionTabsProps = {
  items: AdminSectionTabItem[];
  active: string;
  onChange: (id: string) => void;
  /**
   * Visual clusters in the tab strip. Order defines left-to-right layout.
   * Items without a matching `group` render in an unlabeled leftover cluster.
   */
  groups?: readonly AdminSectionTabGroup[];
  /** Accessible name for the tablist. */
  "aria-label"?: string;
  /**
   * Kept for call-site compatibility. The strip is always one scrolling row,
   * so column counts no longer change the layout.
   */
  columns?: number;
  /** Nested inside another panel — flush sticky chrome, no outer radii. */
  embedded?: boolean;
  /** Prefix for tab button ids (`{prefix}-{id}`). Default `adm-section-tab`. */
  idPrefix?: string;
  className?: string;
  /**
   * Everything below the tab strip lives in the cool “well”
   * (title, description, fields) so the open section reads as one surface.
   */
  children?: ReactNode;
};

function toneFor(item: AdminSectionTabItem): AdminSectionTabTone {
  return item.tone === "issue" || item.tone === "conflict" ? item.tone : "default";
}

function tabAccessibleName(item: AdminSectionTabItem): string {
  const tone = toneFor(item);
  const signals = [
    item.dirty ? "unsaved edits" : null,
    tone === "issue" ? "open problems" : null,
    tone === "conflict" ? "sync conflicts" : null,
  ].filter((part): part is string => part != null);
  const base = [item.label, item.detail].filter(Boolean).join(" ");
  return signals.length > 0 ? `${base}, ${signals.join(", ")}` : base;
}

type ResolvedGroup = {
  id: string;
  label: string | null;
  compactLabel?: string;
  items: AdminSectionTabItem[];
};

function resolveGroups(
  items: AdminSectionTabItem[],
  groups: readonly AdminSectionTabGroup[] | undefined,
): ResolvedGroup[] {
  if (!groups || groups.length === 0) {
    return [{ id: "__all", label: null, items }];
  }

  const used = new Set<string>();
  const resolved: ResolvedGroup[] = [];

  for (const group of groups) {
    const groupItems = items.filter((item) => item.group === group.id);
    for (const item of groupItems) used.add(item.id);
    if (groupItems.length === 0) continue;
    resolved.push({
      id: group.id,
      label: group.label,
      compactLabel: group.compactLabel,
      items: groupItems,
    });
  }

  const leftovers = items.filter((item) => !used.has(item.id));
  if (leftovers.length > 0) {
    resolved.push({ id: "__ungrouped", label: null, items: leftovers });
  }

  return resolved.length > 0 ? resolved : [{ id: "__all", label: null, items }];
}

const PAN_LOCK_PX = 8;
const PAN_CLICK_PX = 10;

/**
 * Horizontal pan that does not steal vertical scrolling.
 *
 * The admin page scrolls inside `.admin-content` (`overflow-x: hidden`).
 * Nested `overflow-x: auto` often never receives a horizontal touch there.
 * `touch-action: pan-y` leaves vertical panning to the browser
 * (https://developer.mozilla.org/en-US/docs/Web/CSS/touch-action);
 * this listener claims the X axis only after the gesture is clearly horizontal
 * (https://developer.mozilla.org/en-US/docs/Web/API/Touch_events).
 */
function useStripPan(
  scrollerRef: RefObject<HTMLDivElement | null>,
  pannedRef: { current: boolean },
) {
  useEffect(() => {
    const node = scrollerRef.current;
    if (!node) return;
    // Closures do not keep the narrowed type of `node`.
    const el: HTMLDivElement = node;

    let active = false;
    let locked: "x" | "y" | null = null;
    let startX = 0;
    let startY = 0;
    let originScroll = 0;
    let lastX = 0;
    let lastT = 0;
    let velocity = 0;
    let frame = 0;
    let clearPanTimer = 0;

    const stopMomentum = () => cancelAnimationFrame(frame);

    function canPan() {
      return el.scrollWidth - el.clientWidth > 2;
    }

    function onStart(x: number, y: number) {
      active = true;
      locked = null;
      pannedRef.current = false;
      startX = x;
      startY = y;
      originScroll = el.scrollLeft;
      lastX = x;
      lastT = performance.now();
      velocity = 0;
      stopMomentum();
      window.clearTimeout(clearPanTimer);
      delete el.dataset.panning;
    }

    function onMove(x: number, y: number, event: Event) {
      if (!active) return;
      const dx = x - startX;
      const dy = y - startY;
      if (!locked) {
        if (Math.hypot(dx, dy) < PAN_LOCK_PX) return;
        locked = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      }
      if (locked !== "x" || !canPan()) return;
      if (event.cancelable) event.preventDefault();
      el.dataset.panning = "true";
      if (Math.abs(dx) > PAN_CLICK_PX) pannedRef.current = true;

      const now = performance.now();
      const dt = Math.max(now - lastT, 1);
      velocity = (x - lastX) / dt;
      lastX = x;
      lastT = now;
      el.scrollLeft = originScroll - dx;
    }

    function onEnd() {
      if (!active) return;
      const glide = locked === "x" && pannedRef.current;
      active = false;
      locked = null;
      delete el.dataset.panning;
      if (pannedRef.current) {
        clearPanTimer = window.setTimeout(() => {
          pannedRef.current = false;
        }, 400);
      }
      if (!glide) return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

      const capped = Math.max(-2.2, Math.min(2.2, velocity));
      let v = capped * 16;
      const step = () => {
        if (Math.abs(v) < 0.35) return;
        el.scrollLeft -= v;
        v *= 0.9;
        frame = requestAnimationFrame(step);
      };
      frame = requestAnimationFrame(step);
    }

    function onTouchStart(event: TouchEvent) {
      if (event.touches.length !== 1) return;
      onStart(event.touches[0].clientX, event.touches[0].clientY);
    }

    function onTouchMove(event: TouchEvent) {
      if (!active) return;
      if (event.touches.length !== 1) {
        onEnd();
        return;
      }
      onMove(event.touches[0].clientX, event.touches[0].clientY, event);
    }

    function onPointerDown(event: PointerEvent) {
      if (event.pointerType !== "mouse" || event.button !== 0) return;
      onStart(event.clientX, event.clientY);
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
      window.addEventListener("pointercancel", onPointerUp);
    }

    function onPointerMove(event: PointerEvent) {
      onMove(event.clientX, event.clientY, event);
    }

    function onPointerUp() {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      onEnd();
    }

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onEnd);
    el.addEventListener("touchcancel", onEnd);
    el.addEventListener("pointerdown", onPointerDown);

    return () => {
      stopMomentum();
      window.clearTimeout(clearPanTimer);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
      el.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, [pannedRef, scrollerRef]);
}

function revealTab(scroller: HTMLElement, tab: HTMLElement) {
  const scrollerRect = scroller.getBoundingClientRect();
  const tabRect = tab.getBoundingClientRect();
  const pad = 20;
  if (tabRect.left < scrollerRect.left + pad) {
    scroller.scrollLeft -= scrollerRect.left + pad - tabRect.left;
  } else if (tabRect.right > scrollerRect.right - pad) {
    scroller.scrollLeft += tabRect.right - (scrollerRect.right - pad);
  }
}

function syncOverflowEdges(el: HTMLElement) {
  const max = el.scrollWidth - el.clientWidth;
  el.dataset.overflowStart = el.scrollLeft > 2 ? "true" : "false";
  el.dataset.overflowEnd = max - el.scrollLeft > 2 ? "true" : "false";
}

/** Selected segment sits on a thumb that moves from its current box. */
function placeThumbs(root: HTMLElement) {
  const groups = root.querySelectorAll<HTMLElement>(".adm-section-tabs__group-tabs");
  for (const group of groups) {
    const thumb = group.querySelector<HTMLElement>(".adm-section-tabs__thumb");
    const tab = group.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
    if (!thumb || !tab) continue;
    const tone = tab.dataset.tone;
    if (tone) thumb.dataset.tone = tone;
    else delete thumb.dataset.tone;
    thumb.style.width = `${tab.offsetWidth}px`;
    thumb.style.height = `${tab.offsetHeight}px`;
    thumb.style.transform = `translate3d(${tab.offsetLeft}px, ${tab.offsetTop}px, 0)`;
    if (!thumb.dataset.placed) {
      thumb.dataset.placed = "true";
      requestAnimationFrame(() => {
        thumb.dataset.live = "true";
      });
    }
  }
}

/**
 * Shared admin section tabs — one compact row + cool content well.
 * Groups stay in the row and travel together when the strip pans on X.
 * States: idle / hover / selected (+ hover) × default | issue | conflict.
 */
export function AdminSectionTabs({
  items,
  active,
  onChange,
  groups,
  "aria-label": ariaLabel = "Sections",
  embedded = false,
  idPrefix = "adm-section-tab",
  className,
  children,
}: AdminSectionTabsProps) {
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const pannedRef = useRef(false);
  const activeItem = items.find((item) => item.id === active) ?? items[0];
  const resolvedGroups = resolveGroups(items, groups);
  const grouped = Boolean(groups && groups.length > 0);
  const flatItems = resolvedGroups.flatMap((group) => group.items);
  const flatIndexById = new Map(flatItems.map((item, index) => [item.id, index]));

  useStripPan(scrollerRef, pannedRef);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const sync = () => syncOverflowEdges(el);
    sync();
    placeThumbs(el);
    el.addEventListener("scroll", sync, { passive: true });
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => {
      sync();
      placeThumbs(el);
    });
    observer?.observe(el);
    const track = el.firstElementChild;
    if (track) observer?.observe(track);
    return () => {
      el.removeEventListener("scroll", sync);
      observer?.disconnect();
    };
  }, [items, groups]);

  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    const tab = scroller?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
    if (!scroller || !tab) return;
    placeThumbs(scroller);
    revealTab(scroller, tab);
  }, [activeItem?.id, items, groups]);

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, flatIndex: number) {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextIndex = (flatIndex + 1) % flatItems.length;
    }
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextIndex = (flatIndex - 1 + flatItems.length) % flatItems.length;
    }
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = flatItems.length - 1;
    if (nextIndex == null) return;

    event.preventDefault();
    onChange(flatItems[nextIndex].id);
    buttonRefs.current[nextIndex]?.focus();
  }

  function selectTab(id: string) {
    if (pannedRef.current) {
      pannedRef.current = false;
      return;
    }
    onChange(id);
  }

  return (
    <div
      data-component="AdminSectionTabs"
      data-embedded={embedded ? "true" : undefined}
      data-grouped={grouped ? "true" : undefined}
      className={cn("adm-section-tabs", className)}
    >
      <div
        role="tablist"
        aria-label={ariaLabel}
        aria-orientation="horizontal"
        className={cn(
          "adm-section-tabs__list",
          grouped && "adm-section-tabs__list--grouped",
          embedded ? "adm-section-tabs__list--embedded adm-product-section-tabs" : "adm-section-tabs__list--standalone",
        )}
      >
        <div ref={scrollerRef} className="adm-section-tabs__scroller">
          <div className="adm-section-tabs__track">
            {resolvedGroups.map((group) => (
              <div
                key={group.id}
                role={group.label ? "group" : undefined}
                aria-label={group.label ?? undefined}
                className="adm-section-tabs__group"
                data-group={group.id === "__all" || group.id === "__ungrouped" ? undefined : group.id}
                style={{
                  ["--adm-section-tabs-group-cols" as string]: String(
                    Math.max(group.items.length, 1),
                  ),
                }}
              >
                {group.label ? (
                  <span className="adm-section-tabs__group-label" title={group.label} aria-hidden="true">
                    {group.compactLabel ? (
                      <>
                        <span className="adm-section-tabs__group-label-full">{group.label}</span>
                        <span className="adm-section-tabs__group-label-short">{group.compactLabel}</span>
                      </>
                    ) : (
                      group.label
                    )}
                  </span>
                ) : null}
                <div className="adm-section-tabs__group-tabs">
                  {group.items.some((item) => item.id === activeItem?.id) ? (
                    <span className="adm-section-tabs__thumb" aria-hidden="true" />
                  ) : null}
                  {group.items.map((item) => {
                    const index = flatIndexById.get(item.id) ?? 0;
                    const Icon = item.icon;
                    const selected = item.id === activeItem?.id;
                    const tone = toneFor(item);
                    const visibleLabel = item.stripLabel ?? item.label;
                    const hint = [item.label, item.detail].filter(Boolean).join(" — ");
                    return (
                      <button
                        key={item.id}
                        ref={(element) => {
                          buttonRefs.current[index] = element;
                        }}
                        id={`${idPrefix}-${item.id}`}
                        type="button"
                        role="tab"
                        aria-selected={selected}
                        aria-label={tabAccessibleName(item)}
                        title={hint}
                        tabIndex={selected ? 0 : -1}
                        data-tone={tone === "default" ? undefined : tone}
                        data-dirty={item.dirty ? "true" : undefined}
                        data-issue={tone === "issue" ? "true" : undefined}
                        data-conflict={tone === "conflict" ? "true" : undefined}
                        className="adm-section-tab"
                        onClick={() => selectTab(item.id)}
                        onKeyDown={(event) => handleKeyDown(event, index)}
                      >
                        {Icon || item.dirty || tone !== "default" ? (
                          <span className="adm-section-tab__glyph">
                            {Icon ? (
                              <span className="adm-section-tab__icon" aria-hidden="true">
                                <Icon size={14} strokeWidth={1.9} />
                              </span>
                            ) : null}
                            {item.dirty || tone !== "default" ? (
                              <span className="adm-section-tab__signals" aria-hidden="true">
                                {item.dirty ? (
                                  <span
                                    className="adm-section-tab__dot adm-section-tab__dot--dirty"
                                    title="Unsaved edits"
                                  />
                                ) : null}
                                {tone === "issue" ? (
                                  <span
                                    className="adm-section-tab__dot adm-section-tab__dot--issue"
                                    title="Open problem"
                                  />
                                ) : null}
                                {tone === "conflict" ? (
                                  <span
                                    className="adm-section-tab__dot adm-section-tab__dot--conflict"
                                    title="Sync conflict"
                                  />
                                ) : null}
                              </span>
                            ) : null}
                          </span>
                        ) : null}
                        <span className="adm-section-tab__label">{visibleLabel}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {children != null ? (
        <div className="adm-section-tabs__well">{children}</div>
      ) : null}
    </div>
  );
}
