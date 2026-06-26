"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";

import {
  deleteProductAction,
  saveProductAction,
  type ProductActionState,
  type SavedProductPayload,
} from "@/app/admin/actions";
import { AuthMessage } from "@/components/auth/auth-form-primitives";
import {
  fallbackProductLookbook,
  fallbackProductMaterials,
  fallbackProductProcess,
  parseProductDetails,
} from "@/lib/content/catalog";

const adminFieldClass =
  "admin-field w-full min-w-0 border border-stroke bg-transparent px-4 py-3 outline-none focus:border-accent";

type CategoryOption = {
  id: string;
  slug: string;
  name: string;
};

type TagOption = {
  id: string;
  slug: string;
  name: string;
};

type CollectionOption = {
  id: string;
  slug: string;
  name: string;
};

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
      return {
        value: source?.value ?? "",
        label: source?.label ?? "",
      };
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
    name: "",
    slug: "",
    sku: "",
    price: "",
    seriesLabel: "",
    shortDescription: "",
    description: "",
    materialLine: "",
    symbolismLabel: "",
    symbolismTitle: "",
    symbolismBody: "",
    symbolismBody2: "",
    categorySlug: "",
    collectionSlug: "",
    tags: "",
    workflowState: "DRAFT",
    imageUrl: "",
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
      product.status === "ACTIVE" && product.visibility === "PUBLIC" ? "PUBLISHED" : "DRAFT",
    imageUrl: product.imageUrl ?? "",
  };
}

function normalizeProducts(items: ProductRecord[]) {
  return [...items].sort((left, right) => right.name.localeCompare(left.name));
}

function ProductCmsMessage({ state }: { state: ProductActionState }) {
  return <AuthMessage error={state.error} success={state.success} />;
}

function ProgressBar({ pending }: { pending: boolean }) {
  return (
    <div className="h-1 overflow-hidden bg-stroke/70">
      <div
        className={[
          "h-full bg-couture-red transition-all duration-300",
          pending ? "w-full animate-pulse" : "w-0",
        ].join(" ")}
      />
    </div>
  );
}

