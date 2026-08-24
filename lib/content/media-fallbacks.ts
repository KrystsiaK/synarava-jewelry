const STOREFRONT_MEDIA_FALLBACKS = [
  "/materials/traditional-craft.svg",
  "/materials/oak-wood.svg",
  "/materials/basalt-lava.svg",
  "/materials/white-ceramic.svg",
] as const;

export function isLegacyDemoImage(value: string) {
  return value.startsWith("https://lh3.googleusercontent.com/aida") || value.startsWith("/uploads/");
}

export function storefrontMedia(value: string | null | undefined, seed: string) {
  const media = value?.trim() ?? "";
  if (media && !isLegacyDemoImage(media)) return media;

  const index = Array.from(seed).reduce((total, character) => total + character.charCodeAt(0), 0)
    % STOREFRONT_MEDIA_FALLBACKS.length;
  return STOREFRONT_MEDIA_FALLBACKS[index];
}
