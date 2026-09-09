"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  deleteProductAction,
  updateProductStatusAction,
  type ProductActionState,
} from "@/app/admin/actions/products";
import {
  archiveMissingShopifyProductsAction,
  previewShopifyReconciliationAction,
  syncShopifySelectionAction,
  testShopifyConnectionAction,
} from "@/app/admin/actions/sync";
import { AdminConfirmModal } from "@/components/admin/shared/admin-confirm-modal";
import { AdminRecordDates, AdminRecordMetaModal } from "@/components/admin/shared/admin-record-meta";
import { useAdminToast } from "@/components/admin/shared/admin-toast";
import { AuthMessage } from "@/components/auth/auth-form-primitives";
import type { ShopifyReconciliationPreview } from "@/lib/shopify/product-sync";
import { ArrowDownToLine, ArrowUpFromLine, Eye, RefreshCw } from "lucide-react";
import {
  centsToPrice,
  PRODUCT_SORT_OPTIONS,
  productActionCopy,
  productStatusLabel,
  normalizeProducts,
  sortProducts,
  type ProductSortKey,
} from "@/components/admin/products/product-helpers";
import type {
  ProductCmsProps,
  ProductRecord,
  ProductRowAction,
  SyncConfirmation,
} from "@/components/admin/products/product-types";

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
  const [sortBy, setSortBy] = useState<ProductSortKey>("published");
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
      categoryFilter === "ALL" || product.shopifyCategoryId === categoryFilter;
    const matchesCollection =
      collectionFilter === "ALL" ||
      product.collections.some((item) => item.collection.slug === collectionFilter);

    return matchesQuery && matchesStatus && matchesCategory && matchesCollection;
  });
  const sortedProducts = sortProducts(filteredProducts, sortBy);

  return (
    <section data-component="ProductsCms" className="grid gap-6">
      <div className="adm-panel p-5">
        <div
          className="flex flex-col gap-3 pb-4 md:flex-row md:items-end md:justify-between"
          style={{ borderBottom: "1px solid var(--adm-border)" }}
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
          className="grid gap-3 py-4 sm:grid-cols-2 xl:grid-cols-[minmax(14rem,1fr)_9rem_10rem_10rem_11rem]"
          style={{ borderBottom: "1px solid var(--adm-border)" }}
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
              <option value="UNLISTED">Unlisted</option>
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
                <option key={category.slug} value={category.slug}>
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
          <label className="grid gap-2">
            <span className="adm-label">Sort by</span>
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as ProductSortKey)}
              className="adm-field"
            >
              {PRODUCT_SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
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
                  Shopify webhooks pull changes automatically. An action appears only while the local copy still differs.
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
                        {item.changes.length > 0 ? (
                          <p className="mt-1 text-[var(--adm-subtle)]">Shopify changed: {item.changes.join(", ")}</p>
                        ) : null}
                        <button
                          type="button"
                          className="adm-btn-ghost mt-3 inline-flex min-h-8 items-center gap-2 px-2 py-1 text-[0.62rem]"
                          disabled={!isActionable || isSyncPending}
                          onClick={() => runSync([item.shopifyProductId], [])}
                        >
                          <ArrowDownToLine className="size-3.5" />
                          {hasConflict ? "Resolve conflict first" : isUpToDate ? "Already synced" : item.action === "CREATE_LOCAL" ? "Import" : "Pull update"}
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

            {sortedProducts.length > 0 ? (
              sortedProducts.map((product) => {
                const status = productStatusLabel(product);
                const productIssues = issues.filter(
                  (issue) => issue.entityType === "PRODUCT" && issue.entityId === product.id,
                );

                return (
                  <div
                    key={product.id}
                    className={`grid min-w-0 gap-3 p-3 xl:items-center ${desktopTableGridClass}`}
                    style={{
                      border: "1px solid var(--adm-border)",
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
                      <p className="mt-1 text-xs" style={{ color: "var(--adm-subtle)" }}>
                        {product.publishedAt
                          ? `Published ${new Date(product.publishedAt).toLocaleDateString("en-IE", { dateStyle: "medium" })}`
                          : "Not published yet"}
                      </p>
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
                      {centsToPrice(product.variants[0]?.priceCents ?? product.priceCents)} EUR
                    </span>
                    <span className="text-xs font-semibold" style={{ color: "var(--adm-muted)" }}>
                      {product.shopifyCategoryName ?? "No category"}
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
