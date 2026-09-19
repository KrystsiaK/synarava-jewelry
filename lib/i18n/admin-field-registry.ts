import { STOREFRONT_COPY_GROUPS } from "@/lib/content/storefront-copy-fields";

// Typed inventory of every buyer-facing admin field: whether it is shared
// (one value for EN/PT) or localized (independent EN/PT values), how
// required it is, and where it syncs in Shopify. Form schemas, validation,
// completeness, and Shopify adapters all read this instead of re-declaring
// the same field list — see tasks/plan.md "Единый контракт полей".
//
// This is the source of truth. If a buyer-facing field exists in a form or
// server action but not here, translation-field-registry.test.ts style
// coverage checks (added per-entity as each vertical slice lands) should
// fail until it's added with a `shared`/`localized` decision and a Shopify
// target (or `null` with a documented reason).

export type FieldMode = "shared" | "localized";
export type FieldRequiredness = "always" | "when-published" | "optional";
export type FieldKind = "short-text" | "long-text" | "rich-text" | "alt" | "seo";

export type ShopifyFieldTarget =
  | { kind: "native"; resource: string; key: string }
  | { kind: "metaobject"; definition: string; key: string }
  | { kind: "metafield"; namespace: string; key: string }
  | null;

export type LocalizedFieldDefinition = {
  key: string;
  label: string;
  mode: FieldMode;
  required: FieldRequiredness;
  kind: FieldKind;
  /** null only when `mode: "shared"` — the translation platform never owns a shared field's sync. */
  shopifyTarget: ShopifyFieldTarget;
};

export type EntityFieldRegistry = {
  entity: string;
  fields: LocalizedFieldDefinition[];
};

const native = (resource: string, key: string): ShopifyFieldTarget => ({ kind: "native", resource, key });
const metaobject = (definition: string, key: string): ShopifyFieldTarget => ({ kind: "metaobject", definition, key });

