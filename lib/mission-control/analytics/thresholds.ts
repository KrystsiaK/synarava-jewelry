/**
 * Single admin-facing threshold config for the Analytics hub node.
 * Plain language; every rule maps to a fix hint in detect.ts.
 */
export const ANALYTICS_THRESHOLDS = {
  /** Minimum prior-step events before a funnel check counts (avoids noise). */
  funnelMinPriorEvents: 20,
  /**
   * Per-step minimum conversion (next/prev). Below → warning only.
   * Floors are conservative ecommerce baselines (PDP→ATC often ~3–8%;
   * ATC→checkout and checkout→purchase higher once intent exists).
   * Sources: Synarava ops notes + typical headless checkout funnels —
   * not a single global 0.85/0.95 drop ratio (that false-alarms healthy funnels).
   */
  funnelStepWarnMinConversion: {
    "view_item->add_to_cart": 0.02,
    "add_to_cart->begin_checkout": 0.15,
    "begin_checkout->purchase": 0.2,
  } as const,
  /** synarava_telemetry client_error / unhandled_rejection count → warn. */
  telemetryErrorWarn: 5,
  /** synarava_telemetry client_error / unhandled_rejection count → error. */
  telemetryErrorError: 25,
  /** web_vital “poor” samples in period → warn. */
  webVitalPoorWarn: 10,
  /** web_vital “poor” samples in period → error. */
  webVitalPoorError: 40,
  /**
   * Query GA for synarava_telemetry only when GA4 has event-scoped custom
   * dimensions `telemetry_kind` (+ optional `rating`) and GTM maps the
   * dataLayer event. Default false — otherwise every run would 400/empty.
   */
  gaTelemetryQueryEnabled: false,
  /** Expected GA event silent for this many days → warning. */
  silentEventDaysWarn: 7,
  /**
   * Silent days → error for non-purchase expected events.
   * `purchase` is warning-only forever (no orders OR Shopify purchase pixel
   * may not reach GA).
   */
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
  /** Min hours between successful Clarity calls (4/day ⇒ ≥6h). */
  clarityMinIntervalHours: 6,
  /** Clarity lookback for project-live-insights. */
  clarityNumOfDays: 3 as 1 | 2 | 3,
  /** Default GA lookback for funnel / telemetry / silence checks. */
  gaLookbackDays: 28,
} as const;

export type AnalyticsThresholds = typeof ANALYTICS_THRESHOLDS;

export type FunnelStepKey = keyof typeof ANALYTICS_THRESHOLDS.funnelStepWarnMinConversion;
