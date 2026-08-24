import {
  isShopDepartmentSlug,
  type ShopDepartmentSlug,
} from "@/lib/catalog/taxonomy";
import { isLegacyDemoImage, storefrontMedia } from "@/lib/content/media-fallbacks";

export type ProductAttribute = {
  label: string;
  value: string;
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

export type ProductDetailsPayload = {
  department?: ShopDepartmentSlug;
  attributes?: ProductAttribute[];
  materialsEyebrow?: string;
  materialsTitle?: string;
  materials?: ProductMaterialStory[];
  process?: Partial<ProductProcessStory> & { stats?: ProductProcessStat[] };
  lookbookEyebrow?: string;
  lookbookTitle?: string;
  lookbook?: ProductLookbookStory[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeMaterialStory(value: unknown, index: number): ProductMaterialStory | null {
  if (!isRecord(value)) return null;
  const title = typeof value.title === "string" ? value.title.trim() : "";
  const body = typeof value.body === "string" ? value.body.trim() : "";
  const image = typeof value.image === "string" ? value.image.trim() : "";
  if (!title || !body) return null;
  return { title, body, image: storefrontMedia(image, `${title}-${index}`) };
}

function normalizeLookbookStory(value: unknown, index: number): ProductLookbookStory | null {
  if (!isRecord(value)) return null;
  const src = typeof value.src === "string" ? value.src.trim() : "";
  const label = typeof value.label === "string" ? value.label.trim() : "";
  const featured = Boolean(value.featured);
  if (!src && !label) return null;
  return { src: storefrontMedia(src, `${label}-${index}`), label, featured };
}

function normalizeProcessStat(value: unknown): ProductProcessStat | null {
  if (!isRecord(value)) return null;
  const valueText = typeof value.value === "string" ? value.value.trim() : "";
  const label = typeof value.label === "string" ? value.label.trim() : "";
  if (!valueText || !label) return null;
  return { value: valueText, label };
}

function normalizeProductAttribute(value: unknown): ProductAttribute | null {
  if (!isRecord(value)) return null;
  const label = typeof value.label === "string" ? value.label.trim() : "";
  const attributeValue = typeof value.value === "string" ? value.value.trim() : "";
  if (!label || !attributeValue) return null;
  return { label, value: attributeValue };
}

export function parseProductDetails(details: unknown): ProductDetailsPayload {
  if (!isRecord(details)) {
    return {};
  }

  const materialsEyebrow =
    typeof details.materialsEyebrow === "string" ? details.materialsEyebrow.trim() : "";
  const materialsTitle =
    typeof details.materialsTitle === "string" ? details.materialsTitle.trim() : "";
  const department = isShopDepartmentSlug(details.department) ? details.department : undefined;
  const attributes = Array.isArray(details.attributes)
    ? details.attributes.map(normalizeProductAttribute).filter(Boolean) as ProductAttribute[]
    : [];
  const materials = Array.isArray(details.materials)
    ? details.materials.map(normalizeMaterialStory).filter(Boolean) as ProductMaterialStory[]
    : [];

  const lookbookEyebrow =
    typeof details.lookbookEyebrow === "string" ? details.lookbookEyebrow.trim() : "";
  const lookbookTitle =
    typeof details.lookbookTitle === "string" ? details.lookbookTitle.trim() : "";
  const lookbook = Array.isArray(details.lookbook)
    ? details.lookbook.map(normalizeLookbookStory).filter(Boolean) as ProductLookbookStory[]
    : [];

  const rawProcess = isRecord(details.process) ? details.process : null;
  const rawProcessMedia =
    rawProcess && typeof rawProcess.mediaImage === "string"
      ? rawProcess.mediaImage.trim()
      : "";
  const process = rawProcess
    ? {
        eyebrow: typeof rawProcess.eyebrow === "string" ? rawProcess.eyebrow.trim() : undefined,
        title: typeof rawProcess.title === "string" ? rawProcess.title.trim() : undefined,
        mediaImage: rawProcessMedia && !isLegacyDemoImage(rawProcessMedia)
          ? rawProcessMedia
          : undefined,
        stats: Array.isArray(rawProcess.stats)
          ? rawProcess.stats.map(normalizeProcessStat).filter(Boolean) as ProductProcessStat[]
          : undefined,
      }
    : undefined;

  return {
    department,
    attributes,
    materialsEyebrow,
    materialsTitle,
    materials,
    process,
    lookbookEyebrow,
    lookbookTitle,
    lookbook,
  };
}
