"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

import { updateShopifyProductsAction } from "@/app/admin/actions/sync";
import { useAdminToast } from "@/components/admin/shared/admin-toast";
import { AuthMessage } from "@/components/auth/auth-form-primitives";
import {
  AdminEntityList,
  AdminListWorkspace,
  AdminStatusBadge,
  AdminTextField,
  type AdminStatusBadgeTone,
} from "@/components/synarava-cms";
import { centsToPrice } from "@/components/admin/products/product-helpers";
import { refreshPreservingScroll } from "@/lib/admin/preserve-scroll";
import {
  listItemStatusLabel,
  type AdminProductListItem,
  type AdminProductListPage,
} from "@/lib/admin/list-products-shared";

async function fetchProductPage(params: {
  q: string;
  cursor?: string | null;
}): Promise<AdminProductListPage> {
  const search = new URLSearchParams();
  if (params.q.trim()) search.set("q", params.q.trim());
  search.set("sort", "updated");
  if (params.cursor) search.set("cursor", params.cursor);

  const response = await fetch(`/admin/api/products?${search.toString()}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Could not load products.");
  return response.json() as Promise<AdminProductListPage>;
}

function syncTone(status: AdminProductListItem["syncStatus"]): AdminStatusBadgeTone {
  if (status === "SYNCED") return "published";
  if (status === "CONFLICT") return "conflict";
  if (status === "FAILED") return "error";
  if (status === "PENDING") return "pending";
  return "draft";
}

function formatTimestamp(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

export type ShopifyProductsCmsProps = {
  initialPage: AdminProductListPage;
};

/**
 * Read-only Shopify product projection with a single bulk update control.
 * Does not replace Catalog authoring — that stays at `/admin/products`.
 */
export function ShopifyProductsCms({ initialPage }: ShopifyProductsCmsProps) {
  const [products, setProducts] = useState<AdminProductListItem[]>(initialPage.nodes);
  const [hasNextPage, setHasNextPage] = useState(initialPage.hasNextPage);
  const [endCursor, setEndCursor] = useState<string | null>(initialPage.endCursor);
  const [totalCount, setTotalCount] = useState(initialPage.totalCount);
  const [loadingMore, setLoadingMore] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isUpdatePending, startUpdateTransition] = useTransition();
  const { pushToast } = useAdminToast();
  const router = useRouter();
  const requestIdRef = useRef(0);
  const skipFilterFetchRef = useRef(true);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 280);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (skipFilterFetchRef.current) {
      skipFilterFetchRef.current = false;
      return;
    }
    const requestId = ++requestIdRef.current;
    setListError(null);
    void fetchProductPage({ q: debouncedQuery })
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
  }, [debouncedQuery]);

  const loadMore = useCallback(() => {
    if (!hasNextPage || loadingMore || !endCursor) return;
    setLoadingMore(true);
    const requestId = ++requestIdRef.current;
    void fetchProductPage({ q: debouncedQuery, cursor: endCursor })
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
  }, [hasNextPage, loadingMore, endCursor, debouncedQuery]);

  function handleUpdateFromShopify() {
    startUpdateTransition(async () => {
      const result = await updateShopifyProductsAction();
      if (result.error) {
        pushToast({ message: result.error, tone: "error" });
        return;
      }
      if (result.success) pushToast({ message: result.success, tone: "success" });
      if (result.warning) pushToast({ message: result.warning, tone: "info" });
      refreshPreservingScroll(router);
      const page = await fetchProductPage({ q: debouncedQuery });
      setProducts(page.nodes);
      setHasNextPage(page.hasNextPage);
      setEndCursor(page.endCursor);
      setTotalCount(page.totalCount);
    });
  }

  const filterSummary = query.trim() ? `“${query.trim()}”` : undefined;
  const desktopTableGridClass =
    "xl:grid-cols-[minmax(12rem,1.6fr)_5.5rem_5rem_minmax(6rem,0.8fr)_minmax(7rem,0.9fr)_minmax(8rem,1fr)]";

  return (
    <section className="space-y-4" data-component="ShopifyProductsCms">
      <AdminListWorkspace.Root>
        <AdminListWorkspace.Header
          tag="[ SYN-ADM // SHOPIFY PRODUCTS ]"
          title="Shopify Products"
          meta={`${totalCount} product${totalCount === 1 ? "" : "s"} · local projection of the Shopify catalog`}
          actions={
            <button
              type="button"
              className="adm-btn-primary inline-flex items-center justify-center gap-2"
              onClick={handleUpdateFromShopify}
              disabled={isUpdatePending}
            >
              <RefreshCw className={`size-4 ${isUpdatePending ? "animate-spin" : ""}`} aria-hidden="true" />
              {isUpdatePending ? "Updating…" : "Update from Shopify"}
            </button>
          }
        >
          <AdminListWorkspace.Filters summary={filterSummary}>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(14rem,1fr)]">
              <AdminTextField
                label="Search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Name, slug, SKU"
                clearable
              />
            </div>
          </AdminListWorkspace.Filters>
        </AdminListWorkspace.Header>

        <AdminListWorkspace.Body>
          <AuthMessage error={listError ?? undefined} />

          <AdminEntityList.Root>
            <AdminEntityList.Header
              gridClassName={desktopTableGridClass}
              columns={[
                { key: "product", label: "Product" },
                { key: "status", label: "Status" },
                { key: "price", label: "Price" },
                { key: "sync", label: "Sync" },
                { key: "shopify", label: "Shopify ID" },
                { key: "synced", label: "Last synced" },
              ]}
            />

            {products.length > 0 ? (
              products.map((product) => {
                const status = listItemStatusLabel(product);
                const shopifyShort = product.shopifyProductId
                  ? product.shopifyProductId.replace(/^gid:\/\/shopify\/Product\//, "")
                  : "—";

                return (
                  <AdminEntityList.Row key={product.id} gridClassName={desktopTableGridClass}>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold" style={{ color: "var(--adm-ink)" }}>
                        {product.name}
                      </p>
                      <p className="mt-0.5 truncate text-[0.7rem] text-[var(--adm-muted)]">
                        {product.sku}
                        {product.slug ? ` · /${product.slug}` : ""}
                      </p>
                    </div>

                    <AdminStatusBadge status={status} />
                    <span className="text-xs font-semibold tabular-nums" style={{ color: "var(--adm-muted)" }}>
                      {centsToPrice(product.priceCents)} EUR
                    </span>
                    <AdminStatusBadge tone={syncTone(product.syncStatus)}>
                      {product.syncStatus}
                    </AdminStatusBadge>
                    <span
                      className="truncate text-xs font-semibold tabular-nums"
                      style={{ color: "var(--adm-muted)" }}
                      title={product.shopifyProductId ?? undefined}
                    >
                      {shopifyShort}
                    </span>
                    <span className="truncate text-xs" style={{ color: "var(--adm-muted)" }}>
                      {formatTimestamp(product.lastSyncedAt)}
                    </span>
                  </AdminEntityList.Row>
                );
              })
            ) : (
              <AdminEntityList.Empty>
                No local products yet. Use Update from Shopify to import the catalog projection.
              </AdminEntityList.Empty>
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
    </section>
  );
}
