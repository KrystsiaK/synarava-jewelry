import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GenerateResult, ProductContentDraft } from "@/lib/ai/product-content/contract";

const mocks = vi.hoisted(() => ({
  generateProductContentAction: vi.fn(),
  pushToast: vi.fn(),
  saveProductAction: vi.fn(),
  pushSingleProductToShopifyAction: vi.fn(),
}));

vi.mock("@/app/admin/actions/ai-content", () => ({
  generateProductContentAction: (...args: unknown[]) => mocks.generateProductContentAction(...args),
}));

vi.mock("@/components/admin/shared/admin-toast", () => ({
  useAdminToast: () => ({ pushToast: mocks.pushToast }),
}));

vi.mock("@/app/admin/actions/products", () => ({
  saveProductAction: (...args: unknown[]) => mocks.saveProductAction(...args),
  deleteProductAction: vi.fn(),
  getSavedProductPayload: vi.fn(),
  updateProductMediaAltAction: vi.fn(),
  moveProductMediaAction: vi.fn(),
  removeProductMediaAction: vi.fn(),
  setPrimaryProductMediaAction: vi.fn(),
}));

vi.mock("@/app/admin/actions/sync", async () => {
  const { adminSyncActionMocks } = await import("@/test/mocks/admin-sync-actions");
  return {
    ...adminSyncActionMocks,
    pushSingleProductToShopifyAction: (...args: unknown[]) => mocks.pushSingleProductToShopifyAction(...args),
  };
});

vi.mock("@/app/admin/actions/taxonomy", () => ({
  searchShopifyTaxonomyCategoriesAction: vi.fn().mockResolvedValue({ categories: [] }),
  getShopifyCategoryAttributesAction: vi.fn().mockResolvedValue({ attributes: [] }),
}));

vi.mock("@/app/admin/actions/product-organization", () => ({
  listShopifyProductOrganizationAction: vi.fn().mockResolvedValue({ options: [] }),
}));

vi.mock("@/app/admin/actions/sku-assign", () => ({
  loadSkuAssignContext: vi.fn().mockResolvedValue({
    configured: false,
    familyKeys: [],
    currentSku: null,
    pending: false,
  }),
  previewProductSkuAction: vi.fn(),
  assignProductSkuAction: vi.fn(),
  resumePendingSkuAction: vi.fn(),
}));

vi.mock("@/lib/admin/preserve-scroll", () => ({
  refreshPreservingScroll: vi.fn(),
}));

import { EditProductForm } from "@/components/admin/products/product-edit-form";
import { AiContentGenerateControl } from "@/components/admin/products/ai-content-generate-control";
import { AiContentPreviewModal } from "@/components/admin/products/ai-content-preview-modal";
import { STALE_APPLY_MESSAGE } from "@/components/admin/products/ai-content-apply";
import type { ProductRecord } from "@/components/admin/products/product-types";
import { createRef } from "react";

function makeOkDraft(overrides: Partial<ProductContentDraft> = {}): ProductContentDraft {
  return {
    productId: "product-1",
    sourceUpdatedAt: "2026-01-02T00:00:00.000Z",
    locales: {
      en: {
        description: "<p>AI EN</p>",
        seoTitle: "AI SEO",
        seoDescription: "AI SEO desc",
      },
      pt: {
        title: "Anel AI",
        description: "<p>AI PT</p>",
      },
    },
    warnings: [{ locale: "en", field: "seoTitle", message: "Soft SEO warning" }],
    usage: {
      model: "gemini-test",
      inputTokens: 11,
      outputTokens: 22,
      costUsd: 0.0025,
      latencyMs: 400,
    },
    ...overrides,
  };
}

function makeProduct(overrides: Partial<ProductRecord> = {}): ProductRecord {
  return {
    id: "product-1",
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    publishedAt: null,
    slug: "lava-ring",
    sku: "LAVA-1",
    name: "Lava Ring",
    seriesLabel: null,
    shortDescription: null,
    description: null,
    materialLine: null,
    symbolismLabel: null,
    symbolismTitle: null,
    symbolismBody: null,
    symbolismBody2: null,
    details: null,
    imageUrl: null,
    primaryAssetId: null,
    priceCents: 4500,
    status: "DRAFT",
    visibility: "PRIVATE",
    shopifyProductId: null,
    shopifyHandle: null,
    shopifyCategoryId: null,
    shopifyCategoryName: null,
    shopifyUpdatedAt: null,
    lastSyncedAt: null,
    syncStatus: "UNLINKED",
    syncError: null,
    shopifySnapshot: null,
    extras: null,
    media: [],
    characteristics: [],
    variants: [],
    collections: [],
    tags: [],
    translations: [],
    ...overrides,
  } as ProductRecord;
}

