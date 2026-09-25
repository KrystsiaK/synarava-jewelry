"use server";

import { revalidatePath } from "next/cache";

import { requireAdminSession } from "@/lib/auth/admin-session";
import { setFooterContactEmails } from "@/lib/content/footer-contact";
import { setFooterLinks } from "@/lib/content/footer-links";
import {
  LEGACY_FOOTER_LEGAL_COPY_KEYS,
  LEGACY_FOOTER_SERVICE_COPY_KEYS,
  MAX_FOOTER_LINK_ITEMS,
  cleanFooterLinkColumn,
  type FooterLinkColumn,
  type FooterLinksData,
} from "@/lib/content/footer-links-fields";
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

function readJsonField(formData: FormData, name: string): unknown | { error: string } {
  const raw = String(formData.get(name) ?? "");
  if (!raw.trim()) return { error: `${name} payload is missing.` };
  try {
    return JSON.parse(raw);
  } catch {
    return { error: `${name} payload is invalid.` };
  }
}

function readHeaderNavPayload(formData: FormData): HeaderNavData | { error: string } {
  const parsed = readJsonField(formData, "headerNav");
  if (parsed && typeof parsed === "object" && "error" in parsed) {
    return parsed as { error: string };
  }
  const data = parseHeaderNavData(parsed);
  if (!data) {
    return {
      error: `Header navigation needs ${MIN_HEADER_NAV_ITEMS}–${MAX_HEADER_NAV_ITEMS} links, each with a path.`,
    };
  }

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

function readFooterColumn(
  formData: FormData,
  fieldName: string,
  label: string,
): FooterLinkColumn | { error: string } {
  const parsed = readJsonField(formData, fieldName);
  if (parsed && typeof parsed === "object" && "error" in parsed) {
    return parsed as { error: string };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { error: `${label} links payload is invalid.` };
  }

  const record = parsed as { items?: unknown; labels?: unknown };
  if (!Array.isArray(record.items)) {
    return { error: `${label} links payload is invalid.` };
  }
  if (record.items.length > MAX_FOOTER_LINK_ITEMS) {
    return { error: `${label} links: at most ${MAX_FOOTER_LINK_ITEMS} allowed.` };
  }

  for (let i = 0; i < record.items.length; i += 1) {
    const entry = record.items[i];
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      return { error: `${label} link ${i + 1} is invalid.` };
    }
    const href = (entry as { href?: unknown }).href;
    if (typeof href !== "string" || !href.trim()) {
      return { error: `${label} link ${i + 1} needs a path or URL.` };
    }
  }

  return cleanFooterLinkColumn({
    items: record.items as FooterLinkColumn["items"],
    labels:
      record.labels && typeof record.labels === "object" && !Array.isArray(record.labels)
        ? (record.labels as FooterLinkColumn["labels"])
        : {},
  });
}

function readFooterLinksPayload(formData: FormData): FooterLinksData | { error: string } {
  const service = readFooterColumn(formData, "footerServiceLinks", "Service");
  if ("error" in service) return service;
  const legal = readFooterColumn(formData, "footerLegalLinks", "Legal");
  if ("error" in legal) return legal;
  const socials = readFooterColumn(formData, "footerSocialLinks", "Social");
  if ("error" in socials) return socials;
  return { service, legal, socials };
}

function readContactEmails(formData: FormData): string[] | { error: string } {
  const parsed = readJsonField(formData, "footerContactEmails");
  if (parsed && typeof parsed === "object" && "error" in parsed) {
    return parsed as { error: string };
  }
  if (!Array.isArray(parsed)) {
    return { error: "Contact emails payload is invalid." };
  }
  return parsed.map((entry) => String(entry ?? ""));
}

export async function saveStorefrontCopyAction(formData: FormData): Promise<StorefrontCopyActionState> {
  await requireAdminSession("/admin/settings");

  const headerNav = readHeaderNavPayload(formData);
  if ("error" in headerNav) return { error: headerNav.error };

  const footerLinks = readFooterLinksPayload(formData);
  if ("error" in footerLinks) return { error: footerLinks.error };

  const contactEmails = readContactEmails(formData);
  if ("error" in contactEmails) return { error: contactEmails.error };

  const locales = await getStorefrontLocales();
  const updates: StorefrontCopy = {};
  for (const locale of locales) {
    const fields: Record<string, string> = {};
    for (const key of STOREFRONT_COPY_KEYS) {
      fields[key] = String(formData.get(`${locale.code}:${key}`) ?? "");
    }
    for (const key of LEGACY_HEADER_NAV_COPY_KEYS) {
      fields[key] = "";
    }
    for (const key of LEGACY_FOOTER_NAV_COPY_KEYS) {
      fields[key] = "";
    }
    for (const key of LEGACY_FOOTER_SERVICE_COPY_KEYS) {
      fields[key] = "";
    }
    for (const key of LEGACY_FOOTER_LEGAL_COPY_KEYS) {
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
    await setFooterLinks(footerLinks);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not save footer links." };
  }

  try {
    await setFooterContactEmails(contactEmails);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not save footer contact emails." };
  }

  await setStorefrontCopy(updates);

  revalidatePath("/", "layout");

  return { success: "Shared saved." };
}
