"use client";

import { useState } from "react";

import {
  AdminHelp,
  AdminRichTextField,
  AdminTextField,
} from "@/components/synarava-cms";
import { SOURCE_LOCALE } from "@/components/admin/products/product-editor-scope";
import {
  SHOPIFY_PRODUCT_SPEC_FIELDS,
  shopifyProductSpecKeysMissingInShopify,
  shopifyProductSpecOverlaysFromTranslations,
  shopifyProductSpecValuesFromWindows,
} from "@/lib/products/shopify-product-specs";
import {
  customMetafieldTypeFieldName,
  customMetafieldValueFieldName,
  metafieldTranslationsFromSnapshot,
} from "@/lib/shopify/product-metafields-shared";

const MISSING_SHOPIFY_METAFIELD_WARNING =
  "Missing in Shopify — Save the English value and Push first so this metafield exists. PT/RU Markets translations need a Metafield GID.";

function HiddenSpecOverlayFields({
  overlaysByLocale,
}: {
  overlaysByLocale: Record<string, Record<string, string>>;
}) {
  return (
    <div hidden data-component="HiddenShopifyProductSpecOverlays">
      {Object.entries(overlaysByLocale).flatMap(([locale, overlay]) => {
        if (locale === SOURCE_LOCALE) return [];
        return SHOPIFY_PRODUCT_SPEC_FIELDS.map((spec) => {
          const name = customMetafieldValueFieldName("custom", spec.key, locale);
          return (
            <input
              key={name}
              type="hidden"
              name={name}
              value={overlay[spec.key] ?? ""}
              readOnly
            />
          );
        });
      })}
    </div>
  );
}

/**
 * Editable Shopify-owned jewelry specs on Product (Shopify group).
 * FormData names match Metafields Save → workingSnapshot.metafields → Push.
 */
export function ShopifyProductSpecsFields({
  workingSnapshot,
  shopifySnapshot,
  activeLocale = SOURCE_LOCALE,
  translationLocales = [],
}: {
  workingSnapshot?: unknown;
  shopifySnapshot?: unknown;
  activeLocale?: string;
  translationLocales?: Array<{ code: string }>;
}) {
  const enValues = shopifyProductSpecValuesFromWindows(workingSnapshot, shopifySnapshot);
  const missingInShopify = new Set(shopifyProductSpecKeysMissingInShopify(shopifySnapshot));
  const allTranslations = metafieldTranslationsFromSnapshot(workingSnapshot ?? shopifySnapshot);
  const [overlaysByLocale, setOverlaysByLocale] = useState<Record<string, Record<string, string>>>(() => {
    const initial: Record<string, Record<string, string>> = {};
    for (const { code } of translationLocales) {
      if (code === SOURCE_LOCALE) continue;
      initial[code] = shopifyProductSpecOverlaysFromTranslations(allTranslations, code);
    }
    return initial;
  });

  const isEn = activeLocale === SOURCE_LOCALE;
  const overlay = overlaysByLocale[activeLocale] ?? {};
  const missingCount = missingInShopify.size;

  function updateOverlay(key: string, value: string) {
    if (isEn) return;
    setOverlaysByLocale((prev) => ({
      ...prev,
      [activeLocale]: { ...(prev[activeLocale] ?? {}), [key]: value },
    }));
  }

  // Ensure translation buckets exist for every registered locale so hidden mirrors submit.
  const overlaysForSubmit: Record<string, Record<string, string>> = { ...overlaysByLocale };
  for (const { code } of translationLocales) {
    if (code === SOURCE_LOCALE) continue;
    overlaysForSubmit[code] = overlaysForSubmit[code] ?? {};
  }

  return (
    <section
      data-component="ShopifyProductSpecsFields"
      className="grid gap-4 border border-[var(--adm-border)] p-4"
    >
      <div>
        <p className="adm-label-row">
          <span className="adm-label">Shopify product specs</span>
          <AdminHelp>
            Shopify-owned jewelry facts (`custom.*`). Save writes OUR commerce window; Push
            updates Shopify. Category taxonomy attributes stay under Product category (Pull
            display). Synarava-only compliance and chain lengths live under Synarava → Passport.
          </AdminHelp>
        </p>
        <p className="mt-2 text-xs leading-5 text-[var(--adm-muted)]">
          {isEn
            ? "Edit English values here. Vendor, product type, and category are above."
            : "Optional translation overlays for this language. Blank falls back to English / Shopify Markets translations."}
        </p>
        {!isEn && missingCount > 0 ? (
          <p
            className="mt-2 text-xs leading-5 text-[var(--adm-warning)]"
            role="status"
            data-testid="shopify-specs-missing-metafields"
          >
            {missingCount} spec{missingCount === 1 ? "" : "s"} missing in Shopify (no Metafield
            GID). Save English values and Push first — PT/RU Markets translations cannot register
            without the metafield on the product.
          </p>
        ) : null}
      </div>

      <HiddenSpecOverlayFields overlaysByLocale={overlaysForSubmit} />

      <div className="grid gap-3 md:grid-cols-2">
        {SHOPIFY_PRODUCT_SPEC_FIELDS.map((spec) => {
          const enName = customMetafieldValueFieldName("custom", spec.key);
          const typeName = customMetafieldTypeFieldName("custom", spec.key);
          const enValue = enValues[spec.key] ?? "";
          const overlayValue = overlay[spec.key] ?? "";
          const missing = missingInShopify.has(spec.key);
          const localeWarning = !isEn && missing ? MISSING_SHOPIFY_METAFIELD_WARNING : undefined;

          return (
            <div
              key={spec.key}
              className={spec.multiline ? "min-w-0 md:col-span-2" : "min-w-0"}
              data-missing-shopify-metafield={missing ? "true" : "false"}
            >
              <input type="hidden" name={typeName} value={spec.type} readOnly />
              <div hidden={!isEn} aria-hidden={!isEn || undefined}>
                {spec.multiline ? (
                  <AdminRichTextField
                    label={spec.label}
                    owner="Shopify"
                    name={enName}
                    defaultValue={enValue}
                    help={`custom.${spec.key}`}
                  />
                ) : (
                  <AdminTextField
                    label={spec.label}
                    owner="Shopify"
                    name={enName}
                    defaultValue={enValue}
                    help={`custom.${spec.key}`}
                  />
                )}
              </div>
              {!isEn ? (
                spec.multiline ? (
                  <AdminRichTextField
                    label={spec.label}
                    owner="Shopify"
                    value={overlayValue}
                    onChange={(value) => updateOverlay(spec.key, value)}
                    placeholder={enValue || undefined}
                    help={`custom.${spec.key} · ${activeLocale.toUpperCase()}`}
                    warning={localeWarning}
                  />
                ) : (
                  <AdminTextField
                    label={spec.label}
                    owner="Shopify"
                    value={overlayValue}
                    onChange={(event) => updateOverlay(spec.key, event.target.value)}
                    placeholder={enValue || undefined}
                    help={`custom.${spec.key} · ${activeLocale.toUpperCase()}`}
                    warning={localeWarning}
                  />
                )
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
