"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";

import {
  autosaveProductDraftAction,
  deleteProductAction,
  saveProductAction,
  updateProductStatusAction,
  type ProductActionState,
  type SavedCategoryPayload,
  type SavedProductPayload,
  type SavedTagPayload,
} from "@/app/admin/actions";
import { AdminConfirmModal } from "@/components/admin/admin-confirm-modal";
import { AdminHelp } from "@/components/admin/admin-help";
import { AdminIssueInlineWarning } from "@/components/admin/admin-issues-cms";
import type { AdminIssueSummary } from "@/components/admin/admin-issue-types";
import { AdminRecordDates, AdminRecordMetaModal } from "@/components/admin/admin-record-meta";
import { useAdminToast } from "@/components/admin/admin-toast";
import { slugifyForAdmin } from "@/components/admin/slug-utils";
import { AuthMessage } from "@/components/auth/auth-form-primitives";
import { ImageFileField } from "@/components/admin/image-file-field";
import { LocaleTabStrip } from "@/components/admin/admin-primitives";
import { useDraftAutosave } from "@/components/admin/use-draft-autosave";
import {
  fallbackProductLookbook,
  fallbackProductMaterials,
  fallbackProductProcess,
  parseProductDetails,
} from "@/lib/content/catalog";

type CategoryOption = SavedCategoryPayload;
type TagOption = SavedTagPayload;
type CollectionOption = { id: string; slug: string; name: string };
type ProductRecord = SavedProductPayload;

type ProductCmsProps = {
  initialProducts: ProductRecord[];
  categories: CategoryOption[];
  tags: TagOption[];
  collections: CollectionOption[];
  issues?: AdminIssueSummary[];
};

type ProductDraft = {
  name: string;
  slug: string;
  sku: string;
  price: string;
  seriesLabel: string;
  shortDescription: string;
  description: string;
  materialLine: string;
  symbolismLabel: string;
  symbolismTitle: string;
  symbolismBody: string;
  symbolismBody2: string;
  categorySlug: string;
  collectionSlug: string;
  tags: string;
  workflowState: "DRAFT" | "PUBLISHED";
  imageUrl: string;
};

function centsToPrice(cents: number) {
  return (cents / 100).toFixed(2);
}

function getProductEditorDetails(details: unknown) {
  const parsed = parseProductDetails(details);

  const materials = Array.from({ length: 3 }, (_, index) => {
    const source = parsed.materials?.[index] ?? fallbackProductMaterials[index];
    return {
      title: source?.title ?? "",
      body: source?.body ?? "",
      image: source?.image ?? "",
    };
  });

  const process = {
    eyebrow: parsed.process?.eyebrow ?? fallbackProductProcess.eyebrow,
    title: parsed.process?.title ?? fallbackProductProcess.title,
    mediaImage: parsed.process?.mediaImage ?? fallbackProductProcess.mediaImage,
    stats: Array.from({ length: 4 }, (_, index) => {
      const source = parsed.process?.stats?.[index] ?? fallbackProductProcess.stats[index];
      return { value: source?.value ?? "", label: source?.label ?? "" };
    }),
  };

  const lookbook = Array.from({ length: 4 }, (_, index) => {
    const source = parsed.lookbook?.[index] ?? fallbackProductLookbook[index];
    return {
      src: source?.src ?? "",
      label: source?.label ?? "",
      featured: Boolean(source?.featured),
    };
  });

  return { materials, process, lookbook };
}

function emptyDraft(): ProductDraft {
  return {
    name: "", slug: "", sku: "", price: "", seriesLabel: "",
    shortDescription: "", description: "", materialLine: "",
    symbolismLabel: "", symbolismTitle: "", symbolismBody: "",
    symbolismBody2: "", categorySlug: "", collectionSlug: "",
    tags: "", workflowState: "DRAFT", imageUrl: "",
  };
}

