"use client";

import { useEffect } from "react";

import { clearBuyAgainNoticeAction } from "@/app/[locale]/cart/actions";

/**
 * Clears the Buy again flash cookie after the cart notice has rendered.
 * RSC cannot call cookies().set — only Server Actions / Route Handlers may.
 * @see https://nextjs.org/docs/app/api-reference/functions/cookies
 */
export function CartBuyAgainNoticeClear() {
  useEffect(() => {
    void clearBuyAgainNoticeAction();
  }, []);

  return null;
}
