import { useState, type CSSProperties, type ReactNode } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import {
  FieldConflictDetailsModal,
  FieldConflictListModal,
  FieldConflictPreviewModal,
  type FieldConflictPreviewModel,
} from "@/components/admin/shared/field-conflict-panel";
import type { CatalogConflictDirection, CatalogConflictField } from "@/lib/shopify/catalog-conflict";
import type { CatalogConflictSignals } from "@/lib/shopify/catalog-conflict-signals";

const lightVars = {
  "--adm-bg": "#f7f3ec",
  "--adm-panel": "#ffffff",
  "--adm-ink": "#211d19",
  "--adm-border": "#e4ddd2",
  "--adm-muted": "#7a7168",
  "--adm-danger": "#9d3836",
  "--adm-warning": "#a16207",
  "--adm-conflict": "#a16207",
  background: "#f7f3ec",
  color: "#211d19",
} as CSSProperties;

const darkVars = {
  "--adm-bg": "#141312",
  "--adm-panel": "#1c1a18",
  "--adm-ink": "#f4efe7",
  "--adm-border": "#3a342e",
  "--adm-muted": "#a79d92",
  "--adm-danger": "#e87874",
  "--adm-warning": "#e3b341",
  "--adm-conflict": "#e3b341",
  background: "#141312",
  color: "#f4efe7",
} as CSSProperties;

const localeField: CatalogConflictField = {
  fieldKey: "translation:pt:title",
  label: "Title",
  scope: { kind: "LOCALE", code: "pt", name: "Portuguese", nativeName: "Português" },
  origin: "TRANSLATION",
  targetKind: "NATIVE",
  synaravaValue: "Anel de Lava",
  shopifyValue: "Anel Vulcânico",
  baseValue: "Lava Ring",
  localFingerprint: "local-title",
  shopifyFingerprint: "shopify-title",
  allowedDirections: ["SHOPIFY_TO_SYNARAVA", "SYNARAVA_TO_SHOPIFY"],
  blockedReason: null,
  sourceId: "d1",
};

const sharedField: CatalogConflictField = {
  fieldKey: "commerce:product_type",
  label: "Product type",
  scope: { kind: "SHARED" },
  origin: "COMMERCE",
  targetKind: "NATIVE",
  synaravaValue: "Rings",
  shopifyValue: "Jewellery",
  baseValue: "Rings",
  localFingerprint: "local-type",
  shopifyFingerprint: "shopify-type",
  allowedDirections: ["SHOPIFY_TO_SYNARAVA", "SYNARAVA_TO_SHOPIFY"],
  blockedReason: null,
  sourceId: null,
};

const signals: CatalogConflictSignals = {
  state: "ready",
  totalCount: 2,
  checkedAt: "2026-10-23T10:00:00.000Z",
  recentlyUpdatedProducts: {},
  products: {
    p1: {
      shared: true,
      locales: [{ code: "pt", name: "Portuguese", nativeName: "Português", count: 1 }],
      name: "Lava Ring",
      sku: "LR-1",
    },
    p2: {
      shared: false,
      locales: [{ code: "ru", name: "Russian", nativeName: "Русский", count: 2 }],
      name: "Amber Band",
      sku: "AB-2",
    },
  },
};

function Frame({
  label,
  style,
  width,
  children,
}: {
  label: string;
  style: CSSProperties;
  width: number;
  children: ReactNode;
}) {
  return (
    <div className="admin-terminal admin-modal-root relative min-h-[28rem] p-4" style={{ ...style, width }}>
      <p className="m-0 mb-3 text-[0.68rem] font-semibold uppercase tracking-[0.08em] opacity-60">
        {label}
        {" "}
        ·
        {width}
        px
      </p>
      {children}
    </div>
  );
}

