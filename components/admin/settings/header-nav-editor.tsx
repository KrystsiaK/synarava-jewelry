"use client";

import { useState } from "react";

import {
  AdminHelp,
  AdminHrefField,
  AdminOrderedList,
  AdminTextField,
} from "@/components/synarava-cms";
import {
  createHeaderNavItemId,
  MAX_HEADER_NAV_ITEMS,
  MIN_HEADER_NAV_ITEMS,
  type HeaderNavData,
  type HeaderNavItem,
} from "@/lib/content/header-nav-fields";

type HeaderNavEditorProps = {
  initial: HeaderNavData;
  activeLocale: string;
  /** Shipped message fallbacks for placeholders (flattened `nav.*` keys). */
  labelPlaceholders: Record<string, string>;
  locales: Array<{ code: string }>;
};

/**
 * Dynamic header main links — label (per locale) + path (shared) with add/remove/reorder.
 * Submits as JSON via a hidden `headerNav` field so the parent form can save in one action.
 */
export function HeaderNavEditor({
  initial,
  activeLocale,
  labelPlaceholders,
  locales,
}: HeaderNavEditorProps) {
  const [items, setItems] = useState<HeaderNavItem[]>(() => initial.items.map((item) => ({ ...item })));
  const [labels, setLabels] = useState<Record<string, Record<string, string>>>(() => {
    const next: Record<string, Record<string, string>> = {};
    for (const locale of locales) {
      next[locale.code] = { ...(initial.labels[locale.code] ?? {}) };
    }
    // Keep any locales present in the saved payload even if not currently registered.
    for (const [locale, localeLabels] of Object.entries(initial.labels)) {
      next[locale] ??= { ...localeLabels };
    }
    return next;
  });

  const payload: HeaderNavData = { items, labels };

  function updateHref(index: number, href: string) {
    setItems((current) => current.map((item, slot) => (slot === index ? { ...item, href } : item)));
  }

  function updateLabel(itemId: string, value: string) {
    setLabels((current) => ({
      ...current,
      [activeLocale]: {
        ...(current[activeLocale] ?? {}),
        [itemId]: value,
      },
    }));
  }

  function createItem(): HeaderNavItem {
    return { id: createHeaderNavItemId(), href: "" };
  }

  return (
    <section id="copy-header-main" className="adm-panel grid gap-4 p-5 md:p-6 scroll-mt-24">
      <div>
        <p className="adm-section-tag">Header — main links</p>
        <p className="mt-1 text-xs" style={{ color: "var(--adm-muted)" }}>
          Primary navigation. Name is per locale; path is shared and uses the storefront path autocomplete.
        </p>
      </div>

      <input type="hidden" name="headerNav" value={JSON.stringify(payload)} readOnly />

      <AdminOrderedList
        label="Main links"
        help={
          <AdminHelp>
            Add or remove links, reorder with the arrows. Empty name falls back to the shipped default
            (shown as placeholder) for the built-in Home / Shop / Collections / About rows, or to the
            path for custom rows. Path is required.
          </AdminHelp>
        }
        items={items}
        onChange={setItems}
        getKey={(item) => item.id}
        minItems={MIN_HEADER_NAV_ITEMS}
        maxItems={MAX_HEADER_NAV_ITEMS}
        createItem={createItem}
        addLabel="Add link"
        renderItem={(item, { index }) => {
          const localeTag = activeLocale.toUpperCase();
          const placeholderKey =
            item.id === "home"
              ? "nav.home"
              : item.id === "shop"
                ? "nav.shop"
                : item.id === "collections"
                  ? "nav.collections"
                  : item.id === "about"
                    ? "nav.about"
                    : "";
          const placeholder = placeholderKey
            ? (labelPlaceholders[placeholderKey] ?? labelPlaceholders[`nav.${item.id}`] ?? "")
            : item.href || "/…";

          return (
            <div className="grid gap-4 md:grid-cols-2">
              <AdminTextField
                label={`Name (${localeTag})`}
                value={labels[activeLocale]?.[item.id] ?? ""}
                onChange={(event) => updateLabel(item.id, event.target.value)}
                placeholder={placeholder}
                clearable
              />
              <AdminHrefField
                label="Path"
                help={
                  <AdminHelp>
                    Shared across languages. Search by name, or type /products/ or /collections/ to pick a
                    specific item.
                  </AdminHelp>
                }
                name={`headerNavHref-${item.id}`}
                value={item.href}
                onValueChange={(href) => updateHref(index, href)}
                placeholder="/shop"
              />
            </div>
          );
        }}
      />
    </section>
  );
}