function productToDraft(product: ProductRecord): ProductDraft {
  return {
    name: product.name,
    slug: product.slug,
    sku: product.sku,
    price: centsToPrice(product.priceCents),
    seriesLabel: product.seriesLabel ?? "",
    shortDescription: product.shortDescription ?? "",
    description: product.description ?? "",
    materialLine: product.materialLine ?? "",
    symbolismLabel: product.symbolismLabel ?? "",
    symbolismTitle: product.symbolismTitle ?? "",
    symbolismBody: product.symbolismBody ?? "",
    symbolismBody2: product.symbolismBody2 ?? "",
    categorySlug: product.category?.slug ?? "",
    collectionSlug: product.collections[0]?.collection.slug ?? "",
    tags: product.tags.map((item) => item.tag.slug).join(", "),
    workflowState:
      product.status === "ACTIVE" && product.visibility === "PUBLIC"
        ? "PUBLISHED"
        : "DRAFT",
    imageUrl: product.imageUrl ?? "",
  };
}

function normalizeProducts(items: ProductRecord[]) {
  return [...items].sort((left, right) => right.name.localeCompare(left.name));
}

function ProgressBar({ pending }: { pending: boolean }) {
  return (
    <div className="adm-progress-bar">
      <div
        className={[
          "adm-progress-fill",
          pending ? "adm-progress-fill--active" : "",
        ].join(" ")}
      />
    </div>
  );
}

function SaveButtons({
  onOpenConfirm,
  pending,
}: {
  onOpenConfirm: () => void;
  pending: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onOpenConfirm}
      disabled={pending}
      className="adm-btn-primary"
    >
      {pending ? "Saving..." : "Save product"}
    </button>
  );
}

function productStatusLabel(product: ProductRecord) {
  if (product.status === "ARCHIVED") return "ARCHIVED";
  return product.status === "ACTIVE" && product.visibility === "PUBLIC" ? "PUBLISHED" : "DRAFT";
}

function issuesForField(issues: AdminIssueSummary[], fieldPath: string) {
  return issues.filter((issue) => issue.fieldPath === fieldPath && issue.status === "OPEN");
}

type ProductRowAction = {
  product: ProductRecord;
  action: "publish" | "draft" | "archive" | "delete";
};

function productActionCopy(target: ProductRowAction) {
  const name = target.product.name;
  if (target.action === "publish") {
    return {
      title: `Publish ${name}`,
      description:
        "This will make the product visible on the storefront and product listings. Customers may be able to view and add it to cart immediately.",
      confirmLabel: "Publish product",
      tone: "default" as const,
    };
  }
  if (target.action === "draft") {
    return {
      title: `Move ${name} to draft`,
      description:
        "This will remove the product from public listings and direct public product pages. Existing order history remains unchanged.",
      confirmLabel: "Move to draft",
      tone: "default" as const,
    };
  }
  if (target.action === "archive") {
    return {
      title: `Archive ${name}`,
      description:
        "This will hide the product from the storefront and keep the record in admin for later recovery. Use this instead of permanent delete when you may need history or content back.",
      confirmLabel: "Archive product",
      tone: "danger" as const,
    };
  }
  return {
    title: `Permanently delete ${name}`,
    description:
      "This permanently removes the product record and related product media, variants, tags, and collection links. Public product URLs will stop working. Prefer Archive unless you are certain.",
    confirmLabel: "Delete permanently",
    tone: "danger" as const,
  };
}

