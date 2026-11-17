"use server";

import { revalidatePath } from "next/cache";

import { requireAdminSession } from "@/lib/auth/admin-session";
import { setProductReviewStatus } from "@/lib/reviews/mutations";
import { productReviewStatusSchema } from "@/lib/reviews/schema";
import {
  setProductReviewsSettings,
  type ProductReviewsSettings,
} from "@/lib/reviews/settings";
import { PRODUCT_REVIEWS_SETTINGS_FIELD_DEFS } from "@/lib/reviews/settings-fields";
import { revalidateStorefrontPath } from "@/lib/content/revalidate-storefront";
import { db } from "@/lib/db";

export type AdminReviewsActionState = {
  error?: string;
  success?: string;
  updated?: number;
};

function parseIds(formData: FormData): string[] {
  const raw = formData.getAll("ids");
  return raw
    .flatMap((value) => (typeof value === "string" ? value.split(",") : []))
    .map((value) => value.trim())
    .filter(Boolean);
}

async function revalidateReviewedProducts(ids: string[]) {
  if (ids.length === 0) return;
  const rows = await db.productReview.findMany({
    where: { id: { in: ids } },
    select: { product: { select: { slug: true } } },
  });
  for (const row of rows) {
    revalidateStorefrontPath(`/products/${row.product.slug}`);
  }
}

export async function moderateProductReviewsAction(
  formData: FormData,
): Promise<AdminReviewsActionState> {
  const session = await requireAdminSession("/admin/reviews");
  const statusParsed = productReviewStatusSchema.safeParse(formData.get("status"));
  if (!statusParsed.success) {
    return { error: "Choose a valid review status." };
  }
  const ids = parseIds(formData);
  if (ids.length === 0) {
    return { error: "Select at least one review." };
  }

  const updated = await setProductReviewStatus({
    ids,
    status: statusParsed.data,
    moderatedBy: session.username,
  });
  await revalidateReviewedProducts(ids);
  revalidatePath("/admin/reviews");
  revalidatePath("/admin");

  return {
    success: `Updated ${updated} review${updated === 1 ? "" : "s"} to ${statusParsed.data}.`,
    updated,
  };
}

export async function saveProductReviewsSettingsAction(
  formData: FormData,
): Promise<AdminReviewsActionState> {
  await requireAdminSession("/admin/reviews");

  const updates: Partial<ProductReviewsSettings> = {};
  for (const field of PRODUCT_REVIEWS_SETTINGS_FIELD_DEFS) {
    updates[field.key] = formData.get(field.key) === "true";
  }

  await setProductReviewsSettings(updates);
  revalidatePath("/admin/reviews");
  return { success: "Review settings saved." };
}
