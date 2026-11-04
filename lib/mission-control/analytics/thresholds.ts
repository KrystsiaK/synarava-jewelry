/**
 * Single admin-facing threshold config for the Analytics hub node.
 * Plain language; every rule maps to a fix hint in detect.ts.
 */
export const ANALYTICS_THRESHOLDS = {
  /** Funnel: drop from previous step above this ratio → warning. */
  funnelDropWarnRatio: 0.85,
  /** Funnel: drop from previous step above this ratio → error. */
  funnelDropErrorRatio: 0.95,
  /** Minimum prior-step events before a dropoff counts (avoids noise). */
  funnelMinPriorEvents: 20,
  /** synarava_telemetry client_error / unhandled_rejection count → warn. */
  telemetryErrorWarn: 5,
  /** synarava_telemetry client_error / unhandled_rejection count → error. */
  telemetryErrorError: 25,
  /** web_vital “poor” samples in period → warn. */
  webVitalPoorWarn: 10,
  /** web_vital “poor” samples in period → error. */
  webVitalPoorError: 40,
  /** Expected GA event silent for this many days → warning. */
  silentEventDaysWarn: 7,
  /** Expected GA event silent for this many days → error. */
  silentEventDaysError: 28,
  /** Events that must appear regularly (e.g. begin_checkout from #397). */
  expectedEvents: [
    "view_item",
    "add_to_cart",
    "begin_checkout",
    "purchase",
  ] as const,
  /** Funnel step order for dropoff detection. */
  funnelSteps: [
    "view_item",
    "add_to_cart",
    "begin_checkout",
    "purchase",
  ] as const,
  /** Clarity friction metric count per URL+device → warn. */
  clarityFrictionWarn: 5,
  /** Clarity friction metric count per URL+device → error. */
  clarityFrictionError: 20,
  /** Clarity Data Export API hard project limit (MS docs). */
  clarityApiHardLimitPerDay: 10,
  /** Hub budget — stay under the hard limit. */
  clarityApiBudgetPerDay: 4,
  /** Clarity lookback for project-live-insights. */
  clarityNumOfDays: 3 as 1 | 2 | 3,
  /** Default GA lookback for funnel / telemetry / silence checks. */
  gaLookbackDays: 28,
} as const;

export type AnalyticsThresholds = typeof ANALYTICS_THRESHOLDS;
