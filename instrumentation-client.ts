import {
  initializeClientTelemetry,
  publishClientTelemetry,
} from "@/lib/telemetry/client";

try {
  initializeClientTelemetry();
} catch {
  // Telemetry must never prevent the storefront from becoming interactive.
}
export function onRouterTransitionStart(
  url: string,
  navigationType: "push" | "replace" | "traverse",
) {
  try {
    const path = new URL(url, window.location.origin).pathname;
    publishClientTelemetry("navigation_start", { path, navigationType });
  } catch {
    // Ignore malformed or unavailable navigation context.
  }
}
