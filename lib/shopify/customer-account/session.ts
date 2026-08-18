import "server-only";

import { cookies } from "next/headers";

import {
  getShopifyCustomerAccountConfig,
  SHOPIFY_CUSTOMER_SESSION_COOKIE,
} from "./config";
import { decryptCustomerSecret, encryptCustomerSecret } from "./crypto";
import { getCustomerAuthorizationDiscovery } from "./discovery";
import { requestCustomerTokens } from "./tokens";
import {
  deleteStoredCustomerSession,
  findStoredCustomerSession,
  type StoredShopifyCustomerSession,
  updateStoredCustomerSession,
} from "./session-store";

const REFRESH_LEEWAY_MS = 60_000;

export type ActiveShopifyCustomerSession = {
  accessToken: string;
  id: string;
  idToken: string;
};

async function refreshCustomerSession(
  session: StoredShopifyCustomerSession | null,
): Promise<ActiveShopifyCustomerSession | null> {
  if (!session) return null;

  try {
    const [{ token_endpoint }, config] = await Promise.all([
      getCustomerAuthorizationDiscovery(),
      Promise.resolve(getShopifyCustomerAccountConfig()),
    ]);
    const body = new URLSearchParams({
      client_id: config.clientId,
      grant_type: "refresh_token",
      refresh_token: decryptCustomerSecret(session.refreshToken),
    });
    const tokens = await requestCustomerTokens(token_endpoint, body);
    const idToken = tokens.id_token
      ? tokens.id_token
      : decryptCustomerSecret(session.idToken);

    await updateStoredCustomerSession(session.id, {
      accessToken: encryptCustomerSecret(tokens.access_token),
      refreshToken: encryptCustomerSecret(tokens.refresh_token),
      idToken: encryptCustomerSecret(idToken),
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    });

    return {
      accessToken: tokens.access_token,
      id: session.id,
      idToken,
    };
  } catch {
    await deleteStoredCustomerSession(session.id).catch(() => undefined);
    return null;
  }
}

export async function getShopifyCustomerSession(): Promise<ActiveShopifyCustomerSession | null> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SHOPIFY_CUSTOMER_SESSION_COOKIE)?.value;
  if (!sessionId) return null;

  const session = await findStoredCustomerSession(sessionId);
  if (!session) return null;

  if (session.expiresAt.getTime() <= Date.now() + REFRESH_LEEWAY_MS) {
    return refreshCustomerSession(session);
  }

  try {
    return {
      accessToken: decryptCustomerSecret(session.accessToken),
      id: session.id,
      idToken: decryptCustomerSecret(session.idToken),
    };
  } catch {
    await deleteStoredCustomerSession(session.id).catch(() => undefined);
    return null;
  }
}

export async function hasShopifyCustomerSession() {
  return Boolean(await getShopifyCustomerSession());
}