export const PRODUCT_FIELD_REGISTRY: EntityFieldRegistry = {
  entity: "product",
  fields: [
    { key: "title", label: "Title", mode: "localized", required: "always", kind: "short-text", shopifyTarget: native("PRODUCT", "title") },
    { key: "localizedHandle", label: "URL handle", mode: "localized", required: "optional", kind: "short-text", shopifyTarget: native("PRODUCT", "handle") },
    { key: "shortDescription", label: "Short description", mode: "localized", required: "always", kind: "short-text", shopifyTarget: metaobject("product_detail_copy", "short_description") },
    { key: "description", label: "Description", mode: "localized", required: "always", kind: "long-text", shopifyTarget: native("PRODUCT", "body_html") },
    { key: "materialLine", label: "Material line", mode: "localized", required: "optional", kind: "short-text", shopifyTarget: metaobject("product_detail_copy", "material_line") },
    { key: "symbolismLabel", label: "Symbolism — eyebrow", mode: "localized", required: "optional", kind: "short-text", shopifyTarget: metaobject("product_detail_copy", "symbolism_label") },
    { key: "symbolismTitle", label: "Symbolism — title", mode: "localized", required: "optional", kind: "short-text", shopifyTarget: metaobject("product_detail_copy", "symbolism_title") },
    { key: "symbolismBody", label: "Symbolism — body", mode: "localized", required: "optional", kind: "long-text", shopifyTarget: metaobject("product_detail_copy", "symbolism_body") },
    { key: "symbolismBody2", label: "Symbolism — body (cont.)", mode: "localized", required: "optional", kind: "long-text", shopifyTarget: metaobject("product_detail_copy", "symbolism_body_2") },
    { key: "details", label: "Detail labels/stories (materials, process, lookbook)", mode: "localized", required: "optional", kind: "rich-text", shopifyTarget: metaobject("product_detail_copy", "details") },
    { key: "seoTitle", label: "SEO title", mode: "localized", required: "when-published", kind: "seo", shopifyTarget: native("PRODUCT", "meta_title") },
    { key: "seoDescription", label: "SEO description", mode: "localized", required: "when-published", kind: "seo", shopifyTarget: native("PRODUCT", "meta_description") },
    { key: "optionName", label: "Option name (e.g. \"Color\")", mode: "localized", required: "when-published", kind: "short-text", shopifyTarget: native("PRODUCT_OPTION", "name") },
    { key: "optionValueLabel", label: "Option value label", mode: "localized", required: "when-published", kind: "short-text", shopifyTarget: native("PRODUCT_OPTION_VALUE", "name") },
    { key: "mediaAlt", label: "Image alt text", mode: "localized", required: "optional", kind: "alt", shopifyTarget: native("MEDIA_IMAGE", "alt") },
    { key: "mediaCaption", label: "Image caption", mode: "localized", required: "optional", kind: "short-text", shopifyTarget: metaobject("product_detail_copy", "media_caption") },

    { key: "sku", label: "SKU", mode: "shared", required: "always", kind: "short-text", shopifyTarget: null },
    { key: "priceCents", label: "Price", mode: "shared", required: "always", kind: "short-text", shopifyTarget: null },
    { key: "compareAtCents", label: "Compare-at price", mode: "shared", required: "optional", kind: "short-text", shopifyTarget: null },
    { key: "currency", label: "Currency", mode: "shared", required: "always", kind: "short-text", shopifyTarget: null },
    { key: "status", label: "Status", mode: "shared", required: "always", kind: "short-text", shopifyTarget: null },
    { key: "visibility", label: "Visibility", mode: "shared", required: "always", kind: "short-text", shopifyTarget: null },
    { key: "category", label: "Category relation", mode: "shared", required: "optional", kind: "short-text", shopifyTarget: null },
    { key: "collections", label: "Collection membership", mode: "shared", required: "optional", kind: "short-text", shopifyTarget: null },
    { key: "tags", label: "Tags", mode: "shared", required: "optional", kind: "short-text", shopifyTarget: null },
    { key: "media", label: "Media assets and order", mode: "shared", required: "optional", kind: "short-text", shopifyTarget: null },
    { key: "variants", label: "Variants and inventory", mode: "shared", required: "optional", kind: "short-text", shopifyTarget: null },
  ],
};

