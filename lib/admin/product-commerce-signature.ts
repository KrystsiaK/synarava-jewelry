type ProductCommerceSnapshot = {
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  shopifyCategoryId: string | null;
  media: Array<{ assetId: string; sortOrder: number }>;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED" | "UNLISTED";
  visibility: "PRIVATE" | "UNLISTED" | "PUBLIC";
  sku: string;
  priceCents: number;
  variants: Array<{
    sku: string;
    priceCents: number;
    compareAtCents: number | null;
    stockOnHand: number;
  }>;
  tags: Array<{ tag: { slug: string } }>;
  characteristics: Array<{
    key: string;
    valueType: "TEXT" | "NUMBER" | "BOOLEAN";
    textValue: string | null;
    numberValue: number | null;
    booleanValue: boolean | null;
    certificateUrl: string | null;
  }>;
};

export function productCommerceSignature(product: ProductCommerceSnapshot) {
  const primaryVariant = product.variants[0] ?? null;
  return JSON.stringify({
    name: product.name,
    slug: product.slug,
    description: product.description ?? "",
    imageUrl: product.imageUrl ?? "",
    shopifyCategoryId: product.shopifyCategoryId ?? "",
    media: product.media.map((item) => ({ assetId: item.assetId, sortOrder: item.sortOrder })),
    status: product.status,
    visibility: product.visibility,
    sku: primaryVariant?.sku ?? product.sku,
    priceCents: primaryVariant?.priceCents ?? product.priceCents,
    compareAtCents: primaryVariant?.compareAtCents ?? null,
    stockOnHand: primaryVariant?.stockOnHand ?? 0,
    tags: product.tags.map((item) => item.tag.slug).sort(),
    characteristics: product.characteristics
      .map((item) => ({
        key: item.key,
        valueType: item.valueType,
        value: item.valueType === "BOOLEAN"
          ? Boolean(item.booleanValue)
          : item.valueType === "NUMBER"
            ? item.numberValue
            : item.textValue ?? "",
        certificateUrl: item.certificateUrl ?? "",
      }))
      .sort((left, right) => left.key.localeCompare(right.key)),
  });
}
