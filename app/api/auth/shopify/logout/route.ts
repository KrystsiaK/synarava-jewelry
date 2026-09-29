import { NextResponse } from "next/server";

import {
  getShopifyCustomerAccountConfig,
  SHOPIFY_CUSTOMER_SESSION_COOKIE,
} from "@/lib/shopify/customer-account/config";
import { getCustomerAuthorizationDiscovery } from "@/lib/shopify/customer-account/discovery";
import { getShopifyCustomerSession } from "@/lib/shopify/customer-account/session";
import { deleteStoredCustomerSession } from "@/lib/shopify/customer-account/session-store";
import { SHOPIFY_CART_COOKIE } from "@/lib/shopify/cart";

export const runtime = "nodejs";

/**
 * Logout must be POST. SameSite=Lax cookies are sent on top-level GET
 * navigations from other sites, which would let a third-party page force
 * sign-out and clear the cart. Cross-site POST does not include Lax cookies.
 */
export async function POST() {
  const [session, config, discovery] = await Promise.all([
    getShopifyCustomerSession(),
    Promise.resolve(getShopifyCustomerAccountConfig()),
    getCustomerAuthorizationDiscovery(),
  ]);

  if (session) {
    await deleteStoredCustomerSession(session.id).catch(() => undefined);
  }

  const logoutUrl = session
    ? new URL(discovery.end_session_endpoint)
    : new URL("/", config.appOrigin);
  if (session) {
    logoutUrl.searchParams.set("id_token_hint", session.idToken);
    logoutUrl.searchParams.set("post_logout_redirect_uri", `${config.appOrigin}/`);
  }

  const response = NextResponse.redirect(logoutUrl, 303);
  response.cookies.delete(SHOPIFY_CUSTOMER_SESSION_COOKIE);
  response.cookies.delete(SHOPIFY_CART_COOKIE);
  return response;
}

export async function GET() {
  return new NextResponse("Method Not Allowed", {
    status: 405,
    headers: { Allow: "POST" },
  });
}
