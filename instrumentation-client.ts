import { pathLocaleSegment, stripLocalePrefix } from "@/lib/i18n/routing";
import { clarityTag } from "@/lib/telemetry/clarity";
import {
  initializeClientTelemetry,
  publishClientTelemetry,
} from "@/lib/telemetry/client";

function syncClarityRouteTags(pathname: string) {
  const locale = pathLocaleSegment(pathname);
  if (locale) clarityTag("locale", locale);

  const path = stripLocalePrefix(pathname);
  if (path === "/") {
    clarityTag("page_type", "home");
  } else if (
    path === "/shop"
    || path.startsWith("/shop/")
    || path.startsWith("/collections/")
  ) {
    clarityTag("page_type", "shop");
  } else if (path.startsWith("/products/")) {
    clarityTag("page_type", "product");
  } else if (path === "/cart" || path.startsWith("/cart/")) {
    clarityTag("page_type", "cart");
  }

  const collectionMatch = /^\/collections\/([^/]+)/.exec(path);
  if (collectionMatch?.[1]) clarityTag("collection", collectionMatch[1]);
}

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
    syncClarityRouteTags(path);
  } catch {
    // Ignore malformed or unavailable navigation context.
  }
}
