"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  autosaveProductDraftAction,
  archiveMissingShopifyProductsAction,
  deleteProductAction,
  inspectProductSyncAction,
  previewShopifyReconciliationAction,
  pullSingleProductFromShopifyAction,
  saveProductAction,
  pushSingleProductToShopifyAction,
  syncShopifySelectionAction,
  testShopifyConnectionAction,
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
import { parseProductDetails } from "@/lib/content/product-details";
import { SHOP_DEPARTMENTS } from "@/lib/catalog/taxonomy";
import { PRODUCT_CHARACTERISTICS, PRODUCT_CHARACTERISTIC_GROUPS } from "@/lib/products/characteristics";
import type { ProductSyncInspection, ShopifyReconciliationPreview } from "@/lib/shopify/product-sync";
import { ArrowDownToLine, ArrowUpFromLine, Check, Clock3, Eye, RefreshCw, TriangleAlert } from "lucide-react";

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
  stockOnHand: string;
};

function centsToPrice(cents: number) {
  return (cents / 100).toFixed(2);
}

function getProductEditorDetails(details: unknown, characteristics: ProductRecord["characteristics"] = []) {
  const parsed = parseProductDetails(details);
  const attributes = Array.from({ length: 8 }, (_, index) => {
    const source = parsed.attributes?.[index];
    return { label: source?.label ?? "", value: source?.value ?? "" };
  });

  const materialsEyebrow = parsed.materialsEyebrow ?? "";
  const materialsTitle = parsed.materialsTitle ?? "";
  const materials = Array.from({ length: 3 }, (_, index) => {
    const source = parsed.materials?.[index];
    return {
      title: source?.title ?? "",
      body: source?.body ?? "",
      image: source?.image ?? "",
    };
  });

  const process = {
    eyebrow: parsed.process?.eyebrow ?? "",
    title: parsed.process?.title ?? "",
    mediaImage: parsed.process?.mediaImage ?? "",
    stats: Array.from({ length: 4 }, (_, index) => {
      const source = parsed.process?.stats?.[index];
      return { value: source?.value ?? "", label: source?.label ?? "" };
    }),
  };

  const lookbookEyebrow = parsed.lookbookEyebrow ?? "";
  const lookbookTitle = parsed.lookbookTitle ?? "";
  const lookbook = Array.from({ length: 4 }, (_, index) => {
    const source = parsed.lookbook?.[index];
    return {
      src: source?.src ?? "",
      label: source?.label ?? "",
      featured: Boolean(source?.featured),
    };
  });

  return {
    department: parsed.department ?? "",
    attributes,
    characteristics: Object.fromEntries(characteristics.map((item) => [item.key, {
      value: item.valueType === "BOOLEAN"
        ? Boolean(item.booleanValue)
        : item.valueType === "NUMBER"
          ? item.numberValue?.toString() ?? ""
          : item.textValue ?? "",
      certificateUrl: item.certificateUrl ?? "",
    }])),
    materialsEyebrow,
    materialsTitle,
    materials,
    process,
    lookbookEyebrow,
    lookbookTitle,
    lookbook,
  };
}