export const COLLECTION_FIELD_REGISTRY: EntityFieldRegistry = {
  entity: "collection",
  fields: [
    { key: "name", label: "Name", mode: "localized", required: "always", kind: "short-text", shopifyTarget: native("COLLECTION", "title") },
    { key: "localizedHandle", label: "URL handle", mode: "localized", required: "optional", kind: "short-text", shopifyTarget: native("COLLECTION", "handle") },
    { key: "subtitle", label: "Subtitle", mode: "localized", required: "optional", kind: "short-text", shopifyTarget: metaobject("collection_section_copy", "subtitle") },
    { key: "description", label: "Description", mode: "localized", required: "when-published", kind: "long-text", shopifyTarget: native("COLLECTION", "body_html") },
    { key: "manifesto", label: "Manifesto", mode: "localized", required: "optional", kind: "long-text", shopifyTarget: metaobject("collection_section_copy", "manifesto") },
    { key: "symbolismLabel", label: "Symbolism — eyebrow", mode: "localized", required: "optional", kind: "short-text", shopifyTarget: metaobject("collection_section_copy", "symbolism_label") },
    { key: "symbolismTitle", label: "Symbolism — title", mode: "localized", required: "optional", kind: "short-text", shopifyTarget: metaobject("collection_section_copy", "symbolism_title") },
    { key: "symbolismBody", label: "Symbolism — body", mode: "localized", required: "optional", kind: "long-text", shopifyTarget: metaobject("collection_section_copy", "symbolism_body") },
    { key: "symbolismBody2", label: "Symbolism — body (cont.)", mode: "localized", required: "optional", kind: "long-text", shopifyTarget: metaobject("collection_section_copy", "symbolism_body_2") },
    { key: "searchSummary", label: "Search summary", mode: "localized", required: "optional", kind: "short-text", shopifyTarget: metaobject("collection_section_copy", "search_summary") },
    { key: "seoTitle", label: "SEO title", mode: "localized", required: "when-published", kind: "seo", shopifyTarget: native("COLLECTION", "meta_title") },
    { key: "seoDescription", label: "SEO description", mode: "localized", required: "when-published", kind: "seo", shopifyTarget: native("COLLECTION", "meta_description") },
    { key: "heroImageAlt", label: "Hero image alt text", mode: "localized", required: "optional", kind: "alt", shopifyTarget: native("COLLECTION_IMAGE", "alt") },
    { key: "sectionTitle", label: "Section title", mode: "localized", required: "optional", kind: "short-text", shopifyTarget: metaobject("collection_section_copy", "title") },
    { key: "sectionEyebrow", label: "Section eyebrow", mode: "localized", required: "optional", kind: "short-text", shopifyTarget: metaobject("collection_section_copy", "eyebrow") },
    { key: "sectionBody", label: "Section body", mode: "localized", required: "optional", kind: "long-text", shopifyTarget: metaobject("collection_section_copy", "body") },

    { key: "code", label: "Code", mode: "shared", required: "always", kind: "short-text", shopifyTarget: null },
    { key: "slug", label: "Slug/handle", mode: "shared", required: "always", kind: "short-text", shopifyTarget: null },
    { key: "status", label: "Status", mode: "shared", required: "always", kind: "short-text", shopifyTarget: null },
    { key: "visibility", label: "Visibility", mode: "shared", required: "always", kind: "short-text", shopifyTarget: null },
    { key: "membership", label: "Product membership and order", mode: "shared", required: "optional", kind: "short-text", shopifyTarget: null },
    { key: "images", label: "Hero/cover image assets", mode: "shared", required: "optional", kind: "short-text", shopifyTarget: null },
    { key: "navOrdering", label: "Navigation ordering", mode: "shared", required: "optional", kind: "short-text", shopifyTarget: null },
  ],
};

