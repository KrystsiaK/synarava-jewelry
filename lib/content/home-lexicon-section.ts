export type HomeLexiconMaterialFields = {
  name?: string;
  category?: string;
  description?: string;
  image?: string;
  properties?: string;
};

export type HomeLexiconSectionFields = {
  materialSectionNoteLabel?: string;
  materialLexicon?: HomeLexiconMaterialFields[];
};

export type ResolvedLexiconMaterial = {
  name: string;
  category: string;
  description: string;
  image: string;
  properties: string[];
};

/** Scroll carousel needs at least two specimens; admin keeps this many slots open. */
export const MIN_HOME_LEXICON_MATERIALS = 2;
/** MaterialLab motion keyframes are authored for up to three plates. */
export const MAX_HOME_LEXICON_MATERIALS = 3;

function optionalTrimmed(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

export function resolveLexiconNoteLabel(value: string | undefined) {
  return optionalTrimmed(value) ?? "Material notes";
}

/**
 * Admin-entered Lexicon materials, in order. An entry missing its name,
 * description, or image is dropped rather than shown half-empty.
 *
 * Storefront must never substitute Featured Collections (or any other
 * catalog surface) for missing specimens — empty means hide the incomplete
 * row / section, not invent a different content type.
 */
export function resolveLexiconMaterials(
  content: HomeLexiconSectionFields | undefined,
): ResolvedLexiconMaterial[] {
  return (content?.materialLexicon ?? [])
    .flatMap((item) => {
      const name = optionalTrimmed(item.name);
      const description = optionalTrimmed(item.description);
      const image = optionalTrimmed(item.image);
      if (!name || !description || !image) return [];

      return [{
        name,
        category: item.category?.trim() ?? "",
        description,
        image,
        properties: (item.properties ?? "")
          .split(",")
          .map((property) => property.trim())
          .filter(Boolean)
          .slice(0, 3),
      }];
    })
    .slice(0, MAX_HOME_LEXICON_MATERIALS);
}

const STOREFRONT_REQUIRED_MSG = "Won't appear on the site without this.";
const STOREFRONT_ROW_CAPTION = "This specimen won't appear on the site.";

/** True when name, description, and image are all present (storefront gate). */
export function lexiconMaterialAppearsOnStorefront(material: HomeLexiconMaterialFields): boolean {
  return Boolean(
    optionalTrimmed(material.name)
    && optionalTrimmed(material.description)
    && optionalTrimmed(material.image),
  );
}

/**
 * Soft admin warnings for lexicon fields required on the storefront.
 * Empty required fields warn even on a blank row so the collapsed chrome can stay honest.
 */
export function lexiconMaterialStorefrontWarnings(material: HomeLexiconMaterialFields): {
  name?: string;
  description?: string;
  image?: string;
} {
  const name = material.name?.trim() ?? "";
  const description = material.description?.trim() ?? "";
  const image = material.image?.trim() ?? "";
  return {
    name: name ? undefined : STOREFRONT_REQUIRED_MSG,
    description: description ? undefined : STOREFRONT_REQUIRED_MSG,
    image: image ? undefined : STOREFRONT_REQUIRED_MSG,
  };
}

export function lexiconMaterialStorefrontCaption(material: HomeLexiconMaterialFields): string | undefined {
  return lexiconMaterialAppearsOnStorefront(material) ? undefined : STOREFRONT_ROW_CAPTION;
}
