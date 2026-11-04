import { ANALYTICS_THRESHOLDS } from "@/lib/mission-control/analytics/thresholds";
import type { AnalyticsNotice } from "@/lib/mission-control/analytics/types";

/**
 * Informational notice when site-error / web-vital GA queries are gated off.
 * Not warn/error/ok — config gap only (custom dims + GTM for synarava_telemetry).
 */
export function buildTelemetryNotConfiguredNotice(): AnalyticsNotice {
  return {
    id: "notice:telemetry_not_configured",
    tone: "info",
    title: "site errors/web vitals: not configured",
    detail:
      "Missing: GA4 event-scoped custom dimensions telemetry_kind (+ optional rating) and/or GTM that maps the dataLayer synarava_telemetry event. " +
      `Query stays gated by ANALYTICS_THRESHOLDS.gaTelemetryQueryEnabled=${String(ANALYTICS_THRESHOLDS.gaTelemetryQueryEnabled)} so the collector does not 400 on empty config.`,
  };
}
