"use client";

import { useEffect, useState, useTransition } from "react";

import {
  createProductMetafieldDefinitionAction,
  listCustomProductMetafieldDefinitionsAction,
} from "@/app/admin/actions/sync";
import {
  AdminHelp,
  AdminReadonlyField,
  AdminRichTextField,
  AdminSelectField,
  AdminTextField,
} from "@/components/synarava-cms";
import { SOURCE_LOCALE } from "@/components/admin/products/product-editor-scope";
import { useAdminToast } from "@/components/admin/shared/admin-toast";
import type { AdminTranslationLocale } from "@/lib/i18n/admin-translation-locales";
import {
  customMetafieldTypeFieldName,
  customMetafieldValueFieldName,
  isTranslatableMetafieldType,
  metafieldIdentityKey,
  metafieldTranslatedValue,
  metafieldTranslationsFromSnapshot,
  metafieldValueFromSnapshot,
  metafieldsArrayFromSnapshot,
  type MetafieldTranslations,
  type ProductMetafieldDefinition,
} from "@/lib/shopify/product-metafields-shared";

const METAFIELD_TYPE_OPTIONS = [
  "single_line_text_field",
  "multi_line_text_field",
  "number_integer",
  "number_decimal",
  "boolean",
  "url",
  "date",
  "json",
] as const;

function HiddenMetafieldOverlayFields({
  definitions,
  overlaysByLocale,
  translationLocales,
}: {
  definitions: ProductMetafieldDefinition[];
  overlaysByLocale: MetafieldTranslations;
  translationLocales: AdminTranslationLocale[];
}) {
  const textDefinitions = definitions.filter((item) => isTranslatableMetafieldType(item.type));
  return (
    <div hidden data-component="HiddenMetafieldOverlayFields">
      {translationLocales.flatMap(({ code }) => {
        if (code === SOURCE_LOCALE) return [];
        return textDefinitions.map((definition) => {
          const name = customMetafieldValueFieldName(definition.namespace, definition.key, code);
          const id = metafieldIdentityKey(definition.namespace, definition.key);
          return (
            <input
              key={name}
              type="hidden"
              name={name}
              value={overlaysByLocale[code]?.[id] ?? ""}
              readOnly
            />
          );
        });
      })}
    </div>
  );
}

/**
 * Merchant PRODUCT metafields — edits are local FormData → Save → workingSnapshot.
 * Source locale (EN) values sync via metafieldsSet; PT/RU text overlays use Shopify
 * Translations API on the Metafield GID (`key: value`).
 *
 * @see https://shopify.dev/docs/apps/build/metafields/definitions
 * @see https://shopify.dev/docs/apps/build/markets/manage-translated-content
 */
