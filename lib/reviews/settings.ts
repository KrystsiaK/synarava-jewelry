import "server-only";

import { cache } from "react";

import { db } from "@/lib/db";
import {
  PRODUCT_REVIEWS_SETTINGS_DEFAULTS,
  PRODUCT_REVIEWS_SETTINGS_KEY,
  type ProductReviewsSettings,
} from "@/lib/reviews/settings-fields";

export {
  PRODUCT_REVIEWS_SETTINGS_DEFAULTS,
  PRODUCT_REVIEWS_SETTINGS_KEY,
  type ProductReviewsSettings,
};

const FIELD_KEYS = Object.keys(
  PRODUCT_REVIEWS_SETTINGS_DEFAULTS,
) as (keyof ProductReviewsSettings)[];

function parseStored(value: unknown): Partial<ProductReviewsSettings> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const record = value as Record<string, unknown>;
  const next: Partial<ProductReviewsSettings> = {};
  for (const key of FIELD_KEYS) {
    if (typeof record[key] === "boolean") next[key] = record[key];
  }
  return next;
}

function mergeWithDefaults(
  overrides: Partial<ProductReviewsSettings>,
): ProductReviewsSettings {
  return {
    moderationBeforePublish:
      overrides.moderationBeforePublish ??
      PRODUCT_REVIEWS_SETTINGS_DEFAULTS.moderationBeforePublish,
  };
}

export const getProductReviewsSettings = cache(
  async (): Promise<ProductReviewsSettings> => {
    const setting = await db.siteSetting.findUnique({
      where: { key: PRODUCT_REVIEWS_SETTINGS_KEY },
    });
    return mergeWithDefaults(parseStored(setting?.value));
  },
);

export async function setProductReviewsSettings(
  updates: Partial<ProductReviewsSettings>,
): Promise<ProductReviewsSettings> {
  const setting = await db.siteSetting.findUnique({
    where: { key: PRODUCT_REVIEWS_SETTINGS_KEY },
  });
  const next: Partial<ProductReviewsSettings> = { ...parseStored(setting?.value) };

  for (const key of FIELD_KEYS) {
    if (key in updates && typeof updates[key] === "boolean") {
      next[key] = updates[key];
    }
  }

  await db.siteSetting.upsert({
    where: { key: PRODUCT_REVIEWS_SETTINGS_KEY },
    update: { value: next },
    create: { key: PRODUCT_REVIEWS_SETTINGS_KEY, value: next },
  });

  return mergeWithDefaults(next);
}
