import { NextResponse } from "next/server";

import {
  getShopifyCustomerAccountConfig,
  SHOPIFY_CUSTOMER_SESSION_COOKIE,
} from "@/lib/shopify/customer-account/config";
import { getCustomerAuthorizationDiscovery } from "@/lib/shopify/customer-account/discovery";
import { getShopifyCustomerSession } from "@/lib/shopify/customer-account/session";
import { deleteStoredCustomerSession } from "@/lib/shopify/customer-account/session-store";

export const runtime = "nodejs";

export async function GET() {
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

  const response = NextResponse.redirect(logoutUrl);
  response.cookies.delete(SHOPIFY_CUSTOMER_SESSION_COOKIE);
  return response;
}
