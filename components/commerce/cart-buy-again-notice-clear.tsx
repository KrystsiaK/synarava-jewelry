"use client";

import { useEffect } from "react";

/**
 * Clears the Buy again flash cookie after the cart notice has rendered.
 * Uses a POST Route Handler (not a Server Action): cookie mutation via Server
 * Action automatically re-renders the current RSC page and would remove the
 * notice almost immediately.
 * @see https://nextjs.org/docs/app/guides/server-actions
 */
export function CartBuyAgainNoticeClear() {
  useEffect(() => {
    void fetch("/api/cart/buy-again-notice", {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
    });
  }, []);

  return null;
}
