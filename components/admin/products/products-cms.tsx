"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { refreshPreservingScroll } from "@/lib/admin/preserve-scroll";
import {
  Archive,
  ChevronDown,
  ChevronUp,
  Eye,
  FilePenLine,
  GripVertical,
  Info,
  RotateCcw,
  Trash2,
  Upload,
} from "lucide-react";

import {
  deleteProductAction,
  updateProductStatusAction,
  type ProductActionState,
  type SavedProductPayload,
} from "@/app/admin/actions/products";
import { reorderCollectionProductAction } from "@/app/admin/actions/catalog-order";
import {
  checkCatalogConflictsAction,
  rebindShopifyStoreAction,
} from "@/app/admin/actions/sync";
import { runCommerceStoreConsoleFlow } from "@/components/admin/products/commerce-store-console-flow";
import { AdminConfirmModal } from "@/components/admin/shared/admin-confirm-modal";
import { AdminRecordMetaModal } from "@/components/admin/shared/admin-record-meta";
import { useAdminToast } from "@/components/admin/shared/admin-toast";
import { AuthMessage } from "@/components/auth/auth-form-primitives";
import { CatalogConflictStatus } from "@/components/admin/products/catalog-conflict-signals";
import { CatalogConflictWorkspace, type CatalogConflictViewScope } from "@/components/admin/products/catalog-conflict-workspace";
import { ProductListMetaLine, ProductListSignals } from "@/components/admin/products/product-list-signals";
import { collectionSelectOptionLabel } from "@/lib/admin/collection-select-options";
import {
  AdminEntityList,
  AdminIconButton,
  AdminListWorkspace,
  AdminSelectField,
  AdminSortChips,
  AdminStatusBadge,
  AdminTextField,
} from "@/components/synarava-cms";
import {
  centsToPrice,
  productActionCopy,
} from "@/components/admin/products/product-helpers";
import type {
  ProductCmsProps,
  ProductRowAction,
} from "@/components/admin/products/product-types";
import {
  ADMIN_PRODUCT_SORT_OPTIONS,
  listItemStatusLabel,
  type AdminProductListItem,
  type AdminProductListPage,
  type AdminProductSortKey,
} from "@/lib/admin/list-products-shared";
import { moveCollectionItem, syncedOrderPosition } from "@/lib/catalog/collection-order";

function patchListItem(item: AdminProductListItem, saved: SavedProductPayload): AdminProductListItem {
  return {
    ...item,
    name: saved.name,
    slug: saved.slug,
    sku: saved.sku,
    status: saved.status,
    visibility: saved.visibility,
    priceCents: saved.variants[0]?.priceCents ?? saved.priceCents,
    shopifyCategoryId: saved.shopifyCategoryId,
    shopifyCategoryName: saved.shopifyCategoryName,
    shopifyProductId: saved.shopifyProductId,
    publishedAt: saved.publishedAt ? new Date(saved.publishedAt).toISOString() : null,
    updatedAt: new Date(saved.updatedAt).toISOString(),
    collections: saved.collections.map((membership) => {
      const previous = item.collections.find((entry) => entry.collection.id === membership.collection.id);
      return {
        sortOrder: membership.sortOrder,
        collection: {
          id: membership.collection.id,
          shopifyCollectionId: previous?.collection.shopifyCollectionId ?? null,
        },
      };
    }),
  };
}

