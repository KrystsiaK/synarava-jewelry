"use server";

import { requireAdminSession } from "@/lib/auth/admin-session";
import {
  searchStorefrontHrefs,
  type StorefrontHrefSearchResult,
} from "@/lib/admin/storefront-href-search";

export type StorefrontHrefSearchActionResult = StorefrontHrefSearchResult & {
  error?: string;
};

export async function searchStorefrontHrefsAction(
  query: string,
): Promise<StorefrontHrefSearchActionResult> {
  await requireAdminSession("/admin");

  if (typeof query !== "string") {
    return { segments: [], error: "Enter a path or name to search." };
  }

  try {
    return await searchStorefrontHrefs(query);
  } catch (error) {
    return {
      segments: [],
      error: error instanceof Error ? error.message : "Storefront href search failed.",
    };
  }
}
