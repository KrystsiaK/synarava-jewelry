import { AdminHelp } from "@/components/synarava-cms";
import type { ShopifyProductFact } from "@/lib/shopify/product-facts";

export function ShopifyProductFactsPanel({
  facts,
  linked,
}: {
  facts: ShopifyProductFact[];
  linked: boolean;
}) {
  return (
    <section
      data-component="ShopifyProductFactsPanel"
      className="grid gap-4 border border-[var(--adm-border)] p-4"
    >
      <div>
        <p className="adm-label-row">
          <span className="adm-label">Product facts from Shopify</span>
          <AdminHelp>
            Category attributes, merchant metafields, weight, and origin come from Shopify.
            Edit them in Shopify Admin, then Pull. Synarava product-page sections (materials story,
            process, lookbook) stay under Product page.
          </AdminHelp>
        </p>
        <p className="mt-2 text-xs leading-5 text-[var(--adm-muted)]">
          Shopify is the catalog source of truth. Empty jewelry / pet / maker passport groups are
          no longer shown here — only facts that exist on the product in Shopify.
        </p>
      </div>

      {!linked ? (
        <p className="text-sm text-[var(--adm-muted)]">
          Link this product to Shopify and Pull to load category attributes, materials, and commerce facts.
        </p>
      ) : facts.length === 0 ? (
        <p className="text-sm text-[var(--adm-muted)]">
          No customer-facing facts on the last Pull yet. Fill category attributes and metafields in
          Shopify, then Pull from Shopify.
        </p>
      ) : (
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          {facts.map((fact) => (
            <div key={fact.key} className="grid gap-0.5">
              <dt className="adm-label">{fact.label}</dt>
              <dd className="text-[var(--adm-ink)]">{fact.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}

/** Keeps Pull-seeded passport rows on Save without exposing the old checklist editor. */
export function HiddenCharacteristicPersistFields({
  characteristics,
}: {
  characteristics: Record<string, { value: string | boolean; certificateUrl: string }>;
}) {
  return (
    <div hidden data-slot="characteristic-persist">
      {Object.entries(characteristics).map(([key, current]) => {
        const name = `characteristic_${key}`;
        if (typeof current.value === "boolean") {
          return (
            <span key={key}>
              {current.value ? <input type="hidden" name={name} value="on" /> : null}
              {current.certificateUrl ? (
                <input type="hidden" name={`${name}_certificate`} value={current.certificateUrl} />
              ) : null}
            </span>
          );
        }
        if (!String(current.value).trim() && !current.certificateUrl.trim()) return null;
        return (
          <span key={key}>
            <input type="hidden" name={name} value={String(current.value)} />
            {current.certificateUrl ? (
              <input type="hidden" name={`${name}_certificate`} value={current.certificateUrl} />
            ) : null}
          </span>
        );
      })}
    </div>
  );
}
