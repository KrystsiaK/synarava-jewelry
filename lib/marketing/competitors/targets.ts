export type CompetitorTier = "small" | "benchmark";

export type CompetitorTarget = {
  /** Registrable host used for allowlist + SSRF checks (no www). */
  host: string;
  origin: string;
  productPath: RegExp;
  label: string;
  tier: CompetitorTier;
};

const PRODUCT_SHOPIFY = /\/products\/[^/]+\/?$/i;
const PRODUCT_PARFOIS = /^\/pt\/pt\/bijuteria\/.*\.html$/i;

/**
 * Fixed owner-approved monitor list (ADR-0012).
 * Hosts must match exactly after lowercasing / stripping leading www.
 */
export const COMPETITOR_TARGETS: readonly CompetitorTarget[] = [
  {
    host: "aurorajoalharia.com",
    origin: "https://aurorajoalharia.com",
    productPath: PRODUCT_SHOPIFY,
    label: "Aurora Joalharia",
    tier: "small",
  },
  {
    host: "magnolia-jewellery.pt",
    origin: "https://www.magnolia-jewellery.pt",
    productPath: PRODUCT_SHOPIFY,
    label: "Magnolia Jewellery",
    tier: "small",
  },
  {
    host: "theboutiqueminimaliste.com",
    origin: "https://theboutiqueminimaliste.com",
    productPath: PRODUCT_SHOPIFY,
    label: "Boutique Minimaliste",
    tier: "small",
  },
  {
    host: "disejewelry.pt",
    origin: "https://disejewelry.pt",
    productPath: PRODUCT_SHOPIFY,
    label: "Disé Jewelry",
    tier: "small",
  },
  {
    host: "casildafinatmc.com",
    origin: "https://casildafinatmc.com",
    productPath: PRODUCT_SHOPIFY,
    label: "Casilda Finat",
    tier: "small",
  },
  {
    host: "corelunejewellery.de",
    origin: "https://corelunejewellery.de",
    productPath: PRODUCT_SHOPIFY,
    label: "Corelune",
    tier: "small",
  },
  {
    host: "anni-lu.com",
    origin: "https://www.anni-lu.com",
    productPath: PRODUCT_SHOPIFY,
    label: "Anni-Lu",
    tier: "small",
  },
  {
    host: "singularu.com",
    origin: "https://singularu.com",
    productPath: PRODUCT_SHOPIFY,
    label: "Singularu",
    tier: "benchmark",
  },
  {
    host: "parfois.com",
    origin: "https://www.parfois.com",
    productPath: PRODUCT_PARFOIS,
    label: "Parfois",
    tier: "benchmark",
  },
  {
    host: "pdpaola.com",
    origin: "https://www.pdpaola.com",
    productPath: PRODUCT_SHOPIFY,
    label: "PDPAOLA",
    tier: "benchmark",
  },
] as const;

const HOST_SET = new Set(COMPETITOR_TARGETS.map((t) => t.host));

/** Normalize hostname: lowercase, strip leading www. */
export function normalizeCompetitorHost(hostname: string): string {
  const lower = hostname.trim().toLowerCase();
  return lower.startsWith("www.") ? lower.slice(4) : lower;
}

export function isAllowedCompetitorHost(hostname: string): boolean {
  return HOST_SET.has(normalizeCompetitorHost(hostname));
}

export function findCompetitorTarget(hostname: string): CompetitorTarget | undefined {
  const host = normalizeCompetitorHost(hostname);
  return COMPETITOR_TARGETS.find((t) => t.host === host);
}

/** Parfois: exclude lookbook / comprar-o-look paths even when regex matches. */
export function isProductUrlForTarget(target: CompetitorTarget, pathname: string): boolean {
  if (target.host === "parfois.com") {
    if (pathname.includes("/comprar-o-look/")) return false;
  }
  return target.productPath.test(pathname);
}
