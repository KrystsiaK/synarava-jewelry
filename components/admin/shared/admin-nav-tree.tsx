"use client";

import {
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";

import {
  adminHrefUnder,
  resolveAdminNavItemSignal,
  resolveAdminNavSignal,
  splitAdminHref,
  type AdminNavChildConfig,
  type AdminNavItemConfig,
  type AdminNavSignal,
} from "@/components/admin/shared/admin-nav-config";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/ui";

function useLocationHash() {
  const [hash, setHash] = useState("");

  useEffect(() => {
    function readHash() {
      setHash(window.location.hash.replace(/^#/, ""));
    }

    readHash();
    window.addEventListener("hashchange", readHash);
    return () => window.removeEventListener("hashchange", readHash);
  }, []);

  return hash;
}

function AdminNavCountBadge({
  count,
  label,
  kind = "issues",
}: {
  count: number;
  label: string;
  kind?: "issues" | "sync" | "count";
}) {
  if (count <= 0) return null;

  return (
    <span
      data-component="AdminNavCountBadge"
      className={cn(
        "adm-nav-badge",
        kind === "sync" && "adm-nav-badge--sync",
        kind === "count" && "adm-nav-badge--count",
      )}
      aria-label={label}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

function AdminNavMarker({
  active,
  signal,
}: {
  active: boolean;
  signal?: AdminNavSignal;
}) {
  if (signal) {
    return (
      <span
        className="adm-nav-arrow"
        data-attention="true"
        data-signal={signal}
        aria-hidden="true"
      />
    );
  }

  return (
    <span className="adm-nav-arrow" aria-hidden="true">
      {active ? "◆" : "·"}
    </span>
  );
}

function AdminNavLabel({ label, className }: { label: string; className?: string }) {
  const text = (
    <span className={cn("adm-nav-label", className)}>{label}</span>
  );

  if (label.length < 22) return text;

  return (
    <Tooltip content={label} side="right" delay={280} maxWidth={240}>
      {text}
    </Tooltip>
  );
}

function scrollToHashTarget(hash: string) {
  if (!hash || typeof document === "undefined") return;
  const el = document.getElementById(hash);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

function childIsActive(
  child: AdminNavChildConfig,
  pathname: string,
  hash: string,
): boolean {
  const { pathname: childPath, hash: childHash } = splitAdminHref(child.href);
  if (pathname !== childPath) return false;
  if (!childHash) return true;
  return hash === childHash;
}

function itemIsActive(item: AdminNavItemConfig, pathname: string, hash: string): boolean {
  if (item.children?.some((child) => childIsActive(child, pathname, hash))) {
    return false;
  }
  return adminHrefUnder(item.href, pathname, item.exact);
}

function itemRouteWantsOpen(item: AdminNavItemConfig, pathname: string, hash: string): boolean {
  if (!item.children?.length) return false;
  if (adminHrefUnder(item.href, pathname, item.exact)) return true;
  return item.children.some((child) => childIsActive(child, pathname, hash));
}

function activeChildBeyondPreview(
  item: AdminNavItemConfig,
  pathname: string,
  hash: string,
): boolean {
  const children = item.children ?? [];
  const limit = item.childPreviewLimit ?? 8;
  const activeIndex = children.findIndex((child) => childIsActive(child, pathname, hash));
  return activeIndex >= limit;
}

export type AdminNavTreeProps = {
  items: AdminNavItemConfig[];
  issueNavHrefs?: string[];
  syncNavHrefs?: string[];
  onNavigate?: () => void;
  footer?: ReactNode;
  className?: string;
};

/**
 * Config-driven admin sidebar tree.
 * Expansion follows the router (pathname + hash); deep links open the matching branch
 * and reveal an active child past the “Show more” fold.
 */
export function AdminNavTree({
  items,
  issueNavHrefs = [],
  syncNavHrefs = [],
  onNavigate,
  footer,
  className,
}: AdminNavTreeProps) {
  const pathname = usePathname();
  const hash = useLocationHash();
  const issueHrefSet = new Set(issueNavHrefs);
  const syncHrefSet = new Set(syncNavHrefs);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  // User-expanded branches beyond the route.
  const [manualOpen, setManualOpen] = useState<ReadonlySet<string>>(() => new Set());
  // User-collapsed branches that the route would otherwise keep open (clears on URL change).
  const [manualClosed, setManualClosed] = useState<ReadonlySet<string>>(() => new Set());
  const [revealed, setRevealed] = useState<ReadonlySet<string>>(() => new Set());

  // Deep-link sync: URL wins — reset manual open/close and reveal active overflow children.
  useEffect(() => {
    setManualOpen(new Set());
    setManualClosed(new Set());

    const nextRevealed = new Set<string>();
    for (const item of itemsRef.current) {
      if (activeChildBeyondPreview(item, pathname, hash)) {
        nextRevealed.add(item.id);
      }
    }
    setRevealed(nextRevealed);

    // Same-document hash landing: scroll after paint.
    if (hash) {
      const frame = window.requestAnimationFrame(() => scrollToHashTarget(hash));
      return () => window.cancelAnimationFrame(frame);
    }
    return undefined;
  }, [pathname, hash]);

  function isOpen(item: AdminNavItemConfig) {
    if (manualClosed.has(item.id)) return false;
    if (itemRouteWantsOpen(item, pathname, hash)) return true;
    return manualOpen.has(item.id);
  }

  function toggleOpen(item: AdminNavItemConfig) {
    const currentlyOpen = isOpen(item);
    const routeWants = itemRouteWantsOpen(item, pathname, hash);

    if (currentlyOpen) {
      if (routeWants) {
        setManualClosed((current) => new Set(current).add(item.id));
      }
      setManualOpen((current) => {
        const next = new Set(current);
        next.delete(item.id);
        return next;
      });
      return;
    }

    setManualClosed((current) => {
      const next = new Set(current);
      next.delete(item.id);
      return next;
    });
    setManualOpen((current) => new Set(current).add(item.id));
  }

  function handleHashLinkClick(
    event: ReactMouseEvent<HTMLAnchorElement>,
    href: string,
  ) {
    const { pathname: targetPath, hash: targetHash } = splitAdminHref(href);
    if (!targetHash) return;
    if (pathname !== targetPath) return;

    event.preventDefault();
    const next = `#${targetHash}`;
    if (window.location.hash !== next) {
      window.history.pushState(null, "", `${targetPath}${next}`);
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    }
    scrollToHashTarget(targetHash);
    onNavigate?.();
  }

  return (
    <nav
      data-component="AdminNavTree"
      className={cn("adm-nav-tree", className)}
      aria-label="Admin"
    >
      <ul className="adm-nav-tree__list">
        {items.map((item) => {
          const hasChildren = Boolean(item.children?.length);
          const open = hasChildren && isOpen(item);
          const active = itemIsActive(item, pathname, hash);
          const signal = resolveAdminNavItemSignal(item, issueHrefSet, syncHrefSet);
          const panelId = `adm-nav-panel-${item.id}`;
          const limit = item.childPreviewLimit ?? 8;
          const children = item.children ?? [];
          const showAll = revealed.has(item.id);
          const visibleChildren = showAll ? children : children.slice(0, limit);
          const hiddenCount = Math.max(0, children.length - visibleChildren.length);

          return (
            <li key={item.id} className="adm-nav-tree__item" data-open={open ? "true" : undefined}>
              <div className="adm-nav-tree__row">
                <Link
                  href={item.href}
                  data-active={active ? "true" : undefined}
                  className="adm-nav-item adm-nav-item--parent"
                  onClick={onNavigate}
                >
                  <AdminNavMarker active={active} signal={signal} />
                  <AdminNavLabel label={item.label} />
                  <span className="adm-nav-item__end">
                    {item.badge ? (
                      <AdminNavCountBadge
                        count={item.badge.count}
                        kind={item.badge.kind}
                        label={
                          item.badge.kind === "issues"
                            ? `${item.badge.count} open problems`
                            : `${item.badge.count} Shopify sync changes to review`
                        }
                      />
                    ) : item.showChildCount && hasChildren && !open ? (
                      <AdminNavCountBadge
                        count={children.length}
                        kind="count"
                        label={`${children.length} items`}
                      />
                    ) : item.code && !(hasChildren && open) ? (
                      <span className="adm-nav-code" aria-hidden="true">
                        {item.code}
                      </span>
                    ) : null}
                  </span>
                </Link>

                {hasChildren ? (
                  <button
                    type="button"
                    className="adm-nav-tree__toggle"
                    aria-expanded={open}
                    aria-controls={panelId}
                    aria-label={open ? `Collapse ${item.label}` : `Expand ${item.label}`}
                    onClick={() => toggleOpen(item)}
                    data-open={open ? "true" : undefined}
                  >
                    <ChevronDown
                      className="adm-nav-tree__chevron"
                      aria-hidden="true"
                      strokeWidth={2}
                      size={14}
                    />
                  </button>
                ) : null}
              </div>

              {hasChildren ? (
                <div
                  id={panelId}
                  className="adm-nav-tree__panel"
                  role="group"
                  aria-label={`${item.label} items`}
                  hidden={!open}
                >
                  <ul className="adm-nav-tree__children">
                    {visibleChildren.map((child) => {
                      const childActive = childIsActive(child, pathname, hash);
                      const childSignal = resolveAdminNavSignal(
                        child.href,
                        issueHrefSet,
                        syncHrefSet,
                      );
                      return (
                        <li key={child.id}>
                          <Link
                            href={child.href}
                            data-active={childActive ? "true" : undefined}
                            className="adm-nav-item adm-nav-item--child"
                            onClick={(event) => {
                              handleHashLinkClick(event, child.href);
                              if (!splitAdminHref(child.href).hash) onNavigate?.();
                            }}
                          >
                            <AdminNavMarker active={childActive} signal={childSignal} />
                            <AdminNavLabel label={child.label} />
                          </Link>
                        </li>
                      );
                    })}
                  </ul>

                  {hiddenCount > 0 ? (
                    <button
                      type="button"
                      className="adm-nav-tree__more"
                      onClick={() =>
                        setRevealed((current) => new Set(current).add(item.id))
                      }
                    >
                      Show {hiddenCount} more
                    </button>
                  ) : null}

                  {showAll && children.length > limit ? (
                    <button
                      type="button"
                      className="adm-nav-tree__more"
                      onClick={() =>
                        setRevealed((current) => {
                          const next = new Set(current);
                          next.delete(item.id);
                          return next;
                        })
                      }
                    >
                      Show less
                    </button>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      <hr className="adm-divider adm-nav-tree__divider" />

      <a
        href="/shop"
        target="_blank"
        rel="noopener noreferrer"
        className="adm-nav-item"
        onClick={onNavigate}
      >
        <span className="adm-nav-arrow" aria-hidden="true">
          ↗
        </span>
        <AdminNavLabel label="View site" />
      </a>

      {footer}
    </nav>
  );
}
