import { AdminHelp } from "@/components/synarava-cms";
import type { ShopifyProductFact } from "@/lib/shopify/product-facts";

/** Read-only snapshot of what the last Shopify Pull resolved — edit specs in Product parameters. */
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
      className="grid gap-3 border border-[var(--adm-border)] p-4"
    >
      <div>
        <p className="adm-label-row">
          <span className="adm-label">Last Pull from Shopify</span>
          <AdminHelp>
            Reference only — values Shopify had on the last Pull (category attributes, public
            metafields, weight, origin). To change specs from Synarava, use Product parameters below,
            Save, then Push. To refresh this list, Pull again.
          </AdminHelp>
        </p>
      </div>

      {!linked ? (
        <p className="text-sm text-[var(--adm-muted)]">
          Link this product to Shopify and Pull to see remote facts here.
        </p>
      ) : facts.length === 0 ? (
        <p className="text-sm text-[var(--adm-muted)]">
          Nothing resolved on the last Pull yet. Fill Product parameters below or edit in Shopify, then Pull.
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
