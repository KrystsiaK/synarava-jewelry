export type ExtractSource = "json-ld" | "og" | "shopify-js";

export type ExtractedProduct = {
  name: string | null;
  price: number | null;
  currency: string | null;
  availability: string | null;
  source: ExtractSource | null;
};

type JsonLdOffer = {
  price?: unknown;
  lowPrice?: unknown;
  priceCurrency?: unknown;
  availability?: unknown;
  sku?: unknown;
  offers?: unknown;
};

type JsonLdProduct = {
  "@type"?: unknown;
  name?: unknown;
  offers?: unknown;
  hasVariant?: unknown;
  sku?: unknown;
};

function asArray<T>(value: T | T[] | null | undefined): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function typeIncludes(node: JsonLdProduct, wanted: string): boolean {
  return asArray(node["@type"]).map(String).includes(wanted);
}

function walkLd(node: unknown, out: JsonLdProduct[]): void {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) walkLd(item, out);
    return;
  }
  const obj = node as JsonLdProduct & { "@graph"?: unknown };
  if (typeIncludes(obj, "Product") || typeIncludes(obj, "ProductGroup")) {
    out.push(obj);
  }
  if (obj["@graph"]) walkLd(obj["@graph"], out);
}

export function parseJsonLdProducts(html: string): JsonLdProduct[] {
  const out: JsonLdProduct[] = [];
  for (const m of html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    const raw = (m[1] ?? "").trim();
    if (!raw) continue;
    try {
      walkLd(JSON.parse(raw), out);
    } catch {
      // skip invalid JSON-LD block
    }
  }
  return out;
}

function offersOf(product: JsonLdProduct): JsonLdOffer[] {
  const top = asArray(product.offers as JsonLdOffer | JsonLdOffer[] | undefined).flatMap((x) =>
    x && typeof x === "object" && "offers" in x && x.offers
      ? asArray(x.offers as JsonLdOffer | JsonLdOffer[])
      : [x],
  );
  const variants = asArray(product.hasVariant as JsonLdProduct | JsonLdProduct[] | undefined).flatMap(
    (v) => asArray(v?.offers as JsonLdOffer | JsonLdOffer[] | undefined),
  );
  return [...top, ...variants];
}

function toPrice(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number(value.replace(/\.(?=\d{3})/g, "").replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function availabilityToken(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  const parts = value.split("/");
  return parts[parts.length - 1] || null;
}

function fromJsonLd(html: string): ExtractedProduct | null {
  const product = parseJsonLdProducts(html)[0];
  if (!product) return null;
  const offers = offersOf(product);
  const prices = offers.map((o) => toPrice(o.price ?? o.lowPrice)).filter((n): n is number => n != null);
  return {
    name: typeof product.name === "string" ? product.name : null,
    price: prices.length ? Math.min(...prices) : null,
    currency:
      typeof offers[0]?.priceCurrency === "string" ? (offers[0].priceCurrency as string) : null,
    availability: availabilityToken(offers[0]?.availability),
    source: "json-ld",
  };
}

function fromOg(html: string): ExtractedProduct | null {
  const amount = html.match(/og:price:amount"\s+content="([0-9.,]+)"/i)?.[1];
  if (!amount) return null;
  const currency = html.match(/og:price:currency"\s+content="([A-Z]{3})"/i)?.[1] ?? null;
  const name =
    html.match(/property="og:title"\s+content="([^"]+)"/i)?.[1] ??
    html.match(/content="([^"]+)"\s+property="og:title"/i)?.[1] ??
    null;
  const price = toPrice(amount);
  return {
    name,
    price,
    currency,
    availability: null,
    source: "og",
  };
}

export function parseShopifyProductJs(text: string): ExtractedProduct | null {
  try {
    const json = JSON.parse(text) as { title?: string; price?: number; available?: boolean };
    if (typeof json.price !== "number" || !Number.isFinite(json.price)) return null;
    return {
      name: typeof json.title === "string" ? json.title : null,
      price: json.price / 100,
      currency: null,
      availability: typeof json.available === "boolean" ? (json.available ? "InStock" : "OutOfStock") : null,
      source: "shopify-js",
    };
  } catch {
    return null;
  }
}

/** Prefer JSON-LD → og → (caller may try Shopify .js). */
export function extractFromHtml(html: string): ExtractedProduct {
  const ld = fromJsonLd(html);
  if (ld && (ld.price != null || ld.name)) return ld;
  const og = fromOg(html);
  if (og) return og;
  return {
    name: ld?.name ?? null,
    price: null,
    currency: ld?.currency ?? null,
    availability: ld?.availability ?? null,
    source: ld?.source ?? null,
  };
}
