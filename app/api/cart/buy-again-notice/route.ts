import { NextResponse } from "next/server";

import { clearBuyAgainNotice } from "@/lib/commerce/buy-again-notice";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Clear the Buy again flash cookie without a Server Action.
 * Server Actions that mutate cookies re-render the current RSC tree and would
 * wipe the already-shown notice; a plain Route Handler fetch does not.
 * @see https://nextjs.org/docs/app/guides/server-actions
 */
export async function POST() {
  await clearBuyAgainNotice();
  return new NextResponse(null, {
    status: 204,
    headers: { "Cache-Control": "no-store" },
  });
}