function ProductDetailFields({
  details,
  mode,
  issues = [],
}: {
  details: ReturnType<typeof getProductEditorDetails>;
  mode: "create" | "edit";
  issues?: AdminIssueSummary[];
}) {
  return (
    <div
      className="grid gap-6 pt-5"
      style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
    >
      <div>
        <p className="adm-label-row">
          <span className="adm-section-tag">[ PRODUCT DETAIL PAGE ]</span>
          <AdminHelp>
            Materials, process story, and lookbook blocks feed the public product detail page.
          </AdminHelp>
        </p>
      </div>

      {/* Materials */}
      <section
        className="grid gap-4 p-4"
        style={{ border: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div>
          <p className="adm-label-row">
            <span className="adm-label">Materials</span>
            <AdminHelp>Three material cards shown on the storefront product detail page.</AdminHelp>
          </p>
        </div>
        <div className="grid gap-4 xl:grid-cols-3">
          {details.materials.map((material, index) => (
            <div
              key={`material-${index}`}
              id={`field-details-materials-${index}-image`}
              className="grid gap-3 p-4"
              style={{ border: "1px solid rgba(255,255,255,0.05)" }}
            >
              <p className="adm-section-tag">MATERIAL {index + 1}</p>
              <AdminIssueInlineWarning issues={issuesForField(issues, `field-details-materials-${index}-image`)} />
              <input
                name={`materialTitle${index + 1}`}
                defaultValue={material.title}
                placeholder="Lava Stone"
                className="adm-field"
              />
              <textarea
                name={`materialBody${index + 1}`}
                rows={4}
                defaultValue={material.body}
                placeholder="Describe the material story."
                className="adm-field"
              />
              <input
                type="hidden"
                name={`existingMaterialImage${index + 1}`}
                value={material.image}
              />
              <ImageFileField
                name={`materialImageFile${index + 1}`}
                currentImageUrl={mode === "edit" ? material.image : ""}
                currentImageAlt={material.title || `Material ${index + 1}`}
                removeFieldName={`removeMaterialImage${index + 1}`}
                removeLabel="Remove"
              />
            </div>
          ))}
        </div>
      </section>

      {/* Process */}
      <section
        className="grid gap-4 p-4"
        style={{ border: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div>
          <p className="adm-label-row">
            <span className="adm-label">Process</span>
            <AdminHelp>Craftsmanship section with media and stats.</AdminHelp>
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <input
            name="processEyebrow"
            defaultValue={details.process.eyebrow}
            placeholder="Process"
            className="adm-field"
          />
          <input
            name="processTitle"
            defaultValue={details.process.title}
            placeholder="Human Precision"
            className="adm-field"
          />
        </div>
        <input
          type="hidden"
          name="existingProcessMediaImage"
          value={details.process.mediaImage}
        />
        <ImageFileField
          name="processMediaImageFile"
          currentImageUrl={mode === "edit" ? details.process.mediaImage : ""}
          currentImageAlt={details.process.title || "Process media"}
          currentImageLabel="Current process media"
          previewAspect="video"
          fieldId="field-details-process-mediaImage"
          removeFieldName="removeProcessMediaImage"
          removeLabel="Remove"
        />
        <AdminIssueInlineWarning issues={issuesForField(issues, "field-details-process-mediaImage")} />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {details.process.stats.map((stat, index) => (
            <div
              key={`process-stat-${index}`}
              className="grid gap-3 p-3"
              style={{ border: "1px solid rgba(255,255,255,0.05)" }}
            >
              <p className="adm-section-tag">STAT {index + 1}</p>
              <input
                name={`processStatValue${index + 1}`}
                defaultValue={stat.value}
                placeholder="12"
                className="adm-field"
              />
              <input
                name={`processStatLabel${index + 1}`}
                defaultValue={stat.label}
                placeholder="Hours of weaving"
                className="adm-field"
              />
            </div>
          ))}
        </div>
      </section>

      {/* Lookbook */}
      <section
        className="grid gap-4 p-4"
        style={{ border: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div>
          <p className="adm-label-row">
            <span className="adm-label">Lookbook</span>
            <AdminHelp>Gallery blocks used in the pairing guide and lookbook section.</AdminHelp>
          </p>
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          {details.lookbook.map((item, index) => (
            <div
              key={`lookbook-${index}`}
              id={`field-details-lookbook-${index}-src`}
              className="grid gap-3 p-4"
              style={{ border: "1px solid rgba(255,255,255,0.05)" }}
            >
              <AdminIssueInlineWarning issues={issuesForField(issues, `field-details-lookbook-${index}-src`)} />
              <div className="flex items-center justify-between gap-3">
                <p className="adm-section-tag">LOOKBOOK {index + 1}</p>
                <label
                  className="flex items-center gap-2 text-[0.68rem] font-bold uppercase tracking-[0.08em] cursor-pointer"
                  style={{ color: "var(--adm-muted)" }}
                >
                  <input
                    type="checkbox"
                    name={`lookbookFeatured${index + 1}`}
                    defaultChecked={item.featured}
                  />
                  Featured
                </label>
              </div>
              <input
                name={`lookbookLabel${index + 1}`}
                defaultValue={item.label}
                placeholder="01 / The Ensemble"
                className="adm-field"
              />
              <input
                type="hidden"
                name={`existingLookbookImage${index + 1}`}
                value={item.src}
              />
              <ImageFileField
                name={`lookbookImageFile${index + 1}`}
                currentImageUrl={mode === "edit" ? item.src : ""}
                currentImageAlt={item.label || `Lookbook ${index + 1}`}
                removeFieldName={`removeLookbookImage${index + 1}`}
                removeLabel="Remove"
              />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function ProductFormFields({
  draft,
  categories,
  collections,
  issues = [],
}: {
  draft: ProductDraft;
  categories: CategoryOption[];
  collections: CollectionOption[];
  issues?: AdminIssueSummary[];
}) {
  const [nameValue, setNameValue] = useState(draft.name);
  const [slugValue, setSlugValue] = useState(draft.slug);
  const [slugLocked, setSlugLocked] = useState(Boolean(draft.slug));

  function updateName(value: string) {
    setNameValue(value);
    if (!slugLocked) {
      setSlugValue(slugifyForAdmin(value));
    }
  }

  function updateSlug(value: string) {
    if (!value.trim()) {
      setSlugValue(slugifyForAdmin(nameValue));
      setSlugLocked(false);
      return;
    }

    setSlugValue(value);
    setSlugLocked(true);
  }

  return (
    <>
      {/* i18n groundwork */}
      <LocaleTabStrip />

      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2">
          <span className="adm-label">Name</span>
          <input
            name="name"
            value={nameValue}
            onChange={(event) => updateName(event.target.value)}
            className="adm-field"
          />
        </label>
        <label className="grid gap-2">
          <span className="adm-label">Slug</span>
          <input
            name="slug"
            value={slugValue}
            onChange={(event) => updateSlug(event.target.value)}
            className="adm-field"
          />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <label className="grid gap-2">
          <span className="adm-label">SKU</span>
          <input name="sku" defaultValue={draft.sku} className="adm-field" />
        </label>
        <label className="grid gap-2">
          <span className="adm-label">Series label</span>
          <input name="seriesLabel" defaultValue={draft.seriesLabel} className="adm-field" />
        </label>
        <label className="grid gap-2">
          <span className="adm-label">Price EUR</span>
          <input
            name="price"
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            defaultValue={draft.price}
            className="adm-field"
          />
        </label>
      </div>

      <label className="grid gap-2">
        <span className="adm-label">Short description</span>
        <textarea
          name="shortDescription"
          rows={3}
          defaultValue={draft.shortDescription}
          className="adm-field"
        />
      </label>

      <label className="grid gap-2">
        <span className="adm-label">Description</span>
        <textarea
          name="description"
          rows={4}
          defaultValue={draft.description}
          className="adm-field"
        />
      </label>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2">
          <span className="adm-label">Material line</span>
          <input name="materialLine" defaultValue={draft.materialLine} className="adm-field" />
        </label>
        <label id="field-imageUrl" className="grid gap-2">
          <span className="adm-label">Product image</span>
          <AdminIssueInlineWarning issues={issuesForField(issues, "field-imageUrl")} />
          <input type="hidden" name="existingImageUrl" value={draft.imageUrl} />
          <ImageFileField
            name="imageFile"
            currentImageUrl={draft.imageUrl}
            currentImageAlt={draft.name || "Product image"}
            removeFieldName="removeImage"
            removeLabel="Remove"
          />
        </label>
      </div>

      {/* Symbolism */}
      <div
        className="grid gap-4 pt-4"
        style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div>
          <p className="adm-label-row">
            <span className="adm-section-tag">[ PRODUCT SYMBOLISM OVERRIDE ]</span>
            <AdminHelp>If empty, the product page falls back to the selected collection defaults.</AdminHelp>
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <input
            name="symbolismLabel"
            defaultValue={draft.symbolismLabel}
            placeholder="Symbolic Language"
            className="adm-field"
          />
          <input
            name="symbolismTitle"
            defaultValue={draft.symbolismTitle}
            placeholder="Wood, Lava, Embroidery"
            className="adm-field"
          />
        </div>
        <textarea
          name="symbolismBody"
          rows={4}
          defaultValue={draft.symbolismBody}
          className="adm-field"
        />
        <textarea
          name="symbolismBody2"
          rows={3}
          defaultValue={draft.symbolismBody2}
          className="adm-field"
        />
      </div>

      {/* Taxonomy + state */}
      <div className="grid gap-4 md:grid-cols-3">
        <div id="field-taxonomy-category" className="grid gap-2">
          <AdminIssueInlineWarning issues={issuesForField(issues, "field-taxonomy-category")} />
          <select name="categorySlug" defaultValue={draft.categorySlug} className="adm-field">
            <option value="">No category</option>
            {categories.map((category) => (
              <option key={category.id} value={category.slug}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
        <div id="field-taxonomy-collection" className="grid gap-2">
          <AdminIssueInlineWarning issues={issuesForField(issues, "field-taxonomy-collection")} />
          <select name="collectionSlug" defaultValue={draft.collectionSlug} className="adm-field">
            <option value="">No collection</option>
            {collections.map((collection) => (
              <option key={collection.id} value={collection.slug}>
                {collection.name}
              </option>
            ))}
          </select>
        </div>
        <div id="field-taxonomy-tags" className="grid gap-2">
          <AdminIssueInlineWarning issues={issuesForField(issues, "field-taxonomy-tags")} />
          <input
            name="tags"
            defaultValue={draft.tags}
            placeholder="lava, heritage, symbolic"
            className="adm-field"
          />
        </div>
      </div>

      <label className="grid gap-2 md:max-w-xs">
        <span className="adm-label">Storefront state</span>
        <select name="workflowState" defaultValue={draft.workflowState} className="adm-field">
          <option value="DRAFT">Draft — hidden</option>
          <option value="PUBLISHED">Published — visible</option>
        </select>
      </label>
    </>
  );
}

export function CreateProductForm({
  categories,
  collections,
  onCreated,
}: {
  categories: CategoryOption[];
  collections: CollectionOption[];
  onCreated?: (product: ProductRecord) => void;
}) {
  const [state, setState] = useState<ProductActionState>({});
  const [isPending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [draftId, setDraftId] = useState("");
  const [draft] = useState<ProductDraft>(emptyDraft);
  const formRef = useRef<HTMLFormElement>(null);
  const { pushToast } = useAdminToast();

  useDraftAutosave({
    formRef,
    saveDraft: autosaveProductDraftAction,
    onSaved: (result) => {
      if (result.recordId) setDraftId(result.recordId);
    },
  });

  async function formAction(formData: FormData) {
    startTransition(async () => {
      const result = await saveProductAction(formData);
      setState(result);
      setConfirmOpen(false);
      if (result.error) pushToast({ message: result.error, tone: "error" });
      if (result.success) pushToast({ message: result.success, tone: "success" });

      if (result.product) {
        onCreated?.(result.product);
      }

      if (result.success && result.created) {
        formRef.current?.reset();
      }
    });
  }

  return (
    <>
      <form ref={formRef} action={formAction} className="adm-panel grid gap-4 p-5">
        <input type="hidden" name="productId" value={draftId} />
        <div
          className="flex items-center justify-between gap-4 pb-4"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div>
            <p className="adm-section-tag">[ NEW UNIT ]</p>
            <h2 className="adm-title-sm mt-2">
              Create product
            </h2>
          </div>
          <SaveButtons onOpenConfirm={() => setConfirmOpen(true)} pending={isPending} />
        </div>

        <ProgressBar pending={isPending} />
        <AuthMessage error={state.error} />
        <div>
          <AdminHelp label="Publishing guidance">
            Saving updates the database. Published products can immediately affect the public storefront.
          </AdminHelp>
        </div>

        <ProductFormFields draft={draft} categories={categories} collections={collections} />
        <ProductDetailFields details={getProductEditorDetails(null)} mode="create" />

        <div
          className="flex items-center justify-end pt-4"
          style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
        >
          <SaveButtons onOpenConfirm={() => setConfirmOpen(true)} pending={isPending} />
        </div>
      </form>

      <AdminConfirmModal
        open={confirmOpen}
        title="Create product"
        description="This will save a new product record to the database. If the product is marked as Published, it can become visible on the storefront immediately after save."
        confirmLabel="Continue and save"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => formRef.current?.requestSubmit()}
        pending={isPending}
      />
    </>
  );
}

export function EditProductForm({
  product,
  categories,
  collections,
  issues = [],
  onUpdated,
  onDeleted,
  highlighted = false,
}: {
  product: ProductRecord;
  categories: CategoryOption[];
  collections: CollectionOption[];
  issues?: AdminIssueSummary[];
  onUpdated?: (product: ProductRecord) => void;
  onDeleted?: (productId: string) => void;
  highlighted?: boolean;
}) {
  const [state, setState] = useState<ProductActionState>({});
  const [isPending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);
  const draft = productToDraft(product);
  const details = getProductEditorDetails(product.details);
  const { pushToast } = useAdminToast();

  useEffect(() => {
    if (!highlighted || !rowRef.current) return;
    rowRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [highlighted]);

  async function formAction(formData: FormData) {
    startTransition(async () => {
      const result = await saveProductAction(formData);
      setState(result);
      setConfirmOpen(false);
      if (result.error) pushToast({ message: result.error, tone: "error" });
      if (result.success) pushToast({ message: result.success, tone: "success" });
      if (result.product) {
        onUpdated?.(result.product);
      }
    });
  }

  async function handleDelete(formData: FormData) {
    startTransition(async () => {
      const result = await deleteProductAction(formData);
      setState(result);
      setDeleteOpen(false);
      if (result.error) pushToast({ message: result.error, tone: "error" });
      if (result.success) pushToast({ message: result.success, tone: "success" });
      if (result.deletedProductId) {
        onDeleted?.(result.deletedProductId);
      }
    });
  }

  return (
    <>
      <div
        ref={rowRef}
        className="adm-panel grid gap-4 p-5 transition-colors"
        style={{
          ...(highlighted
            ? { background: "var(--adm-accent-soft)", outline: "1px solid var(--adm-border-strong)" }
            : {}),
        }}
      >
        <form action={formAction} className="grid gap-4">
          <input type="hidden" name="productId" value={product.id} />

          <div
            className="flex flex-wrap items-start justify-between gap-4 pb-4"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
          >
            <div>
              <p className="adm-section-tag">[ EDIT PRODUCT ]</p>
              <h3 className="adm-title-sm mt-2">{product.name}</h3>
              <p className="mt-1 text-xs" style={{ color: "var(--adm-muted)" }}>
                /{product.slug}
              </p>
              <AdminIssueInlineWarning issues={issues} className="mt-3" />
              {highlighted ? (
                <p
                  className="mt-1 text-xs font-bold uppercase tracking-[0.08em]"
                  style={{ color: "var(--adm-accent)" }}
                >
                  Just created
                </p>
              ) : null}
            </div>
            <SaveButtons onOpenConfirm={() => setConfirmOpen(true)} pending={isPending} />
          </div>

          <ProgressBar pending={isPending} />
          <AuthMessage error={state.error} />

          <ProductFormFields
            draft={draft}
            categories={categories}
            collections={collections}
            issues={issues}
          />
          <ProductDetailFields details={details} mode="edit" issues={issues} />

          <div
            className="flex items-center justify-between gap-4 pt-4"
            style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
          >
            <button
              type="button"
              onClick={() => setDeleteOpen(true)}
              disabled={isPending}
              className="adm-btn-danger"
            >
              Delete product
            </button>
            <SaveButtons onOpenConfirm={() => setConfirmOpen(true)} pending={isPending} />
          </div>
        </form>
      </div>

      <AdminConfirmModal
        open={confirmOpen}
        title={`Save ${product.name}`}
        description="This will write changes to the database. If the product is in Published state, changes can immediately affect the storefront product page and listings."
        confirmLabel="Yes, save changes"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          const form = rowRef.current?.querySelector("form");
          if (form instanceof HTMLFormElement) form.requestSubmit();
        }}
        pending={isPending}
      />

      <AdminConfirmModal
        open={deleteOpen}
        title={`Delete ${product.name}`}
        description="This action removes the product record permanently. Public storefront pages for this item will stop working after deletion."
        confirmLabel="Yes, delete permanently"
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => {
          const formData = new FormData();
          formData.set("productId", product.id);
          formData.set("productSlug", product.slug);
          void handleDelete(formData);
        }}
        pending={isPending}
        tone="danger"
      />
    </>
  );
}

export function ProductsCms({
  initialProducts,
  categories,
  tags,
  collections,
  issues = [],
}: ProductCmsProps) {
  const [products, setProducts] = useState<ProductRecord[]>(() =>
    normalizeProducts(initialProducts),
  );
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [collectionFilter, setCollectionFilter] = useState("ALL");
  const [rowAction, setRowAction] = useState<ProductRowAction | null>(null);
  const [editingProduct, setEditingProduct] = useState<ProductRecord | null>(null);
  const [rowActionState, setRowActionState] = useState<ProductActionState>({});
  const [isRowActionPending, startRowActionTransition] = useTransition();
  const { pushToast } = useAdminToast();

  function handleUpdated(product: ProductRecord) {
    setProducts((current) =>
      normalizeProducts(current.map((item) => (item.id === product.id ? product : item))),
    );
  }

  function handleDeleted(productId: string) {
    setProducts((current) => current.filter((item) => item.id !== productId));
  }

  function runRowAction() {
    if (!rowAction) return;

    startRowActionTransition(async () => {
      const formData = new FormData();
      formData.set("productId", rowAction.product.id);

      if (rowAction.action === "delete") {
        formData.set("productSlug", rowAction.product.slug);
        const result = await deleteProductAction(formData);
        setRowActionState(result);
        if (result.error) pushToast({ message: result.error, tone: "error" });
        if (result.success) pushToast({ message: result.success, tone: "success" });
        if (result.deletedProductId) {
          handleDeleted(result.deletedProductId);
        }
      } else {
        formData.set("action", rowAction.action);
        const result = await updateProductStatusAction(formData);
        setRowActionState(result);
        if (result.error) pushToast({ message: result.error, tone: "error" });
        if (result.success) pushToast({ message: result.success, tone: "success" });
        if (result.product) {
          handleUpdated(result.product);
        }
      }

      setRowAction(null);
    });
  }

  const modalCopy = rowAction ? productActionCopy(rowAction) : null;
  const normalizedQuery = query.trim().toLowerCase();
  const desktopTableGridClass =
    "lg:grid-cols-[minmax(18rem,24rem)_8.5rem_8.5rem_11rem_minmax(24rem,1fr)]";
  const filteredProducts = products.filter((product) => {
    const status = productStatusLabel(product);
    const matchesQuery =
      !normalizedQuery ||
      [product.name, product.slug, product.sku, product.seriesLabel ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    const matchesStatus = statusFilter === "ALL" || status === statusFilter;
    const matchesCategory =
      categoryFilter === "ALL" || product.category?.slug === categoryFilter;
    const matchesCollection =
      collectionFilter === "ALL" ||
      product.collections.some((item) => item.collection.slug === collectionFilter);

    return matchesQuery && matchesStatus && matchesCategory && matchesCollection;
  });

  return (
    <section className="grid gap-6">
      <div className="adm-panel p-5">
        <div
          className="flex flex-col gap-3 pb-4 md:flex-row md:items-end md:justify-between"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div>
            <p className="adm-section-tag">[ CURRENT CATALOG ]</p>
            <h2 className="adm-title-sm mt-2">Products table</h2>
            <p className="mt-1 text-xs" style={{ color: "var(--adm-muted)" }}>
              {categories.length} categories · {tags.length} tags · {collections.length} collections
            </p>
          </div>
          <Link href="/admin/products/new" className="adm-btn-primary">
            New product
          </Link>
        </div>

        <div
          className="grid gap-3 py-4 md:grid-cols-[minmax(16rem,1fr)_10rem_12rem_12rem]"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          <label className="grid gap-2">
            <span className="adm-label">Search</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Name, slug, SKU"
              className="adm-field"
            />
          </label>
          <label className="grid gap-2">
            <span className="adm-label">Status</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="adm-field"
            >
              <option value="ALL">All</option>
              <option value="PUBLISHED">Published</option>
              <option value="DRAFT">Draft</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </label>
          <label className="grid gap-2">
            <span className="adm-label">Category</span>
            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              className="adm-field"
            >
              <option value="ALL">All categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.slug}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2">
            <span className="adm-label">Collection</span>
            <select
              value={collectionFilter}
              onChange={(event) => setCollectionFilter(event.target.value)}
              className="adm-field"
            >
              <option value="ALL">All collections</option>
              {collections.map((collection) => (
                <option key={collection.id} value={collection.slug}>
                  {collection.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <AuthMessage error={rowActionState.error} />

        <div className="mt-4 overflow-x-auto lg:pb-1">
          <div className="grid gap-2 lg:min-w-[74rem]">
            <div
              className={`hidden gap-3 px-3 pb-1 lg:grid ${desktopTableGridClass}`}
              style={{ color: "var(--adm-subtle)" }}
            >
              <span className="text-[0.62rem] font-bold uppercase tracking-[0.1em]">Product</span>
              <span className="text-[0.62rem] font-bold uppercase tracking-[0.1em]">Status</span>
              <span className="text-[0.62rem] font-bold uppercase tracking-[0.1em]">Price</span>
              <span className="text-[0.62rem] font-bold uppercase tracking-[0.1em]">Category</span>
              <span className="text-[0.62rem] font-bold uppercase tracking-[0.1em] text-right">Actions</span>
            </div>

            {filteredProducts.length > 0 ? (
              filteredProducts.map((product) => {
                const status = productStatusLabel(product);
                const productIssues = issues.filter(
                  (issue) => issue.entityType === "PRODUCT" && issue.entityId === product.id,
                );

                return (
                  <div
                    key={product.id}
                    className={`grid gap-3 p-3 lg:items-center ${desktopTableGridClass}`}
                    style={{
                      border: "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    <div>
                      <p className="text-sm font-semibold" style={{ color: "var(--adm-ink)" }}>
                        {product.name}
                      </p>
                      <p className="mt-0.5 text-xs" style={{ color: "var(--adm-muted)" }}>
                        /{product.slug}
                      </p>
                      <AdminRecordDates record={product} />
                      {productIssues.length > 0 ? (
                        <Link
                          href={productIssues[0]?.targetHref ?? `/admin/products/${product.id}`}
                          className="mt-2 inline-flex items-center text-[0.62rem] font-bold uppercase tracking-[0.08em]"
                          style={{ color: "var(--adm-danger)" }}
                        >
                          {productIssues.length} problem{productIssues.length === 1 ? "" : "s"}
                        </Link>
                      ) : null}
                    </div>
                    <span className={status === "PUBLISHED" ? "adm-badge-published" : "adm-badge-draft"}>
                      {status}
                    </span>
                    <span className="text-xs font-semibold" style={{ color: "var(--adm-muted)" }}>
                      {centsToPrice(product.priceCents)} EUR
                    </span>
                    <span className="text-xs font-semibold" style={{ color: "var(--adm-muted)" }}>
                      {product.category?.name ?? "No category"}
                    </span>
                    <div className="flex flex-wrap justify-start gap-2 lg:flex-nowrap lg:justify-end">
                      <button
                        type="button"
                        className="adm-btn-primary py-1 px-2 text-[0.58rem]"
                        onClick={() => setEditingProduct(product)}
                      >
                        Details
                      </button>
                      {status === "PUBLISHED" ? (
                        <button
                          type="button"
                          className="adm-btn-ghost py-1 px-2 text-[0.58rem]"
                          onClick={() => setRowAction({ product, action: "draft" })}
                        >
                          Draft
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="adm-btn-ghost py-1 px-2 text-[0.58rem]"
                          onClick={() => setRowAction({ product, action: "publish" })}
                          disabled={status === "ARCHIVED"}
                        >
                          Publish
                        </button>
                      )}
                      {status === "ARCHIVED" ? (
                        <button
                          type="button"
                          className="adm-btn-ghost py-1 px-2 text-[0.58rem]"
                          onClick={() => setRowAction({ product, action: "draft" })}
                        >
                          Restore
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="adm-btn-ghost py-1 px-2 text-[0.58rem]"
                          onClick={() => setRowAction({ product, action: "archive" })}
                        >
                          Archive
                        </button>
                      )}
                      <button
                        type="button"
                        className="adm-btn-danger py-1 px-2 text-[0.58rem]"
                        onClick={() => setRowAction({ product, action: "delete" })}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="adm-copy py-6">No products match the current filters.</p>
            )}
          </div>
        </div>
      </div>

      {modalCopy ? (
        <AdminConfirmModal
          open={Boolean(rowAction)}
          title={modalCopy.title}
          description={modalCopy.description}
          confirmLabel={modalCopy.confirmLabel}
          tone={modalCopy.tone}
          pending={isRowActionPending}
          onCancel={() => setRowAction(null)}
          onConfirm={runRowAction}
        />
      ) : null}

      <AdminRecordMetaModal
        open={Boolean(editingProduct)}
        title={editingProduct?.name ?? "Product"}
        subtitle={editingProduct ? `/${editingProduct.slug}` : undefined}
        href={editingProduct ? `/admin/products/${editingProduct.id}` : "/admin/products"}
        entityType="PRODUCT"
        entityId={editingProduct?.id ?? ""}
        record={editingProduct}
        onClose={() => setEditingProduct(null)}
      />
    </section>
  );
}
