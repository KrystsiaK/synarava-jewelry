"use client";

import { useEffect } from "react";

import { markProductIncomingUpdateViewedAction } from "@/app/admin/actions/sync";

/** The product counts as reviewed only after its real editor has mounted for this admin. */
export function ProductIncomingUpdateMarker({ productId }: { productId: string }) {
  useEffect(() => {
    void markProductIncomingUpdateViewedAction(productId);
  }, [productId]);
  return null;
}
