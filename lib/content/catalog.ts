import { db } from "@/lib/db";

export type CollectionSummary = {
  slug: string;
  name: string;
  eyebrow: string;
  summary: string;
  heroImage: string;
  accent: string;
};

export type ProductSummary = {
  slug: string;
  series: string;
  title: string;
  shortDescription: string;
  price: string;
  image: string;
  collectionSlug: string;
  collectionName: string;
  materialLine: string;
  categorySlug: string | null;
  categoryName: string | null;
  tagSlugs: string[];
  tagNames: string[];
  symbolismLabel: string;
  symbolismTitle: string;
  symbolismBody: string;
  symbolismBody2: string;
  materials: ProductMaterialStory[];
  process: ProductProcessStory;
  lookbook: ProductLookbookStory[];
};

export type ProductMaterialStory = {
  title: string;
  body: string;
  image: string;
};

export type ProductProcessStat = {
  value: string;
  label: string;
};

export type ProductProcessStory = {
  eyebrow: string;
  title: string;
  mediaImage: string;
  stats: ProductProcessStat[];
};

export type ProductLookbookStory = {
  src: string;
  label: string;
  featured?: boolean;
};

export type ShopFilters = {
  q?: string;
  category?: string;
  tag?: string;
  collection?: string;
};

export type PageContent = {
  eyebrow?: string;
  body?: string;
  ctaLabel?: string;
  ctaHref?: string;
  quote?: string;
  secondaryTitle?: string;
  secondaryBody?: string;
};

const defaultCollections = [
  {
    slug: "belarus-heritage",
    code: "COL-01",
    name: "Belarus Heritage",
    subtitle: "Collection 01",
    description:
      "Geometric folk codes, white ceramic, linen rhythm, and sculptural forms rooted in Belarusian symbolic language.",
    manifesto:
      "A collection where ceremonial Belarusian ornament enters a contemporary jewelry language without becoming costume.",
    symbolismLabel: "Symbolic Language",
    symbolismTitle: "Wood, Lava, Embroidery",
    symbolismBody:
      "Wood brings warmth and grounding, lava introduces protective contrast, and Belarusian embroidery carries inherited ornament once worn close to the body as a quiet sign of memory.",
    symbolismBody2:
      "Together they make the piece feel personal rather than decorative: earth, heat, and pattern held in a form meant for everyday wear.",
    searchSummary:
      "Belarusian symbolism, white ceramic, linen rhythm, and sculptural forms.",
    heroImageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuCeoC4s0GytU2DJHgrs3Y0VtvzJzV8XnZqdlM-zu7Pj5SOSNmgf2fH0UUWquiyWXIKpNLyYe7uIZO3_8XVObSjX88ucZFaSmB7RmcgsRhsPnG7tPGc0n0_G6K7x3a5mstC1CRokMdByQ5QzcXX2nFedtwx42wOm2YsJwOSo6OzbspMc5J8qdpMsI2dZi4z_wUwpmA0QdXlFyhLvOkujl25D4nxEsU7IcGhDLxyZA3K6CO9_k9Sx1YFGtL1eqQjnZEl_HFLyG9-8uxkN",
  },
  {
    slug: "earth-rituals",
    code: "COL-02",
    name: "Earth Rituals",
    subtitle: "Collection 02",
    description:
      "Bog oak, volcanic basalt, and raw brass arranged as grounded everyday talismans with a quieter, earth-led palette.",
    manifesto:
      "Objects built from earthy restraint, tactile woods, and raw metals for daily wear with ceremonial depth.",
    symbolismLabel: "Material Meaning",
    symbolismTitle: "Oak, Brass, Basalt",
    symbolismBody:
      "In this collection, wood keeps the pieces tactile and grounded, brass adds warmth and human-made glow, and basalt holds the memory of cooled fire.",
    symbolismBody2:
      "The combination is restrained, but never empty: each material speaks through weight, texture, and wear over time.",
    searchSummary:
      "Bog oak, volcanic basalt, and raw brass everyday talismans.",
    heroImageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuB3bC6VRl2dzJVp1zDJ6F8LIDDaDFjwENBdbLjc5V2HyeQtnfTBNXAnOIKy0hoaL6h__BXybYEv5shYBB_miy09TC6ZVM-f9lUfrO9JOTSxhjtxl-gHz2-hWOBoerCpdanN9qPwdZpiYbcHMYvvAjywffeHeMvC421vpXHTVGgwGsYQzA-PVG_gPvPmpBYeE80XCwL9ifkN2H-IZDB9zpkEr7GBI3CQdSKYAHtXO06qS8aYl7NcL9UeS9d1GYTuH2oO9y1A4a9ZgwIU",
  },
  {
    slug: "dark-symbols",
    code: "COL-03",
    name: "Dark Symbols",
    subtitle: "Collection 03",
    description:
      "Onyx, lava, red agate, and metal symbol pieces with a sharper contrast and a more nocturnal, minimal attitude.",
    manifesto:
      "A darker symbolic line balancing mineral gravity with sharper graphic contrast.",
    symbolismLabel: "Night Code",
    symbolismTitle: "Onyx, Lava, Red Agate",
    symbolismBody:
      "Dark stone creates visual discipline, lava keeps the surface porous and alive, and red agate introduces a more concentrated note of energy and focus.",
    symbolismBody2:
      "These pieces are built to feel sharper and more graphic, while still carrying the same symbolic depth as the softer collections.",
    searchSummary:
      "Onyx, lava, red agate, and metal symbol pieces with nocturnal contrast.",
    heroImageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDo0brMJO6QweYPgvVPClZ6gtXoEsD6e-ZxScM4lJ6vtH__edq9seA-CR7YVps8U1JzWeHTcIT_cpKq9MWv9wpXHmjUgemr7Ahuoai7FwxfiSTOLBCHw_dof0JzrUChWIiHy4T0T73Wh3m-mkmPrC0c2FokJ2WF9niHU5SmYy5qiSzxhcQZgC6qiZxqxNh9GQ10szMB9Te3bbw3PdffbHjIDGTZeOL6UCQ3nDKwZTdj3kOe5jQaoYsvOVaZM_SJN5oBviQ6gSa-ghUm",
  },
];

