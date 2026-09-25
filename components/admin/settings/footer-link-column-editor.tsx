"use client";

import { useState } from "react";

import {
  AdminHelp,
  AdminHrefField,
  AdminOrderedList,
  AdminTextField,
} from "@/components/synarava-cms";
import {
  MAX_FOOTER_LINK_ITEMS,
  createFooterLinkItemId,
  type FooterLinkColumn,
  type FooterLinkItem,
} from "@/lib/content/footer-links-fields";

type FooterLinkColumnEditorProps = {
  columnId: "service" | "legal" | "socials";
  title: string;
  description: string;
  listLabel: string;
  initial: FooterLinkColumn;
  activeLocale: string;
  labelPlaceholders: Record<string, string>;
  defaultLabelKeys: Record<string, string>;
  locales: Array<{ code: string }>;
  /** Hidden form field name for the JSON payload. */
  fieldName: string;
  minItems?: number;
  hrefPlaceholder?: string;
  allowExternalHint?: boolean;
};

/**
 * Ordered label + path list for one footer column — same interaction model as Header main links.
 */
export function FooterLinkColumnEditor({
  columnId,
  title,
  description,
  listLabel,
  initial,
  activeLocale,
  labelPlaceholders,
  defaultLabelKeys,
  locales,
  fieldName,
  minItems = 0,
  hrefPlaceholder = "/care",
  allowExternalHint = false,
}: FooterLinkColumnEditorProps) {
  const [items, setItems] = useState<FooterLinkItem[]>(() => initial.items.map((item) => ({ ...item })));
  const [labels, setLabels] = useState<Record<string, Record<string, string>>>(() => {
    const next: Record<string, Record<string, string>> = {};
    for (const locale of locales) {
      next[locale.code] = { ...(initial.labels[locale.code] ?? {}) };
    }
    for (const [locale, localeLabels] of Object.entries(initial.labels)) {
      next[locale] ??= { ...localeLabels };
    }
    return next;
  });

  const payload: FooterLinkColumn = { items, labels };

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

  function createItem(): FooterLinkItem {
    return { id: createFooterLinkItemId(columnId), href: "" };
  }

  return (
    <section id={`copy-footer-${columnId}`} className="adm-panel grid gap-4 p-5 md:p-6 scroll-mt-24">
      <div>
        <p className="adm-section-tag">{title}</p>
        <p className="mt-1 text-xs" style={{ color: "var(--adm-muted)" }}>
          {description}
        </p>
      </div>

      <input type="hidden" name={fieldName} value={JSON.stringify(payload)} readOnly />

      <AdminOrderedList
        label={listLabel}
        help={
          <AdminHelp>
            Add or remove links, reorder with the arrows. Empty name falls back to the shipped default
            (placeholder) for built-in rows, or to the path/host for custom rows. Path is required
            {allowExternalHint ? "; absolute https:// URLs are allowed for external destinations." : "."}
          </AdminHelp>
        }
        items={items}
        onChange={setItems}
        getKey={(item) => item.id}
        minItems={minItems}
        maxItems={MAX_FOOTER_LINK_ITEMS}
        createItem={createItem}
        addLabel="Add link"
        renderItem={(item, { index }) => {
          const localeTag = activeLocale.toUpperCase();
          const messageKey = defaultLabelKeys[item.id];
          const placeholder = messageKey
            ? (labelPlaceholders[messageKey] ?? "")
            : item.href || hrefPlaceholder;

          return (
            <div className="grid gap-4 md:grid-cols-2">
              <AdminTextField
                label={`Name (${localeTag})`}
                value={labels[activeLocale]?.[item.id] ?? ""}
                onChange={(event) => updateLabel(item.id, event.target.value)}
                placeholder={placeholder || hrefPlaceholder}
                clearable
              />
              <AdminHrefField
                label="Path"
                help={
                  <AdminHelp>
                    Shared across languages. Search by name, or type /products/ or /collections/ to pick a
                    specific item
                    {allowExternalHint ? ". External https:// URLs are fine for legal/social destinations." : "."}
                  </AdminHelp>
                }
                name={`${fieldName}Href-${item.id}`}
                value={item.href}
                onValueChange={(href) => updateHref(index, href)}
                placeholder={hrefPlaceholder}
              />
            </div>
          );
        }}
      />
    </section>
  );
}
