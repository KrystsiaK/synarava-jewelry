"use server";

import { revalidatePath } from "next/cache";

import { requireAdminSession } from "@/lib/auth/admin-session";
import { setFooterContactEmail } from "@/lib/content/footer-contact";
import { setHeaderNav } from "@/lib/content/header-nav";
import {
  LEGACY_FOOTER_NAV_COPY_KEYS,
  LEGACY_HEADER_NAV_COPY_KEYS,
  MAX_HEADER_NAV_ITEMS,
  MIN_HEADER_NAV_ITEMS,
  parseHeaderNavData,
  type HeaderNavData,
} from "@/lib/content/header-nav-fields";
import { setStorefrontCopy, type StorefrontCopy } from "@/lib/content/storefront-copy";
import { STOREFRONT_COPY_KEYS } from "@/lib/content/storefront-copy-fields";
import { getStorefrontLocales } from "@/lib/i18n/storefront-locale-cache";

export type StorefrontCopyActionState = {
  error?: string;
  success?: string;
};

function readHeaderNavPayload(formData: FormData): HeaderNavData | { error: string } {
  const raw = String(formData.get("headerNav") ?? "");
  if (!raw.trim()) {
    return { error: "Header navigation payload is missing." };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { error: "Header navigation payload is invalid." };
  }
  const data = parseHeaderNavData(parsed);
  if (!data) {
    return {
      error: `Header navigation needs ${MIN_HEADER_NAV_ITEMS}–${MAX_HEADER_NAV_ITEMS} links, each with a path.`,
    };
  }

  // Surface empty paths before drop-on-save so the operator can fix the row.
  const record = parsed as { items?: Array<{ href?: unknown }> };
  if (Array.isArray(record.items)) {
    for (let i = 0; i < record.items.length; i += 1) {
      const href = record.items[i]?.href;
      if (typeof href !== "string" || !href.trim()) {
        return { error: `Header link ${i + 1} needs a path.` };
      }
    }
  }

  return data;
}

export async function saveStorefrontCopyAction(formData: FormData): Promise<StorefrontCopyActionState> {
  await requireAdminSession("/admin/settings");

  const headerNav = readHeaderNavPayload(formData);
  if ("error" in headerNav) return { error: headerNav.error };

  const locales = await getStorefrontLocales();
  const updates: StorefrontCopy = {};
  for (const locale of locales) {
    const fields: Record<string, string> = {};
    for (const key of STOREFRONT_COPY_KEYS) {
      fields[key] = String(formData.get(`${locale.code}:${key}`) ?? "");
    }
    // Clear legacy keys so header-nav-v1 is the only source for those labels.
    for (const key of LEGACY_HEADER_NAV_COPY_KEYS) {
      fields[key] = "";
    }
    for (const key of LEGACY_FOOTER_NAV_COPY_KEYS) {
      fields[key] = "";
    }
    updates[locale.code] = fields;
  }

  try {
    await setHeaderNav(headerNav);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not save header navigation." };
  }

  try {
    await setFooterContactEmail(String(formData.get("footerContactEmail") ?? ""));
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not save footer contact email." };
  }

  await setStorefrontCopy(updates);

  // Footer and the main menu render in the root layout on every route.
  revalidatePath("/", "layout");

  return { success: "Shared saved." };
}
