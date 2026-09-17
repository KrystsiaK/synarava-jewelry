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
import { isTerminalCustomerTokenError, requestCustomerTokens } from "./tokens";
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
  } catch (error) {
    return recoverFromFailedRefresh(session, error);
  }
}

/**
 * A failed refresh isn't necessarily proof the session is dead: a concurrent
 * request may have already refreshed successfully — re-reading picks that up
 * instead of deleting a session out from under a fresher write — or the
 * failure may be a passing Shopify/network outage rather than a rejected
 * refresh token. Only deletes the session when the stored row is still
 * exactly what we started with AND the failure was a genuine rejection of the
 * refresh grant (REV-17).
 */
async function recoverFromFailedRefresh(
  session: StoredShopifyCustomerSession,
  error: unknown,
): Promise<ActiveShopifyCustomerSession | null> {
  const current = await findStoredCustomerSession(session.id);
  if (!current) return null;

  const refreshedConcurrently = current.updatedAt.getTime() !== session.updatedAt.getTime();
  const row = refreshedConcurrently ? current : session;

  if (!refreshedConcurrently) {
    if (isTerminalCustomerTokenError(error)) {
      await deleteStoredCustomerSession(session.id).catch(() => undefined);
      return null;
    }
    // Transient failure, nothing changed underneath us: keep the stored
    // session for a later request to retry, but only serve this request if
    // the still-stored access token hasn't actually expired yet.
    if (row.accessTokenExpiresAt.getTime() <= Date.now()) return null;
  }

  try {
    return {
      accessToken: decryptCustomerSecret(row.accessToken),
      id: row.id,
      idToken: decryptCustomerSecret(row.idToken),
      sessionExpiresAt: row.sessionExpiresAt,
    };
  } catch {
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
