"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";

import {
  deleteProductAction,
  saveProductAction,
  type ProductActionState,
  type SavedProductPayload,
} from "@/app/admin/actions";
import { AdminHelp } from "@/components/admin/admin-help";
import { AuthMessage } from "@/components/auth/auth-form-primitives";
import { LocaleTabStrip } from "@/components/admin/admin-primitives";
import {
  fallbackProductLookbook,
  fallbackProductMaterials,
  fallbackProductProcess,
  parseProductDetails,
} from "@/lib/content/catalog";

type CategoryOption = { id: string; slug: string; name: string };
type TagOption = { id: string; slug: string; name: string };
type CollectionOption = { id: string; slug: string; name: string };
type ProductRecord = SavedProductPayload;

type ProductCmsProps = {
  initialProducts: ProductRecord[];
  categories: CategoryOption[];
  tags: TagOption[];
  collections: CollectionOption[];
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

function ConfirmModal({
  open,
  title,
  description,
  confirmLabel,
  onCancel,
  onConfirm,
  pending,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
  pending: boolean;
}) {
  if (!open) return null;

  return (
      <div
        className="fixed inset-0 z-[200] flex items-center justify-center px-6"
        style={{ background: "rgba(5,4,3,0.82)", backdropFilter: "blur(10px)" }}
      >
      <div className="adm-panel w-full max-w-md p-6">
        <p className="adm-section-tag mb-3">[ CONFIRM OPERATION ]</p>
        <h3 className="adm-title-sm">
          {title}
        </h3>
        <p className="adm-copy mt-4">
          {description}
        </p>
        <div
          className="mt-6 flex flex-wrap justify-end gap-3 pt-4"
          style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
        >
          <button type="button" onClick={onCancel} className="adm-btn-ghost">
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className="adm-btn-primary"
          >
            {pending ? "Processing..." : confirmLabel}
          </button>
        </div>
      </div>
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

function ProductDetailFields({
  details,
  mode,
}: {
  details: ReturnType<typeof getProductEditorDetails>;
  mode: "create" | "edit";
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
              className="grid gap-3 p-4"
              style={{ border: "1px solid rgba(255,255,255,0.05)" }}
            >
              <p className="adm-section-tag">MATERIAL {index + 1}</p>
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
              <input
                name={`materialImageFile${index + 1}`}
                type="file"
                accept="image/*"
                className="adm-field"
              />
              {mode === "edit" && material.image ? (
                <div className="grid gap-2">
                  <p className="adm-label">Current image</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={material.image}
                    alt={material.title || `Material ${index + 1}`}
                    className="aspect-square w-full object-cover"
                    style={{ opacity: 0.7 }}
                  />
                </div>
              ) : null}
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
        <input
          name="processMediaImageFile"
          type="file"
          accept="image/*"
          className="adm-field"
        />
        {mode === "edit" && details.process.mediaImage ? (
          <div className="grid gap-2">
            <p className="adm-label">Current process media</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={details.process.mediaImage}
              alt={details.process.title || "Process media"}
              className="aspect-video w-full object-cover"
              style={{ opacity: 0.7 }}
            />
          </div>
        ) : null}
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
              className="grid gap-3 p-4"
              style={{ border: "1px solid rgba(255,255,255,0.05)" }}
            >
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
              <input
                name={`lookbookImageFile${index + 1}`}
                type="file"
                accept="image/*"
                className="adm-field"
              />
              {mode === "edit" && item.src ? (
                <div className="grid gap-2">
                  <p className="adm-label">Current image</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.src}
                    alt={item.label || `Lookbook ${index + 1}`}
                    className="aspect-square w-full object-cover"
                    style={{ opacity: 0.7 }}
                  />
                </div>
              ) : null}
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
}: {
  draft: ProductDraft;
  categories: CategoryOption[];
  collections: CollectionOption[];
}) {
  return (
    <>
      {/* i18n groundwork */}
      <LocaleTabStrip />

      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2">
          <span className="adm-label">Name</span>
          <input name="name" defaultValue={draft.name} className="adm-field" />
        </label>
        <label className="grid gap-2">
          <span className="adm-label">Slug</span>
          <input name="slug" defaultValue={draft.slug} className="adm-field" />
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
        <label className="grid gap-2">
          <span className="adm-label">Product image</span>
          <input type="hidden" name="existingImageUrl" value={draft.imageUrl} />
          <input name="imageFile" type="file" accept="image/*" className="adm-field" />
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
        <select name="categorySlug" defaultValue={draft.categorySlug} className="adm-field">
          <option value="">No category</option>
          {categories.map((category) => (
            <option key={category.id} value={category.slug}>
              {category.name}
            </option>
          ))}
        </select>
        <select name="collectionSlug" defaultValue={draft.collectionSlug} className="adm-field">
          <option value="">No collection</option>
          {collections.map((collection) => (
            <option key={collection.id} value={collection.slug}>
              {collection.name}
            </option>
          ))}
        </select>
        <input
          name="tags"
          defaultValue={draft.tags}
          placeholder="lava, heritage, symbolic"
          className="adm-field"
        />
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

function CreateProductForm({
  categories,
  collections,
  onCreated,
}: {
  categories: CategoryOption[];
  collections: CollectionOption[];
  onCreated: (product: ProductRecord) => void;
}) {
  const [state, setState] = useState<ProductActionState>({});
  const [isPending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [draft] = useState<ProductDraft>(emptyDraft);
  const formRef = useRef<HTMLFormElement>(null);

  async function formAction(formData: FormData) {
    startTransition(async () => {
      const result = await saveProductAction(formData);
      setState(result);
      setConfirmOpen(false);

      if (result.product) {
        onCreated(result.product);
      }

      if (result.success && result.created) {
        formRef.current?.reset();
      }
    });
  }

  return (
    <>
      <form ref={formRef} action={formAction} className="adm-panel grid gap-4 p-5">
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
        <AuthMessage error={state.error} success={state.success} />
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

      <ConfirmModal
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

function EditProductForm({
  product,
  categories,
  collections,
  onUpdated,
  onDeleted,
  highlighted,
}: {
  product: ProductRecord;
  categories: CategoryOption[];
  collections: CollectionOption[];
  onUpdated: (product: ProductRecord) => void;
  onDeleted: (productId: string) => void;
  highlighted: boolean;
}) {
  const [state, setState] = useState<ProductActionState>({});
  const [isPending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const rowRef = useRef<HTMLDetailsElement>(null);
  const draft = productToDraft(product);
  const details = getProductEditorDetails(product.details);

  useEffect(() => {
    if (!highlighted || !rowRef.current) return;
    rowRef.current.open = true;
    rowRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [highlighted]);

  async function formAction(formData: FormData) {
    startTransition(async () => {
      const result = await saveProductAction(formData);
      setState(result);
      setConfirmOpen(false);
      if (result.product) {
        onUpdated(result.product);
      }
    });
  }

  async function handleDelete(formData: FormData) {
    startTransition(async () => {
      const result = await deleteProductAction(formData);
      setState(result);
      setDeleteOpen(false);
      if (result.deletedProductId) {
        onDeleted(result.deletedProductId);
      }
    });
  }

  const isPublished = product.status === "ACTIVE" && product.visibility === "PUBLIC";

  return (
    <>
      <details
        ref={rowRef}
        className="transition-colors"
        style={{
          borderTop: "1px solid rgba(255,255,255,0.06)",
          paddingTop: "1rem",
          ...(highlighted
            ? { background: "var(--adm-accent-soft)", outline: "1px solid var(--adm-border-strong)" }
            : {}),
        }}
      >
        <summary className="cursor-pointer list-none">
          <div className="flex items-start justify-between gap-4 py-1">
            <div>
          <p className="text-sm font-semibold" style={{ color: "var(--adm-ink)" }}>
            {product.name}
          </p>
          <p className="mt-0.5 text-xs" style={{ color: "var(--adm-muted)" }}>
            /{product.slug}
          </p>
              {highlighted && (
                <p
                  className="mt-1 text-xs font-bold uppercase tracking-[0.08em]"
                  style={{ color: "var(--adm-accent)" }}
                >
                  Just created
                </p>
              )}
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span
                className="text-xs font-semibold"
                style={{ color: "var(--adm-muted)" }}
              >
                {centsToPrice(product.priceCents)} EUR
              </span>
              <span className={isPublished ? "adm-badge-published" : "adm-badge-draft"}>
                {isPublished ? "PUB" : "DRF"}
              </span>
            </div>
          </div>
        </summary>

        <form action={formAction} className="mt-4 grid gap-4">
          <input type="hidden" name="productId" value={product.id} />

          <div
            className="flex items-center justify-between gap-4 pb-4"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
          >
            <div>
              <p className="adm-section-tag">[ EDIT UNIT ]</p>
              <h3 className="adm-title-sm mt-2">
                {product.name}
              </h3>
            </div>
            <SaveButtons onOpenConfirm={() => setConfirmOpen(true)} pending={isPending} />
          </div>

          <ProgressBar pending={isPending} />
          <AuthMessage error={state.error} success={state.success} />

          <ProductFormFields draft={draft} categories={categories} collections={collections} />
          <ProductDetailFields details={details} mode="edit" />

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
      </details>

      <ConfirmModal
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

      <ConfirmModal
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
      />
    </>
  );
}

export function ProductsCms({
  initialProducts,
  categories,
  tags,
  collections,
}: ProductCmsProps) {
  const [products, setProducts] = useState<ProductRecord[]>(() =>
    normalizeProducts(initialProducts),
  );
  const [highlightedProductId, setHighlightedProductId] = useState<string | null>(null);

  function handleCreated(product: ProductRecord) {
    setProducts((current) =>
      normalizeProducts([product, ...current.filter((item) => item.id !== product.id)]),
    );
    setHighlightedProductId(product.id);
    window.setTimeout(() => {
      setHighlightedProductId((current) => (current === product.id ? null : current));
    }, 4500);
  }

  function handleUpdated(product: ProductRecord) {
    setProducts((current) =>
      normalizeProducts(current.map((item) => (item.id === product.id ? product : item))),
    );
  }

  function handleDeleted(productId: string) {
    setProducts((current) => current.filter((item) => item.id !== productId));
    if (highlightedProductId === productId) {
      setHighlightedProductId(null);
    }
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(22rem,0.85fr)]">
      {/* Create form */}
      <div>
        <CreateProductForm
          categories={categories}
          collections={collections}
          onCreated={handleCreated}
        />
      </div>

      {/* Current catalog */}
      <div className="adm-panel p-5">
        <p className="adm-section-tag mb-5">[ CURRENT CATALOG ]</p>

        <div className="space-y-0">
          {products.map((product) => (
            <EditProductForm
              key={product.id}
              product={product}
              categories={categories}
              collections={collections}
              onUpdated={handleUpdated}
              onDeleted={handleDeleted}
              highlighted={highlightedProductId === product.id}
            />
          ))}
        </div>

        {/* Taxonomy summary */}
        <div
          className="mt-6 grid gap-4 pt-5 md:grid-cols-2"
          style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div>
            <p className="adm-section-tag mb-3">[ CATEGORIES ]</p>
            <div className="flex flex-wrap gap-1.5">
              {categories.map((category) => (
                <span
                  key={category.id}
                  className="px-2 py-1 text-[0.68rem] font-bold uppercase tracking-[0.08em]"
                  style={{
                    color: "var(--adm-muted)",
                    border: "1px solid var(--adm-border)",
                    borderRadius: "999px",
                  }}
                >
                  {category.name}
                </span>
              ))}
            </div>
          </div>
          <div>
            <p className="adm-section-tag mb-3">[ TAGS ]</p>
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <span
                  key={tag.id}
                  className="px-2 py-1 text-[0.68rem] font-bold uppercase tracking-[0.08em]"
                  style={{
                    color: "var(--adm-muted)",
                    border: "1px solid var(--adm-border)",
                    borderRadius: "999px",
                  }}
                >
                  {tag.name}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Collections link */}
        <div
          className="mt-5 pt-5"
          style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="adm-section-tag mb-2">[ COLLECTIONS ]</p>
              <AdminHelp>
                Hero images, manifesto copy, symbolism defaults, sort order, and publication state are managed in the collections module.
              </AdminHelp>
            </div>
            <Link href="/admin/collections" className="adm-btn-ghost shrink-0">
              Manage collections
            </Link>
          </div>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {collections.map((collection) => (
              <span
                key={collection.id}
                className="px-2 py-1 text-[0.68rem] font-bold uppercase tracking-[0.08em]"
                style={{
                  color: "var(--adm-muted)",
                  border: "1px solid var(--adm-border)",
                  borderRadius: "999px",
                }}
              >
                {collection.name}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
