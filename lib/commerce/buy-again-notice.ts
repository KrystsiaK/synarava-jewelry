import "server-only";

import { createHash } from "node:crypto";

import { cookies } from "next/headers";

export const BUY_AGAIN_NOTICE_COOKIE = "synarava-buy-again-notice";
export const BUY_AGAIN_REPLAY_COOKIE = "synarava-buy-again-replay";

/** Short UX window so refresh does not re-add the same permalink. */
export const BUY_AGAIN_REPLAY_MAX_AGE_SECONDS = 120;
export const BUY_AGAIN_NOTICE_MAX_AGE_SECONDS = 120;

export type BuyAgainOutcomeCode =
  | "completed"
  | "partial"
  | "adjusted"
  | "rejected"
  | "failed"
  | "replayed";

export type BuyAgainNotice = {
  outcome: BuyAgainOutcomeCode;
  added: number;
  skipped: number;
  rejectCode?: string;
};

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

/** Compact cookie payload: outcome|added|skipped|rejectCode? */
export function encodeBuyAgainNotice(notice: BuyAgainNotice): string {
  const base = `${notice.outcome}|${notice.added}|${notice.skipped}`;
  return notice.rejectCode ? `${base}|${notice.rejectCode}` : base;
}

export function decodeBuyAgainNotice(raw: string | undefined): BuyAgainNotice | null {
  if (!raw) return null;
  const [outcome, addedRaw, skippedRaw, rejectCode] = raw.split("|");
  const allowed: BuyAgainOutcomeCode[] = [
    "completed",
    "partial",
    "adjusted",
    "rejected",
    "failed",
    "replayed",
  ];
  if (!allowed.includes(outcome as BuyAgainOutcomeCode)) return null;
  const added = Number.parseInt(addedRaw ?? "", 10);
  const skipped = Number.parseInt(skippedRaw ?? "", 10);
  if (!Number.isFinite(added) || !Number.isFinite(skipped) || added < 0 || skipped < 0) {
    return null;
  }
  return {
    outcome: outcome as BuyAgainOutcomeCode,
    added,
    skipped,
    ...(rejectCode ? { rejectCode } : {}),
  };
}

export async function setBuyAgainNotice(notice: BuyAgainNotice) {
  const store = await cookies();
  store.set(BUY_AGAIN_NOTICE_COOKIE, encodeBuyAgainNotice(notice), cookieOptions(BUY_AGAIN_NOTICE_MAX_AGE_SECONDS));
}

/**
 * Read-only peek for Server Components.
 * Cookie mutation is not allowed during RSC render — clear via
 * {@link clearBuyAgainNotice} from the POST Route Handler at
 * `/api/cart/buy-again-notice` (plain fetch). Do not clear from a Server
 * Action: cookie writes there re-render the current RSC tree and would wipe
 * the already-shown notice.
 * @see https://nextjs.org/docs/app/api-reference/functions/cookies
 * @see https://nextjs.org/docs/app/guides/server-actions
 */
export async function readBuyAgainNotice(): Promise<BuyAgainNotice | null> {
  const store = await cookies();
  return decodeBuyAgainNotice(store.get(BUY_AGAIN_NOTICE_COOKIE)?.value);
}

/** Clear the flash notice. Call only from a Route Handler (not a Server Action). */
export async function clearBuyAgainNotice() {
  const store = await cookies();
  if (!store.get(BUY_AGAIN_NOTICE_COOKIE)) return;
  store.set(BUY_AGAIN_NOTICE_COOKIE, "", { ...cookieOptions(0), maxAge: 0 });
}

export function hashBuyAgainReplay(locale: string, canonical: string) {
  return createHash("sha256").update(`${locale}\n${canonical}`).digest("hex");
}

export async function readBuyAgainReplayHash(): Promise<string | null> {
  return (await cookies()).get(BUY_AGAIN_REPLAY_COOKIE)?.value ?? null;
}

export async function writeBuyAgainReplayHash(hash: string) {
  const store = await cookies();
  store.set(BUY_AGAIN_REPLAY_COOKIE, hash, cookieOptions(BUY_AGAIN_REPLAY_MAX_AGE_SECONDS));
}
