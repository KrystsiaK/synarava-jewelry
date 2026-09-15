export type HomeLexiconMaterialFields = {
  name?: string;
  category?: string;
  description?: string;
  image?: string;
  properties?: string;
};

export type HomeLexiconSectionFields = {
  materialLexicon?: HomeLexiconMaterialFields[];
};

export type ResolvedLexiconMaterial = {
  name: string;
  category: string;
  description: string;
  image: string;
  properties: string[];
};

function optionalTrimmed(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

/**
 * Admin-entered Lexicon materials, in order. An entry missing its name,
 * description, or image is dropped rather than shown half-empty — the
 * caller falls back to collection-derived materials when this is empty.
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
    .slice(0, 3);
}
