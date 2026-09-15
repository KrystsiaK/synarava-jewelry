import "server-only";

import { cookies } from "next/headers";
import { cache } from "react";

import {
  CUSTOMER_SESSION_IDLE_TIMEOUT_MS,
  getShopifyCustomerAccountConfig,
  SHOPIFY_CUSTOMER_SESSION_COOKIE,
} from "./config";
import { decryptCustomerSecret, encryptCustomerSecret } from "./crypto";
import { getCustomerAuthorizationDiscovery } from "./discovery";
import { requestCustomerTokens } from "./tokens";
import {
  deleteStoredCustomerSession,
  findStoredCustomerSession,
  touchStoredCustomerSession,
  type StoredShopifyCustomerSession,
  updateStoredCustomerSessionTokens,
} from "./session-store";

const REFRESH_LEEWAY_MS = 60_000;
/** Avoids writing `lastSeenAt` on every request; an activity granularity this coarse is enough for an idle-timeout check. */
const SESSION_TOUCH_THRESHOLD_MS = 5 * 60 * 1000;

export type ActiveShopifyCustomerSession = {
  accessToken: string;
  id: string;
  idToken: string;
  sessionExpiresAt: Date;
};

function isSessionExpired(session: StoredShopifyCustomerSession) {
  const now = Date.now();
  return (
    session.sessionExpiresAt.getTime() <= now ||
    now - session.lastSeenAt.getTime() > CUSTOMER_SESSION_IDLE_TIMEOUT_MS
  );
}

async function refreshCustomerSession(
  session: StoredShopifyCustomerSession,
): Promise<ActiveShopifyCustomerSession | null> {
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

    await updateStoredCustomerSessionTokens(session.id, {
      accessToken: encryptCustomerSecret(tokens.access_token),
      refreshToken: encryptCustomerSecret(tokens.refresh_token),
      idToken: encryptCustomerSecret(idToken),
      accessTokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    });

    return {
      accessToken: tokens.access_token,
      id: session.id,
      idToken,
      sessionExpiresAt: session.sessionExpiresAt,
    };
  } catch {
    await deleteStoredCustomerSession(session.id).catch(() => undefined);
    return null;
  }
}

async function loadShopifyCustomerSession(): Promise<ActiveShopifyCustomerSession | null> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SHOPIFY_CUSTOMER_SESSION_COOKIE)?.value;
  if (!sessionId) return null;

  const session = await findStoredCustomerSession(sessionId);
  if (!session) return null;

  if (isSessionExpired(session)) {
    await deleteStoredCustomerSession(session.id).catch(() => undefined);
    return null;
  }

  if (session.accessTokenExpiresAt.getTime() <= Date.now() + REFRESH_LEEWAY_MS) {
    return refreshCustomerSession(session);
  }

  try {
    const active: ActiveShopifyCustomerSession = {
      accessToken: decryptCustomerSecret(session.accessToken),
      id: session.id,
      idToken: decryptCustomerSecret(session.idToken),
      sessionExpiresAt: session.sessionExpiresAt,
    };
    if (Date.now() - session.lastSeenAt.getTime() > SESSION_TOUCH_THRESHOLD_MS) {
      await touchStoredCustomerSession(session.id).catch(() => undefined);
    }
    return active;
  } catch {
    await deleteStoredCustomerSession(session.id).catch(() => undefined);
    return null;
  }
}

/** Deduplicates session reads and token refreshes within one server render. */
export const getShopifyCustomerSession = cache(loadShopifyCustomerSession);

export async function hasShopifyCustomerSession() {
  return Boolean(await getShopifyCustomerSession());
}