const defaultCategories = [
  {
    slug: "bracelets",
    name: "Bracelets",
    description: "Bracelets and wrist-focused pieces.",
    sortOrder: 1,
  },
  {
    slug: "dark-pieces",
    name: "Dark Pieces",
    description: "Low-light, higher-contrast symbolic pieces.",
    sortOrder: 2,
  },
  {
    slug: "earth-pieces",
    name: "Earth Pieces",
    description: "Grounded material pieces led by oak, lava, and brass.",
    sortOrder: 3,
  },
  {
    slug: "symbolic-editions",
    name: "Symbolic Editions",
    description: "Pieces driven by explicit geometric and ritual motifs.",
    sortOrder: 4,
  },
];

const defaultTags = [
  "oak",
  "lava",
  "ceramic",
  "brass",
  "agate",
  "heritage",
  "dark",
  "minimal",
  "symbolic",
];

const defaultProducts = [
  {
    slug: "heritage-hybrid",
    sku: "SYN-001",
    name: "Heritage Hybrid I",
    seriesLabel: "Archive Series 04",
    shortDescription:
      "Woven Belarusian ornaments meet the primal honesty of lava and wood in a sculptural wrist piece.",
    description:
      "A sculptural bracelet where woven Belarusian symbolic detail meets lava stone, wood, and linen-led composition.",
    materialLine: "Lava stone · white oak · woven linen",
    searchSummary:
      "Woven Belarusian ornaments, lava stone, wood, and linen in a sculptural wrist piece.",
    priceCents: 34000,
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAs7XYDUYnSqdCPmVGyWlgKudoYrpFkMMgYSiRNwb_37eOg-UfSjnjaK1noWNP7hHVP0k3DPqDRXXJ8FXoLMHCqbDX8mOf-LDwlXQv4HLfis5W7M242xHpirme-XWne_hZ5N5Mz5hjxvWfZj9MsqzQovz3MhaUIwkZ1Wd-HOGypm-j1Q7NuEkyV_hEo7Ihwo1WxlbA-A_3oB7WdSHRmwJRMg_2TlkMjc_qd-3yNV0IuQXFKxy1q-HKDBy3DFvfoWCE8TXaN5Jswu97D",
    collectionSlug: "belarus-heritage",
    categorySlug: "bracelets",
    tags: ["heritage", "lava", "oak", "symbolic"],
  },
  {
    slug: "multi-layered-heritage-cuff",
    sku: "SYN-002",
    name: "The Multi-Layered Heritage Cuff",
    seriesLabel: "01 / Signature",
    shortDescription:
      "Lava, shells, oak wood, and raw brass fasteners in a layered composition inspired by tactile Slavic textures.",
    description:
      "A layered cuff with shells, oak, brass, and tactile contrasts that speak to ceremonial dressing codes.",
    materialLine: "Shells · oak wood · brass",
    searchSummary:
      "Layered cuff with shells, oak wood, and raw brass inspired by Slavic textures.",
    priceCents: 42000,
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuCBX63WCgWtPnScacT2NdSX0EXxTLNA95jHIIkVfY1Fhxfa_tNgorlYdDTKcQu28PFCfFxuVr2dfa__XKYWebZyvt6mCthqPE0YN8c8QpKX4Ge6z363LyMizVS2x-rcrcmGIrzR9ExiDST3DRKgZJ8xhXOwA3ZmFWhCH6OC-Zcq8mpEyCNnt-Pi2r2PyfKB5bOGVAM9azkLweV_1zkNAJ7xShSTvruw5sNV_WDWHMrtNa_lT8dT3iVBFC2XV1rjXB8UI1Iw6uz5xpV3",
    collectionSlug: "belarus-heritage",
    categorySlug: "symbolic-editions",
    tags: ["heritage", "brass", "symbolic"],
  },
  {
    slug: "oak-raw-brass-totem",
    sku: "SYN-003",
    name: "Oak & Raw Brass Totem",
    seriesLabel: "03 / Eco Earth",
    shortDescription:
      "A grounded bracelet study built from bog oak, uncoated brass, and an earth-first composition.",
    description:
      "A quiet everyday talisman built from bog oak and raw brass with minimal ceremony and strong material presence.",
    materialLine: "Bog oak · raw brass",
    searchSummary:
      "Grounded bracelet built from bog oak, uncoated brass, and an earth-first composition.",
    priceCents: 19500,
    imageUrl: "/uploads/products/photo-2026-05-16-20-43-11-4bb9f6a4-243f-4754-9417-a98995b92664.jpg",
    collectionSlug: "earth-rituals",
    categorySlug: "earth-pieces",
    tags: ["oak", "brass", "minimal"],
  },
  {
    slug: "shadow-onyx-silver-sun",
    sku: "SYN-004",
    name: "Shadow Onyx & Silver Sun",
    seriesLabel: "02 / Dark Edition",
    shortDescription:
      "A darker symbolic piece balancing shadow onyx, silver-tone detailing, and a restrained contrast palette.",
    description:
      "A darker symbolic bracelet anchored by shadow onyx and graphic metalwork.",
    materialLine: "Onyx · silver detail · red agate accent",
    searchSummary:
      "Dark symbolic piece balancing shadow onyx, silver-tone detailing, and restrained contrast.",
    priceCents: 28500,
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDo0brMJO6QweYPgvVPClZ6gtXoEsD6e-ZxScM4lJ6vtH__edq9seA-CR7YVps8U1JzWeHTcIT_cpKq9MWv9wpXHmjUgemr7Ahuoai7FwxfiSTOLBCHw_dof0JzrUChWIiHy4T0T73Wh3m-mkmPrC0c2FokJ2WF9niHU5SmYy5qiSzxhcQZgC6qiZxqxNh9GQ10szMB9Te3bbw3PdffbHjIDGTZeOL6UCQ3nDKwZTdj3kOe5jQaoYsvOVaZM_SJN5oBviQ6gSa-ghUm",
    collectionSlug: "dark-symbols",
    categorySlug: "dark-pieces",
    tags: ["dark", "agate", "symbolic", "minimal"],
  },
  {
    slug: "lava-red-agate-compass",
    sku: "SYN-005",
    name: "Lava & Red Agate Compass",
    seriesLabel: "04 / Symbolism",
    shortDescription:
      "A directional talisman combining porous basalt with a more graphic red agate note.",
    description:
      "A directional talisman that leans into strong contrast and symbolic geometry.",
    materialLine: "Lava · red agate · symbol metalwork",
    searchSummary:
      "Directional talisman with porous basalt, red agate, and symbolic metalwork.",
    priceCents: 34000,
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuCt_d_ebEGOWp1ihdn9E9rOzPoAp47x8VK2oL2u1osFvrQrI82dVRunrsFTkmF6e79LX4G83igcALJUo5v5SceK_LnOAXpuLcDGxmdguwDbzYZfYfT4Kk-H2rFkGCuvXFHelznWeIfm0Cz4PhL0-R3AdSg-sflr3SXMGyiug95M4h2kaYuM_QxNL-4sy_cYB6svoR3ufc6WqLHbzfRc2go7AndpuUWUDAsC6jmigW4FSDC2IrDbxXCxpbXO78mXwNxpHUWKfTI1Efka",
    collectionSlug: "dark-symbols",
    categorySlug: "symbolic-editions",
    tags: ["lava", "agate", "dark", "symbolic"],
  },
];