describe("AiContentPreviewModal", () => {
  it("defaults checkboxes: empty checked, non-empty unchecked, warnings unchecked", () => {
    const draft = makeOkDraft({
      locales: {
        en: {
          description: "<p>new</p>",
          seoTitle: "warn me",
          seoDescription: "filled already proposed",
        },
        pt: { title: "Novo" },
      },
      warnings: [{ locale: "en", field: "seoTitle", message: "long" }],
    });

    render(
      <AiContentPreviewModal
        open
        draft={draft}
        productUpdatedAt={draft.sourceUpdatedAt}
        fingerprintAtGenerate="same"
        fingerprintNow="same"
        getCurrent={(locale, field) => {
          if (locale === "en" && field === "seoDescription") return "existing seo desc";
          return "";
        }}
        onClose={() => undefined}
        onApply={() => undefined}
      />,
    );

    const description = screen.getByLabelText("Description");
    const seoTitle = screen.getByLabelText("SEO title");
    const seoDescription = screen.getByLabelText("SEO description");
    const ptTitle = screen.getByLabelText("Title");

    expect(description).toBeChecked();
    expect(seoTitle).not.toBeChecked();
    expect(seoDescription).not.toBeChecked();
    expect(ptTitle).toBeChecked();
    expect(screen.getByTestId("ai-preview-warning-en-seoTitle")).toHaveTextContent("long");
    expect(screen.getByTestId("ai-content-usage")).toHaveTextContent("gemini-test");
  });

  it("blocks apply when stale and shows Russian message", () => {
    const onApply = vi.fn();
    const draft = makeOkDraft();
    render(
      <AiContentPreviewModal
        open
        draft={draft}
        productUpdatedAt="2026-01-03T00:00:00.000Z"
        fingerprintAtGenerate="a"
        fingerprintNow="a"
        getCurrent={() => ""}
        onClose={() => undefined}
        onApply={onApply}
      />,
    );

    expect(screen.getByTestId("ai-content-stale")).toHaveTextContent(STALE_APPLY_MESSAGE);
    expect(screen.getByTestId("ai-content-apply")).toBeDisabled();
    expect(onApply).not.toHaveBeenCalled();
  });

  it("moves focus into the dialog and labels apply control", async () => {
    const draft = makeOkDraft();
    render(
      <AiContentPreviewModal
        open
        draft={draft}
        productUpdatedAt={draft.sourceUpdatedAt}
        fingerprintAtGenerate="x"
        fingerprintNow="x"
        getCurrent={() => ""}
        onClose={() => undefined}
        onApply={() => undefined}
      />,
    );

    const dialog = await screen.findByRole("dialog", { name: "AI content preview" });
    expect(dialog).toBeInTheDocument();
    await waitFor(() => {
      expect(dialog.contains(document.activeElement)).toBe(true);
    });
    expect(screen.getByRole("button", { name: "Apply to form" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("sanitizes HTML through RichText (no raw script execution surface)", () => {
    const draft = makeOkDraft({
      locales: {
        en: { description: '<p>ok</p><script>alert(1)</script>' },
      },
      warnings: [],
    });
    const { container } = render(
      <AiContentPreviewModal
        open
        draft={draft}
        productUpdatedAt={draft.sourceUpdatedAt}
        fingerprintAtGenerate="x"
        fingerprintNow="x"
        getCurrent={() => ""}
        onClose={() => undefined}
        onApply={() => undefined}
      />,
    );
    expect(container.querySelector("script")).toBeNull();
    expect(screen.getByText("ok")).toBeInTheDocument();
  });
});

describe("AiContentGenerateControl", () => {
  beforeEach(() => {
    mocks.generateProductContentAction.mockReset();
    mocks.pushToast.mockReset();
  });

  it("toasts clear messages for generate error codes", async () => {
    const user = userEvent.setup();
    const formRef = createRef<HTMLFormElement>();
    mocks.generateProductContentAction.mockResolvedValue({
      ok: false,
      code: "rate_limited",
      message: "raw",
    } satisfies GenerateResult);

    render(
      <form ref={formRef}>
        <AiContentGenerateControl
          productId="product-1"
          productUpdatedAt="2026-01-02T00:00:00.000Z"
          availableLocales={["en", "pt"]}
          formRef={formRef}
          getCurrent={() => ""}
          onApplySelections={() => undefined}
        />
      </form>,
    );

    await user.click(screen.getByTestId("ai-content-generate-button"));
    await user.click(screen.getByTestId("ai-content-confirm-generate"));

    await waitFor(() => {
      expect(mocks.pushToast).toHaveBeenCalledWith({
        message: "Too many AI requests. Wait a moment and try again.",
        tone: "error",
      });
    });
  });

  it("maps budget_exhausted, timeout, provider_error, invalid_output, disabled", async () => {
    const user = userEvent.setup();
    const formRef = createRef<HTMLFormElement>();
    const codes = [
      ["budget_exhausted", "AI budget is exhausted for this period."],
      ["timeout", "AI generation timed out. Try again."],
      ["provider_error", "AI provider error. Try again later."],
      ["invalid_output", "AI returned invalid content. Try again."],
      ["disabled", "AI content generation is disabled."],
    ] as const;

    for (const [code, message] of codes) {
      mocks.generateProductContentAction.mockResolvedValueOnce({
        ok: false,
        code,
        message: "x",
      } satisfies GenerateResult);
      mocks.pushToast.mockClear();

      const { unmount } = render(
        <form ref={formRef}>
          <AiContentGenerateControl
            productId="product-1"
            productUpdatedAt="2026-01-02T00:00:00.000Z"
            availableLocales={["en"]}
            formRef={formRef}
            getCurrent={() => ""}
            onApplySelections={() => undefined}
          />
        </form>,
      );

      await user.click(screen.getByTestId("ai-content-generate-button"));
      await user.click(screen.getByTestId("ai-content-confirm-generate"));
      await waitFor(() => {
        expect(mocks.pushToast).toHaveBeenCalledWith({ message, tone: "error" });
      });
      unmount();
    }
  });
});

describe("EditProductForm AI wiring", () => {
  beforeEach(() => {
    mocks.generateProductContentAction.mockReset();
    mocks.pushToast.mockReset();
    mocks.saveProductAction.mockReset();
    mocks.pushSingleProductToShopifyAction.mockReset();
  });

  it("hides Generate with AI unless aiContentEnabled", () => {
    render(<EditProductForm product={makeProduct()} collections={[]} />);
    expect(screen.queryByTestId("ai-content-generate-button")).not.toBeInTheDocument();
  });

  it("shows the control when enabled and apply does not call save or push", async () => {
    const user = userEvent.setup();
    const draft = makeOkDraft({ warnings: [] });
    mocks.generateProductContentAction.mockResolvedValue({ ok: true, draft });

    render(
      <EditProductForm
        product={makeProduct()}
        collections={[]}
        translationLocales={[
          { code: "pt", label: "Português" },
          { code: "ru", label: "Русский" },
        ]}
        aiContentEnabled
      />,
    );

    expect(screen.getByTestId("ai-content-generate-button")).toBeInTheDocument();
    await user.click(screen.getByTestId("ai-content-generate-button"));

    const picker = screen.getByRole("dialog", { name: "Languages to generate" });
    expect(within(picker).getByLabelText("English")).toBeChecked();
    expect(within(picker).getByLabelText("Português")).toBeChecked();
    expect(within(picker).getByLabelText("Русский")).toBeChecked();

    await user.click(screen.getByTestId("ai-content-confirm-generate"));

    const preview = await screen.findByRole("dialog", { name: "AI content preview" });
    expect(preview).toBeInTheDocument();
    expect(screen.getByTestId("ai-content-apply")).not.toBeDisabled();

    await user.click(screen.getByTestId("ai-content-apply"));

    expect(mocks.saveProductAction).not.toHaveBeenCalled();
    expect(mocks.pushSingleProductToShopifyAction).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(mocks.pushToast).toHaveBeenCalledWith(
        expect.objectContaining({
          tone: "success",
          message: expect.stringContaining("applied to the form"),
        }),
      );
    });
    // Preview closes after apply — form state was updated without save/push.
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "AI content preview" })).not.toBeInTheDocument();
    });
  });

  it("blocks apply when draft sourceUpdatedAt is behind product.updatedAt", async () => {
    const user = userEvent.setup();
    const draft = makeOkDraft({
      sourceUpdatedAt: "2026-01-01T00:00:00.000Z",
      warnings: [],
    });
    mocks.generateProductContentAction.mockResolvedValue({ ok: true, draft });

    render(
      <EditProductForm
        product={makeProduct({ updatedAt: new Date("2026-01-02T00:00:00.000Z") })}
        collections={[]}
        translationLocales={[{ code: "pt", label: "Português" }]}
        aiContentEnabled
      />,
    );

    await user.click(screen.getByTestId("ai-content-generate-button"));
    await user.click(screen.getByTestId("ai-content-confirm-generate"));
    await screen.findByRole("dialog", { name: "AI content preview" });

    expect(screen.getByTestId("ai-content-stale")).toHaveTextContent(STALE_APPLY_MESSAGE);
    expect(screen.getByTestId("ai-content-apply")).toBeDisabled();
    expect(mocks.saveProductAction).not.toHaveBeenCalled();
  });
});
