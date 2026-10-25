import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";

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
  localFingerprint: "local-price",
  shopifyFingerprint: "shopify-price",
  allowedDirections: ["SHOPIFY_TO_SYNARAVA", "SYNARAVA_TO_SHOPIFY"],
  blockedReason: null,
  sourceId: null,
};

const createField: CatalogConflictField = {
  fieldKey: "presence:collection",
  label: "Collection exists only in Synarava",
  scope: { kind: "SHARED" },
  origin: "PRESENCE",
  targetKind: "NATIVE",
  synaravaValue: "Pets · /pets",
  shopifyValue: "— Collection is missing —",
  localFingerprint: "local-presence",
  shopifyFingerprint: "shopify-presence",
  allowedDirections: ["SYNARAVA_TO_SHOPIFY"],
  blockedReason: null,
  sourceId: null,
  presenceDifference: {
    id: "c-pets",
    kind: "SYNARAVA_ONLY",
    localProductId: "c-pets",
    shopifyProductId: null,
    name: "Pets",
    handle: "pets",
    sku: "",
    localFingerprint: "l",
    shopifyFingerprint: "s",
    remoteMissing: true,
    matchReason: null,
    localIdentity: { name: "Pets", handle: "pets", sku: "" },
    shopifyIdentity: null,
  },
};

const removeField: CatalogConflictField = {
  ...createField,
  label: "Collection exists only in Synarava",
  allowedDirections: ["SHOPIFY_TO_SYNARAVA", "SYNARAVA_TO_SHOPIFY"],
};

function fieldsFor(keys: string[]): CatalogConflictField[] {
  const all = [titleField, priceField, createField, removeField];
  return all.filter((field, index, list) =>
    keys.includes(field.fieldKey) && list.findIndex((item) => item.fieldKey === field.fieldKey) === index,
  );
}

