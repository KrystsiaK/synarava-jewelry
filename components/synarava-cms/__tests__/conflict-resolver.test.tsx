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
  baseValue: "Ring",
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

  it("shows blocked commerce fields without choice cells", async () => {
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
    const adapter = createAdapter({
      loadEntityFields: vi.fn(async () => ({ fields: [blocked] })),
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
    expect(await screen.findByText("Status")).toBeInTheDocument();
    expect(screen.getByText(/Cannot choose here/)).toBeInTheDocument();
    // Footer bulk select stays; no per-row Shopify/Synarava choice cells.
    expect(screen.queryByRole("button", { name: /Selected|Choose this value/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Take Shopify for all" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Apply (0)" })).toBeDisabled();
  });
});
