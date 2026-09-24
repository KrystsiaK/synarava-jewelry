"use client";

import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/ui";

/**
 * Status / label chips for entity lists and sync strips.
 * `error` is reserved for real faults — incomplete work is never error.
 */
export type AdminStatusBadgeTone =
  | "published"
  | "draft"
  | "archived"
  | "unlisted"
  | "pending"
  | "conflict"
  | "error";

export type AdminWorkflowStatus = "PUBLISHED" | "DRAFT" | "ARCHIVED" | "UNLISTED";

const TONE_CLASS: Record<AdminStatusBadgeTone, string> = {
  published: "adm-badge adm-badge--published",
  draft: "adm-badge adm-badge--draft",
  archived: "adm-badge adm-badge--archived",
  unlisted: "adm-badge adm-badge--unlisted",
  pending: "adm-badge adm-badge--pending",
  conflict: "adm-badge adm-badge--conflict",
  error: "adm-badge adm-badge--error",
};

export function workflowStatusTone(status: AdminWorkflowStatus): AdminStatusBadgeTone {
  if (status === "PUBLISHED") return "published";
  if (status === "ARCHIVED") return "archived";
  if (status === "UNLISTED") return "unlisted";
  return "draft";
}

export type AdminStatusBadgeProps = Omit<HTMLAttributes<HTMLSpanElement>, "children"> & {
  tone?: AdminStatusBadgeTone;
  /** Convenience for product/page/collection workflow labels. */
  status?: AdminWorkflowStatus;
  children?: ReactNode;
};

/**
 * Pill label — Published / Draft / Archived / sync states.
 * One chrome everywhere; pick tone or pass a workflow `status`.
 */
export function AdminStatusBadge({
  tone,
  status,
  children,
  className,
  ...props
}: AdminStatusBadgeProps) {
  const resolved = tone ?? (status ? workflowStatusTone(status) : "draft");
  const label = children ?? status ?? resolved;

  return (
    <span
      data-component="AdminStatusBadge"
      data-tone={resolved}
      data-role={status ? "workflow-status" : undefined}
      className={cn(TONE_CLASS[resolved], className)}
      {...props}
    >
      {label}
    </span>
  );
}