async function fetchProductPage(params: {
  q: string;
  status: string;
  category: string;
  collection: string;
  sort: AdminProductSortKey;
  cursor?: string | null;
}): Promise<AdminProductListPage> {
  const search = new URLSearchParams();
  if (params.q.trim()) search.set("q", params.q.trim());
  if (params.status !== "ALL") search.set("status", params.status);
  if (params.category !== "ALL") search.set("category", params.category);
  if (params.collection !== "ALL") search.set("collection", params.collection);
  search.set("sort", params.sort);
  if (params.cursor) search.set("cursor", params.cursor);

  const response = await fetch(`/admin/api/products?${search.toString()}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Could not load products.");
  return response.json() as Promise<AdminProductListPage>;
}

export function ProductsCms({
  initialPage,
  categories,
  tags,
  collections,
  initialConflictSignals,
}: ProductCmsProps) {
  const [products, setProducts] = useState<AdminProductListItem[]>(initialPage.nodes);
  const [hasNextPage, setHasNextPage] = useState(initialPage.hasNextPage);
  const [endCursor, setEndCursor] = useState<string | null>(initialPage.endCursor);
  const [totalCount, setTotalCount] = useState(initialPage.totalCount);
  const [loadingMore, setLoadingMore] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [collectionFilter, setCollectionFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState<AdminProductSortKey>("published");

  const [rowAction, setRowAction] = useState<ProductRowAction | null>(null);
  const [editingProduct, setEditingProduct] = useState<AdminProductListItem | null>(null);
  const [rowActionState, setRowActionState] = useState<ProductActionState>({});
  const [shopifyStoreMismatch, setShopifyStoreMismatch] = useState<{
    boundShopDomain: string;
    currentShopDomain: string;
  } | null>(null);
  const [confirmStoreRebind, setConfirmStoreRebind] = useState(false);
  const [conflictListOpen, setConflictListOpen] = useState(false);
  const [conflictViewScope, setConflictViewScope] = useState<CatalogConflictViewScope>({ kind: "catalog" });
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
  const [isStoreRebindPending, startStoreRebindTransition] = useTransition();
  const [isOrderPending, startOrderTransition] = useTransition();
  const [isConflictCheckPending, startConflictCheckTransition] = useTransition();
  const { pushToast } = useAdminToast();
  const router = useRouter();
  const closeConflictList = useCallback(() => {
    setConflictListOpen(false);
    setFocusedConflictProductId(null);
    setConflictViewScope({ kind: "catalog" });
  }, []);
  const requestIdRef = useRef(0);
  const skipFilterFetchRef = useRef(true);

  function setConflictSignals(value: typeof initialConflictSignals) {
    setConflictSignalsOverride({ base: initialConflictSignals, value });
  }

  function showConflicts(productId: string | null = null) {
    setFocusedConflictProductId(productId);
    setConflictViewScope(productId ? { kind: "product", productId } : { kind: "catalog" });
    setConflictListOpen(true);
  }

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 280);
    return () => clearTimeout(timer);
  }, [query]);

  // Dual full-store foundation: stepped console flow on admin products entry.
  useEffect(() => {
    void runCommerceStoreConsoleFlow("products-list").catch((error) => {
      console.error("[commerce-store] FLOW EXCEPTION", error);
    });
  }, []);

  useEffect(() => {
    if (skipFilterFetchRef.current) {
      skipFilterFetchRef.current = false;
      return;
    }
    const requestId = ++requestIdRef.current;
    setListError(null);
    void fetchProductPage({
      q: debouncedQuery,
      status: statusFilter,
      category: categoryFilter,
      collection: collectionFilter,
      sort: sortBy,
    })
      .then((page) => {
        if (requestIdRef.current !== requestId) return;
        setProducts(page.nodes);
        setHasNextPage(page.hasNextPage);
        setEndCursor(page.endCursor);
        setTotalCount(page.totalCount);
      })
      .catch(() => {
        if (requestIdRef.current !== requestId) return;
        setListError("Could not refresh the product list.");
      });
  }, [debouncedQuery, statusFilter, categoryFilter, collectionFilter, sortBy]);

  const loadMore = useCallback(() => {
    if (!hasNextPage || loadingMore || !endCursor) return;
    setLoadingMore(true);
    const requestId = ++requestIdRef.current;
    void fetchProductPage({
      q: debouncedQuery,
      status: statusFilter,
      category: categoryFilter,
      collection: collectionFilter,
      sort: sortBy,
      cursor: endCursor,
    })
      .then((page) => {
        if (requestIdRef.current !== requestId) return;
        setProducts((current) => {
          const seen = new Set(current.map((item) => item.id));
          return [...current, ...page.nodes.filter((item) => !seen.has(item.id))];
        });
        setHasNextPage(page.hasNextPage);
        setEndCursor(page.endCursor);
        setTotalCount(page.totalCount);
      })
      .catch(() => {
        if (requestIdRef.current !== requestId) return;
        setListError("Could not load more products.");
      })
      .finally(() => {
        if (requestIdRef.current === requestId) setLoadingMore(false);
      });
  }, [hasNextPage, loadingMore, endCursor, debouncedQuery, statusFilter, categoryFilter, collectionFilter, sortBy]);

  function handleConflictCheck() {
    startConflictCheckTransition(async () => {
      const result = await checkCatalogConflictsAction();
      if (!("signals" in result)) {
        pushToast({ message: result.error, tone: "error" });
        setShopifyStoreMismatch("storeMismatch" in result ? result.storeMismatch ?? null : null);
        return;
      }
      setShopifyStoreMismatch(null);
      pushToast({ message: result.success, tone: "success" });
      if (result.warning) pushToast({ message: result.warning, tone: "info" });
      setConflictSignals(result.signals);
      if ((result.signals.totalCount ?? 0) > 0) showConflicts();
      refreshPreservingScroll(router);
    });
  }

  function applyCollectionOrder(
    current: AdminProductListItem[],
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
          setProducts((current) => current.filter((item) => item.id !== result.deletedProductId));
          setTotalCount((count) => Math.max(0, count - 1));
        }
      } else {
        formData.set("action", rowAction.action);
        const result = await updateProductStatusAction(formData);
        setRowActionState(result);
        if (result.error) pushToast({ message: result.error, tone: "error" });
        if (result.success) pushToast({ message: result.success, tone: "success" });
        if (result.warning) pushToast({ message: result.warning, tone: "info" });
        if (result.product) {
          setProducts((current) =>
            current.map((item) => (item.id === result.product!.id ? patchListItem(item, result.product!) : item)),
          );
        }
      }

      setRowAction(null);
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
        refreshPreservingScroll(router);
      }
      setConfirmStoreRebind(false);
    });
  }

  const modalCopy = rowAction ? productActionCopy(rowAction) : null;
  const selectedCollection = collections.find((collection) => collection.id === collectionFilter);
  const priorityMode = Boolean(selectedCollection) && sortBy === "collection-priority";
  const hasNarrowingFilters = Boolean(debouncedQuery.trim()) || statusFilter !== "ALL" || categoryFilter !== "ALL";
  const canReorder = priorityMode && !hasNarrowingFilters && Boolean(selectedCollection?.shopifyCollectionId);
  const filterSummaryParts = [
    query.trim() ? `“${query.trim()}”` : null,
    statusFilter !== "ALL" ? statusFilter : null,
    categoryFilter !== "ALL"
      ? (categories.find((category) => category.slug === categoryFilter)?.name ?? categoryFilter)
      : null,
    collectionFilter !== "ALL"
      ? (collections.find((collection) => collection.id === collectionFilter)?.name ?? "Collection")
      : null,
  ].filter(Boolean);
  const filterSummary = filterSummaryParts.length > 0 ? filterSummaryParts.join(" · ") : undefined;
  // Actions: 4×2rem icons + 3×0.25rem gaps ≈ 8.75rem — keep nowrap (see AdminIconButton).
  const desktopTableGridClass = selectedCollection
    ? "xl:grid-cols-[5.5rem_minmax(12rem,1.6fr)_5.5rem_5rem_minmax(7rem,0.9fr)_9rem]"
    : "xl:grid-cols-[minmax(12rem,1.6fr)_5.5rem_5rem_minmax(7rem,0.9fr)_9rem]";

  const sortOptions = ADMIN_PRODUCT_SORT_OPTIONS.map((option) => ({
    ...option,
    hidden: option.value === "collection-priority" && !selectedCollection,
  }));

  function moveProduct(productId: string, newPosition: number) {
    if (!canReorder || !selectedCollection || isOrderPending) return;
    const currentOrder = products.map((product) => product.id);
    const nextOrder = moveCollectionItem(currentOrder, productId, newPosition);
    if (nextOrder.every((id, index) => id === currentOrder[index])) return;

    const shopifySyncedIds = new Set(
      products.filter((product) => product.shopifyProductId).map((product) => product.id),
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
      <AdminListWorkspace.Root>
        <AdminListWorkspace.Header
          tag="[ CURRENT CATALOG ]"
          title="Products list"
          meta={`${products.length} of ${totalCount} · ${categories.length} categories · ${tags.length} tags · ${collections.length} collections`}
          actions={
            <>
              <CatalogConflictStatus signals={conflictSignals} onShow={() => showConflicts()} onCheck={handleConflictCheck} checking={isConflictCheckPending} compact />
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
              <Link href="/admin/products/new" className="adm-btn-primary">
                New product
              </Link>
            </>
          }
        >
          <AdminListWorkspace.Filters summary={filterSummary}>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(12rem,1.2fr)_8rem_9rem_9rem]">
              <AdminTextField
                label="Search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Name, slug, SKU"
                clearable
              />
              <AdminSelectField
                label="Status"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="ALL">All</option>
                <option value="PUBLISHED">Published</option>
                <option value="DRAFT">Draft</option>
                <option value="UNLISTED">Unlisted</option>
                <option value="ARCHIVED">Archived</option>
              </AdminSelectField>
              <AdminSelectField
                label="Category"
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
              >
                <option value="ALL">All categories</option>
                {categories.map((category) => (
                  <option key={category.slug} value={category.slug}>
                    {category.name}
                  </option>
                ))}
              </AdminSelectField>
              <AdminSelectField
                label="Collection"
                value={collectionFilter}
                onChange={(event) => {
                  const value = event.target.value;
                  setCollectionFilter(value);
                  setSortBy(value === "ALL" ? "published" : "collection-priority");
                }}
              >
                <option value="ALL">All collections</option>
                {collections.map((collection) => (
                  <option key={collection.id} value={collection.id}>
                    {collectionSelectOptionLabel(collection)}
                    {collection.isStorefrontDefault ? " (global priority)" : ""}
                  </option>
                ))}
              </AdminSelectField>
            </div>
            <AdminSortChips
              value={sortBy}
              options={sortOptions}
              onChange={setSortBy}
            />
          </AdminListWorkspace.Filters>
        </AdminListWorkspace.Header>

        <AdminListWorkspace.Body>
        <AuthMessage error={rowActionState.error ?? listError ?? undefined} />

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
                  ? "Choose Priority under Sort to arrange products."
                  : hasNarrowingFilters
                    ? "Clear search, status, and category filters before arranging the full collection."
                    : isOrderPending
                      ? "Saving the new position in Shopify…"
                      : "Drag a handle or use the arrow buttons. Changes save immediately."}
            </span>
          </div>
        ) : null}

        <AdminEntityList.Root>
          <AdminEntityList.Header
            gridClassName={desktopTableGridClass}
            leading={selectedCollection ? <span className="text-[0.62rem] font-bold uppercase tracking-[0.1em]">Order</span> : null}
            columns={[
              { key: "product", label: "Product" },
              { key: "status", label: "Status" },
              { key: "price", label: "Price" },
              { key: "category", label: "Category" },
              { key: "actions", label: "Actions", align: "end" },
            ]}
          />

          {products.length > 0 ? (
            products.map((product) => {
              const status = listItemStatusLabel(product);
              const conflict = conflictSignals.products[product.id];

              return (
                <AdminEntityList.Row
                  key={product.id}
                  gridClassName={desktopTableGridClass}
                  className={draggedProductId && draggedProductId !== product.id ? "outline outline-1 outline-transparent hover:outline-[var(--adm-accent)]" : undefined}
                  onDragOver={(event) => {
                    if (canReorder) event.preventDefault();
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    const sourceId = event.dataTransfer.getData("text/plain") || draggedProductId;
                    setDraggedProductId(null);
                    if (!sourceId || sourceId === product.id) return;
                    moveProduct(sourceId, products.findIndex((item) => item.id === product.id));
                  }}
                >
                  {selectedCollection ? (
                    <div className="flex items-center gap-0.5">
                      <AdminIconButton
                        label={`Drag ${product.name} to change its priority`}
                        tooltip={product.shopifyProductId ? "Drag to change priority" : "Sync product with Shopify first"}
                        draggable={canReorder && Boolean(product.shopifyProductId)}
                        disabled={!canReorder || !product.shopifyProductId || isOrderPending}
                        className="cursor-grab active:cursor-grabbing"
                        onDragStart={(event) => {
                          setDraggedProductId(product.id);
                          event.dataTransfer.effectAllowed = "move";
                          event.dataTransfer.setData("text/plain", product.id);
                        }}
                        onDragEnd={() => setDraggedProductId(null)}
                      >
                        <GripVertical className="size-3.5" aria-hidden="true" />
                      </AdminIconButton>
                      <AdminIconButton
                        label={`Move ${product.name} up`}
                        disabled={!canReorder || !product.shopifyProductId || isOrderPending || products[0]?.id === product.id}
                        onClick={() => moveProduct(product.id, products.findIndex((item) => item.id === product.id) - 1)}
                      >
                        <ChevronUp className="size-3.5" aria-hidden="true" />
                      </AdminIconButton>
                      <AdminIconButton
                        label={`Move ${product.name} down`}
                        disabled={!canReorder || !product.shopifyProductId || isOrderPending || products.at(-1)?.id === product.id}
                        onClick={() => moveProduct(product.id, products.findIndex((item) => item.id === product.id) + 1)}
                      >
                        <ChevronDown className="size-3.5" aria-hidden="true" />
                      </AdminIconButton>
                    </div>
                  ) : null}

                  <div className="min-w-0">
                    <div className="flex min-w-0 items-start gap-2">
                      <p className="truncate text-sm font-semibold" style={{ color: "var(--adm-ink)" }}>
                        {product.name}
                      </p>
                      {conflictSignals.recentlyUpdatedProducts[product.id] ? (
                        <AdminIconButton
                          label="Updated from Shopify — open editor to review"
                          tone="warning"
                          onClick={() => router.push(`/admin/products/${product.id}`)}
                        >
                          <Eye className="size-3.5" aria-hidden="true" />
                        </AdminIconButton>
                      ) : null}
                    </div>
                    <ProductListMetaLine product={product} />
                    <ProductListSignals
                      product={product}
                      conflict={conflict}
                      onShowConflicts={() => showConflicts(product.id)}
                    />
                  </div>

                  <AdminStatusBadge status={status} />
                  <span className="text-xs font-semibold tabular-nums" style={{ color: "var(--adm-muted)" }}>
                    {centsToPrice(product.priceCents)} EUR
                  </span>
                  <span className="truncate text-xs font-semibold" style={{ color: "var(--adm-muted)" }} title={product.shopifyCategoryName ?? "No category"}>
                    {product.shopifyCategoryName ?? "No category"}
                  </span>

                  <div className="flex shrink-0 flex-nowrap items-center justify-start gap-1 xl:justify-end">
                    <AdminIconButton
                      label="Details"
                      tooltip="Record details and version history"
                      tone="primary"
                      onClick={() => setEditingProduct(product)}
                    >
                      <Info className="size-3.5" aria-hidden="true" />
                    </AdminIconButton>
                    {status === "PUBLISHED" ? (
                      <AdminIconButton
                        label="Draft"
                        tooltip="Move to draft — hide from the public storefront"
                        onClick={() => setRowAction({ product, action: "draft" })}
                      >
                        <FilePenLine className="size-3.5" aria-hidden="true" />
                      </AdminIconButton>
                    ) : (
                      <AdminIconButton
                        label="Publish"
                        tooltip="Publish to the public storefront"
                        onClick={() => setRowAction({ product, action: "publish" })}
                        disabled={status === "ARCHIVED"}
                      >
                        <Upload className="size-3.5" aria-hidden="true" />
                      </AdminIconButton>
                    )}
                    {status === "ARCHIVED" ? (
                      <AdminIconButton
                        label="Restore"
                        tooltip="Restore from archive to draft"
                        onClick={() => setRowAction({ product, action: "draft" })}
                      >
                        <RotateCcw className="size-3.5" aria-hidden="true" />
                      </AdminIconButton>
                    ) : (
                      <AdminIconButton
                        label="Archive"
                        tooltip="Archive — hide from the site but keep the record"
                        onClick={() => setRowAction({ product, action: "archive" })}
                      >
                        <Archive className="size-3.5" aria-hidden="true" />
                      </AdminIconButton>
                    )}
                    <AdminIconButton
                      label="Delete"
                      tooltip="Permanently delete this product"
                      tone="danger"
                      onClick={() => setRowAction({ product, action: "delete" })}
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                    </AdminIconButton>
                  </div>
                </AdminEntityList.Row>
              );
            })
          ) : (
            <AdminEntityList.Empty>No products match the current filters.</AdminEntityList.Empty>
          )}

          <AdminEntityList.LoadMore
            hasMore={hasNextPage}
            loading={loadingMore}
            onLoadMore={loadMore}
            label={loadingMore ? "Loading more…" : "Scroll for more"}
          />
        </AdminEntityList.Root>
        </AdminListWorkspace.Body>
      </AdminListWorkspace.Root>

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
        viewScope={conflictViewScope}
        onToast={(message, tone) => pushToast({ message, tone })}
      />

      {shopifyStoreMismatch ? (
        <AdminConfirmModal
          open={confirmStoreRebind}
          title="Rebind catalog to another Shopify store"
          description={`Synarava is linked to ${shopifyStoreMismatch.boundShopDomain}. Rebinding to ${shopifyStoreMismatch.currentShopDomain} clears the old store-specific product, variant, inventory, and collection IDs. It does not delete local content or Shopify products. Existing records will reconnect through normal product saves, webhooks, and conflict checks.`}
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
