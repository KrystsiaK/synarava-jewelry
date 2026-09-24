"use client";

import {
  useEffect,
  useRef,
  type HTMLAttributes,
  type ReactNode,
} from "react";

import { cn } from "@/lib/ui";

export type AdminEntityListColumn = {
  key: string;
  label: string;
  align?: "start" | "end";
  className?: string;
};

type RootProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

function Root({ children, className, ...props }: RootProps) {
  return (
    <div data-component="AdminEntityList" className={cn("mt-4 min-w-0 overflow-hidden", className)} {...props}>
      <div className="grid min-w-0 gap-1.5">{children}</div>
    </div>
  );
}

function Header({
  columns,
  gridClassName,
  leading,
}: {
  columns: AdminEntityListColumn[];
  gridClassName: string;
  leading?: ReactNode;
}) {
  return (
    <div
      className={cn("hidden gap-2 px-2 pb-1 xl:grid", gridClassName)}
      style={{ color: "var(--adm-subtle)" }}
      role="row"
    >
      {leading}
      {columns.map((column) => (
        <span
          key={column.key}
          role="columnheader"
          className={cn(
            "text-[0.62rem] font-bold uppercase tracking-[0.1em]",
            column.align === "end" && "text-right",
            column.className,
          )}
        >
          {column.label}
        </span>
      ))}
    </div>
  );
}

function Row({
  children,
  gridClassName,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & { gridClassName: string }) {
  return (
    <div
      role="row"
      className={cn(
        "grid min-w-0 gap-2 px-2 py-2 transition-colors xl:items-center",
        gridClassName,
        className,
      )}
      style={{ border: "1px solid var(--adm-border)" }}
      {...props}
    >
      {children}
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="adm-copy py-6">{children}</p>;
}

function LoadMore({
  hasMore,
  loading,
  onLoadMore,
  label = "Loading more…",
}: {
  hasMore: boolean;
  loading?: boolean;
  onLoadMore: () => void;
  label?: string;
}) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hasMore || loading) return;
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) onLoadMore();
      },
      { rootMargin: "240px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loading, onLoadMore]);

  if (!hasMore && !loading) return null;

  return (
    <div
      ref={sentinelRef}
      className="flex min-h-10 items-center justify-center py-3 text-xs"
      style={{ color: "var(--adm-muted)" }}
      aria-live="polite"
    >
      {loading || hasMore ? label : null}
    </div>
  );
}

export const AdminEntityList = {
  Root,
  Header,
  Row,
  Empty,
  LoadMore,
};
