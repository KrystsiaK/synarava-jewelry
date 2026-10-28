import type { ProductEditorSection } from "@/components/admin/products/product-editor-tabs";
import { isSharedSection } from "@/components/admin/products/product-editor-scope";
import {
  lookupContractForPath,
  type SyncConflictSection,
} from "@/lib/sync/field-registry";

/**
 * Map a conflict-modal field row → the editor section that owns it.
 * Commerce / presence read leaf contract metadata (`section` / `parts`) only —
 * no path/label regex routing.
 */
export function productEditorSectionForConflictField(field: {
  origin: "COMMERCE" | "TRANSLATION" | "PRESENCE";
  label: string;
  fieldKey: string;
  path?: string | null;
  section?: SyncConflictSection | null;
  parts?: ReadonlyArray<{ section: SyncConflictSection }> | null;
}): ProductEditorSection {
  if (field.origin === "PRESENCE") return "shopify";
  if (field.origin === "COMMERCE") {
    if (field.section) return field.section;
    if (field.parts && field.parts.length > 0) return field.parts[0]!.section;
    if (field.path) {
      const contract = lookupContractForPath(field.path, "PRODUCT");
      if (contract) return contract.section;
    }
    return "shopify";
  }
  // Translation leaves: small key→section map (not commerce path regex).
  const key = field.fieldKey.split(":")[2] ?? "";
  if (key === "title" || key === "localizedHandle" || key === "name" || key === "handle") {
    return "essentials";
  }
  if (
    key === "description"
    || key === "body"
    || key === "seoTitle"
    || key === "seoDescription"
  ) {
    return "essentials";
  }
  if (
    key === "shortDescription"
    || key === "materialLine"
    || key === "symbolismLabel"
    || key === "symbolismTitle"
    || key === "symbolismBody"
    || key === "symbolismBody2"
  ) {
    return "details";
  }
  return "details";
}

/**
 * Resolve section from contract metadata (path lookup), never path/label regex.
 * Prefer passing `section` from the SyncLeaf when available.
 */
export function productEditorSectionForCommerceDiff(diff: {
  path?: string;
  field: string;
  section?: SyncConflictSection | null;
}): ProductEditorSection {
  if (diff.section) return diff.section;
  if (diff.path === "_presence" || diff.field === "Presence") return "shopify";
  if (diff.path === "_adopt" || diff.field === "Adopt Shopify") return "shopify";
  if (diff.path) {
    const contract = lookupContractForPath(diff.path, "PRODUCT");
    if (contract) return contract.section;
  }
  return "shopify";
}

/** Sections whose tabs should show conflict tone for the given differences. */
export function conflictSectionsFromDifferences(
  differences: ReadonlyArray<{
    path?: string;
    field: string;
    section?: SyncConflictSection | null;
    parts?: ReadonlyArray<{ section: SyncConflictSection }> | null;
  }>,
): Set<ProductEditorSection> {
  const sections = new Set<ProductEditorSection>();
  for (const diff of differences) {
    if (diff.parts && diff.parts.length > 0) {
      for (const part of diff.parts) sections.add(part.section);
      continue;
    }
    sections.add(productEditorSectionForCommerceDiff(diff));
  }
  return sections;
}

/**
 * Language shells to mark for a conflict set (tree display).
 * Shared commerce / presence → base (EN) only. Locale-only → those codes only.
 * Shared never lights PT/RU tabs.
 * @see docs/wiki/commerce-sync.md
 */
export function conflictLocalesFromCommerce(input: {
  localeCodes: readonly string[];
  conflictSections: ReadonlySet<ProductEditorSection>;
  sharedSignal?: boolean;
  presenceSignal?: boolean;
  localeSignals?: ReadonlyArray<{ code: string; count: number }>;
  /** Default/base locale code (EN tab). */
  baseLocale?: string;
}): Set<string> {
  const out = new Set<string>();
  const base = (input.baseLocale ?? "en").trim().toLowerCase() || "en";
  const sharedHit = [...input.conflictSections].some((section) => isSharedSection(section))
    || Boolean(input.sharedSignal)
    || Boolean(input.presenceSignal);
  if (sharedHit) {
    const baseCode = input.localeCodes.find((code) => code.trim().toLowerCase() === base) ?? base;
    out.add(baseCode);
  }
  for (const locale of input.localeSignals ?? []) {
    if (locale.count > 0) out.add(locale.code);
  }
  return out;
}
