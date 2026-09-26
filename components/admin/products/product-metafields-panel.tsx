"use client";

import { useEffect, useState, useTransition } from "react";

import {
  createProductMetafieldDefinitionAction,
  listCustomProductMetafieldDefinitionsAction,
} from "@/app/admin/actions/sync";
import { AdminHelp, AdminLongTextField, AdminSelectField, AdminTextField } from "@/components/synarava-cms";
import { useAdminToast } from "@/components/admin/shared/admin-toast";
import {
  customMetafieldTypeFieldName,
  customMetafieldValueFieldName,
  metafieldValueFromSnapshot,
  metafieldsArrayFromSnapshot,
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

/**
 * Merchant PRODUCT metafields — edits are local FormData → Save → workingSnapshot.
 * Push / conflict resolve sends them to Shopify (same dual-window model as Price).
 * Add definition is shop-wide schema (Shopify Settings), not product sync.
 *
 * @see https://shopify.dev/docs/apps/build/metafields/definitions
 */
export function ProductMetafieldsPanel({
  productId,
  shopifyProductId,
  shopifySnapshot,
  workingSnapshot,
}: {
  productId: string;
  shopifyProductId: string | null;
  shopifySnapshot: unknown;
  /** OUR commerce window — preferred for field values when present. */
  workingSnapshot?: unknown;
}) {
  const { pushToast } = useAdminToast();
  const [definitions, setDefinitions] = useState<ProductMetafieldDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newNamespace, setNewNamespace] = useState("custom");
  const [newKey, setNewKey] = useState("");
  const [newType, setNewType] = useState<string>("single_line_text_field");
  const [newDescription, setNewDescription] = useState("");
  const snapshotFields = metafieldsArrayFromSnapshot(workingSnapshot ?? shopifySnapshot);

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
    if (!shopifyProductId) {
      setLoading(false);
      return;
    }
    refreshDefinitions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopifyProductId, productId]);

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
              Same as Shopify Admin → Product metafields. Edit values here, then Save (writes OUR
              window). Push or resolve conflicts to send them to Shopify. Passport fields stay under
              Catalog.
            </AdminHelp>
          </p>
          <p className="mt-2 text-xs leading-5 text-[var(--adm-muted)]">
            Values are part of commerce sync — not a separate Shopify write. Add definition only
            creates a shop-wide field schema in Shopify.
          </p>
        </div>
        <button
          type="button"
          className="adm-btn-secondary"
          disabled={pending}
          onClick={() => setAddOpen((open) => !open)}
        >
          Add definition
        </button>
      </div>

      {addOpen ? (
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
          <AdminLongTextField
            label="Description"
            value={newDescription}
            onChange={setNewDescription}
            rows={4}
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
            const valueName = customMetafieldValueFieldName(definition.namespace, definition.key);
            const typeName = customMetafieldTypeFieldName(definition.namespace, definition.key);
            const help = `${definition.namespace}.${definition.key} · ${definition.type}`;
            const defaultValue = metafieldValueFromSnapshot(
              snapshotFields,
              definition.namespace,
              definition.key,
            );
            return (
              <div key={definition.id} className="grid gap-1">
                <input type="hidden" name={typeName} value={definition.type} readOnly />
                {definition.type.includes("multi_line") ? (
                  <AdminLongTextField
                    label={definition.name}
                    help={help}
                    name={valueName}
                    defaultValue={defaultValue}
                  />
                ) : (
                  <AdminTextField
                    label={definition.name}
                    help={help}
                    name={valueName}
                    defaultValue={defaultValue}
                  />
                )}
              </div>
            );
          })}
          <p className="text-xs text-[var(--adm-muted)]">
            Use Save product to store these in OUR commerce window, then Push (or resolve conflicts)
            to update Shopify.
          </p>
        </div>
      )}
    </section>
  );
}
