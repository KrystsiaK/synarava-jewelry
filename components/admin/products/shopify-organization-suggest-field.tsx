"use client";

import { useEffect, useId, useState, type ComponentProps } from "react";

import { listShopifyProductOrganizationAction } from "@/app/admin/actions/product-organization";
import { AdminTextField } from "@/components/synarava-cms";
import type { ShopifyProductOrganizationKind } from "@/lib/shopify/product-organization-kinds";

type AdminTextFieldProps = ComponentProps<typeof AdminTextField>;

/**
 * AdminTextField whose datalist options come from Shopify store-wide
 * productVendors / productTypes / productTags — not a local invented list.
 * Keep help quiet so paired grid cells stay aligned.
 */
export function ShopifyOrganizationSuggestField({
  kind,
  ...fieldProps
}: AdminTextFieldProps & { kind: ShopifyProductOrganizationKind }) {
  const listId = useId();
  const [options, setOptions] = useState<string[]>([]);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void listShopifyProductOrganizationAction(kind).then((result) => {
      if (cancelled) return;
      setOptions(result.options);
      setLoadError(result.error ?? "");
    });
    return () => {
      cancelled = true;
    };
  }, [kind]);

  const suggestTitle = loadError
    ? `Shopify suggestions unavailable. You can still type a value.`
    : options.length > 0
      ? `${options.length} suggestions from this Shopify store`
      : "Suggestions load from Shopify when available";

  return (
    <>
      <AdminTextField
        {...fieldProps}
        list={listId}
        title={fieldProps.title ?? suggestTitle}
      />
      <datalist id={listId}>
        {options.map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>
    </>
  );
}