function emptyDraft(): ProductDraft {
  return {
    name: "", slug: "", sku: "", price: "", seriesLabel: "",
    shortDescription: "", description: "", materialLine: "",
    symbolismLabel: "", symbolismTitle: "", symbolismBody: "",
    symbolismBody2: "", categorySlug: "", collectionSlug: "",
    tags: "", workflowState: "DRAFT", imageUrl: "", stockOnHand: "0",
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
    stockOnHand: String(product.variants[0]?.stockOnHand ?? 0),
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

function ProductSyncStrip({ product, dirty, inspection, pending, onCheck, onPull, onPush, onResolve }: {
  product: ProductRecord;
  dirty: boolean;
  inspection: ProductSyncInspection | null;
  pending: boolean;
  onCheck: () => void;
  onPull: () => void;
  onPush: () => void;
  onResolve: (resolution: "shopify" | "synarava") => void;
}) {
  const fallbackState: ProductSyncInspection["state"] = product.shopifyProductId
    ? product.syncStatus === "PENDING" || product.syncStatus === "FAILED"
      ? "LOCAL_CHANGES"
      : product.syncStatus === "CONFLICT"
        ? "CONFLICT"
        : "SYNCED"
    : "UNLINKED";
  const syncState = dirty ? "UNSAVED" : inspection?.state ?? fallbackState;
  const healthy = syncState === "SYNCED";
  const failed = syncState === "CONFLICT" || syncState === "REMOTE_MISSING" || product.syncStatus === "FAILED";
  const Icon = healthy ? Check : failed ? TriangleAlert : Clock3;
  const totalStock = product.variants.reduce((sum, variant) => sum + variant.stockOnHand, 0);
  const shopifyPublications = inspection?.publications ?? [];
  const storefrontState = product.status === "ACTIVE" && product.visibility === "PUBLIC"
    ? "Published"
    : product.status === "ARCHIVED"
      ? "Archived"
      : "Draft / hidden";
  const stateLabel = syncState === "UNSAVED"
    ? "Unsaved changes"
    : syncState === "LOCAL_CHANGES"
      ? "Ready to push"
      : syncState === "REMOTE_CHANGES"
        ? "Shopify update available"
        : syncState === "CONFLICT"
          ? "Conflict needs a decision"
          : syncState === "REMOTE_MISSING"
            ? "Shopify product missing"
            : syncState === "UNLINKED"
              ? "Not connected to Shopify"
              : "Shopify commerce core synced";
  const stateDescription = syncState === "UNSAVED"
    ? "Save locally before Push or Pull. Unsaved form values will never be overwritten."
    : syncState === "LOCAL_CHANGES"
      ? "Local commerce changes are saved and ready. Shopify has not been changed yet."
      : syncState === "REMOTE_CHANGES"
        ? "Shopify has newer commerce data. Pull applies it while preserving the Synarava CMS layer."
        : syncState === "CONFLICT"
          ? "Saved commerce changes exist on both sides. Choose which version should win."
          : syncState === "REMOTE_MISSING"
            ? "The linked Shopify product could not be found. No automatic action was taken."
            : syncState === "UNLINKED"
              ? "This local product has not been linked. Its first push creates the Shopify commerce record."
              : "Shopify commerce data matches the last confirmed local state. Synarava CMS content remains local.";
  const canPush = !dirty && product.variants.length > 0 && (syncState === "LOCAL_CHANGES" || syncState === "UNLINKED");
  // A linked Shopify product can always be refreshed. Timestamp equality only
  // means no remote edit was detected; it does not guarantee that a newer
  // local projection (for example shopifySnapshot) has already been hydrated.
  // The server action still blocks destructive pulls when saved local commerce
  // changes or a conflict are present.
  const canPull = !dirty && Boolean(product.shopifyProductId) && syncState !== "REMOTE_MISSING";
  const pullLabel = syncState === "REMOTE_CHANGES" ? "Pull Shopify update" : "Refresh from Shopify";
  return (
    <section className="grid gap-4 border bg-[var(--adm-bg-soft)] p-4" style={{ borderColor: "var(--adm-border)" }} aria-label="Commerce synchronization">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full border border-[var(--adm-accent)] text-[var(--adm-accent)]"><Icon className="size-4" /></span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold">{stateLabel}</p>
              <span className={healthy ? "adm-badge-published" : "adm-badge-draft"}>{syncState}</span>
            </div>
            <p className="mt-1 max-w-3xl text-xs text-[var(--adm-subtle)]">
              {product.syncError ?? stateDescription}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          {product.shopifyProductId ? (
            <button type="button" className="adm-btn-ghost inline-flex items-center justify-center gap-2" onClick={onCheck} disabled={pending || dirty}>
              <RefreshCw className={`size-4 ${pending ? "animate-spin" : ""}`} />
              Check Shopify
            </button>
          ) : null}
          <button type="button" className="adm-btn-ghost inline-flex items-center justify-center gap-2" onClick={onPull} disabled={pending || !canPull}>
            <ArrowDownToLine className="size-4" />
            {pending ? "Refreshing..." : pullLabel}
          </button>
          <button type="button" className="adm-btn-secondary inline-flex items-center justify-center gap-2" onClick={onPush} disabled={pending || !canPush}>
            <ArrowUpFromLine className="size-4" />
            {pending ? "Syncing..." : product.variants.length === 0 ? "Save core fields first" : product.shopifyProductId ? "Push to Shopify" : "Create in Shopify"}
          </button>
        </div>
      </div>

      <div className="grid border-y border-[var(--adm-border)] sm:grid-cols-2 xl:grid-cols-4">
        <div className="py-3 sm:pr-4 xl:border-r xl:border-[var(--adm-border)]">
          <p className="adm-section-tag">Shopify link</p>
          <p className="mt-2 break-all text-xs font-semibold text-[var(--adm-ink)]">{product.shopifyProductId ?? "Not linked"}</p>
          <p className="mt-1 text-xs text-[var(--adm-muted)]">{product.shopifyHandle ? `/${product.shopifyHandle}` : "A Shopify ID will appear after the first push."}</p>
        </div>
        <div className="border-t border-[var(--adm-border)] py-3 sm:border-l sm:border-t-0 sm:px-4 xl:border-l-0 xl:border-r">
          <p className="adm-section-tag">Available quantity</p>
          <p className="mt-2 text-lg font-semibold text-[var(--adm-ink)]">{totalStock}</p>
          <p className="mt-1 text-xs text-[var(--adm-muted)]">Across {product.variants.length} variant{product.variants.length === 1 ? "" : "s"}</p>
        </div>
        <div className="border-t border-[var(--adm-border)] py-3 sm:pr-4 xl:border-r xl:border-t-0 xl:px-4">
          <p className="adm-section-tag">Storefront state</p>
          <p className="mt-2 text-sm font-semibold text-[var(--adm-ink)]">{storefrontState}</p>
          <p className="mt-1 text-xs text-[var(--adm-muted)]">
            {product.shopifyProductId
              ? shopifyPublications.length > 0
                ? `Shopify: ${shopifyPublications.join(", ")}`
                : inspection ? "Shopify: no active publication" : "Checking Shopify publications…"
              : "Not created in Shopify yet"}
          </p>
        </div>
        <div className="border-t border-[var(--adm-border)] py-3 sm:border-l sm:pl-4 xl:border-l-0 xl:border-t-0">
          <p className="adm-section-tag">Last confirmed sync</p>
          <p className="mt-2 text-xs font-semibold text-[var(--adm-ink)]">{product.lastSyncedAt ? new Date(product.lastSyncedAt).toLocaleString() : "Never"}</p>
          <p className="mt-1 text-xs text-[var(--adm-muted)]">{product.shopifyUpdatedAt ? `Shopify updated ${new Date(product.shopifyUpdatedAt).toLocaleString()}` : "No Shopify timestamp yet"}</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div>
          <p className="adm-section-tag">Shopify-backed commerce core</p>
          <p className="mt-2 text-xs leading-5 text-[var(--adm-muted)]">Name, handle, base description, primary image, status, publication, and primary SKU/price/inventory can be pushed. Shopify variant IDs, all variants, and their inventory are pulled back as the confirmed commerce state.</p>
        </div>
        <div>
          <p className="adm-section-tag">Synarava CMS layer</p>
          <p className="mt-2 text-xs leading-5 text-[var(--adm-muted)]">Additional photography, category and collection curation, symbolism, materials, process story, lookbook, and storefront search presentation stay local and survive every Shopify pull.</p>
        </div>
      </div>

      {inspection && inspection.differences.length > 0 && (syncState === "REMOTE_CHANGES" || syncState === "CONFLICT") ? (
        <div className="border-t border-[var(--adm-border)] pt-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="adm-section-tag">Changed commerce fields ({inspection.differences.length})</p>
              <p className="mt-1 text-xs text-[var(--adm-muted)]">Only Shopify-backed fields are compared. Synarava CMS fields are excluded.</p>
            </div>
            {syncState === "CONFLICT" ? (
              <div className="flex flex-wrap gap-2">
                <button type="button" className="adm-btn-ghost" disabled={pending} onClick={() => onResolve("shopify")}>Use Shopify version</button>
                <button type="button" className="adm-btn-secondary" disabled={pending} onClick={() => onResolve("synarava")}>Keep Synarava and push</button>
              </div>
            ) : null}
          </div>
          <div className="mt-3 overflow-x-auto">
            <div className="grid min-w-[34rem] grid-cols-[minmax(10rem,1fr)_minmax(10rem,1fr)_minmax(10rem,1fr)] gap-3 px-2 pb-2 text-[0.62rem] font-bold uppercase tracking-[0.08em] text-[var(--adm-subtle)]">
              <span>Field</span><span>Synarava</span><span>Shopify</span>
            </div>
            {inspection.differences.map((difference) => (
              <div key={difference.field} className="grid min-w-[34rem] grid-cols-[minmax(10rem,1fr)_minmax(10rem,1fr)_minmax(10rem,1fr)] gap-3 border-t border-[var(--adm-border)] px-2 py-2 text-xs text-[var(--adm-muted)]">
                <span className="font-semibold text-[var(--adm-ink)]">{difference.field}</span>
                <span className="break-words">{difference.local}</span>
                <span className="break-words">{difference.shopify}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {product.variants.length > 0 ? (
        <div className="overflow-x-auto border-t border-[var(--adm-border)] pt-3">
          <div className="grid min-w-[46rem] grid-cols-[minmax(10rem,1fr)_8rem_7rem_7rem_7rem_8rem] gap-3 px-2 pb-2 text-[0.62rem] font-bold uppercase tracking-[0.08em] text-[var(--adm-subtle)]">
            <span>Variant</span><span>SKU</span><span>Price</span><span>Compare at</span><span>Available</span><span>Shopify</span>
          </div>
          {product.variants.map((variant) => (
            <div key={variant.id} className="grid min-w-[46rem] grid-cols-[minmax(10rem,1fr)_8rem_7rem_7rem_7rem_8rem] gap-3 border-t border-[var(--adm-border)] px-2 py-2 text-xs text-[var(--adm-muted)]">
              <span className="font-semibold text-[var(--adm-ink)]">{variant.title}</span>
              <span>{variant.sku}</span>
              <span>{centsToPrice(variant.priceCents)} EUR</span>
              <span>{variant.compareAtCents == null ? "—" : `${centsToPrice(variant.compareAtCents)} EUR`}</span>
              <span>{variant.stockOnHand}</span>
              <span>{variant.shopifyVariantId ? "Linked" : "Local only"}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-[var(--adm-danger)]">No commerce variant exists. Enter the available quantity and save the product to create its primary variant before synchronization.</p>
      )}
    </section>
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

function OwnershipLabel({ children, owner }: { children: React.ReactNode; owner: "Shopify" | "Synarava" | "Shopify push" }) {
  return (
    <span className="adm-label flex items-center justify-between gap-2">
      <span>{children}</span>
      <span className={owner === "Shopify" ? "text-[var(--adm-accent)]" : "text-[var(--adm-subtle)]"}>{owner}</span>
    </span>
  );
}

function issuesForField(issues: AdminIssueSummary[], fieldPath: string) {
  return issues.filter((issue) => issue.fieldPath === fieldPath && issue.status === "OPEN");
}

type ProductRowAction = {
  product: ProductRecord;
  action: "publish" | "draft" | "archive" | "delete";
};

type SyncConfirmation = {
  title: string;
  description: string;
  confirmLabel: string;
  remoteProductIds: string[];
  localProductIds: string[];
  archiveProductIds: string[];
  tone?: "default" | "danger";
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
          <span className="adm-section-tag">[ SYNARAVA CMS LAYER ]</span>
          <AdminHelp>
            Extended content enriches the storefront without being erased by Shopify catalog pulls.
          </AdminHelp>
        </p>
        <p className="mt-2 text-xs text-[var(--adm-muted)]">Characteristics are mirrored to Shopify metafields. Editorial photography, materials, process, and lookbook remain managed by Synarava.</p>
      </div>

      <section
        className="grid gap-4 p-4"
        style={{ border: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div>
          <p className="adm-label-row">
            <span className="adm-label">Department &amp; characteristics</span>
            <AdminHelp>
              Department drives the top-level shop navigation. Characteristics adapt the same
              product page to jewelry, pet accessories, kids products, and jewelry-making supplies.
            </AdminHelp>
          </p>
        </div>

        <label className="grid gap-2 md:max-w-sm">
          <span className="adm-label">Department</span>
          <select name="department" defaultValue={details.department} className="adm-field">
            <option value="">No department</option>
            {SHOP_DEPARTMENTS.map((department) => (
              <option key={department.slug} value={department.slug}>
                {department.name}
              </option>
            ))}
          </select>
        </label>

        {PRODUCT_CHARACTERISTIC_GROUPS.map((group) => (
          <fieldset key={group} className="grid gap-3 border-t pt-4" style={{ borderColor: "var(--adm-border)" }}>
            <legend className="adm-section-tag px-2">{group}</legend>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {PRODUCT_CHARACTERISTICS.filter((item) => item.group === group).map((definition) => {
                const current = details.characteristics[definition.key] ?? { value: definition.type === "BOOLEAN" ? false : "", certificateUrl: "" };
                const name = `characteristic_${definition.key}`;
                if (definition.type === "BOOLEAN") {
                  return (
                    <div key={definition.key} className="grid content-start gap-2 border p-3" style={{ borderColor: "var(--adm-border)" }}>
                      <label className="flex items-center gap-3 text-sm">
                        <input type="checkbox" name={name} defaultChecked={Boolean(current.value)} />
                        <span>{definition.label}</span>
                      </label>
                      {"certificate" in definition ? (
                        <input name={`${name}_certificate`} defaultValue={current.certificateUrl} className="adm-field" placeholder="Certificate URL" type="url" />
                      ) : null}
                    </div>
                  );
                }
                const input = (
                  "multiline" in definition && definition.multiline
                    ? <textarea name={name} defaultValue={String(current.value)} className="adm-field min-h-24" rows={3} />
                    : <input name={name} defaultValue={String(current.value)} className="adm-field min-w-0 flex-1" type={definition.type === "NUMBER" ? "number" : "text"} step={definition.type === "NUMBER" ? "0.01" : undefined} />
                );
                return (
                  <label key={definition.key} className="grid gap-2">
                    <span className="adm-label">{definition.label}</span>
                    <span className={"multiline" in definition && definition.multiline ? "grid" : "flex"}>
                      {input}
                      {"unit" in definition ? <span className="flex items-center border border-l-0 px-3 text-xs text-[var(--adm-muted)]" style={{ borderColor: "var(--adm-border)" }}>{definition.unit}</span> : null}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        ))}
      </section>

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
        <div className="grid gap-4 md:grid-cols-2">
          <input
            name="materialsEyebrow"
            defaultValue={details.materialsEyebrow}
            placeholder="Section eyebrow"
            className="adm-field"
          />
          <input
            name="materialsTitle"
            defaultValue={details.materialsTitle}
            placeholder="Section title"
            className="adm-field"
          />
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
        <div className="grid gap-4 md:grid-cols-2">
          <input
            name="lookbookEyebrow"
            defaultValue={details.lookbookEyebrow}
            placeholder="Section eyebrow"
            className="adm-field"
          />
          <input
            name="lookbookTitle"
            defaultValue={details.lookbookTitle}
            placeholder="Section title"
            className="adm-field"
          />
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
  variantExists = false,
  issues = [],
}: {
  draft: ProductDraft;
  categories: CategoryOption[];
  collections: CollectionOption[];
  variantExists?: boolean;
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
      <div className="flex flex-col gap-2 border border-[var(--adm-border)] bg-[var(--adm-bg-soft)] p-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="adm-section-tag">[ SHOPIFY COMMERCE CORE ]</p>
          <p className="mt-2 text-xs text-[var(--adm-muted)]">Every field is labelled by owner. Shopify fields form the sellable product; Synarava fields enrich it without being overwritten by catalog pulls.</p>
        </div>
        <span className="adm-badge-published w-fit">Shopify-backed</span>
      </div>

      {/* i18n groundwork */}
      <LocaleTabStrip />

      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2">
          <OwnershipLabel owner="Shopify">Name</OwnershipLabel>
          <input
            name="name"
            value={nameValue}
            onChange={(event) => updateName(event.target.value)}
            className="adm-field"
          />
        </label>
        <label className="grid gap-2">
          <OwnershipLabel owner="Shopify">Slug</OwnershipLabel>
          <input
            name="slug"
            value={slugValue}
            onChange={(event) => updateSlug(event.target.value)}
            className="adm-field"
          />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <label className="grid gap-2">
          <OwnershipLabel owner="Shopify">SKU</OwnershipLabel>
          <input name="sku" defaultValue={draft.sku} className="adm-field" />
        </label>
        <label className="grid gap-2">
          <OwnershipLabel owner="Synarava">Series label</OwnershipLabel>
          <input name="seriesLabel" defaultValue={draft.seriesLabel} className="adm-field" />
        </label>
        <label className="grid gap-2">
          <OwnershipLabel owner="Shopify">Price EUR</OwnershipLabel>
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
        <label className="grid gap-2">
          <OwnershipLabel owner="Shopify">Available quantity</OwnershipLabel>
          <input name="stockOnHand" type="number" min="0" step="1" inputMode="numeric" defaultValue={draft.stockOnHand} className="adm-field" />
          <span className="text-xs text-[var(--adm-subtle)]">{variantExists ? "Primary variant inventory synced with Shopify." : "No variant record yet. Enter quantity and save to create the primary variant."}</span>
        </label>
      </div>

      <label className="grid gap-2">
        <OwnershipLabel owner="Synarava">Short description</OwnershipLabel>
        <textarea
          name="shortDescription"
          rows={3}
          defaultValue={draft.shortDescription}
          className="adm-field"
        />
      </label>

      <label className="grid gap-2">
        <OwnershipLabel owner="Shopify">Description</OwnershipLabel>
        <textarea
          name="description"
          rows={4}
          defaultValue={draft.description}
          className="adm-field"
        />
      </label>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2">
          <OwnershipLabel owner="Synarava">Material line</OwnershipLabel>
          <input name="materialLine" defaultValue={draft.materialLine} className="adm-field" />
        </label>
        <label id="field-imageUrl" className="grid gap-2">
          <OwnershipLabel owner="Shopify">Primary product image</OwnershipLabel>
          <AdminIssueInlineWarning issues={issuesForField(issues, "field-imageUrl")} />
          <input type="hidden" name="existingImageUrl" value={draft.imageUrl} />
          <ImageFileField
            name="imageFile"
            currentImageUrl={draft.imageUrl}
            currentImageAlt={draft.name || "Product image"}
            removeFieldName="removeImage"
            removeLabel="Remove"
          />
          <span className="text-xs text-[var(--adm-subtle)]">The primary image is mirrored to Shopify when its URL is publicly reachable. Editorial gallery images remain in Synarava.</span>
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
            <AdminHelp>If empty, the symbolism section stays hidden on the product page.</AdminHelp>
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
          <OwnershipLabel owner="Synarava">Category</OwnershipLabel>
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
          <OwnershipLabel owner="Synarava">Collection</OwnershipLabel>
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
          <OwnershipLabel owner="Shopify push">Tags</OwnershipLabel>
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
        <OwnershipLabel owner="Shopify">Storefront state</OwnershipLabel>
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
      if (result.syncWarning) pushToast({ message: `Saved locally. Sync failed: ${result.syncWarning}`, tone: "error" });

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
        description="This saves the product locally only. Shopify will not change. After save, review the commerce state and use Create in Shopify when ready."
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
  const [isDirty, setIsDirty] = useState(false);
  const [inspection, setInspection] = useState<ProductSyncInspection | null>(null);
  const [conflictResolution, setConflictResolution] = useState<"shopify" | "synarava" | null>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const currentProduct = state.product ?? product;
  const draft = productToDraft(currentProduct);
  const details = getProductEditorDetails(currentProduct.details, currentProduct.characteristics);
  const { pushToast } = useAdminToast();
  const router = useRouter();

  useEffect(() => {
    if (!highlighted || !rowRef.current) return;
    rowRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [highlighted]);

  useEffect(() => {
    if (!product.shopifyProductId) return;
    let cancelled = false;
    void inspectProductSyncAction(product.id).then((result) => {
      if (!cancelled && result.inspection) setInspection(result.inspection);
    });
    return () => { cancelled = true; };
  }, [product.id, product.shopifyProductId]);

  async function formAction(formData: FormData) {
    startTransition(async () => {
      const result = await saveProductAction(formData);
      setState(result);
      setConfirmOpen(false);
      if (result.error) pushToast({ message: result.error, tone: "error" });
      if (result.success) pushToast({ message: result.success, tone: "success" });
      if (result.product) {
        setIsDirty(false);
        setInspection(result.product.shopifyProductId
          ? {
              state: result.product.syncStatus === "CONFLICT" ? "CONFLICT" : result.product.syncStatus === "PENDING" ? "LOCAL_CHANGES" : "SYNCED",
              remoteUpdatedAt: result.product.shopifyUpdatedAt?.toISOString() ?? null,
              publications: inspection?.publications ?? [],
              differences: inspection?.differences ?? [],
            }
          : { state: "UNLINKED", remoteUpdatedAt: null, publications: [], differences: [] });
        onUpdated?.(result.product);
      }
    });
  }

  function handleCheckShopify() {
    startTransition(async () => {
      const result = await inspectProductSyncAction(currentProduct.id);
      if (result.error) pushToast({ message: result.error, tone: "error" });
      if (result.inspection) {
        setInspection(result.inspection);
        pushToast({ message: result.inspection.state === "SYNCED" ? "Shopify is up to date." : "Shopify comparison refreshed.", tone: "success" });
      }
    });
  }

  function handlePushToShopify(force = false) {
    setConflictResolution(null);
    startTransition(async () => {
      const result = await pushSingleProductToShopifyAction(currentProduct.id, force);
      if (result.error) pushToast({ message: result.error, tone: "error" });
      if (result.success) pushToast({ message: result.success, tone: "success" });
      if (result.inspection) setInspection(result.inspection);
      if (result.product) {
        setState({ success: result.success, product: result.product });
        onUpdated?.(result.product);
        router.refresh();
      }
    });
  }

  function handlePullFromShopify(force = false) {
    setConflictResolution(null);
    startTransition(async () => {
      const result = await pullSingleProductFromShopifyAction(currentProduct.id, force);
      if (result.error) pushToast({ message: result.error, tone: "error" });
      if (result.success) pushToast({ message: result.success, tone: "success" });
      if (result.inspection) setInspection(result.inspection);
      if (result.product) {
        setState({ success: result.success, product: result.product });
        setIsDirty(false);
        onUpdated?.(result.product);
        router.refresh();
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
        <form action={formAction} className="grid gap-4" onChange={() => setIsDirty(true)}>
          <input type="hidden" name="productId" value={currentProduct.id} />

          <div
            className="flex flex-wrap items-start justify-between gap-4 pb-4"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
          >
            <div>
              <p className="adm-section-tag">[ EDIT PRODUCT ]</p>
              <h3 className="adm-title-sm mt-2">{currentProduct.name}</h3>
              <p className="mt-1 text-xs" style={{ color: "var(--adm-muted)" }}>
                /{currentProduct.slug}
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
          <ProductSyncStrip
            product={currentProduct}
            dirty={isDirty}
            inspection={inspection}
            pending={isPending}
            onCheck={handleCheckShopify}
            onPull={() => handlePullFromShopify(false)}
            onPush={() => handlePushToShopify(false)}
            onResolve={setConflictResolution}
          />

          <ProductFormFields
            key={`${currentProduct.id}-${new Date(currentProduct.updatedAt).getTime()}`}
            draft={draft}
            categories={categories}
            collections={collections}
            variantExists={currentProduct.variants.length > 0}
            issues={issues}
          />
          <ProductDetailFields
            key={`details-${currentProduct.id}-${new Date(currentProduct.updatedAt).getTime()}`}
            details={details}
            mode="edit"
            issues={issues}
          />

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
        title={`Save ${currentProduct.name}`}
        description="This saves locally only. Shopify will not change. If Shopify-backed commerce fields changed, Push to Shopify becomes available after saving."
        confirmLabel="Yes, save changes"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          const form = rowRef.current?.querySelector("form");
          if (form instanceof HTMLFormElement) form.requestSubmit();
        }}
        pending={isPending}
      />

      <AdminConfirmModal
        open={conflictResolution === "shopify"}
        title="Use Shopify commerce version"
        description="Shopify-backed fields saved in Synarava will be replaced by the current Shopify version. Synarava-only content and editorial media will be preserved."
        confirmLabel="Use Shopify version"
        onCancel={() => setConflictResolution(null)}
        onConfirm={() => handlePullFromShopify(true)}
        pending={isPending}
      />

      <AdminConfirmModal
        open={conflictResolution === "synarava"}
        title="Keep Synarava commerce version"
        description="The saved Synarava commerce values will overwrite the corresponding Shopify fields. Synarava-only content will remain unchanged."
        confirmLabel="Keep Synarava and push"
        onCancel={() => setConflictResolution(null)}
        onConfirm={() => handlePushToShopify(true)}
        pending={isPending}
      />

      <AdminConfirmModal
        open={deleteOpen}
        title={`Delete ${currentProduct.name}`}
        description="This action removes the product record permanently. Public storefront pages for this item will stop working after deletion."
        confirmLabel="Yes, delete permanently"
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => {
          const formData = new FormData();
          formData.set("productId", currentProduct.id);
          formData.set("productSlug", currentProduct.slug);
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
  const [syncPreview, setSyncPreview] = useState<ShopifyReconciliationPreview | null>(null);
  const [selectedRemoteIds, setSelectedRemoteIds] = useState<string[]>([]);
  const [selectedLocalIds, setSelectedLocalIds] = useState<string[]>([]);
  const [selectedArchiveIds, setSelectedArchiveIds] = useState<string[]>([]);
  const [syncConfirmation, setSyncConfirmation] = useState<SyncConfirmation | null>(null);
  const [isRowActionPending, startRowActionTransition] = useTransition();
  const [isConnectionPending, startConnectionTransition] = useTransition();
  const [isPreviewPending, startPreviewTransition] = useTransition();
  const [isSyncPending, startSyncTransition] = useTransition();
  const { pushToast } = useAdminToast();
  const router = useRouter();

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

  function handleTestShopifyConnection() {
    startConnectionTransition(async () => {
      const result = await testShopifyConnectionAction();
      if (result.error) pushToast({ message: result.error, tone: "error" });
      if (result.success) pushToast({ message: result.success, tone: "success" });
    });
  }

  function handlePreviewShopifyReconciliation() {
    startPreviewTransition(async () => {
      const result = await previewShopifyReconciliationAction();
      if (result.error) pushToast({ message: result.error, tone: "error" });
      if (result.success) pushToast({ message: result.success, tone: "success" });
      if (result.preview) {
        setSyncPreview(result.preview);
        setSelectedRemoteIds([]);
        setSelectedLocalIds([]);
        setSelectedArchiveIds([]);
      }
    });
  }

  function toggleSelection(id: string, selected: string[], setSelected: (ids: string[]) => void) {
    setSelected(selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id]);
  }

  function runSync(remoteProductIds: string[], localProductIds: string[]) {
    setSyncConfirmation(null);
    startSyncTransition(async () => {
      const result = await syncShopifySelectionAction({ remoteProductIds, localProductIds });
      if (result.error) pushToast({ message: result.error, tone: "error" });
      if (result.success) pushToast({ message: result.success, tone: "success" });
      if (result.preview) setSyncPreview(result.preview);
      if (result.products?.length) {
        setProducts((current) => {
          const changedIds = new Set(result.products.map((product) => product.id));
          return normalizeProducts([...current.filter((product) => !changedIds.has(product.id)), ...result.products]);
        });
      }
      setSelectedRemoteIds([]);
      setSelectedLocalIds([]);
      router.refresh();
    });
  }

  function runArchive(productIds: string[]) {
    setSyncConfirmation(null);
    startSyncTransition(async () => {
      const result = await archiveMissingShopifyProductsAction(productIds);
      if (result.error) pushToast({ message: result.error, tone: "error" });
      if (result.success) pushToast({ message: result.success, tone: "success" });
      if (result.preview) setSyncPreview(result.preview);
      if (result.products?.length) {
        setProducts((current) => {
          const changedIds = new Set(result.products.map((product) => product.id));
          return normalizeProducts([...current.filter((product) => !changedIds.has(product.id)), ...result.products]);
        });
      }
      setSelectedArchiveIds([]);
      router.refresh();
    });
  }

  function confirmSync(remoteProductIds: string[], localProductIds: string[], title: string) {
    const count = remoteProductIds.length + localProductIds.length;
    setSyncConfirmation({
      title,
      description: `${remoteProductIds.length} product${remoteProductIds.length === 1 ? "" : "s"} will be imported from Shopify and ${localProductIds.length} product${localProductIds.length === 1 ? "" : "s"} will be pushed to Shopify. Archive candidates are not included.`,
      confirmLabel: `Sync ${count} product${count === 1 ? "" : "s"}`,
      remoteProductIds,
      localProductIds,
      archiveProductIds: [],
    });
  }

  function confirmArchive(productIds: string[]) {
    setSyncConfirmation({
      title: "Archive missing local products",
      description: `${productIds.length} local product${productIds.length === 1 ? "" : "s"} no longer found in Shopify will be hidden from the storefront. The records remain available in admin.`,
      confirmLabel: `Archive ${productIds.length} product${productIds.length === 1 ? "" : "s"}`,
      remoteProductIds: [],
      localProductIds: [],
      archiveProductIds: productIds,
      tone: "danger",
    });
  }

  const modalCopy = rowAction ? productActionCopy(rowAction) : null;
  const normalizedQuery = query.trim().toLowerCase();
  const desktopTableGridClass =
    "xl:grid-cols-[minmax(14rem,1.5fr)_7rem_7rem_9rem_minmax(18rem,1fr)]";
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
            <h2 className="adm-title-sm mt-2">Products list</h2>
            <p className="mt-1 text-xs" style={{ color: "var(--adm-muted)" }}>
              {categories.length} categories · {tags.length} tags · {collections.length} collections
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="adm-btn-secondary inline-flex items-center justify-center gap-2"
              onClick={handleTestShopifyConnection}
              disabled={isConnectionPending}
            >
              <RefreshCw className={`size-4 ${isConnectionPending ? "animate-spin" : ""}`} />
              {isConnectionPending ? "Testing Shopify..." : "Test Shopify connection"}
            </button>
            <button
              type="button"
              className="adm-btn-secondary inline-flex items-center justify-center gap-2"
              onClick={handlePreviewShopifyReconciliation}
              disabled={isPreviewPending}
            >
              <Eye className="size-4" />
              {isPreviewPending ? "Reading catalogs..." : "Preview sync"}
            </button>
            <Link href="/admin/products/new" className="adm-btn-primary">
              New product
            </Link>
          </div>
        </div>

        <div
          className="grid gap-3 py-4 sm:grid-cols-2 xl:grid-cols-[minmax(16rem,1fr)_10rem_12rem_12rem]"
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

        {syncPreview ? (
          <section className="mt-4 grid gap-4 border border-[var(--adm-border)] bg-[var(--adm-bg-soft)] p-4">
            <div className="flex flex-col gap-3 border-b border-[var(--adm-border)] pb-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="adm-section-tag">[ SYNC PREVIEW — READY FOR REVIEW ]</p>
                <p className="mt-2 text-xs text-[var(--adm-muted)]">
                  Nothing has changed yet. Select individual products or synchronize every safe action.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="adm-btn-secondary"
                  disabled={isSyncPending || selectedRemoteIds.length + selectedLocalIds.length === 0}
                  onClick={() => confirmSync(selectedRemoteIds, selectedLocalIds, "Sync selected products")}
                >
                  Sync selected ({selectedRemoteIds.length + selectedLocalIds.length})
                </button>
                <button
                  type="button"
                  className="adm-btn-primary"
                  disabled={isSyncPending || syncPreview.remote.every((item) => item.action === "CONFLICT" || item.action === "UP_TO_DATE") && syncPreview.pushToShopify.length === 0}
                  onClick={() => confirmSync(
                    syncPreview.remote.filter((item) => item.action !== "CONFLICT" && item.action !== "UP_TO_DATE").map((item) => item.shopifyProductId),
                    syncPreview.pushToShopify.map((item) => item.productId),
                    "Sync all safe catalog changes",
                  )}
                >
                  {isSyncPending ? "Syncing..." : "Sync all"}
                </button>
              </div>
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <p className="adm-label">From Shopify ({syncPreview.remote.length})</p>
                  <button
                    type="button"
                    className="adm-btn-ghost min-h-8 px-2 py-1 text-[0.62rem]"
                    disabled={isSyncPending || syncPreview.remote.every((item) => item.action === "CONFLICT" || item.action === "UP_TO_DATE")}
                    onClick={() => confirmSync(
                      syncPreview.remote.filter((item) => item.action !== "CONFLICT" && item.action !== "UP_TO_DATE").map((item) => item.shopifyProductId),
                      [],
                      "Import all Shopify changes",
                    )}
                  >
                    Import all
                  </button>
                </div>
                <div className="mt-2 grid gap-2">
                  {syncPreview.remote.map((item) => {
                    const hasConflict = item.action === "CONFLICT";
                    const isUpToDate = item.action === "UP_TO_DATE";
                    const isActionable = !hasConflict && !isUpToDate;
                    const checked = selectedRemoteIds.includes(item.shopifyProductId);
                    return (
                    <div key={item.shopifyProductId} className="flex gap-3 border border-[var(--adm-border)] p-3 text-xs">
                      <input
                        type="checkbox"
                        aria-label={`Select ${item.title} for import`}
                        checked={checked}
                        disabled={!isActionable || isSyncPending}
                        onChange={() => toggleSelection(item.shopifyProductId, selectedRemoteIds, setSelectedRemoteIds)}
                        className="mt-0.5 size-4 shrink-0 !p-0"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-[var(--adm-ink)]">{item.title}</p>
                        <p className="mt-1 text-[var(--adm-muted)]">{item.sku} · {item.action.replaceAll("_", " ")}</p>
                        {item.localName ? <p className="mt-1 text-[var(--adm-subtle)]">Matches local: {item.localName}</p> : null}
                        <button
                          type="button"
                          className="adm-btn-ghost mt-3 inline-flex min-h-8 items-center gap-2 px-2 py-1 text-[0.62rem]"
                          disabled={!isActionable || isSyncPending}
                          onClick={() => runSync([item.shopifyProductId], [])}
                        >
                          <ArrowDownToLine className="size-3.5" />
                          {hasConflict ? "Resolve conflict first" : isUpToDate ? "Up to date" : item.action === "CREATE_LOCAL" ? "Import" : "Pull update"}
                        </button>
                      </div>
                    </div>
                  );})}
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between gap-2">
                  <p className="adm-label">Push to Shopify ({syncPreview.pushToShopify.length})</p>
                  <button
                    type="button"
                    className="adm-btn-ghost min-h-8 px-2 py-1 text-[0.62rem]"
                    disabled={isSyncPending || syncPreview.pushToShopify.length === 0}
                    onClick={() => confirmSync([], syncPreview.pushToShopify.map((item) => item.productId), "Push all local products")}
                  >
                    Push all
                  </button>
                </div>
                <div className="mt-2 grid gap-2">
                  {syncPreview.pushToShopify.map((item) => (
                    <div key={item.productId} className="flex gap-3 border border-[var(--adm-border)] p-3 text-xs">
                      <input
                        type="checkbox"
                        aria-label={`Select ${item.name} to push to Shopify`}
                        checked={selectedLocalIds.includes(item.productId)}
                        disabled={isSyncPending}
                        onChange={() => toggleSelection(item.productId, selectedLocalIds, setSelectedLocalIds)}
                        className="mt-0.5 size-4 shrink-0 !p-0"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-[var(--adm-ink)]">{item.name}</p>
                        <p className="mt-1 text-[var(--adm-muted)]">{item.sku} · /{item.slug}</p>
                        <button
                          type="button"
                          className="adm-btn-ghost mt-3 inline-flex min-h-8 items-center gap-2 px-2 py-1 text-[0.62rem]"
                          disabled={isSyncPending}
                          onClick={() => runSync([], [item.productId])}
                        >
                          <ArrowUpFromLine className="size-3.5" />
                          Push
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between gap-2">
                  <p className="adm-label">Archive locally ({syncPreview.archiveLocal.length})</p>
                  <button
                    type="button"
                    className="adm-btn-danger min-h-8 px-2 py-1 text-[0.62rem]"
                    disabled={isSyncPending || selectedArchiveIds.length === 0}
                    onClick={() => confirmArchive(selectedArchiveIds)}
                  >
                    Archive selected
                  </button>
                </div>
                <div className="mt-2 grid gap-2">
                  {syncPreview.archiveLocal.length === 0 ? (
                    <p className="text-xs text-[var(--adm-muted)]">Nothing would be archived.</p>
                  ) : null}
                  {syncPreview.archiveLocal.map((item) => (
                    <div key={item.productId} className="flex gap-3 border border-[var(--adm-border)] p-3 text-xs">
                      <input
                        type="checkbox"
                        aria-label={`Select ${item.name} to archive locally`}
                        checked={selectedArchiveIds.includes(item.productId)}
                        disabled={isSyncPending}
                        onChange={() => toggleSelection(item.productId, selectedArchiveIds, setSelectedArchiveIds)}
                        className="mt-0.5 size-4 shrink-0 !p-0"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-[var(--adm-ink)]">{item.name}</p>
                        <p className="mt-1 break-all text-[var(--adm-muted)]">{item.shopifyProductId}</p>
                        <button
                          type="button"
                          className="adm-btn-danger mt-3 min-h-8 px-2 py-1 text-[0.62rem]"
                          disabled={isSyncPending}
                          onClick={() => confirmArchive([item.productId])}
                        >
                          Archive
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        ) : null}

        <div className="mt-4 min-w-0 overflow-hidden">
          <div className="grid min-w-0 gap-2">
            <div
              className={`hidden gap-3 px-3 pb-1 xl:grid ${desktopTableGridClass}`}
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
                    className={`grid min-w-0 gap-3 p-3 xl:items-center ${desktopTableGridClass}`}
                    style={{
                      border: "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold" style={{ color: "var(--adm-ink)" }}>
                        {product.name}
                      </p>
                      <p className="mt-0.5 break-words text-xs" style={{ color: "var(--adm-muted)" }}>
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
                    <div className="flex min-w-0 flex-wrap justify-start gap-2 xl:justify-end">
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

      {syncConfirmation ? (
        <AdminConfirmModal
          open
          title={syncConfirmation.title}
          description={syncConfirmation.description}
          confirmLabel={syncConfirmation.confirmLabel}
          tone={syncConfirmation.tone}
          pending={isSyncPending}
          onCancel={() => setSyncConfirmation(null)}
          onConfirm={() => {
            if (syncConfirmation.archiveProductIds.length > 0) {
              runArchive(syncConfirmation.archiveProductIds);
              return;
            }
            runSync(syncConfirmation.remoteProductIds, syncConfirmation.localProductIds);
          }}
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
