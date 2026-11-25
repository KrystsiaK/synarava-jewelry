"use client";

import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import type { ProductPairingPartner } from "@/lib/commerce/product-pairing-partners";
import type { ProductSummary } from "@/lib/content/catalog";

type ProductPairingSelectionContextValue = {
  product: ProductSummary;
  partners: ProductPairingPartner[];
  selectedPartner: ProductPairingPartner | null;
  selectPartner: (slug: string | null) => void;
};

const ProductPairingSelectionContext =
  createContext<ProductPairingSelectionContextValue | null>(null);

export function ProductPairingSelectionProvider({
  product,
  partners,
  children,
}: {
  product: ProductSummary;
  partners: ProductPairingPartner[];
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const withParam = searchParams.get("with");

  const partnerBySlug = useMemo(() => {
    const map = new Map<string, ProductPairingPartner>();
    for (const partner of partners) {
      map.set(partner.product.slug, partner);
      map.set(partner.product.sourceSlug, partner);
    }
    return map;
  }, [partners]);

  const [selectedSlug, setSelectedSlug] = useState<string | null>(() => {
    if (!withParam) return null;
    const partner = partnerBySlug.get(withParam);
    return partner?.available ? partner.product.slug : null;
  });

  useEffect(() => {
    if (!withParam) {
      setSelectedSlug(null);
      return;
    }
    const partner = partnerBySlug.get(withParam);
    setSelectedSlug(partner?.available ? partner.product.slug : null);
  }, [partnerBySlug, withParam]);

  const selectPartner = useCallback(
    (slug: string | null) => {
      const next =
        slug && partnerBySlug.get(slug)?.available
          ? partnerBySlug.get(slug)!.product.slug
          : null;
      // Retap clears.
      const resolved = selectedSlug === next ? null : next;
      setSelectedSlug(resolved);

      const params = new URLSearchParams(searchParams.toString());
      if (resolved) params.set("with", resolved);
      else params.delete("with");
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [partnerBySlug, pathname, router, searchParams, selectedSlug],
  );

  const selectedPartner = selectedSlug
    ? partnerBySlug.get(selectedSlug) ?? null
    : null;

  const value = useMemo(
    () => ({
      product,
      partners,
      selectedPartner: selectedPartner?.available ? selectedPartner : null,
      selectPartner,
    }),
    [partners, product, selectPartner, selectedPartner],
  );

  return (
    <ProductPairingSelectionContext value={value}>
      {children}
    </ProductPairingSelectionContext>
  );
}

export function useProductPairingSelection() {
  return use(ProductPairingSelectionContext);
}

export function useOptionalProductPairingSelection() {
  return use(ProductPairingSelectionContext);
}