// Field keys mirror PageContent (lib/content/catalog.ts). One registry
// covers every template (HOME, MANIFESTO, COLLECTION_INDEX, STATIC_PAGE);
// a given page only uses the subset of keys its template renders.
export const PAGE_FIELD_REGISTRY: EntityFieldRegistry = {
  entity: "page",
  fields: [
    { key: "title", label: "Title", mode: "localized", required: "always", kind: "short-text", shopifyTarget: native("PAGE", "title") },
    { key: "localizedHandle", label: "URL handle", mode: "localized", required: "optional", kind: "short-text", shopifyTarget: native("PAGE", "handle") },
    { key: "excerpt", label: "Excerpt", mode: "localized", required: "optional", kind: "short-text", shopifyTarget: metaobject("page_section_copy", "excerpt") },
    { key: "eyebrow", label: "Eyebrow", mode: "localized", required: "optional", kind: "short-text", shopifyTarget: metaobject("page_section_copy", "eyebrow") },
    { key: "body", label: "Body", mode: "localized", required: "when-published", kind: "long-text", shopifyTarget: native("PAGE", "body_html") },
    { key: "ctaLabel", label: "CTA label", mode: "localized", required: "optional", kind: "short-text", shopifyTarget: metaobject("page_section_copy", "cta_label") },
    { key: "quote", label: "Quote", mode: "localized", required: "optional", kind: "long-text", shopifyTarget: metaobject("page_section_copy", "quote") },
    { key: "secondaryTitle", label: "Secondary title", mode: "localized", required: "optional", kind: "short-text", shopifyTarget: metaobject("page_section_copy", "secondary_title") },
    { key: "secondaryBody", label: "Secondary body", mode: "localized", required: "optional", kind: "long-text", shopifyTarget: metaobject("page_section_copy", "secondary_body") },
    { key: "departmentSectionTitle", label: "Department section — title", mode: "localized", required: "optional", kind: "short-text", shopifyTarget: metaobject("page_section_copy", "department_title") },
    { key: "departmentSectionBody", label: "Department section — body", mode: "localized", required: "optional", kind: "long-text", shopifyTarget: metaobject("page_section_copy", "department_body") },
    { key: "departmentSectionImageCaption", label: "Department section — image caption", mode: "localized", required: "optional", kind: "short-text", shopifyTarget: metaobject("page_section_copy", "department_image_caption") },
    { key: "departmentSectionCtaLabel", label: "Department section — CTA label", mode: "localized", required: "optional", kind: "short-text", shopifyTarget: metaobject("page_section_copy", "department_cta_label") },
    { key: "archiveSectionLabel", label: "Archive section label", mode: "localized", required: "optional", kind: "short-text", shopifyTarget: metaobject("page_section_copy", "archive_label") },
    { key: "materialSectionEyebrow", label: "Material section — eyebrow", mode: "localized", required: "optional", kind: "short-text", shopifyTarget: metaobject("page_section_copy", "material_eyebrow") },
    { key: "materialSectionTitle", label: "Material section — title", mode: "localized", required: "optional", kind: "short-text", shopifyTarget: metaobject("page_section_copy", "material_title") },
    { key: "materialSectionNoteLabel", label: "Material section — note label", mode: "localized", required: "optional", kind: "short-text", shopifyTarget: metaobject("page_section_copy", "material_note_label") },
    { key: "materialLexicon", label: "Material lexicon entries (name/category/description/properties)", mode: "localized", required: "optional", kind: "rich-text", shopifyTarget: metaobject("page_section_copy", "material_lexicon") },
    { key: "manifestoSectionLabel", label: "Manifesto label", mode: "localized", required: "optional", kind: "short-text", shopifyTarget: metaobject("page_section_copy", "manifesto_label") },
    { key: "manifestoSectionAttribution", label: "Manifesto attribution", mode: "localized", required: "optional", kind: "short-text", shopifyTarget: metaobject("page_section_copy", "manifesto_attribution") },
    { key: "finalCtaLabel", label: "Final CTA label", mode: "localized", required: "optional", kind: "short-text", shopifyTarget: metaobject("page_section_copy", "final_cta_label") },
    { key: "finalFooterTitle", label: "Final footer title", mode: "localized", required: "optional", kind: "short-text", shopifyTarget: metaobject("page_section_copy", "final_footer_title") },
    { key: "finalContactLabel", label: "Final contact label", mode: "localized", required: "optional", kind: "short-text", shopifyTarget: metaobject("page_section_copy", "final_contact_label") },
    { key: "legalIntro", label: "Legal intro", mode: "localized", required: "optional", kind: "long-text", shopifyTarget: metaobject("page_section_copy", "legal_intro") },
    { key: "legalLastUpdated", label: "Legal — last updated (displayed date)", mode: "localized", required: "optional", kind: "short-text", shopifyTarget: metaobject("page_section_copy", "legal_last_updated") },
    { key: "legalSections", label: "Legal sections (title/body per section id)", mode: "localized", required: "optional", kind: "rich-text", shopifyTarget: metaobject("page_section_copy", "legal_sections") },
    { key: "seoTitle", label: "SEO title", mode: "localized", required: "when-published", kind: "seo", shopifyTarget: native("PAGE", "meta_title") },
    { key: "seoDescription", label: "SEO description", mode: "localized", required: "when-published", kind: "seo", shopifyTarget: native("PAGE", "meta_description") },

    { key: "slug", label: "Slug", mode: "shared", required: "always", kind: "short-text", shopifyTarget: null },
    { key: "template", label: "Template", mode: "shared", required: "always", kind: "short-text", shopifyTarget: null },
    { key: "status", label: "Status", mode: "shared", required: "always", kind: "short-text", shopifyTarget: null },
    { key: "visibility", label: "Visibility", mode: "shared", required: "always", kind: "short-text", shopifyTarget: null },
    { key: "heroImage", label: "Hero image asset", mode: "shared", required: "optional", kind: "short-text", shopifyTarget: null },
    { key: "ctaHref", label: "CTA href", mode: "shared", required: "optional", kind: "short-text", shopifyTarget: null },
    { key: "finalCtaHref", label: "Final CTA href", mode: "shared", required: "optional", kind: "short-text", shopifyTarget: null },
    { key: "finalContactEmail", label: "Final contact email", mode: "shared", required: "optional", kind: "short-text", shopifyTarget: null },
    { key: "sectionEnabledFlags", label: "Section enabled/disabled flags", mode: "shared", required: "optional", kind: "short-text", shopifyTarget: null },
  ],
};

