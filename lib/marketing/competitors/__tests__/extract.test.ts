import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  extractFromHtml,
  parseShopifyProductJs,
} from "@/lib/marketing/competitors/extract";

const evidence = JSON.parse(
  readFileSync(
    join(process.cwd(), "docs/research/task-002/evidence/p-aurorajoalharia.com.json"),
    "utf8",
  ),
) as {
  rows: Array<{ name: string; price: number; currency: string; availability: string }>;
};

describe("extract", () => {
  it("parses JSON-LD Product with offers and min price from variants", () => {
    const html = `<html><head>
<script type="application/ld+json">
{"@type":"Product","name":"Colar Cardume d'Ouro","offers":{"@type":"AggregateOffer","lowPrice":"22.90","priceCurrency":"EUR","availability":"https://schema.org/OutOfStock"}}
</script></head></html>`;
    const extracted = extractFromHtml(html);
    expect(extracted.source).toBe("json-ld");
    expect(extracted.name).toBe("Colar Cardume d'Ouro");
    expect(extracted.price).toBe(22.9);
    expect(extracted.currency).toBe("EUR");
    expect(extracted.availability).toBe("OutOfStock");
    expect(extracted.price).toBe(evidence.rows[0]?.price);
  });

  it("falls back to og:price", () => {
    const html = `<meta property="og:title" content="Red Crush Bracelet" />
<meta property="og:price:amount" content="42.50" />
<meta property="og:price:currency" content="EUR" />`;
    const extracted = extractFromHtml(html);
    expect(extracted.source).toBe("og");
    expect(extracted.price).toBe(42.5);
    expect(extracted.currency).toBe("EUR");
    expect(extracted.name).toBe("Red Crush Bracelet");
  });

  it("parses Shopify product.js cents", () => {
    const parsed = parseShopifyProductJs(
      JSON.stringify({ title: "mushroom", price: 13500, available: true }),
    );
    expect(parsed?.source).toBe("shopify-js");
    expect(parsed?.price).toBe(135);
    expect(parsed?.availability).toBe("InStock");
  });

  it("reads ProductGroup hasVariant offers for min price", () => {
    const html = `<script type="application/ld+json">
{"@type":"ProductGroup","name":"Ring","hasVariant":[
  {"@type":"Product","offers":{"price":"30","priceCurrency":"EUR"}},
  {"@type":"Product","offers":{"price":"18","priceCurrency":"EUR"}}
]}
</script>`;
    const extracted = extractFromHtml(html);
    expect(extracted.price).toBe(18);
    expect(extracted.source).toBe("json-ld");
  });
});