export const fallbackProductMaterials: ProductMaterialStory[] = [
  {
    title: "Lava Stone",
    body: "Primal energy captured from the earth's core. Porous, lightweight, and grounding.",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuC1bJ7ykeUWZbNNpZ4zXpG4SvAJjAQPMpH2D0v2qVUL3Ba8rL9yK6yAJhAybvdZGFOqRYdueOQMOG8LACGPAsxdq9XZkmCcT6u_NVTMYbdZ2rxCVIDcUe11J4hIkFlcfp7CeVur2isa6KbgGOQ32iIYXAjaKKMQ-10-9VyS2htqJu7NHcWYjQuNV-fF9gQLC20YtjoNHhF-z3N6Y8_m_q_vFnHOCINxrvJxGkR0GP3uR-DYJmfkE09_yvCDD72DRF9qBSIH5HrZHMXN",
  },
  {
    title: "White Oak",
    body: "Hand-turned wood, oil-finished to preserve the warmth of Belarusian forests.",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuCIlvjp4lBihCVwo4LwQUe3FT7_W35SdGVr6Zfrm0tN4HxiR6fN_IgsxjzXNsvyz8LAcB5J2GiRSo9EAhE-3aKH_7RzSsvp1NGgb6ia5KwCc2Ns_nXbuyGK73j1LgBOLiEGC3I_v_wO66xJb2FkJZ3ZIQAgt4ZopW1udde2_rQhEizoHb0141AxZjnz5PUdOYiWuCwQ8TRzh5yxJuZJdPnOeLnYF66RSZPIabh-YO5Kv836T5DhLOeTFlHLMMcz1YDl7OMQSTjmj_0h",
  },
  {
    title: "Traditional Weave",
    body: "A geometric protection motif, woven by master artisans using centuries-old techniques.",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDgNxbCUeq6PwnV9fMol7H3gSKKn9-3hk2HER8IYcN4ZgFaK_WI8ymgWt_Ee1poxFW4OcwxoPzM-eYwa53r92ExOElEqMnuWzdS9qO8cjUTQlJqyJOwMma-GC1MeVWBWWgsMl1zF-p1AVwqMwSUlxClRbcxD78jRy_4iGCQU_MnsS31GUG56dvs03N9kPRFhQUNtfuiJTr5mPGYnR4j3_IRn4hNHYN0hfiKa1LN-EBPbMLQtZXKEEksLxzagXPjV9SP1LVvlYyZUp45",
  },
];

