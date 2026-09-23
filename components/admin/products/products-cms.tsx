"use client";

import { useCallback, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  deleteProductAction,
  updateProductStatusAction,
  type ProductActionState,
} from "@/app/admin/actions/products";
import { reorderCollectionProductAction } from "@/app/admin/actions/catalog-order";
import {
  archiveMissingShopifyProductsAction,
  checkCatalogConflictsAction,
  previewShopifyReconciliationAction,
  rebindShopifyStoreAction,
  syncShopifySelectionAction,
  testShopifyConnectionAction,
} from "@/app/admin/actions/sync";
import { AdminConfirmModal } from "@/components/admin/shared/admin-confirm-modal";
import { AdminRecordDates, AdminRecordMetaModal } from "@/components/admin/shared/admin-record-meta";
import { useAdminToast } from "@/components/admin/shared/admin-toast";
import { AuthMessage } from "@/components/auth/auth-form-primitives";
import { ProductSyncModal } from "@/components/admin/products/product-sync-modal";
import { CatalogConflictRowBadges, CatalogConflictStatus } from "@/components/admin/products/catalog-conflict-signals";
import { CatalogConflictWorkspace } from "@/components/admin/products/catalog-conflict-workspace";
import type { ShopifyReconciliationPreview } from "@/lib/shopify/product-sync";
import { productLocaleReadiness } from "@/lib/products/localization";
import {
  ChevronDown,
  ChevronUp,
  Eye,
  GripVertical,
  RefreshCw,
} from "lucide-react";
import { moveCollectionItem, syncedOrderPosition } from "@/lib/catalog/collection-order";
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
  initialConflictSignals,
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
  const [shopifyStoreMismatch, setShopifyStoreMismatch] = useState<{
    boundShopDomain: string;
    currentShopDomain: string;
  } | null>(null);
  const [confirmStoreRebind, setConfirmStoreRebind] = useState(false);
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [conflictListOpen, setConflictListOpen] = useState(false);
  const [conflictSignalsOverride, setConflictSignalsOverride] = useState({
    base: initialConflictSignals,
    value: initialConflictSignals,
  });
  const conflictSignals = conflictSignalsOverride.base === initialConflictSignals
    ? conflictSignalsOverride.value
    : initialConflictSignals;
  const [focusedConflictProductId, setFocusedConflictProductId] = useState<string | null>(null);
  const [draggedProductId, setDraggedProductId] = useState<string | null>(null);
  const [isRowActionPending, startRowActionTransition] = useTransition();
  const [isConnectionPending, startConnectionTransition] = useTransition();
  const [isPreviewPending, startPreviewTransition] = useTransition();
  const [isSyncPending, startSyncTransition] = useTransition();
  const [isStoreRebindPending, startStoreRebindTransition] = useTransition();
  const [isOrderPending, startOrderTransition] = useTransition();
  const [isConflictCheckPending, startConflictCheckTransition] = useTransition();
  const { pushToast } = useAdminToast();
  const router = useRouter();
  const closeConflictList = useCallback(() => setConflictListOpen(false), []);

  function setConflictSignals(value: typeof initialConflictSignals) {
    setConflictSignalsOverride({ base: initialConflictSignals, value });
  }

  function showConflicts(productId: string | null = null) {
    setFocusedConflictProductId(productId);
    setConflictListOpen(true);
  }

  function handleConflictCheck() {
    startConflictCheckTransition(async () => {
      const result = await checkCatalogConflictsAction();
      if (!("signals" in result)) {
        pushToast({ message: result.error, tone: "error" });
        return;
      }
      pushToast({ message: result.success, tone: "success" });
      if (result.warning) pushToast({ message: result.warning, tone: "info" });
      setConflictSignals(result.signals);
      if ((result.signals.totalCount ?? 0) > 0) showConflicts();
      router.refresh();
    });
  }

  function handleUpdated(product: ProductRecord) {
    setProducts((current) =>
      normalizeProducts(current.map((item) => (item.id === product.id ? product : item))),
    );
  }

  function applyCollectionOrder(
    current: ProductRecord[],
    collectionId: string,
    orderedProductIds: string[],
  ) {
    const positionByProductId = new Map(
      orderedProductIds.map((productId, sortOrder) => [productId, sortOrder]),
    );
    return current.map((product) => {
      const sortOrder = positionByProductId.get(product.id);
      if (sortOrder == null) return product;
      return {
        ...product,
        collections: product.collections.map((membership) => (
          membership.collection.id === collectionId ? { ...membership, sortOrder } : membership
        )),
      };
    });
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
        if (result.warning) pushToast({ message: result.warning, tone: "info" });
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
      if (result.warning) pushToast({ message: result.warning, tone: "info" });
      setShopifyStoreMismatch(result.storeMismatch ?? null);
    });
  }

  function handleStoreRebind() {
    if (!shopifyStoreMismatch) return;
    startStoreRebindTransition(async () => {
      const result = await rebindShopifyStoreAction(shopifyStoreMismatch.currentShopDomain);
      if (result.error) pushToast({ message: result.error, tone: "error" });
      if (result.success) {
        pushToast({ message: result.success, tone: "success" });
        setShopifyStoreMismatch(null);
        setSyncPreview(null);
        router.refresh();
      }
      setConfirmStoreRebind(false);
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
        setSyncModalOpen(true);
      }
    });
  }

  function handleResolved(shopifyProductId: string, updatedProduct?: ProductRecord) {
    if (updatedProduct) {
      setProducts((current) => normalizeProducts([
        ...current.filter((product) => product.id !== updatedProduct.id),
        updatedProduct,
      ]));
    }
    setSyncPreview((current) => current
      ? { ...current, remote: current.remote.filter((item) => item.shopifyProductId !== shopifyProductId) }
      : current);
    router.refresh();
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
      if (result.warning) pushToast({ message: result.warning, tone: "info" });
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
      description: `${productIds.length} local product${productIds.length === 1 ? "" : "s"} no longer found in Shopify will be hidden from the site. The records remain available in admin.`,
      confirmLabel: `Archive ${productIds.length} product${productIds.length === 1 ? "" : "s"}`,
      remoteProductIds: [],
      localProductIds: [],
      archiveProductIds: productIds,
      tone: "danger",
    });
  }

  const modalCopy = rowAction ? productActionCopy(rowAction) : null;
  const normalizedQuery = query.trim().toLowerCase();
  const selectedCollection = collections.find((collection) => collection.id === collectionFilter);
  const priorityMode = Boolean(selectedCollection) && sortBy === "collection-priority";
  const hasNarrowingFilters = Boolean(normalizedQuery) || statusFilter !== "ALL" || categoryFilter !== "ALL";
  const canReorder = priorityMode && !hasNarrowingFilters && Boolean(selectedCollection?.shopifyCollectionId);
  const desktopTableGridClass = selectedCollection
    ? "xl:grid-cols-[9rem_minmax(14rem,1.5fr)_7rem_7rem_9rem_minmax(18rem,1fr)]"
    : "xl:grid-cols-[minmax(14rem,1.5fr)_7rem_7rem_9rem_minmax(18rem,1fr)]";
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
      product.collections.some((item) => item.collection.id === collectionFilter);

    return matchesQuery && matchesStatus && matchesCategory && matchesCollection;
  });
  const sortedProducts = sortProducts(filteredProducts, sortBy, selectedCollection?.id);

  function moveProduct(productId: string, newPosition: number) {
    if (!canReorder || !selectedCollection || isOrderPending) return;
    const currentOrder = sortedProducts.map((product) => product.id);
    const nextOrder = moveCollectionItem(currentOrder, productId, newPosition);
    if (nextOrder.every((id, index) => id === currentOrder[index])) return;

    const shopifySyncedIds = new Set(
      sortedProducts.filter((product) => product.shopifyProductId).map((product) => product.id),
    );
    const shopifyPosition = syncedOrderPosition(nextOrder, shopifySyncedIds, productId);

    setProducts((current) => applyCollectionOrder(current, selectedCollection.id, nextOrder));
    startOrderTransition(async () => {
      const result = await reorderCollectionProductAction({
        collectionId: selectedCollection.id,
        productId,
        newPosition: shopifyPosition,
      });
      if (result.error) {
        setProducts((current) => applyCollectionOrder(current, selectedCollection.id, currentOrder));
        pushToast({ message: result.error, tone: "error" });
        return;
      }
      if (result.orderedProductIds) {
        setProducts((current) => applyCollectionOrder(
          current,
          selectedCollection.id,
          result.orderedProductIds!,
        ));
      }
      if (result.success) pushToast({ message: result.success, tone: "success" });
    });
  }

  return (
    <section data-component="ProductsCms" className="grid gap-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="adm-section-tag mb-3">[ SYN-ADM // CAT ]</p>
          <h1 className="adm-page-title">Catalog</h1>
          <p className="adm-page-subtitle">Products, categories, tags, media, and site publishing state.</p>
        </div>
        <CatalogConflictStatus signals={conflictSignals} onShow={() => showConflicts()} onCheck={handleConflictCheck} checking={isConflictCheckPending} />
      </div>
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
            <CatalogConflictStatus signals={conflictSignals} onShow={() => showConflicts()} onCheck={handleConflictCheck} checking={isConflictCheckPending} compact />
            <button
              type="button"
              className="adm-btn-secondary inline-flex items-center justify-center gap-2"
              onClick={handleTestShopifyConnection}
              disabled={isConnectionPending}
            >
              <RefreshCw className={`size-4 ${isConnectionPending ? "animate-spin" : ""}`} />
              {isConnectionPending ? "Checking Shopify..." : "Check Shopify link"}
            </button>
            {shopifyStoreMismatch ? (
              <button
                type="button"
                className="adm-btn-danger inline-flex items-center justify-center gap-2"
                onClick={() => setConfirmStoreRebind(true)}
                disabled={isStoreRebindPending}
              >
                Rebind to {shopifyStoreMismatch.currentShopDomain}
              </button>
            ) : null}
            <button
              type="button"
              className="adm-btn-secondary inline-flex items-center justify-center gap-2"
              onClick={() => syncPreview ? setSyncModalOpen(true) : handlePreviewShopifyReconciliation()}
              disabled={isPreviewPending}
            >
              <Eye className="size-4" />
              {isPreviewPending ? "Comparing catalogs..." : "Compare catalogs"}
            </button>
            <Link href="/admin/products/new" className="adm-btn-primary">
              New product
            </Link>
          </div>
        </div>
        <p className="py-3 text-xs leading-5 text-[var(--adm-muted)]">
          Check Shopify link verifies access and links this catalog to the store on first use; it can also register review webhooks. Compare catalogs opens the existing sync review — nothing is changed until you choose an action there. To reload every field of a product marked up to date, open it and choose Refresh from Shopify.
        </p>

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
              onChange={(event) => {
                const value = event.target.value;
                setCollectionFilter(value);
                setSortBy(value === "ALL" ? "published" : "collection-priority");
              }}
              className="adm-field"
            >
              <option value="ALL">All collections</option>
              {collections.map((collection) => (
                <option key={collection.id} value={collection.id}>
                  {collection.name}{collection.isStorefrontDefault ? " (global priority)" : ""}
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

        {selectedCollection ? (
          <div
            className="mt-4 flex flex-col gap-1 border border-[var(--adm-border)] bg-[var(--adm-bg-soft)] px-4 py-3 text-xs md:flex-row md:items-center md:justify-between"
            role="status"
            aria-live="polite"
          >
            <span className="font-semibold text-[var(--adm-ink)]">
              Shopify order · {selectedCollection.name}
            </span>
            <span className="text-[var(--adm-muted)]">
              {!selectedCollection.shopifyCollectionId
                ? "Sync this collection with Shopify to arrange products."
                : !priorityMode
                  ? "Choose Collection priority under Sort by to arrange products."
                  : hasNarrowingFilters
                    ? "Clear search, status, and category filters before arranging the full collection."
                    : isOrderPending
                      ? "Saving the new position in Shopify…"
                      : "Drag a handle or use the arrow buttons. Changes save immediately."}
            </span>
          </div>
        ) : null}

        <div className="mt-4 min-w-0 overflow-hidden">
          <div className="grid min-w-0 gap-2">
            <div
              className={`hidden gap-3 px-3 pb-1 xl:grid ${desktopTableGridClass}`}
              style={{ color: "var(--adm-subtle)" }}
            >
              {selectedCollection ? <span className="text-[0.62rem] font-bold uppercase tracking-[0.1em]">Priority</span> : null}
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
                const enReadiness = productLocaleReadiness(product, "en");
                const ptReadiness = productLocaleReadiness(product, "pt");
                const ptTranslation = product.translations.find((translation) => translation.locale === "pt");

                return (
                  <div
                    key={product.id}
                    className={`grid min-w-0 gap-3 p-3 transition-colors xl:items-center ${desktopTableGridClass} ${
                      draggedProductId && draggedProductId !== product.id ? "outline outline-1 outline-transparent hover:outline-[var(--adm-accent)]" : ""
                    }`}
                    style={{
                      border: "1px solid var(--adm-border)",
                    }}
                    onDragOver={(event) => {
                      if (canReorder) event.preventDefault();
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      const sourceId = event.dataTransfer.getData("text/plain") || draggedProductId;
                      setDraggedProductId(null);
                      if (!sourceId || sourceId === product.id) return;
                      moveProduct(sourceId, sortedProducts.findIndex((item) => item.id === product.id));
                    }}
                  >
                    {selectedCollection ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          className="adm-btn-ghost grid size-11 cursor-grab place-items-center p-0 active:cursor-grabbing"
                          draggable={canReorder && Boolean(product.shopifyProductId)}
                          disabled={!canReorder || !product.shopifyProductId || isOrderPending}
                          aria-label={`Drag ${product.name} to change its priority`}
                          title={product.shopifyProductId ? "Drag to change priority" : "Sync product with Shopify first"}
                          onDragStart={(event) => {
                            setDraggedProductId(product.id);
                            event.dataTransfer.effectAllowed = "move";
                            event.dataTransfer.setData("text/plain", product.id);
                          }}
                          onDragEnd={() => setDraggedProductId(null)}
                        >
                          <GripVertical className="size-4" aria-hidden="true" />
                        </button>
                        <div className="flex gap-0.5">
                          <button
                            type="button"
                            className="adm-btn-ghost grid size-11 place-items-center p-0"
                            disabled={!canReorder || !product.shopifyProductId || isOrderPending || sortedProducts[0]?.id === product.id}
                            aria-label={`Move ${product.name} up`}
                            onClick={() => moveProduct(product.id, sortedProducts.findIndex((item) => item.id === product.id) - 1)}
                          >
                            <ChevronUp className="size-3.5" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            className="adm-btn-ghost grid size-11 place-items-center p-0"
                            disabled={!canReorder || !product.shopifyProductId || isOrderPending || sortedProducts.at(-1)?.id === product.id}
                            aria-label={`Move ${product.name} down`}
                            onClick={() => moveProduct(product.id, sortedProducts.findIndex((item) => item.id === product.id) + 1)}
                          >
                            <ChevronDown className="size-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    ) : null}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold" style={{ color: "var(--adm-ink)" }}>
                        {product.name}
                      </p>
                      <p className="mt-0.5 break-words text-xs" style={{ color: "var(--adm-muted)" }}>
                        /{product.slug}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <span className={enReadiness.complete && enReadiness.reviewed ? "adm-badge-published" : "adm-badge-draft"}>
                          EN {enReadiness.percent}%
                        </span>
                        <span className={ptReadiness.complete && ptReadiness.reviewed ? "adm-badge-published" : "adm-badge-draft"}>
                          PT {ptReadiness.percent}%
                        </span>
                        {ptTranslation ? (
                          <span className={ptTranslation.syncStatus === "SYNCED" ? "adm-badge-published" : "adm-badge-draft"}>
                            PT {ptTranslation.syncStatus.replace("NOT_APPLICABLE", "LOCAL")}
                          </span>
                        ) : null}
                      </div>
                      {conflictSignals.products[product.id] ? (
                        <CatalogConflictRowBadges
                          productName={product.name}
                          signal={conflictSignals.products[product.id]}
                          onShow={() => showConflicts(product.id)}
                        />
                      ) : null}
                      {conflictSignals.recentlyUpdatedProducts[product.id] ? (
                        <Link
                          href={`/admin/products/${product.id}`}
                          className="mt-2 inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-[var(--adm-warning)] px-2 py-1 text-[0.68rem] font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--adm-warning)]"
                          title="Shopify values were applied after your last visit. Open the editor to review them."
                        >
                          <Eye className="size-3.5" aria-hidden="true" />Updated from Shopify · review
                        </Link>
                      ) : null}
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
                    <span data-role="workflow-status" className={status === "PUBLISHED" ? "adm-badge-published" : "adm-badge-draft"}>
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

      <CatalogConflictWorkspace
        open={conflictListOpen}
        onClose={closeConflictList}
        signals={conflictSignals}
        onSignalsChange={setConflictSignals}
        products={products.map((product) => ({ id: product.id, name: product.name, sku: product.sku }))}
        focusedProductId={focusedConflictProductId}
        onToast={(message, tone) => pushToast({ message, tone })}
      />

      <ProductSyncModal
        open={syncModalOpen}
        onClose={() => setSyncModalOpen(false)}
        preview={syncPreview}
        pending={isSyncPending}
        selectedRemoteIds={selectedRemoteIds}
        setSelectedRemoteIds={setSelectedRemoteIds}
        selectedLocalIds={selectedLocalIds}
        setSelectedLocalIds={setSelectedLocalIds}
        selectedArchiveIds={selectedArchiveIds}
        setSelectedArchiveIds={setSelectedArchiveIds}
        toggleSelection={toggleSelection}
        runSync={runSync}
        confirmSync={confirmSync}
        confirmArchive={confirmArchive}
        onResolved={handleResolved}
      />

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

      {shopifyStoreMismatch ? (
        <AdminConfirmModal
          open={confirmStoreRebind}
          title="Rebind catalog to another Shopify store"
          description={`Synarava is linked to ${shopifyStoreMismatch.boundShopDomain}. Rebinding to ${shopifyStoreMismatch.currentShopDomain} clears only the old store-specific product, variant, inventory, and collection IDs. It does not delete local content or Shopify products. Afterward, run Compare catalogs to match the duplicated catalog by SKU or handle.`}
          confirmLabel="Rebind store IDs"
          tone="danger"
          pending={isStoreRebindPending}
          onCancel={() => setConfirmStoreRebind(false)}
          onConfirm={handleStoreRebind}
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