export function ProductMetafieldsPanel({
  productId,
  shopifyProductId,
  shopifySnapshot,
  workingSnapshot,
  activeLocale = SOURCE_LOCALE,
  translationLocales = [],
}: {
  productId: string;
  shopifyProductId: string | null;
  shopifySnapshot: unknown;
  /** OUR commerce window — preferred for field values when present. */
  workingSnapshot?: unknown;
  activeLocale?: string;
  translationLocales?: AdminTranslationLocale[];
}) {
  const { pushToast } = useAdminToast();
  const [definitions, setDefinitions] = useState<ProductMetafieldDefinition[]>([]);
  const [loading, setLoading] = useState(() => Boolean(shopifyProductId));
  const [pending, startTransition] = useTransition();
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newNamespace, setNewNamespace] = useState("custom");
  const [newKey, setNewKey] = useState("");
  const [newType, setNewType] = useState<string>("single_line_text_field");
  const [newDescription, setNewDescription] = useState("");
  const snapshotSource = workingSnapshot ?? shopifySnapshot;
  const snapshotFields = metafieldsArrayFromSnapshot(snapshotSource);
  const [overlaysByLocale, setOverlaysByLocale] = useState<MetafieldTranslations>(() =>
    metafieldTranslationsFromSnapshot(snapshotSource),
  );
  const isSource = activeLocale === SOURCE_LOCALE;
  const showOverlay = !isSource;

  // When the Shopify link disappears, clear loading/definitions during render.
  const [trackedShopifyId, setTrackedShopifyId] = useState(shopifyProductId);
  if (shopifyProductId !== trackedShopifyId) {
    setTrackedShopifyId(shopifyProductId);
    setLoading(Boolean(shopifyProductId));
    if (!shopifyProductId) setDefinitions([]);
  }

  function refreshDefinitions() {
    setLoading(true);
    void listCustomProductMetafieldDefinitionsAction()
      .then((result) => {
        if (result.error) {
          pushToast({ message: result.error, tone: "error" });
          return;
        }
        setDefinitions(result.definitions ?? []);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (!shopifyProductId) return;
    let cancelled = false;
    // Loading flag is set during render when shopifyProductId changes; only async updates here.
    void listCustomProductMetafieldDefinitionsAction()
      .then((result) => {
        if (cancelled) return;
        if (result.error) {
          pushToast({ message: result.error, tone: "error" });
          return;
        }
        setDefinitions(result.definitions ?? []);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopifyProductId, productId]);

  function updateOverlay(namespace: string, key: string, value: string) {
    if (activeLocale === SOURCE_LOCALE) return;
    const id = metafieldIdentityKey(namespace, key);
    setOverlaysByLocale((prev) => {
      const localeBucket = { ...(prev[activeLocale] ?? {}) };
      if (value.trim()) localeBucket[id] = value;
      else delete localeBucket[id];
      const next = { ...prev };
      if (Object.keys(localeBucket).length > 0) next[activeLocale] = localeBucket;
      else delete next[activeLocale];
      return next;
    });
  }

  if (!shopifyProductId) {
    return (
      <section className="grid gap-3 border border-[var(--adm-border)] p-4">
        <h3 className="text-sm font-semibold">Product metafields</h3>
        <p className="text-xs text-[var(--adm-muted)]">
          Link this product to Shopify first. Custom metafield definitions live in Shopify;
          values sync through Save → Push like other commerce fields.
        </p>
      </section>
    );
  }

  return (
    <section data-component="ProductMetafieldsPanel" className="grid gap-4 border border-[var(--adm-border)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="adm-label-row">
            <span className="adm-label">Product metafields</span>
            <AdminHelp>
              Same as Shopify Admin → Product metafields. English values Save into OUR window and
              Push via metafieldsSet. Other languages translate text fields only (Shopify
              Translations API); blank falls back to English. Numbers, dates, and flags stay shared.
            </AdminHelp>
          </p>
          <p className="mt-2 text-xs leading-5 text-[var(--adm-muted)]">
            {showOverlay
              ? "Translate text metafields for this language. Non-text fields are edited in English."
              : "Values are part of commerce sync — not a separate Shopify write. Add definition only creates a shop-wide field schema in Shopify."}
          </p>
        </div>
        {isSource ? (
          <button
            type="button"
            className="adm-btn-secondary"
            disabled={pending}
            onClick={() => setAddOpen((open) => !open)}
          >
            Add definition
          </button>
        ) : null}
      </div>

      {addOpen && isSource ? (
        <div className="grid gap-3 rounded-xl border border-[var(--adm-border)] bg-[var(--adm-bg-soft)] p-4">
          <AdminTextField
            label="Name"
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            placeholder="e.g. Warranty"
            required
          />
          <AdminTextField
            label="Namespace"
            help="Merchant namespace (default custom). Avoid synarava / shopify / global."
            value={newNamespace}
            onChange={(event) => setNewNamespace(event.target.value)}
            required
          />
          <AdminTextField
            label="Key (optional)"
            help="Lowercase letters, numbers, underscores. Auto from name when empty."
            value={newKey}
            onChange={(event) => setNewKey(event.target.value)}
            placeholder="auto from name"
          />
          <AdminSelectField
            label="Type"
            value={newType}
            onChange={(event) => setNewType(event.target.value)}
          >
            {METAFIELD_TYPE_OPTIONS.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </AdminSelectField>
          <AdminRichTextField
            label="Description"
            value={newDescription}
            onChange={setNewDescription}
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="adm-btn-primary"
              disabled={pending || !newName.trim()}
              onClick={() => {
                startTransition(async () => {
                  const result = await createProductMetafieldDefinitionAction({
                    name: newName,
                    namespace: newNamespace.trim() || "custom",
                    key: newKey.trim() || undefined,
                    type: newType,
                    description: newDescription.trim() || undefined,
                  });
                  if (result.error) {
                    pushToast({ message: result.error, tone: "error" });
                    return;
                  }
                  pushToast({ message: result.success ?? "Definition created.", tone: "success" });
                  setNewName("");
                  setNewNamespace("custom");
                  setNewKey("");
                  setNewType("single_line_text_field");
                  setNewDescription("");
                  setAddOpen(false);
                  refreshDefinitions();
                });
              }}
            >
              {pending ? "Creating…" : "Create in Shopify"}
            </button>
            <button type="button" className="adm-btn-ghost" disabled={pending} onClick={() => setAddOpen(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <HiddenMetafieldOverlayFields
        definitions={definitions}
        overlaysByLocale={overlaysByLocale}
        translationLocales={translationLocales}
      />

      {loading ? (
        <p className="text-xs text-[var(--adm-muted)]" role="status">Loading definitions from Shopify…</p>
      ) : definitions.length === 0 ? (
        <p className="text-xs text-[var(--adm-muted)]">
          No custom metafield definitions yet. Use Add definition, or create them in Shopify Admin →
          Settings → Custom data → Products.
        </p>
      ) : (
        <div className="grid gap-3">
          {definitions.map((definition) => {
            const enValueName = customMetafieldValueFieldName(definition.namespace, definition.key);
            const typeName = customMetafieldTypeFieldName(definition.namespace, definition.key);
            const help = `${definition.namespace}.${definition.key} · ${definition.type}`;
            const defaultValue = metafieldValueFromSnapshot(
              snapshotFields,
              definition.namespace,
              definition.key,
            );
            const translatable = isTranslatableMetafieldType(definition.type);
            const overlayValue = metafieldTranslatedValue(
              overlaysByLocale,
              activeLocale,
              definition.namespace,
              definition.key,
            );
            const multiline = definition.type.includes("multi_line") || definition.type.includes("rich_text");

            if (!translatable) {
              return (
                <div key={definition.id} className="grid gap-1">
                  <input type="hidden" name={typeName} value={definition.type} readOnly />
                  <div hidden={showOverlay}>
                    <AdminTextField
                      label={definition.name}
                      help={help}
                      name={enValueName}
                      defaultValue={defaultValue}
                    />
                  </div>
                  {showOverlay ? (
                    <AdminReadonlyField
                      label={definition.name}
                      help={`${help} · shared (edit in English)`}
                      value={defaultValue.trim() || "—"}
                    />
                  ) : null}
                </div>
              );
            }

            return (
              <div key={definition.id} className="grid gap-1">
                <input type="hidden" name={typeName} value={definition.type} readOnly />
                <div hidden={showOverlay}>
                  {multiline ? (
                    <AdminRichTextField
                      label={definition.name}
                      help={help}
                      name={enValueName}
                      defaultValue={defaultValue}
                    />
                  ) : (
                    <AdminTextField
                      label={definition.name}
                      help={help}
                      name={enValueName}
                      defaultValue={defaultValue}
                    />
                  )}
                </div>
                {showOverlay ? (
                  multiline ? (
                    <AdminRichTextField
                      label={definition.name}
                      help={`${help} · ${activeLocale.toUpperCase()}`}
                      value={overlayValue}
                      onChange={(value) => updateOverlay(definition.namespace, definition.key, value)}
                      placeholder={defaultValue || undefined}
                    />
                  ) : (
                    <AdminTextField
                      label={definition.name}
                      help={`${help} · ${activeLocale.toUpperCase()}`}
                      value={overlayValue}
                      onChange={(event) =>
                        updateOverlay(definition.namespace, definition.key, event.target.value)
                      }
                      placeholder={defaultValue || undefined}
                    />
                  )
                ) : null}
              </div>
            );
          })}
          <p className="text-xs text-[var(--adm-muted)]">
            Use Save product to store these in OUR commerce window, then Push (or resolve conflicts)
            to update Shopify{showOverlay ? " translations" : ""}.
          </p>
        </div>
      )}
    </section>
  );
}