export const fallbackProductProcess: ProductProcessStory = {
  eyebrow: "Process",
  title: "Human Precision",
  mediaImage:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuAmofw-Jl3CJtnxftqTYfRCfvMEZbwTFj9jJp9qj6qNia6D9BZ39ELrH5OIpc_-asXTq_9197RDp0w9y2MaYsazzHK5c3KzOfl1uPmxgYsd1FaIi4HELFmwvI0I7oqTe7e5MLDgGc1W0MK-wfoJtFpxqsD4-gZEyABj3x5tlK9ZLFScCUDw60daJKsCYvmBJgE6mh7cFHHw8DjQO1RqeldU6YcNV8x5tpoF8HJSFswbArPbPD8WeRip_1Bw_ePpMMjB3Alq1IDjz7Tk",
  stats: [
    { value: "12", label: "Hours of Weaving" },
    { value: "100%", label: "Natural Cotton" },
    { value: "02", label: "Master Craftsmen" },
    { value: "∞", label: "Heritage Soul" },
  ],
};

export const fallbackProductLookbook: ProductLookbookStory[] = [
  {
    src: "https://lh3.googleusercontent.com/aida-public/AB6AXuB_Ie20hGCRnyWbIUk3WikrL29NSkFV0FzPiuVnJ0sRYnq-5sGpITU4zzVVIa3X_WHW57G1M7j9yVGq0e3eYoEle4MC86F9rl1INlF3Nf8O8pU06NxCKy2DAK9S1_p2ML8y_BDonMAVl9bNQZa-iGN8qHFDb2HzLal7vARnYSYo0bl0jAAKGWFcL1E0dBOTWuVEuR5doUi7uSQF3rTYXDsXU4t2QiUbdhx66sTBKqGjQuyjRUDwdv7nMQdGBrIJPJPRIuDoTsdtldOn",
    label: "01 / The Ensemble",
    featured: true,
  },
  {
    src: "https://lh3.googleusercontent.com/aida-public/AB6AXuAcHdMprl7YZ1Eqp_m9PN5LjGgHgpO7z9LqYfG2pJWftR5gxPOQHiJQY-Ob8XHfylhpDatz5S5iUSsKzUDsbLrfQht1zuMv6hjYk9Rujb--qtrgJtmkpWXp3QYfHItdcaOOBA1I5328QzhQnwKXqhSLNgEitVvoQ4te8m_kE4nrGTZ-C4Xh8VUqgYfuuObDn7cxfMoH_hQs046d_G9QSi3B60SSb7KtMHblZXLX06SvPAI-yv-xQxNS2KiLhp_tjb9PqBhB4XNRxjHZ",
    label: "02 / Watch Pairing",
  },
  {
    src: "https://lh3.googleusercontent.com/aida-public/AB6AXuBqNAoIB2RLpXNNoPRuqNzhk40thxv5VGyxi8ElGGChgVoL4qw89Sry8ZUj0TSxy53krf4-BbUeueIEOjs1WqLmgWon5yMNif8WaLWVmF0v1JIs8if3JemLyVNXjFrPI5edx6a9eurYhKgbqt1tSZ9N3ZsAJssMrNM4D5QbkHarrKPhiXkGP5xO8incgB3khvTO0u8S9c96TewXNZuvuScb0aXsedPXL8EDeXHAqBefSvWKoEbXgbLFebsHM5qfN-rTAikJP1YvuQj7",
    label: "",
  },
  {
    src: "https://lh3.googleusercontent.com/aida-public/AB6AXuBfnxtP0tnzHpA4FJlWk06e5_0KhM8yN7jd2qnTKFjfVNlw9uy9AF_wv54EAH0Yl1wxofDtCYXCU9DTHTFlcbdn4G0EKZSdZhvyKXw1R_TIplVHHQWbq-vGeVL36bAFJ6rRjrLW5nvh1Qsx6ja7Fe0bmT6LhAkK6Mf3zX-npVmHzpcs1kIL376EfLqHsPONa74c4DY4-li-zpAKScW6JSIBp-M76623SP_ozugt7F29isLug4mNGz1LyAL-EdhMusDGq6lU-GMWCUSCj",
    label: "",
  },
];

