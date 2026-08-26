"use client";

import { useEffect, useRef } from "react";

import { finalizeConfirmedCheckoutAction } from "@/app/checkout/confirmed/actions";
import { trackCommerceEvent } from "@/lib/analytics/commerce";

type CheckoutFinalizerProps = {
  orderId?: string | null;
};

export function CheckoutFinalizer({ orderId }: CheckoutFinalizerProps) {
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    void finalizeConfirmedCheckoutAction(orderId)
      .then(() => trackCommerceEvent("checkout_completed", { orderId }))
      .catch((error) => {
        console.error("[checkout] Failed to finalize confirmed checkout.", error);
      });
  }, [orderId]);

  return null;
}
