import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ConflictResolver,
  type ConflictPreviewModel,
  type ConflictResolverAdapter,
} from "@/components/synarava-cms/conflict-resolver";
import type { CatalogConflictField } from "@/lib/shopify/catalog-conflict";

const field: CatalogConflictField = {
  fieldKey: "translation:pt:title",
  label: "Title",
  scope: { kind: "LOCALE", code: "pt", name: "Portuguese", nativeName: "Português" },
  origin: "TRANSLATION",
  targetKind: "NATIVE",
  synaravaValue: "Anel",
  shopifyValue: "Anel Shopify",
  localFingerprint: "local",
  shopifyFingerprint: "shopify",
  allowedDirections: ["SHOPIFY_TO_SYNARAVA", "SYNARAVA_TO_SHOPIFY"],
  blockedReason: null,
  sourceId: "d1",
};

const fieldB: CatalogConflictField = {
  ...field,
  fieldKey: "translation:pt:description",
  label: "Description",
  synaravaValue: "Local desc",
  shopifyValue: "Shopify desc",
  localFingerprint: "local-b",
  shopifyFingerprint: "shopify-b",
  sourceId: "d2",
};

function createAdapter(overrides: Partial<ConflictResolverAdapter> = {}): ConflictResolverAdapter {
  return {
    entityNoun: "product",
    entityNounPlural: "products",
    ariaLabel: "Product conflicts",
    loadEntityFields: vi.fn(async () => ({ fields: [field, fieldB] })),
    previewSelections: vi.fn(async (selections) => {
      const preview: ConflictPreviewModel = {
        truncated: false,
        excluded: [],
        entries: selections.map((item) => ({
          entityId: item.entityId,
          field: item.fieldKey === fieldB.fieldKey ? fieldB : field,
          direction: item.direction,
          willClearNonEmptyValue: false,
        })),
      };
      return { preview };
    }),
    applySelections: vi.fn(async ({ entries }) => ({
      outcome: {
        appliedCount: entries.length,
        failedCount: 0,
        results: entries.map((entry) => ({ entityId: entry.entityId, ok: true })),
      },
      success: `${entries.length} change applied.`,
    })),
    ...overrides,
  };
}