function SaveConfirmModal({
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-charcoal/60 px-6">
      <div className="w-full max-w-lg border border-stroke bg-background p-6 shadow-2xl">
        <p className="label-caps text-accent">Confirm save</p>
        <h3 className="mt-3 font-serif text-[2rem] leading-none">{title}</h3>
        <p className="mt-4 text-sm leading-7 text-foreground/65">{description}</p>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="border border-stroke px-4 py-3 label-caps transition-colors hover:border-accent hover:text-accent"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className="bg-charcoal px-4 py-3 label-caps text-white transition-colors hover:bg-couture-red disabled:opacity-60"
          >
            {pending ? "Saving..." : confirmLabel}
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
    <div className="flex items-center justify-end">
      <button
        type="button"
        onClick={onOpenConfirm}
        disabled={pending}
        className="bg-charcoal px-5 py-3 label-caps text-white transition-colors hover:bg-couture-red disabled:opacity-60"
      >
        {pending ? "Saving..." : "Save product"}
      </button>
    </div>
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
    <div className="grid gap-6 border-t border-stroke pt-4">
      <div>
        <p className="label-caps text-accent">Product detail page</p>
        <p className="mt-2 max-w-2xl text-sm leading-7 text-foreground/60">
          These sections feed the actual product page: materials, process story, and lookbook.
        </p>
      </div>

      <section className="grid gap-4 border border-stroke/70 p-5">
        <div>
          <p className="label-caps text-muted">Materials</p>
          <p className="mt-2 text-sm leading-7 text-foreground/55">
            Three material cards shown on the storefront product detail page.
          </p>
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          {details.materials.map((material, index) => (
            <div key={`material-${index}`} className="grid gap-3 border border-stroke/60 p-4">
              <p className="label-caps text-accent">Material {index + 1}</p>
              <input
                name={`materialTitle${index + 1}`}
                defaultValue={material.title}
                placeholder="Lava Stone"
                className={adminFieldClass}
              />
              <textarea
                name={`materialBody${index + 1}`}
                rows={4}
                defaultValue={material.body}
                placeholder="Describe the material story."
                className={adminFieldClass}
              />
              <input type="hidden" name={`existingMaterialImage${index + 1}`} value={material.image} />
              <input
                name={`materialImageFile${index + 1}`}
                type="file"
                accept="image/*"
                className={adminFieldClass}
              />
              {mode === "edit" && material.image ? (
                <div className="grid gap-2">
                  <p className="label-caps text-muted">Current image</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={material.image} alt={material.title || `Material ${index + 1}`} className="aspect-square w-full object-cover" />
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 border border-stroke/70 p-5">
        <div>
          <p className="label-caps text-muted">Process</p>
          <p className="mt-2 text-sm leading-7 text-foreground/55">
            Dark craftsmanship section with media and stats.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <input
            name="processEyebrow"
            defaultValue={details.process.eyebrow}
            placeholder="Process"
            className={adminFieldClass}
          />
          <input
            name="processTitle"
            defaultValue={details.process.title}
            placeholder="Human Precision"
            className={adminFieldClass}
          />
        </div>

        <input type="hidden" name="existingProcessMediaImage" value={details.process.mediaImage} />
        <input name="processMediaImageFile" type="file" accept="image/*" className={adminFieldClass} />

        {mode === "edit" && details.process.mediaImage ? (
          <div className="grid gap-2">
            <p className="label-caps text-muted">Current process media</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={details.process.mediaImage} alt={details.process.title || "Process media"} className="aspect-video w-full object-cover" />
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {details.process.stats.map((stat, index) => (
            <div key={`process-stat-${index}`} className="grid gap-3 border border-stroke/60 p-4">
              <p className="label-caps text-accent">Stat {index + 1}</p>
              <input
                name={`processStatValue${index + 1}`}
                defaultValue={stat.value}
                placeholder="12"
                className={adminFieldClass}
              />
              <input
                name={`processStatLabel${index + 1}`}
                defaultValue={stat.label}
                placeholder="Hours of weaving"
                className={adminFieldClass}
              />
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 border border-stroke/70 p-5">
        <div>
          <p className="label-caps text-muted">Lookbook</p>
          <p className="mt-2 text-sm leading-7 text-foreground/55">
            Gallery blocks used in the pairing guide / lookbook section.
          </p>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          {details.lookbook.map((item, index) => (
            <div key={`lookbook-${index}`} className="grid gap-3 border border-stroke/60 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="label-caps text-accent">Lookbook {index + 1}</p>
                <label className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-foreground/55">
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
                className={adminFieldClass}
              />
              <input type="hidden" name={`existingLookbookImage${index + 1}`} value={item.src} />
              <input
                name={`lookbookImageFile${index + 1}`}
                type="file"
                accept="image/*"
                className={adminFieldClass}
              />
              {mode === "edit" && item.src ? (
                <div className="grid gap-2">
                  <p className="label-caps text-muted">Current image</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.src} alt={item.label || `Lookbook ${index + 1}`} className="aspect-square w-full object-cover" />
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
      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2">
          <span className="label-caps text-muted">Name</span>
          <input name="name" defaultValue={draft.name} className={adminFieldClass} />
        </label>
        <label className="grid gap-2">
          <span className="label-caps text-muted">Slug</span>
          <input name="slug" defaultValue={draft.slug} className={adminFieldClass} />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <label className="grid gap-2">
          <span className="label-caps text-muted">SKU</span>
          <input name="sku" defaultValue={draft.sku} className={adminFieldClass} />
        </label>
        <label className="grid gap-2">
          <span className="label-caps text-muted">Series label</span>
          <input name="seriesLabel" defaultValue={draft.seriesLabel} className={adminFieldClass} />
        </label>
        <label className="grid gap-2">
          <span className="label-caps text-muted">Price EUR</span>
          <input name="price" type="number" min="0" step="0.01" inputMode="decimal" defaultValue={draft.price} className={adminFieldClass} />
        </label>
      </div>

      <label className="grid gap-2">
        <span className="label-caps text-muted">Short description</span>
        <textarea name="shortDescription" rows={3} defaultValue={draft.shortDescription} className={adminFieldClass} />
      </label>

      <label className="grid gap-2">
        <span className="label-caps text-muted">Description</span>
        <textarea name="description" rows={4} defaultValue={draft.description} className={adminFieldClass} />
      </label>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2">
          <span className="label-caps text-muted">Material line</span>
          <input name="materialLine" defaultValue={draft.materialLine} className={adminFieldClass} />
        </label>
        <label className="grid gap-2">
          <span className="label-caps text-muted">Product image</span>
          <input type="hidden" name="existingImageUrl" value={draft.imageUrl} />
          <input name="imageFile" type="file" accept="image/*" className={adminFieldClass} />
        </label>
      </div>

      <div className="grid gap-4 border-t border-stroke pt-4">
        <div>
          <p className="label-caps text-accent">Product symbolism override</p>
          <p className="mt-2 text-sm leading-7 text-foreground/60">
            If empty, the product page falls back to the selected collection defaults.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <input name="symbolismLabel" defaultValue={draft.symbolismLabel} placeholder="Symbolic Language" className={adminFieldClass} />
          <input name="symbolismTitle" defaultValue={draft.symbolismTitle} placeholder="Wood, Lava, Embroidery" className={adminFieldClass} />
        </div>

        <textarea name="symbolismBody" rows={4} defaultValue={draft.symbolismBody} className={adminFieldClass} />
        <textarea name="symbolismBody2" rows={3} defaultValue={draft.symbolismBody2} className={adminFieldClass} />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <select name="categorySlug" defaultValue={draft.categorySlug} className={adminFieldClass}>
          <option value="">No category</option>
          {categories.map((category) => (
            <option key={category.id} value={category.slug}>
              {category.name}
            </option>
          ))}
        </select>

        <select name="collectionSlug" defaultValue={draft.collectionSlug} className={adminFieldClass}>
          <option value="">No collection</option>
          {collections.map((collection) => (
            <option key={collection.id} value={collection.slug}>
              {collection.name}
            </option>
          ))}
        </select>

        <input name="tags" defaultValue={draft.tags} placeholder="lava, heritage, symbolic" className={adminFieldClass} />
      </div>

      <label className="grid gap-2 md:max-w-sm">
        <span className="label-caps text-muted">Storefront state</span>
        <select name="workflowState" defaultValue={draft.workflowState} className={adminFieldClass}>
          <option value="DRAFT">Draft</option>
          <option value="PUBLISHED">Published</option>
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
  const [draft, setDraft] = useState<ProductDraft>(emptyDraft);
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
        setDraft(emptyDraft());
        formRef.current?.reset();
      }
    });
  }

  return (
    <>
      <form ref={formRef} action={formAction} className="panel grid gap-4 p-6">
        <div className="flex items-center justify-between gap-4 border-b border-stroke pb-4">
          <div>
            <p className="label-caps text-accent">Create product</p>
            <h2 className="mt-2 font-serif text-[2rem]">New storefront piece</h2>
          </div>
          <SaveButtons onOpenConfirm={() => setConfirmOpen(true)} pending={isPending} />
        </div>

        <ProgressBar pending={isPending} />
        <ProductCmsMessage state={state} />
        <p className="text-sm leading-7 text-foreground/55">
          Saving updates the database and can immediately affect the public storefront if the product is published.
        </p>

        <ProductFormFields draft={draft} categories={categories} collections={collections} />
        <ProductDetailFields details={getProductEditorDetails(null)} mode="create" />

        <div className="border-t border-stroke pt-4">
          <SaveButtons onOpenConfirm={() => setConfirmOpen(true)} pending={isPending} />
        </div>
      </form>

      <SaveConfirmModal
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

  return (
    <>
      <details
        ref={rowRef}
        className={[
          "border-t border-stroke pt-6 transition-colors",
          highlighted ? "bg-accent/5 ring-1 ring-accent/35" : "",
        ].join(" ")}
      >
        <summary className="cursor-pointer list-none">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-serif text-[1.45rem]">{product.name}</p>
              <p className="text-sm text-foreground/55">/{product.slug}</p>
              {highlighted ? (
                <p className="mt-2 text-xs uppercase tracking-[0.14em] text-accent">Just created</p>
              ) : null}
            </div>
            <span className="label-caps text-muted">{centsToPrice(product.priceCents)} EUR</span>
          </div>
        </summary>

        <form action={formAction} className="mt-5 grid gap-4">
          <input type="hidden" name="productId" value={product.id} />

          <div className="flex items-center justify-between gap-4 border-b border-stroke pb-4">
            <div>
              <p className="label-caps text-accent">Edit product</p>
              <h3 className="mt-2 font-serif text-[1.8rem]">{product.name}</h3>
            </div>
            <SaveButtons onOpenConfirm={() => setConfirmOpen(true)} pending={isPending} />
          </div>

          <ProgressBar pending={isPending} />
          <ProductCmsMessage state={state} />

          <ProductFormFields draft={draft} categories={categories} collections={collections} />
          <ProductDetailFields details={details} mode="edit" />

          <div className="flex items-center justify-between gap-4 border-t border-stroke pt-4">
            <button
              type="button"
              onClick={() => setDeleteOpen(true)}
              disabled={isPending}
              className="border border-couture-red/35 px-3 py-2 text-[11px] uppercase tracking-[0.14em] text-couture-red transition-colors hover:border-couture-red hover:bg-couture-red hover:text-white"
            >
              Delete
            </button>
            <SaveButtons onOpenConfirm={() => setConfirmOpen(true)} pending={isPending} />
          </div>
        </form>
      </details>

      <SaveConfirmModal
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

      <SaveConfirmModal
        open={deleteOpen}
        title={`Delete ${product.name}`}
        description="This action removes the product record. Public storefront pages for this item will stop working after deletion."
        confirmLabel="Yes, delete"
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
  const [products, setProducts] = useState<ProductRecord[]>(() => normalizeProducts(initialProducts));
  const [highlightedProductId, setHighlightedProductId] = useState<string | null>(null);

  function handleCreated(product: ProductRecord) {
    setProducts((current) => normalizeProducts([product, ...current.filter((item) => item.id !== product.id)]));
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
      <div className="space-y-6">
        <CreateProductForm
          categories={categories}
          collections={collections}
          onCreated={handleCreated}
        />
      </div>

      <div className="panel p-6">
        <p className="label-caps text-muted">Current catalog</p>
        <div className="mt-6 space-y-6">
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

        <div className="mt-8 grid gap-4 border-t border-stroke pt-6 md:grid-cols-2">
          <div>
            <p className="label-caps text-muted">Categories</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {categories.map((category) => (
                <span
                  key={category.id}
                  className="border border-stroke px-2 py-1 text-[11px] uppercase tracking-[0.14em] text-foreground/60"
                >
                  {category.name}
                </span>
              ))}
            </div>
          </div>

          <div>
            <p className="label-caps text-muted">Tags</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {tags.map((tag) => (
                <span
                  key={tag.id}
                  className="border border-stroke px-2 py-1 text-[11px] uppercase tracking-[0.14em] text-foreground/60"
                >
                  {tag.name}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-8 border-t border-stroke pt-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="label-caps text-muted">Collections</p>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-foreground/60">
                Collection pages, hero images, manifesto copy, symbolism defaults, order, and publication
                status are managed in a dedicated collections CMS.
              </p>
            </div>
            <Link
              href="/admin/collections"
              className="w-fit border border-stroke px-4 py-3 label-caps transition-colors hover:border-accent hover:text-accent"
            >
              Manage collections
            </Link>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {collections.map((collection) => (
              <span
                key={collection.id}
                className="border border-stroke px-2 py-1 text-[11px] uppercase tracking-[0.14em] text-foreground/60"
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