// Derived from STOREFRONT_COPY_KEYS (lib/content/storefront-copy-fields.ts)
// at module load so the two lists can never drift.
function storefrontCopyFields(): LocalizedFieldDefinition[] {
  return STOREFRONT_COPY_GROUPS.flatMap((group) =>
    group.fields.map((field): LocalizedFieldDefinition => ({
      key: field.key,
      label: field.label,
      mode: "localized",
      required: "optional",
      kind: field.area ? "long-text" : "short-text",
      shopifyTarget: metaobject("storefront_copy", field.key),
    })),
  );
}

export const STOREFRONT_COPY_FIELD_REGISTRY: EntityFieldRegistry = {
  entity: "storefront-copy",
  get fields() {
    return storefrontCopyFields();
  },
};

// Merchant-owned taxonomy labels only — Shopify's own Standard Product
// Taxonomy (shopifyCategoryName) is out of scope; it is Shopify's source of
// truth and is not edited here.
export const TAXONOMY_FIELD_REGISTRY: EntityFieldRegistry = {
  entity: "taxonomy",
  fields: [
    { key: "categoryName", label: "Category name", mode: "localized", required: "always", kind: "short-text", shopifyTarget: metaobject("taxonomy_label", "category_name") },
    { key: "categoryDescription", label: "Category description", mode: "localized", required: "optional", kind: "long-text", shopifyTarget: metaobject("taxonomy_label", "category_description") },
    { key: "tagName", label: "Tag name", mode: "localized", required: "always", kind: "short-text", shopifyTarget: metaobject("taxonomy_label", "tag_name") },
    { key: "characteristicLabel", label: "Characteristic label", mode: "localized", required: "always", kind: "short-text", shopifyTarget: metaobject("taxonomy_label", "characteristic_label") },

    { key: "categorySlug", label: "Category canonical id/slug", mode: "shared", required: "always", kind: "short-text", shopifyTarget: null },
    { key: "shopifyTaxonomyId", label: "Shopify taxonomy id", mode: "shared", required: "optional", kind: "short-text", shopifyTarget: null },
    { key: "characteristicKey", label: "Characteristic filter key", mode: "shared", required: "always", kind: "short-text", shopifyTarget: null },
  ],
};

export const ADMIN_FIELD_REGISTRIES: EntityFieldRegistry[] = [
  PRODUCT_FIELD_REGISTRY,
  COLLECTION_FIELD_REGISTRY,
  PAGE_FIELD_REGISTRY,
  STOREFRONT_COPY_FIELD_REGISTRY,
  TAXONOMY_FIELD_REGISTRY,
];

export function localizedFields(registry: EntityFieldRegistry): LocalizedFieldDefinition[] {
  return registry.fields.filter((field) => field.mode === "localized");
}

export function requiredLocalizedFields(
  registry: EntityFieldRegistry,
  { published }: { published: boolean },
): LocalizedFieldDefinition[] {
  return localizedFields(registry).filter((field) =>
    field.required === "always" || (published && field.required === "when-published"),
  );
}