describe("ConflictResolver", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("selects a subset and applies only those rows via preview", async () => {
    const adapter = createAdapter();
    const onApplied = vi.fn();
    render(
      <ConflictResolver
        open
        onClose={vi.fn()}
        adapter={adapter}
        entityIds={["p1"]}
        entities={[{ id: "p1", name: "Lava Ring" }]}
        focusedEntityId="p1"
        onToast={vi.fn()}
        onApplied={onApplied}
      />,
    );

    expect(await screen.findByText("Title")).toBeInTheDocument();
    expect(screen.getByText("Description")).toBeInTheDocument();

    const apply = screen.getByRole("button", { name: "Apply (0)" });
    expect(apply).toBeDisabled();

    // Choose Shopify for Title only (first conflict row).
    const titleSection = screen.getByText("Title").closest("section");
    expect(titleSection).toBeTruthy();
    fireEvent.click(within(titleSection as HTMLElement).getByRole("button", { name: /Shopify/i }));

    expect(screen.getByRole("button", { name: "Apply (1)" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Apply (1)" }));

    await waitFor(() => {
      expect(adapter.previewSelections).toHaveBeenCalledWith([
        { entityId: "p1", fieldKey: "translation:pt:title", direction: "SHOPIFY_TO_SYNARAVA" },
      ]);
    });

    const preview = await screen.findByRole("dialog", { name: "Confirm changes before writing" });
    fireEvent.click(within(preview).getByRole("button", { name: "Confirm changes" }));

    await waitFor(() => {
      expect(adapter.applySelections).toHaveBeenCalledWith(expect.objectContaining({
        entries: [
          expect.objectContaining({
            entityId: "p1",
            fieldKey: "translation:pt:title",
            direction: "SHOPIFY_TO_SYNARAVA",
          }),
        ],
      }));
      expect(onApplied).toHaveBeenCalledWith({ entityIds: ["p1"], appliedCount: 1 });
    });
  });

  it("Take Shopify for all only selects — does not write until Apply + confirm", async () => {
    const adapter = createAdapter();
    render(
      <ConflictResolver
        open
        onClose={vi.fn()}
        adapter={adapter}
        entityIds={["p1"]}
        entities={[{ id: "p1", name: "Lava Ring" }]}
        focusedEntityId={null}
        onToast={vi.fn()}
      />,
    );

    await screen.findByText("Title");
    fireEvent.click(screen.getByRole("button", { name: "Take Shopify for all" }));
    expect(screen.getByRole("button", { name: "Apply (2)" })).toBeEnabled();
    expect(adapter.previewSelections).not.toHaveBeenCalled();
    expect(adapter.applySelections).not.toHaveBeenCalled();
  });

  it("click again clears a selection", async () => {
    const adapter = createAdapter();
    render(
      <ConflictResolver
        open
        onClose={vi.fn()}
        adapter={adapter}
        entityIds={["p1"]}
        entities={[{ id: "p1", name: "Lava Ring" }]}
        focusedEntityId={null}
        onToast={vi.fn()}
      />,
    );
    const titleSection = (await screen.findByText("Title")).closest("section") as HTMLElement;
    const shopifyCell = within(titleSection).getByRole("button", { name: /Shopify/i });
    fireEvent.click(shopifyCell);
    expect(screen.getByRole("button", { name: "Apply (1)" })).toBeEnabled();
    fireEvent.click(shopifyCell);
    expect(screen.getByRole("button", { name: "Apply (0)" })).toBeDisabled();
  });

  it("blocks confirm until clear-non-empty is acknowledged", async () => {
    const adapter = createAdapter({
      previewSelections: vi.fn(async () => ({
        preview: {
          truncated: false,
          excluded: [],
          entries: [{
            entityId: "p1",
            field,
            direction: "SHOPIFY_TO_SYNARAVA",
            willClearNonEmptyValue: true,
          }],
        },
      })),
    });
    render(
      <ConflictResolver
        open
        onClose={vi.fn()}
        adapter={adapter}
        entityIds={["p1"]}
        entities={[{ id: "p1", name: "Lava Ring" }]}
        focusedEntityId={null}
        onToast={vi.fn()}
      />,
    );
    const titleSection = (await screen.findByText("Title")).closest("section") as HTMLElement;
    fireEvent.click(within(titleSection).getByRole("button", { name: /Shopify/i }));
    fireEvent.click(screen.getByRole("button", { name: "Apply (1)" }));

    const dialog = await screen.findByRole("dialog", { name: "Confirm changes before writing" });
    const confirm = within(dialog).getByRole("button", { name: "Confirm changes" });
    expect(confirm).toBeDisabled();
    fireEvent.click(within(dialog).getByRole("checkbox"));
    expect(confirm).toBeEnabled();
  });

  it("makes blocked commerce fields selectable when whole-record is supported", async () => {
    const blocked: CatalogConflictField = {
      ...field,
      fieldKey: "commerce:status",
      label: "Status",
      scope: { kind: "SHARED" },
      origin: "COMMERCE",
      allowedDirections: [],
      blockedReason: "No safe field-by-field write yet",
      sourceId: null,
    };
    const applyWholeRecord = vi.fn(async () => ({ ok: true, success: "Whole item synced." }));
    const adapter = createAdapter({
      supportsWholeRecord: true,
      applyWholeRecord,
      loadEntityFields: vi.fn(async () => ({ fields: [blocked] })),
      previewSelections: vi.fn(async () => ({ preview: { truncated: false, excluded: [], entries: [] } })),
    });
    render(
      <ConflictResolver
        open
        onClose={vi.fn()}
        adapter={adapter}
        entityIds={["p1"]}
        entities={[{ id: "p1", name: "Lava Ring" }]}
        focusedEntityId={null}
        onToast={vi.fn()}
        onApplied={vi.fn()}
      />,
    );
    expect(await screen.findByText("Status")).toBeInTheDocument();
    expect(screen.getByText(/Whole-item sync/)).toBeInTheDocument();
    const statusSection = screen.getByText("Status").closest("section") as HTMLElement;
    fireEvent.click(within(statusSection).getByRole("button", { name: /Shopify/i }));
    fireEvent.click(screen.getByRole("button", { name: "Apply (1)" }));

    const preview = await screen.findByRole("dialog", { name: "Confirm changes before writing" });
    expect(within(preview).getByText(/Whole-item sync: Take Shopify/)).toBeInTheDocument();
    fireEvent.click(within(preview).getByRole("button", { name: "Confirm changes" }));

    await waitFor(() => {
      expect(applyWholeRecord).toHaveBeenCalledWith(
        "p1",
        "SHOPIFY_TO_SYNARAVA",
        expect.arrayContaining([
          expect.objectContaining({
            fieldKey: "commerce:status",
            expectedLocalFingerprint: blocked.localFingerprint,
            expectedShopifyFingerprint: blocked.shopifyFingerprint,
          }),
        ]),
      );
    });
  });

  it("still calls onApplied when applyWholeRecord throws after field entries were written", async () => {
    const onApplied = vi.fn();
    const onClose = vi.fn();
    const onToast = vi.fn();
    const applyWholeRecord = vi.fn(async () => {
      throw new Error("Shopify timed out mid-batch");
    });
    const adapter = createAdapter({
      supportsWholeRecord: true,
      applyWholeRecord,
      loadEntityFields: vi.fn(async () => ({
        fields: [
          field,
          {
            ...field,
            fieldKey: "commerce:status",
            label: "Status",
            origin: "COMMERCE" as const,
            allowedDirections: [] as CatalogConflictField["allowedDirections"],
            blockedReason: "No safe field-by-field write yet",
            sourceId: null,
          },
        ],
      })),
      previewSelections: vi.fn(async () => ({
        preview: {
          truncated: false,
          excluded: [],
          entries: [{
            entityId: "p1",
            field,
            direction: "SHOPIFY_TO_SYNARAVA" as const,
            willClearNonEmptyValue: false,
          }],
        },
      })),
      applySelections: vi.fn(async () => ({
        outcome: {
          appliedCount: 1,
          failedCount: 0,
          results: [{ entityId: "p1", ok: true, message: "Applied." }],
        },
        success: "1 change applied.",
      })),
    });
    render(
      <ConflictResolver
        open
        onClose={onClose}
        adapter={adapter}
        entityIds={["p1"]}
        entities={[{ id: "p1", name: "Lava Ring" }]}
        focusedEntityId={null}
        onToast={onToast}
        onApplied={onApplied}
      />,
    );
    expect(await screen.findByText("Title")).toBeInTheDocument();
    const titleSection = screen.getByText("Title").closest("section") as HTMLElement;
    fireEvent.click(within(titleSection).getByRole("button", { name: /Shopify/i }));
    const statusSection = screen.getByText("Status").closest("section") as HTMLElement;
    fireEvent.click(within(statusSection).getByRole("button", { name: /Shopify/i }));
    fireEvent.click(screen.getByRole("button", { name: "Apply (2)" }));
    const preview = await screen.findByRole("dialog", { name: "Confirm changes before writing" });
    fireEvent.click(within(preview).getByRole("button", { name: "Confirm changes" }));

    await waitFor(() => {
      expect(onApplied).toHaveBeenCalledWith({ entityIds: ["p1"], appliedCount: 1 });
    });
    expect(onClose).toHaveBeenCalled();
    expect(onToast).toHaveBeenCalledWith(expect.stringMatching(/timed out|failed/i), expect.any(String));
  });

  it("keeps blocked commerce non-selectable without whole-record support", async () => {
    const blocked: CatalogConflictField = {
      ...field,
      fieldKey: "commerce:status",
      label: "Status",
      scope: { kind: "SHARED" },
      origin: "COMMERCE",
      allowedDirections: [],
      blockedReason: "No safe field-by-field write yet for this collection field.",
      sourceId: null,
    };
    const adapter = createAdapter({
      supportsWholeRecord: false,
      loadEntityFields: vi.fn(async () => ({ fields: [blocked] })),
    });
    render(
      <ConflictResolver
        open
        onClose={vi.fn()}
        adapter={adapter}
        entityIds={["c1"]}
        entities={[{ id: "c1", name: "Kits" }]}
        focusedEntityId={null}
        onToast={vi.fn()}
      />,
    );
    expect(await screen.findByText("Status")).toBeInTheDocument();
    expect(screen.getByText(/Cannot choose here/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Apply (0)" })).toBeDisabled();
  });

  it("confirm preview shows plain-language headlines, before/after, and direction summary", async () => {
    const createField: CatalogConflictField = {
      ...field,
      fieldKey: "presence:collection",
      label: "Collection exists only in Synarava",
      scope: { kind: "SHARED" },
      origin: "PRESENCE",
      synaravaValue: "Pets · /pets",
      shopifyValue: "— Collection is missing —",
      allowedDirections: ["SYNARAVA_TO_SHOPIFY"],
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
    const priceField: CatalogConflictField = {
      ...field,
      fieldKey: "commerce:price",
      label: "Price",
      scope: { kind: "SHARED" },
      origin: "COMMERCE",
      synaravaValue: "120.00 EUR",
      shopifyValue: "110.00 EUR",
      sourceId: null,
    };
    const adapter = createAdapter({
      entityNoun: "collection",
      entityNounPlural: "collections",
      loadEntityFields: vi.fn(async () => ({ fields: [createField, priceField] })),
      previewSelections: vi.fn(async (selections) => ({
        preview: {
          truncated: false,
          excluded: [],
          entries: selections.map((item) => ({
            entityId: item.entityId,
            field: item.fieldKey === priceField.fieldKey ? priceField : createField,
            direction: item.direction,
            willClearNonEmptyValue: false,
          })),
        },
      })),
    });

    render(
      <ConflictResolver
        open
        onClose={vi.fn()}
        adapter={adapter}
        entityIds={["c-pets"]}
        entities={[{ id: "c-pets", name: "Pets" }]}
        focusedEntityId={null}
        onToast={vi.fn()}
      />,
    );

    await screen.findByText("Collection exists only in Synarava");
    fireEvent.click(screen.getByRole("button", { name: "Keep ours for all" }));
    fireEvent.click(screen.getByRole("button", { name: "Apply (2)" }));

    const preview = await screen.findByRole("dialog", { name: "Confirm changes before writing" });
    expect(within(preview).getByRole("heading", { name: 'Create "Pets" in Shopify' })).toBeInTheDocument();
    expect(within(preview).getByRole("heading", { name: "Update price in Shopify" })).toBeInTheDocument();
    expect(within(preview).getByText("Not in Shopify")).toBeInTheDocument();
    expect(within(preview).getByText("110.00 EUR")).toBeInTheDocument();
    expect(within(preview).getAllByText("120.00 EUR").length).toBeGreaterThanOrEqual(2);
    expect(within(preview).getByText("2 changes to Shopify · 0 changes to Synarava")).toBeInTheDocument();
    expect(within(preview).getByText("Nothing changes until you confirm.")).toBeInTheDocument();
    expect(within(preview).getByRole("button", { name: "Confirm changes" })).toBeEnabled();
  });

  it("Shopify-only list header shows title and /handle, never a synthetic id", async () => {
    const shopifyOnlyId = "shopify-collection:705203536203";
    const presence: CatalogConflictField = {
      ...field,
      fieldKey: "presence:collection",
      label: "Collection exists only in Shopify",
      scope: { kind: "SHARED" },
      origin: "PRESENCE",
      synaravaValue: "— Collection is missing —",
      shopifyValue: "Home page · /frontpage",
      allowedDirections: ["SHOPIFY_TO_SYNARAVA"],
      sourceId: null,
      presenceDifference: {
        id: shopifyOnlyId,
        kind: "SHOPIFY_ONLY",
        localProductId: null,
        shopifyProductId: "gid://shopify/Collection/705203536203",
        name: "Home page",
        handle: "frontpage",
        sku: "",
        localFingerprint: "missing",
        shopifyFingerprint: "s",
        remoteMissing: false,
        matchReason: null,
        localIdentity: null,
        shopifyIdentity: { name: "Home page", handle: "frontpage", sku: "" },
      },
    };
    const adapter = createAdapter({
      entityNoun: "collection",
      entityNounPlural: "collections",
      loadEntityFields: vi.fn(async () => ({ fields: [presence] })),
    });

    render(
      <ConflictResolver
        open
        onClose={vi.fn()}
        adapter={adapter}
        entityIds={[shopifyOnlyId]}
        entities={[{ id: shopifyOnlyId, name: shopifyOnlyId }]}
        focusedEntityId={null}
        onToast={vi.fn()}
      />,
    );

    expect(await screen.findByRole("heading", { level: 3, name: "Home page" })).toBeInTheDocument();
    expect(screen.getByText("/frontpage")).toBeInTheDocument();
    expect(screen.queryByText(shopifyOnlyId)).not.toBeInTheDocument();
  });
});
