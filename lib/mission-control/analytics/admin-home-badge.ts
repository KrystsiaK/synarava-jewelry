/**
 * Admin home Analytics badge from persisted ServiceNodeStatus.
 * Never polls GA — read stored level/message/payload only.
 */

import {
  ANALYTICS_NOT_CONNECTED_MESSAGE,
  type AnalyticsSnapshotPayload,
} from "@/lib/mission-control/analytics/types";
import { readAnalyticsPayloadFromCounters } from "@/lib/mission-control/analytics/payload";
import type { ServiceStatusLevel } from "@/lib/mission-control/status";

export const ANALYTICS_HUB_HREF = "/admin/mission-control";

export type AnalyticsHomeBadge =
  | { kind: "hidden" }
  | {
      kind: "disconnected";
      label: string;
      href: string;
    }
  | {
      kind: "alert";
      label: string;
      href: string;
      level: "warn" | "down";
    };

const SHORT_MAX = 72;

function truncate(text: string, max: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1).trimEnd()}…`;
}

function shortAlertMessage(
  status: {
    level: ServiceStatusLevel;
    message: string | null;
  },
  payload: AnalyticsSnapshotPayload | null,
): string {
  const firstIssue = payload?.issues[0]?.title;
  if (firstIssue) return truncate(firstIssue, SHORT_MAX);
  if (status.message?.trim()) return truncate(status.message, SHORT_MAX);
  return status.level === "down" ? "ошибка" : "предупреждение";
}

/**
 * Build the Control Room Analytics line from a stored node row.
 * ok → hidden; not connected → gray info; warn/down → compact alert + hub link.
 */
export function analyticsHomeBadgeFromStatus(
  status: {
    level: ServiceStatusLevel;
    message: string | null;
    counters?: unknown;
  } | null,
): AnalyticsHomeBadge {
  if (!status) {
    return {
      kind: "disconnected",
      label: "Analytics не подключён",
      href: ANALYTICS_HUB_HREF,
    };
  }

  const payload = readAnalyticsPayloadFromCounters(status.counters ?? null);
  const notConnected =
    status.message === ANALYTICS_NOT_CONNECTED_MESSAGE ||
    payload?.connection === "not_connected";

  if (notConnected) {
    return {
      kind: "disconnected",
      label: "Analytics не подключён",
      href: ANALYTICS_HUB_HREF,
    };
  }

  if (status.level === "ok" || status.level === "unknown") {
    return { kind: "hidden" };
  }

  if (status.level !== "warn" && status.level !== "down") {
    return { kind: "hidden" };
  }

  return {
    kind: "alert",
    level: status.level,
    href: ANALYTICS_HUB_HREF,
    label: `Analytics: ${shortAlertMessage(status, payload)}`,
  };
}
