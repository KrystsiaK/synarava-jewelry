import {
  ADMIN_FIELD_REGISTRIES,
  localizedFields,
  requiredLocalizedFields,
  type EntityFieldRegistry,
} from "@/lib/i18n/admin-field-registry";

describe("admin field registry", () => {
  it("has no duplicate keys within an entity", () => {
    for (const registry of ADMIN_FIELD_REGISTRIES) {
      const keys = registry.fields.map((field) => field.key);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it("gives every localized field a Shopify target and every shared field none", () => {
    for (const registry of ADMIN_FIELD_REGISTRIES) {
      for (const field of registry.fields) {
        if (field.mode === "localized") {
          expect(field.shopifyTarget, `${registry.entity}.${field.key} is localized but has no Shopify target`).not.toBeNull();
        } else {
          expect(field.shopifyTarget, `${registry.entity}.${field.key} is shared but declares a Shopify target`).toBeNull();
        }
      }
    }
  });

  it("filters localized fields", () => {
    const registry: EntityFieldRegistry = {
      entity: "widget",
      fields: [
        { key: "a", label: "A", mode: "localized", required: "always", kind: "short-text", shopifyTarget: { kind: "native", resource: "X", key: "a" } },
        { key: "b", label: "B", mode: "shared", required: "always", kind: "short-text", shopifyTarget: null },
      ],
    };
    expect(localizedFields(registry).map((f) => f.key)).toEqual(["a"]);
  });

  it("resolves requiredness against publish state", () => {
    const registry: EntityFieldRegistry = {
      entity: "widget",
      fields: [
        { key: "always", label: "Always", mode: "localized", required: "always", kind: "short-text", shopifyTarget: { kind: "native", resource: "X", key: "always" } },
        { key: "whenPublished", label: "When published", mode: "localized", required: "when-published", kind: "short-text", shopifyTarget: { kind: "native", resource: "X", key: "wp" } },
        { key: "optional", label: "Optional", mode: "localized", required: "optional", kind: "short-text", shopifyTarget: { kind: "native", resource: "X", key: "opt" } },
      ],
    };
    expect(requiredLocalizedFields(registry, { published: false }).map((f) => f.key)).toEqual(["always"]);
    expect(requiredLocalizedFields(registry, { published: true }).map((f) => f.key)).toEqual(["always", "whenPublished"]);
  });

  it("keeps the storefront-copy registry in sync with STOREFRONT_COPY_KEYS", async () => {
    const { STOREFRONT_COPY_KEYS } = await import("@/lib/content/storefront-copy-fields");
    const registry = ADMIN_FIELD_REGISTRIES.find((r) => r.entity === "storefront-copy")!;
    expect(registry.fields.map((f) => f.key).sort()).toEqual([...STOREFRONT_COPY_KEYS].sort());
  });
});
