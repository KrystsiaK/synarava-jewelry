import type { ProductRecord } from "@/components/admin/products/product-types";

type Metafield = { namespace: string; key: string; type: string; value: string; resolvedValues?: string[] };

function record(value: unknown): Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function rows(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.map(record) : [];
}

function string(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function metafieldsFromSnapshot(value: unknown): Metafield[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const fields = (value as { metafields?: unknown }).metafields;
  if (!Array.isArray(fields)) return [];
  return fields.filter((field): field is Metafield =>
    field != null && typeof field === "object" &&
    typeof field.namespace === "string" && typeof field.key === "string" &&
    typeof field.type === "string" && typeof field.value === "string",
  );
}

export function ShopifyProductMirror({ product }: { product: ProductRecord }) {
  if (!product.shopifyProductId) return null;
  const metafields = metafieldsFromSnapshot(product.shopifySnapshot);
  const snapshot = record(product.shopifySnapshot);
  const seo = record(snapshot.seo);
  const options = rows(snapshot.options);
  const collections = rows(snapshot.collections);
  const publications = rows(snapshot.publications);
  const media = rows(snapshot.media);
  const remoteVariants = rows(snapshot.variants);

  return (
    <section aria-labelledby={`shopify-mirror-${product.id}`} className="grid gap-5 border border-[var(--adm-border)] p-4">
      <div>
        <h3 id={`shopify-mirror-${product.id}`} className="text-lg font-semibold">Shopify product data</h3>
        <p className="mt-1 text-xs text-[var(--adm-muted)]">
          Local commerce projection and the last stored Shopify snapshot. Pull from Shopify refreshes remote values; unsent local edits may differ. Fields below are read only; editable fields are in the form.
        </p>
      </div>

      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div><dt className="adm-label">Shopify ID</dt><dd className="break-all">{product.shopifyProductId}</dd></div>
        <div><dt className="adm-label">Handle</dt><dd>{product.shopifyHandle || "—"}</dd></div>
        <div><dt className="adm-label">Vendor</dt><dd>{product.vendor || "—"}</dd></div>
        <div><dt className="adm-label">Product type</dt><dd>{product.productType || "—"}</dd></div>
        <div><dt className="adm-label">Category</dt><dd>{product.shopifyCategoryName || "—"}</dd></div>
        <div><dt className="adm-label">Variants</dt><dd>{product.variants.length}</dd></div>
        <div><dt className="adm-label">Media</dt><dd>{media.length}</dd></div>
        <div><dt className="adm-label">Total inventory</dt><dd>{typeof snapshot.totalInventory === "number" ? snapshot.totalInventory : "—"}</dd></div>
        <div><dt className="adm-label">SEO title</dt><dd>{string(seo.title) || "—"}</dd></div>
        <div><dt className="adm-label">SEO description</dt><dd>{string(seo.description) || "—"}</dd></div>
      </dl>

      {options.length > 0 && (
        <div className="grid gap-2">
          <h4 className="adm-label">Options</h4>
          <dl className="grid gap-2 text-sm">
            {options.map((option) => (
              <div key={string(option.id) || string(option.name)} className="grid gap-1 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                <dt className="font-medium">{string(option.name)}</dt>
                <dd>{Array.isArray(option.values) ? option.values.filter((value): value is string => typeof value === "string").join(", ") : "—"}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <h4 className="adm-label">Collections ({collections.length})</h4>
          <p className="mt-1 text-sm">{collections.map((collection) => string(collection.title)).filter(Boolean).join(", ") || "—"}</p>
        </div>
        <div>
          <h4 className="adm-label">Published channels</h4>
          <p className="mt-1 text-sm">{publications.filter((entry) => entry.isPublished === true).map((entry) => string(record(entry.publication).name)).filter(Boolean).join(", ") || "—"}</p>
        </div>
      </div>

      {product.variants.length > 0 && (
        <div className="grid gap-2">
          <h4 className="adm-label">Variants and inventory</h4>
          <div className="grid gap-2">
            {product.variants.map((variant) => {
              const remote = remoteVariants.find((item) => item.id === variant.shopifyVariantId);
              const inventoryItem = record(remote?.inventoryItem);
              return <dl key={variant.id} className="grid gap-2 border border-[var(--adm-border)] p-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
                <div><dt className="adm-label">Title</dt><dd>{variant.title}</dd></div>
                <div><dt className="adm-label">SKU</dt><dd>{variant.sku}</dd></div>
                <div><dt className="adm-label">Barcode</dt><dd>{variant.barcode || "—"}</dd></div>
                <div><dt className="adm-label">Price</dt><dd>{(variant.priceCents / 100).toFixed(2)}</dd></div>
                <div><dt className="adm-label">Compare at</dt><dd>{variant.compareAtCents == null ? "—" : (variant.compareAtCents / 100).toFixed(2)}</dd></div>
                <div><dt className="adm-label">Quantity</dt><dd>{variant.stockOnHand}</dd></div>
                <div><dt className="adm-label">Weight</dt><dd>{variant.weightGrams == null ? "—" : `${variant.weightGrams} g`}</dd></div>
                <div><dt className="adm-label">Taxable / shipping / tracked</dt><dd>{[variant.taxable, variant.requiresShipping, variant.tracked].map((flag) => flag ? "Yes" : "No").join(" / ")}</dd></div>
                <div><dt className="adm-label">Selected options</dt><dd>{rows(variant.selectedOptions).map((option) => `${string(option.name)}: ${string(option.value)}`).filter((value) => value !== ": ").join(", ") || "—"}</dd></div>
                <div><dt className="adm-label">Country of origin</dt><dd>{string(inventoryItem.countryCodeOfOrigin) || "—"}</dd></div>
                <div><dt className="adm-label">HS code</dt><dd>{string(inventoryItem.harmonizedSystemCode) || "—"}</dd></div>
              </dl>;
            })}
          </div>
        </div>
      )}

      {metafields.length > 0 && (
        <div className="grid gap-2">
          <h4 className="adm-label">Shopify metafields ({metafields.length})</h4>
          <dl className="grid max-h-80 overflow-y-auto border-t border-[var(--adm-border)]">
            {metafields.map((field) => (
              <div key={`${field.namespace}.${field.key}`} className="grid gap-1 border-b border-[var(--adm-border)] py-2 text-sm sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] sm:gap-4">
                <dt className="break-all font-medium">{field.namespace}.{field.key} <span className="font-normal text-[var(--adm-muted)]">({field.type})</span></dt>
                <dd className="break-words whitespace-pre-wrap">{field.resolvedValues?.length ? field.resolvedValues.join(", ") : field.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {product.shopifySnapshot != null && (
        <details className="border-t border-[var(--adm-border)] pt-3 text-sm">
          <summary className="cursor-pointer font-medium">Stored Shopify snapshot</summary>
          <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap break-all bg-[var(--adm-bg-soft)] p-3 text-xs">{JSON.stringify(product.shopifySnapshot, null, 2)}</pre>
        </details>
      )}
    </section>
  );
}
