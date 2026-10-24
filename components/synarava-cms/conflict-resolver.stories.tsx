import type { Meta, StoryObj } from "@storybook/react-vite";

import { ConflictResolver, type ConflictResolverAdapter } from "@/components/synarava-cms/conflict-resolver";
import type { CatalogConflictField } from "@/lib/shopify/catalog-conflict";

const titleField: CatalogConflictField = {
  fieldKey: "translation:pt:title",
  label: "Title",
  scope: { kind: "LOCALE", code: "pt", name: "Portuguese", nativeName: "Português" },
  origin: "TRANSLATION",
  targetKind: "NATIVE",
  synaravaValue: "Anel de lava",
  shopifyValue: "Lava ring",
  baseValue: "Lava ring",
  localFingerprint: "local-title",
  shopifyFingerprint: "shopify-title",
  allowedDirections: ["SHOPIFY_TO_SYNARAVA", "SYNARAVA_TO_SHOPIFY"],
  blockedReason: null,
  sourceId: "d1",
};

const priceField: CatalogConflictField = {
  fieldKey: "commerce:price",
  label: "Price",
  scope: { kind: "SHARED" },
  origin: "COMMERCE",
  targetKind: "NATIVE",
  synaravaValue: "120.00 EUR",
  shopifyValue: "110.00 EUR",
  baseValue: "110.00 EUR",
  localFingerprint: "local-price",
  shopifyFingerprint: "shopify-price",
  allowedDirections: ["SHOPIFY_TO_SYNARAVA", "SYNARAVA_TO_SHOPIFY"],
  blockedReason: null,
  sourceId: null,
};

const adapter: ConflictResolverAdapter = {
  entityNoun: "product",
  entityNounPlural: "products",
  ariaLabel: "Product conflicts",
  loadEntityFields: async () => ({ fields: [titleField, priceField] }),
  previewSelections: async (selections) => ({
    preview: {
      truncated: false,
      excluded: [],
      entries: selections.map((item) => ({
        entityId: item.entityId,
        field: item.fieldKey === priceField.fieldKey ? priceField : titleField,
        direction: item.direction,
        willClearNonEmptyValue: false,
      })),
    },
  }),
  applySelections: async ({ entries }) => ({
    outcome: {
      appliedCount: entries.length,
      failedCount: 0,
      results: entries.map((entry) => ({ entityId: entry.entityId, ok: true })),
    },
    success: `${entries.length} change applied.`,
  }),
};

const meta = {
  title: "synarava-cms/ConflictResolver",
  component: ConflictResolver,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof ConflictResolver>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    open: true,
    onClose: () => undefined,
    adapter,
    entityIds: ["p1"],
    entities: [{ id: "p1", name: "Lava Ring", detail: "SKU LAVA-1" }],
    focusedEntityId: "p1",
    onToast: () => undefined,
  },
};
