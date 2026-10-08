import { AdminHelp } from "@/components/synarava-cms";
import type { ShopifyProductFact } from "@/lib/shopify/product-facts";

/** Read-only snapshot of what the last Shopify Pull resolved — edit specs on Passport. */
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
            EN identity comes from the last Shopify Pull. On PT/RU tabs, Passport TEXT overlays
            (and taxonomy maps for category/type) replace matching values for preview — Synarava
            only; they are not pushed as Shopify translations. Edit overlays under Synarava →
            Passport. Refresh the EN pull with Pull again.
          </AdminHelp>
        </p>
      </div>

      {!linked ? (
        <p className="text-sm text-[var(--adm-muted)]">
          Link this product to Shopify and Pull to see remote facts here.
        </p>
      ) : facts.length === 0 ? (
        <p className="text-sm text-[var(--adm-muted)]">
          Nothing resolved on the last Pull yet. Fill Passport (Synarava) or edit in Shopify, then Pull.
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