export type ProductDetailsPayload = {
  materials?: ProductMaterialStory[];
  process?: Partial<ProductProcessStory> & { stats?: ProductProcessStat[] };
  lookbook?: ProductLookbookStory[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeMaterialStory(value: unknown): ProductMaterialStory | null {
  if (!isRecord(value)) return null;
  const title = typeof value.title === "string" ? value.title.trim() : "";
  const body = typeof value.body === "string" ? value.body.trim() : "";
  const image = typeof value.image === "string" ? value.image.trim() : "";
  if (!title || !body || !image) return null;
  return { title, body, image };
}

function normalizeLookbookStory(value: unknown): ProductLookbookStory | null {
  if (!isRecord(value)) return null;
  const src = typeof value.src === "string" ? value.src.trim() : "";
  const label = typeof value.label === "string" ? value.label.trim() : "";
  const featured = Boolean(value.featured);
  if (!src) return null;
  return { src, label, featured };
}

function normalizeProcessStat(value: unknown): ProductProcessStat | null {
  if (!isRecord(value)) return null;
  const valueText = typeof value.value === "string" ? value.value.trim() : "";
  const label = typeof value.label === "string" ? value.label.trim() : "";
  if (!valueText || !label) return null;
  return { value: valueText, label };
}

export function parseProductDetails(details: unknown): ProductDetailsPayload {
  if (!isRecord(details)) {
    return {};
  }

  const materials = Array.isArray(details.materials)
    ? details.materials.map(normalizeMaterialStory).filter(Boolean) as ProductMaterialStory[]
    : [];

  const lookbook = Array.isArray(details.lookbook)
    ? details.lookbook.map(normalizeLookbookStory).filter(Boolean) as ProductLookbookStory[]
    : [];

  const rawProcess = isRecord(details.process) ? details.process : null;
  const process = rawProcess
    ? {
        eyebrow: typeof rawProcess.eyebrow === "string" ? rawProcess.eyebrow.trim() : undefined,
        title: typeof rawProcess.title === "string" ? rawProcess.title.trim() : undefined,
        mediaImage: typeof rawProcess.mediaImage === "string" ? rawProcess.mediaImage.trim() : undefined,
        stats: Array.isArray(rawProcess.stats)
          ? rawProcess.stats.map(normalizeProcessStat).filter(Boolean) as ProductProcessStat[]
          : undefined,
      }
    : undefined;

  return { materials, process, lookbook };
}

const defaultPages = [
  {
    slug: "home",
    title: "The Thread Must Not Be Broken",
    template: "HOME",
    excerpt:
      "Living culture survives only when it is practiced.We create handcrafted jewelry that keeps this cultural code alive.",
    searchSummary: "Synarava home page",
    content: {
      eyebrow: "Couture Collection №01",
      body: "Handcrafted jewelry that bridges the gap between ancient Slavic mysticism and the contemporary architectural avant-garde.",
      ctaLabel: "All products",
      ctaHref: "/shop",
      quote:
        "We do not create accessories. We archive the soul of materials—wood that has witnessed centuries, stone that holds the earth’s heat, and the silent rhythm of folk geometry.",
      secondaryTitle: "Current Archive",
      secondaryBody:
        "Browse the latest collections and featured pieces through a clear storefront layer first.",
    },
  },
  {
    slug: "about",
    title: "A jewelry studio shaped like an exhibition.",
    template: "STATIC_PAGE",
    excerpt:
      "Synarava makes collectible jewelry with a calm, editorial point of view. The brand sits between store and archive.",
    searchSummary: "About Synarava",
    content: {
      eyebrow: "About the studio",
      body: "Synarava makes collectible jewelry with a calm, editorial point of view. The brand sits between store and archive, pairing accessible product browsing with a deeper world of material stories, folk geometry, and atelier process.",
      ctaLabel: "Shop all products",
      ctaHref: "/shop",
      secondaryTitle: "How to use the site",
      secondaryBody:
        "Shop by product, browse by collection, learn through story. The store should stay easy first and layered second.",
    },
  },
  {
    slug: "manifesto",
    title: "The Soul of Belarusian Couture",
    template: "MANIFESTO",
    excerpt:
      "SYNARAVA is not jewelry. It is an act of preservation between the ancient Slavic soul and contemporary high fashion.",
    searchSummary: "The editorial manifesto of Synarava",
    content: {
      eyebrow: "01 / Manifesto",
      body: "SYNARAVA is not jewelry. It is an act of preservation. Each piece is a material dialogue between the ancient Slavic soul and the rigor of contemporary high fashion.",
    },
  },
];

function priceFromCents(priceCents: number, currency = "EUR") {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(priceCents / 100);
}

function toSummary(product: {
  slug: string;
  name: string;
  seriesLabel: string | null;
  shortDescription: string | null;
  priceCents: number;
  currency: string;
  imageUrl: string | null;
  materialLine: string | null;
  symbolismLabel: string | null;
  symbolismTitle: string | null;
  symbolismBody: string | null;
  symbolismBody2: string | null;
  details: unknown;
  category: { slug: string; name: string } | null;
  tags: { tag: { slug: string; name: string } }[];
  collections: {
    collection: {
      slug: string;
      name: string;
      symbolismLabel: string | null;
      symbolismTitle: string | null;
      symbolismBody: string | null;
      symbolismBody2: string | null;
    };
  }[];
}): ProductSummary {
  const leadCollection = product.collections[0]?.collection;
  const details = parseProductDetails(product.details);
  const materials = details.materials && details.materials.length > 0 ? details.materials : fallbackProductMaterials;
  const process = {
    eyebrow: details.process?.eyebrow || fallbackProductProcess.eyebrow,
    title: details.process?.title || fallbackProductProcess.title,
    mediaImage: details.process?.mediaImage || fallbackProductProcess.mediaImage,
    stats: details.process?.stats && details.process.stats.length > 0 ? details.process.stats : fallbackProductProcess.stats,
  };
  const lookbook = details.lookbook && details.lookbook.length > 0 ? details.lookbook : fallbackProductLookbook;

  return {
    slug: product.slug,
    series: product.seriesLabel ?? "Archive Series",
    title: product.name,
    shortDescription: product.shortDescription ?? "",
    price: priceFromCents(product.priceCents, product.currency),
    image: product.imageUrl ?? "",
    collectionSlug: leadCollection?.slug ?? "",
    collectionName: leadCollection?.name ?? "",
    materialLine: product.materialLine ?? "",
    categorySlug: product.category?.slug ?? null,
    categoryName: product.category?.name ?? null,
    tagSlugs: product.tags.map((item) => item.tag.slug),
    tagNames: product.tags.map((item) => item.tag.name),
    symbolismLabel: product.symbolismLabel ?? leadCollection?.symbolismLabel ?? "Symbolic Language",
    symbolismTitle: product.symbolismTitle ?? leadCollection?.symbolismTitle ?? "Material Meaning",
    symbolismBody:
      product.symbolismBody ??
      leadCollection?.symbolismBody ??
      "Materials can carry more than texture alone. They can hold warmth, contrast, and inherited visual language close to the body.",
    symbolismBody2:
      product.symbolismBody2 ??
      leadCollection?.symbolismBody2 ??
      "When nothing custom is set, the product inherits the symbolic reading of its collection.",
    materials,
    process,
    lookbook,
  };
}

let seedPromise: Promise<void> | null = null;

export async function ensureStorefrontSeed() {
  if (seedPromise) {
    return seedPromise;
  }

  seedPromise = (async () => {
    for (const category of defaultCategories) {
      await db.productCategory.upsert({
        where: { slug: category.slug },
        update: {
          name: category.name,
          description: category.description,
          sortOrder: category.sortOrder,
        },
        create: category,
      });
    }

    for (const tagName of defaultTags) {
      const normalized = tagName.trim().toLowerCase();
      await db.tag.upsert({
        where: { slug: normalized },
        update: { name: normalized.replace(/-/g, " ") },
        create: {
          slug: normalized,
          name: normalized.replace(/-/g, " "),
        },
      });
    }

    for (const collection of defaultCollections) {
      await db.collection.upsert({
        where: { slug: collection.slug },
        update: {
          code: collection.code,
          name: collection.name,
          subtitle: collection.subtitle,
          description: collection.description,
          manifesto: collection.manifesto,
          symbolismLabel: collection.symbolismLabel,
          symbolismTitle: collection.symbolismTitle,
          symbolismBody: collection.symbolismBody,
          symbolismBody2: collection.symbolismBody2,
          searchSummary: collection.searchSummary,
          heroImageUrl: collection.heroImageUrl,
          status: "ACTIVE",
          visibility: "PUBLIC",
          publishedAt: new Date(),
        },
        create: {
          ...collection,
          status: "ACTIVE",
          visibility: "PUBLIC",
          publishedAt: new Date(),
        },
      });
    }

    for (const page of defaultPages) {
      await db.page.upsert({
        where: { slug: page.slug },
        update: {
          title: page.title,
          template: page.template as never,
          excerpt: page.excerpt,
          searchSummary: page.searchSummary,
          content: page.content,
          status: "PUBLISHED",
          visibility: "PUBLIC",
          publishedAt: new Date(),
        },
        create: {
          ...page,
          template: page.template as never,
          status: "PUBLISHED",
          visibility: "PUBLIC",
          publishedAt: new Date(),
        },
      });
    }

    for (const product of defaultProducts) {
      const category = await db.productCategory.findUnique({
        where: { slug: product.categorySlug },
        select: { id: true },
      });

      const collection = await db.collection.findUnique({
        where: { slug: product.collectionSlug },
        select: { id: true },
      });

      await db.product.upsert({
        where: { slug: product.slug },
        update: {
          sku: product.sku,
          name: product.name,
          seriesLabel: product.seriesLabel,
          shortDescription: product.shortDescription,
          description: product.description,
          materialLine: product.materialLine,
          symbolismLabel: null,
          symbolismTitle: null,
          symbolismBody: null,
          symbolismBody2: null,
          searchSummary: product.searchSummary,
          priceCents: product.priceCents,
          imageUrl: product.imageUrl,
          categoryId: category?.id,
          status: "ACTIVE",
          visibility: "PUBLIC",
          publishedAt: new Date(),
        },
        create: {
          slug: product.slug,
          sku: product.sku,
          name: product.name,
          seriesLabel: product.seriesLabel,
          shortDescription: product.shortDescription,
          description: product.description,
          materialLine: product.materialLine,
          symbolismLabel: null,
          symbolismTitle: null,
          symbolismBody: null,
          symbolismBody2: null,
          searchSummary: product.searchSummary,
          priceCents: product.priceCents,
          currency: "EUR",
          imageUrl: product.imageUrl,
          categoryId: category?.id,
          status: "ACTIVE",
          visibility: "PUBLIC",
          publishedAt: new Date(),
        },
      });

      const dbProduct = await db.product.findUnique({
        where: { slug: product.slug },
        select: { id: true },
      });

      if (dbProduct && collection) {
        await db.productCollection.upsert({
          where: {
            productId_collectionId: {
              productId: dbProduct.id,
              collectionId: collection.id,
            },
          },
          update: {},
          create: {
            productId: dbProduct.id,
            collectionId: collection.id,
          },
        });
      }

      if (dbProduct) {
        for (const tagSlug of product.tags) {
          const tag = await db.tag.findUnique({
            where: { slug: tagSlug },
            select: { id: true },
          });

          if (!tag) {
            continue;
          }

          await db.productTag.upsert({
            where: {
              productId_tagId: {
                productId: dbProduct.id,
                tagId: tag.id,
              },
            },
            update: {},
            create: {
              productId: dbProduct.id,
              tagId: tag.id,
            },
          });
        }
      }
    }
  })();

  return seedPromise;
}

export async function getShopFilterData() {
  await ensureStorefrontSeed();

  const [categories, tags, collections] = await Promise.all([
    db.productCategory.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    db.tag.findMany({
      orderBy: { name: "asc" },
    }),
    db.collection.findMany({
      where: { status: "ACTIVE", visibility: "PUBLIC" },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
  ]);

  return { categories, tags, collections };
}

export async function listCollections() {
  await ensureStorefrontSeed();

  const collections = await db.collection.findMany({
    where: {
      status: "ACTIVE",
      visibility: "PUBLIC",
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return collections.map((collection) => ({
    slug: collection.slug,
    name: collection.name,
    eyebrow: collection.subtitle ?? "Collection",
    summary: collection.description ?? "",
    heroImage: collection.heroImageUrl ?? "",
    accent: collection.code ?? "Synarava",
  }));
}

export async function getCollectionBySlug(slug: string) {
  await ensureStorefrontSeed();

  const collection = await db.collection.findUnique({
    where: { slug },
  });

  if (!collection || collection.status !== "ACTIVE" || collection.visibility !== "PUBLIC") {
    return null;
  }

  return {
    slug: collection.slug,
    name: collection.name,
    eyebrow: collection.subtitle ?? "Collection",
    summary: collection.description ?? "",
    heroImage: collection.heroImageUrl ?? "",
    accent: collection.code ?? "Synarava",
    manifesto: collection.manifesto ?? "",
    symbolismLabel: collection.symbolismLabel ?? "Symbolic Language",
    symbolismTitle: collection.symbolismTitle ?? "Material Meaning",
    symbolismBody: collection.symbolismBody ?? "",
    symbolismBody2: collection.symbolismBody2 ?? "",
  };
}

export async function listShopProducts(filters: ShopFilters = {}) {
  await ensureStorefrontSeed();

  const q = filters.q?.trim();

  const products = await db.product.findMany({
    where: {
      status: "ACTIVE",
      visibility: "PUBLIC",
      ...(filters.category
        ? {
            category: {
              slug: filters.category,
            },
          }
        : {}),
      ...(filters.tag
        ? {
            tags: {
              some: {
                tag: {
                  slug: filters.tag,
                },
              },
            },
          }
        : {}),
      ...(filters.collection
        ? {
            collections: {
              some: {
                collection: {
                  slug: filters.collection,
                },
              },
            },
          }
        : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { seriesLabel: { contains: q, mode: "insensitive" } },
              { shortDescription: { contains: q, mode: "insensitive" } },
              { materialLine: { contains: q, mode: "insensitive" } },
              { searchSummary: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      category: true,
      tags: {
        include: {
          tag: true,
        },
      },
      collections: {
        include: {
          collection: {
            select: {
              slug: true,
              name: true,
              symbolismLabel: true,
              symbolismTitle: true,
              symbolismBody: true,
              symbolismBody2: true,
            },
          },
        },
        orderBy: {
          sortOrder: "asc",
        },
      },
    },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
  });

  return products.map(toSummary);
}

export async function getProductBySlug(slug: string) {
  await ensureStorefrontSeed();

  const product = await db.product.findUnique({
    where: { slug },
    include: {
      category: true,
      tags: {
        include: {
          tag: true,
        },
      },
      collections: {
        include: {
          collection: {
            select: {
              slug: true,
              name: true,
              symbolismLabel: true,
              symbolismTitle: true,
              symbolismBody: true,
              symbolismBody2: true,
            },
          },
        },
        orderBy: {
          sortOrder: "asc",
        },
      },
    },
  });

  if (!product || product.status !== "ACTIVE" || product.visibility !== "PUBLIC") {
    return null;
  }

  return toSummary(product);
}

export async function getProductsByCollection(slug: string) {
  return listShopProducts({ collection: slug });
}

export async function getPageBySlug(slug: string) {
  await ensureStorefrontSeed();

  const page = await db.page.findUnique({
    where: { slug },
  });

  if (!page || page.status !== "PUBLISHED" || page.visibility !== "PUBLIC") {
    return null;
  }

  return {
    slug: page.slug,
    title: page.title,
    excerpt: page.excerpt ?? "",
    content: (page.content ?? {}) as PageContent,
  };
}

export async function getAdminCatalogData() {
  await ensureStorefrontSeed();

  const [pages, products, categories, tags, collections] = await Promise.all([
    db.page.findMany({
      orderBy: { slug: "asc" },
    }),
    db.product.findMany({
      include: {
        category: true,
        tags: {
          include: {
            tag: true,
          },
        },
        collections: {
          include: {
            collection: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    }),
    db.productCategory.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    db.tag.findMany({
      orderBy: { name: "asc" },
    }),
    db.collection.findMany({
      orderBy: { name: "asc" },
    }),
  ]);

  return { pages, products, categories, tags, collections };
}
