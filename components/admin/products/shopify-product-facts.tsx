import { AdminHelp } from "@/components/synarava-cms";
import type { ShopifyProductFact } from "@/lib/shopify/product-facts";
import {
  isShopifyOwnedCharacteristicKey,
  isShopifyProductSpecCustomKey,
} from "@/lib/products/shopify-product-specs";

/** Pull projections that are not edited in Shopify product specs above. */
function isVerificationFact(fact: ShopifyProductFact): boolean {
  if (fact.key === "category" || fact.key === "vendor" || fact.key === "productType") return false;
  if (fact.key.startsWith("custom.") && isShopifyProductSpecCustomKey(fact.key.slice("custom.".length))) {
    return false;
  }
  if (fact.key.startsWith("characteristic:")) {
    return !isShopifyOwnedCharacteristicKey(fact.key.slice("characteristic:".length));
  }
  return true;
}

/** Read-only Pull verification — editable Shopify specs live in ShopifyProductSpecsFields. */
export function ShopifyProductFactsPanel({
  facts,
  linked,
}: {
  facts: ShopifyProductFact[];
  linked: boolean;
}) {
  const verificationFacts = facts.filter(isVerificationFact);

  return (
    <section
      data-component="ShopifyProductFactsPanel"
      className="grid gap-3 border border-[var(--adm-border)] p-4"
    >
      <div>
        <p className="adm-label-row">
          <span className="adm-label">Last Pull from Shopify</span>
          <AdminHelp>
            Verification of Pull projections that are not edited above (category taxonomy
            attributes, unit weight, country of origin, and other remote facts). Edit material,
            care, finish, wrist fit, and related `custom.*` fields in Shopify product specs.
            Vendor, product type, and category are on this Product tab. Refresh with Pull.
          </AdminHelp>
        </p>
      </div>

      {!linked ? (
        <p className="text-sm text-[var(--adm-muted)]">
          Link this product to Shopify and Pull to see remote facts here.
        </p>
      ) : verificationFacts.length === 0 ? (
        <p className="text-sm text-[var(--adm-muted)]">
          No extra Pull projections beyond the editable Shopify product specs above.
        </p>
      ) : (
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          {verificationFacts.map((fact) => (
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