function DetailsDemo() {
  const [selections, setSelections] = useState<Record<string, CatalogConflictDirection>>({});
  return (
    <FieldConflictDetailsModal
      open
      title="Lava Ring"
      fields={[sharedField, localeField]}
      selections={selections}
      loading={false}
      applying={false}
      entityId="p1"
      onClose={() => undefined}
      onSelect={(fieldKey, direction) => setSelections((current) => ({ ...current, [fieldKey]: direction }))}
      onSelectAll={(direction) => {
        setSelections({
          [sharedField.fieldKey]: direction,
          [localeField.fieldKey]: direction,
        });
      }}
      onContinue={() => undefined}
    />
  );
}

const preview: FieldConflictPreviewModel = {
  truncated: false,
  excluded: [],
  entries: [
    {
      entityId: "p1",
      field: sharedField,
      direction: "SHOPIFY_TO_SYNARAVA",
      willClearNonEmptyValue: false,
      impactNote: "Product type is a shared label — confirming updates every product that uses this type name.",
    },
    {
      entityId: "p1",
      field: localeField,
      direction: "SYNARAVA_TO_SHOPIFY",
      willClearNonEmptyValue: true,
    },
  ],
};

const meta = {
  title: "Admin/FieldConflictPanel",
  parameters: {
    layout: "fullscreen",
    chromatic: { viewports: [1440, 768, 390] },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const ListLightDark: Story = {
  name: "List (light/dark · 390/768/1440)",
  render: () => (
    <div className="grid gap-8">
      <Frame label="Light" style={lightVars} width={1440}>
        <FieldConflictListModal
          open
          onClose={() => undefined}
          signals={signals}
          entities={[
            { id: "p1", name: "Lava Ring", detail: "SKU LR-1" },
            { id: "p2", name: "Amber Band", detail: "SKU AB-2" },
          ]}
          focusedEntityId="p1"
          busy={false}
          entityNoun="product"
          entityNounPlural="products"
          ariaLabel="Product differences"
          onAction={() => undefined}
        />
      </Frame>
      <Frame label="Dark" style={darkVars} width={768}>
        <FieldConflictListModal
          open
          onClose={() => undefined}
          signals={signals}
          entities={[
            { id: "p1", name: "Lava Ring", detail: "SKU LR-1" },
            { id: "p2", name: "Amber Band", detail: "SKU AB-2" },
          ]}
          focusedEntityId={null}
          busy={false}
          entityNoun="collection"
          entityNounPlural="collections"
          ariaLabel="Collection differences"
          onAction={() => undefined}
        />
      </Frame>
      <Frame label="Light" style={lightVars} width={390}>
        <FieldConflictListModal
          open
          onClose={() => undefined}
          signals={signals}
          entities={[{ id: "p1", name: "Lava Ring", detail: "SKU LR-1" }]}
          focusedEntityId="p1"
          busy={false}
          hideBulk
          entityNoun="product"
          entityNounPlural="products"
          ariaLabel="Product differences"
          onAction={() => undefined}
        />
      </Frame>
    </div>
  ),
};

export const DetailsAndPreview: Story = {
  name: "Details + preview (clear confirm · product-type note)",
  render: () => (
    <div className="grid gap-8">
      <Frame label="Light details" style={lightVars} width={1440}>
        <DetailsDemo />
      </Frame>
      <Frame label="Dark preview" style={darkVars} width={768}>
        <FieldConflictPreviewModal
          preview={preview}
          entitiesById={new Map([["p1", { id: "p1", name: "Lava Ring", detail: "SKU LR-1" }]])}
          applying={false}
          resultMessage={null}
          onClose={() => undefined}
          onConfirm={() => undefined}
        />
      </Frame>
      <Frame label="Light result" style={lightVars} width={390}>
        <FieldConflictPreviewModal
          preview={preview}
          entitiesById={new Map([["p1", { id: "p1", name: "Lava Ring" }]])}
          applying={false}
          resultMessage="2 changes applied. The preview stays until you close it."
          onClose={() => undefined}
          onConfirm={() => undefined}
        />
      </Frame>
    </div>
  ),
};