function createStoryAdapter(fields: CatalogConflictField[]): ConflictResolverAdapter {
  return {
    entityNoun: "collection",
    entityNounPlural: "collections",
    ariaLabel: "Collection conflicts",
    loadEntityFields: async () => ({ fields }),
    previewSelections: async (selections) => ({
      preview: {
        truncated: false,
        excluded: [],
        entries: selections.map((item) => ({
          entityId: item.entityId,
          field: fields.find((candidate) => candidate.fieldKey === item.fieldKey) ?? fields[0]!,
          direction: item.direction,
          willClearNonEmptyValue:
            item.direction === "SHOPIFY_TO_SYNARAVA"
            && fields.find((candidate) => candidate.fieldKey === item.fieldKey)?.origin === "PRESENCE"
            && fields.find((candidate) => candidate.fieldKey === item.fieldKey)?.presenceDifference?.kind === "SYNARAVA_ONLY",
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
}

const productAdapter: ConflictResolverAdapter = {
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

async function openConfirm(canvasElement: HTMLElement, applyLabel: string) {
  const canvas = within(canvasElement.ownerDocument.body);
  await userEvent.click(canvas.getByRole("button", { name: applyLabel }));
  return canvas.findByRole("dialog", { name: "Confirm changes before writing" });
}

export const Default: Story = {
  args: {
    open: true,
    onClose: () => undefined,
    adapter: productAdapter,
    entityIds: ["p1"],
    entities: [{ id: "p1", name: "Lava Ring", detail: "SKU LAVA-1" }],
    focusedEntityId: "p1",
    onToast: () => undefined,
  },
};

export const ConfirmUpdate: Story = {
  args: {
    open: true,
    onClose: () => undefined,
    adapter: productAdapter,
    entityIds: ["p1"],
    entities: [{ id: "p1", name: "Lava Ring", detail: "SKU LAVA-1" }],
    focusedEntityId: "p1",
    onToast: () => undefined,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body);
    await canvas.findByText("Title");
    await userEvent.click(canvas.getByRole("button", { name: "Take Shopify for all" }));
    const preview = await openConfirm(canvasElement, "Apply (2)");
    await expect(within(preview).getByRole("heading", {
      name: "Take Shopify's title into Synarava",
    })).toBeInTheDocument();
    await expect(within(preview).getByText("0 changes to Shopify · 2 changes to Synarava")).toBeInTheDocument();
  },
};

export const ConfirmCreate: Story = {
  args: {
    open: true,
    onClose: () => undefined,
    adapter: createStoryAdapter(fieldsFor(["presence:collection"])),
    entityIds: ["c-pets"],
    entities: [{ id: "c-pets", name: "Pets", detail: "/pets" }],
    focusedEntityId: "c-pets",
    onToast: () => undefined,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body);
    await canvas.findByText("Collection exists only in Synarava");
    await userEvent.click(canvas.getByRole("button", { name: "Keep ours for all" }));
    const preview = await openConfirm(canvasElement, "Apply (1)");
    await expect(within(preview).getByRole("heading", {
      name: 'Create "Pets" in Shopify',
    })).toBeInTheDocument();
    await expect(within(preview).getByText("Not in Shopify")).toBeInTheDocument();
  },
};

export const ConfirmRemove: Story = {
  args: {
    open: true,
    onClose: () => undefined,
    adapter: createStoryAdapter([removeField]),
    entityIds: ["c-pets"],
    entities: [{ id: "c-pets", name: "Pets", detail: "/pets" }],
    focusedEntityId: "c-pets",
    onToast: () => undefined,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body);
    await canvas.findByText("Collection exists only in Synarava");
    await userEvent.click(canvas.getByRole("button", { name: "Take Shopify for all" }));
    const preview = await openConfirm(canvasElement, "Apply (1)");
    await expect(within(preview).getByRole("heading", {
      name: 'Remove "Pets" from Synarava (linked products stay)',
    })).toBeInTheDocument();
    await expect(within(preview).getByText("Removed")).toBeInTheDocument();
  },
};

export const ConfirmMixedDirections: Story = {
  args: {
    open: true,
    onClose: () => undefined,
    adapter: createStoryAdapter([priceField, createField]),
    entityIds: ["c-pets"],
    entities: [{ id: "c-pets", name: "Pets", detail: "/pets" }],
    focusedEntityId: "c-pets",
    onToast: () => undefined,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body);
    await canvas.findByText("Price");
    const priceSection = canvas.getByText("Price").closest("section");
    const presenceSection = canvas.getByText("Collection exists only in Synarava").closest("section");
    await userEvent.click(within(priceSection as HTMLElement).getByRole("button", { name: /Shopify/i }));
    await userEvent.click(within(presenceSection as HTMLElement).getByRole("button", { name: /Keep ours/i }));
    const preview = await openConfirm(canvasElement, "Apply (2)");
    await expect(within(preview).getByRole("heading", { name: "Take Shopify's price into Synarava" })).toBeInTheDocument();
    await expect(within(preview).getByRole("heading", { name: 'Create "Pets" in Shopify' })).toBeInTheDocument();
    await expect(within(preview).getByText("1 change to Shopify · 1 change to Synarava")).toBeInTheDocument();
  },
};

export const ConfirmReducedMotion: Story = {
  args: {
    open: true,
    onClose: () => undefined,
    adapter: productAdapter,
    entityIds: ["p1"],
    entities: [{ id: "p1", name: "Lava Ring", detail: "SKU LAVA-1" }],
    focusedEntityId: "p1",
    onToast: () => undefined,
  },
  decorators: [
    (Story) => (
      <div className="adm-conflict-confirm--reduced-motion">
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body);
    await canvas.findByText("Title");
    await userEvent.click(canvas.getByRole("button", { name: "Keep ours for all" }));
    const preview = await openConfirm(canvasElement, "Apply (2)");
    const pulse = preview.querySelector(".adm-conflict-flow__pulse");
    await expect(pulse).toBeTruthy();
    await expect(within(preview).getByRole("heading", { name: "Update price in Shopify" })).toBeInTheDocument();
  },
};
