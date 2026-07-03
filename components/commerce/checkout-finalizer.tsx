"use client";

import { useEffect, useRef } from "react";

import { finalizeConfirmedCheckoutAction } from "@/app/checkout/confirmed/actions";

type CheckoutFinalizerProps = {
  orderId?: string | null;
};

export function CheckoutFinalizer({ orderId }: CheckoutFinalizerProps) {
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    void finalizeConfirmedCheckoutAction(orderId).catch((error) => {
      console.error("[checkout] Failed to finalize confirmed checkout.", error);
    });
  }, [orderId]);

  return null;
}
