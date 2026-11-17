"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { EyeOff, RotateCcw, Upload } from "lucide-react";

import {
  moderateProductReviewsAction,
  type AdminReviewsActionState,
} from "@/app/admin/actions/reviews";
import { AdminConfirmModal } from "@/components/admin/shared/admin-confirm-modal";
import { useAdminToast } from "@/components/admin/shared/admin-toast";
import {
  AdminAlert,
  AdminButton,
  AdminEntityList,
  AdminIconButton,
  AdminListWorkspace,
  AdminSelectField,
  AdminStatusBadge,
  AdminTextField,
} from "@/components/synarava-cms";
import { listStateToSearchString } from "@/lib/list-state";
import {
  ADMIN_REVIEW_LOCALE_OPTIONS,
  ADMIN_REVIEW_RATING_OPTIONS,
  ADMIN_REVIEW_SORT_OPTIONS,
  ADMIN_REVIEW_STATUS_OPTIONS,
  adminReviewsListSchema,
  type AdminReviewsListState,
} from "@/lib/admin/reviews-list-state";
import type { AdminReviewListItem, AdminReviewListPage } from "@/lib/reviews/queries";

const REVIEW_GRID =
  "xl:grid-cols-[2rem_minmax(0,1.2fr)_4.5rem_5rem_5rem_minmax(0,1.4fr)_8rem]";

type ProductOption = { id: string; slug: string; name: string };

export function ReviewsCms({
  initialPage,
  initialListState,
  products,
}: {
  initialPage: AdminReviewListPage;
  initialListState: AdminReviewsListState;
  products: ProductOption[];
}) {
  const router = useRouter();
  const { pushToast } = useAdminToast();
  const [page, setPage] = useState(initialPage);
  const [state, setState] = useState(initialListState);
  const [queryDraft, setQueryDraft] = useState(initialListState.q);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [hideConfirmIds, setHideConfirmIds] = useState<string[] | null>(null);
  const [actionState, setActionState] = useState<AdminReviewsActionState>({});
  const [isPending, startTransition] = useTransition();

  function navigate(next: AdminReviewsListState) {
    setState(next);
    const qs = listStateToSearchString(adminReviewsListSchema, next);
    startTransition(() => {
      router.push(qs ? `/admin/reviews?${qs}` : "/admin/reviews");
    });
  }

  function toggleId(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((current) => {
      if (current.size === page.items.length) return new Set();
      return new Set(page.items.map((item) => item.id));
    });
  }

  function runModerate(ids: string[], status: "PUBLISHED" | "HIDDEN" | "PENDING") {
    if (ids.length === 0) return;
    startTransition(async () => {
      const formData = new FormData();
      formData.set("status", status);
      for (const id of ids) formData.append("ids", id);
      const result = await moderateProductReviewsAction(formData);
      setActionState(result);
      if (result.error) pushToast({ message: result.error, tone: "error" });
      if (result.success) {
        pushToast({ message: result.success, tone: "success" });
        setPage((current) => ({
          ...current,
          items: current.items.map((item) =>
            ids.includes(item.id) ? { ...item, status } : item,
          ),
        }));
        setSelected(new Set());
        router.refresh();
      }
      setHideConfirmIds(null);
    });
  }

  const empty = page.items.length === 0;

  return (
    <div data-component="ReviewsCms" className="grid gap-6">
      <AdminListWorkspace.Root>
        <AdminListWorkspace.Header
          tag="[ REVIEWS TABLE ]"
          title="Buyer reviews"
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <AdminButton
                variant="secondary"
                disabled={selected.size === 0 || isPending}
                onClick={() => runModerate([...selected], "PUBLISHED")}
              >
                Publish
              </AdminButton>
              <AdminButton
                variant="secondary"
                disabled={selected.size === 0 || isPending}
                onClick={() => runModerate([...selected], "PENDING")}
              >
                Pending
              </AdminButton>
              <AdminButton
                variant="danger"
                disabled={selected.size === 0 || isPending}
                onClick={() => setHideConfirmIds([...selected])}
              >
                Hide
              </AdminButton>
            </div>
          }
        />
        <AdminListWorkspace.Body>
          <AdminAlert message={actionState.error} />
          <div
            className="adm-inset-x grid gap-3 border-b py-4 md:grid-cols-3 xl:grid-cols-4"
            style={{ borderColor: "var(--adm-border)" }}
          >
            <AdminTextField
              label="Search"
              value={queryDraft}
              onChange={(event) => setQueryDraft(event.target.value)}
              onBlur={() => navigate({ ...state, q: queryDraft, page: "1" })}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  navigate({ ...state, q: queryDraft, page: "1" });
                }
              }}
              placeholder="Text, name, email, product"
            />
            <AdminSelectField
              label="Status"
              value={state.status}
              onChange={(event) =>
                navigate({
                  ...state,
                  status: event.target.value as AdminReviewsListState["status"],
                  page: "1",
                })
              }
            >
              {ADMIN_REVIEW_STATUS_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </AdminSelectField>
            <AdminSelectField
              label="Product"
              value={state.product}
              onChange={(event) =>
                navigate({ ...state, product: event.target.value, page: "1" })
              }
            >
              <option value="ALL">All products</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </AdminSelectField>
            <AdminSelectField
              label="Rating"
              value={state.rating}
              onChange={(event) =>
                navigate({
                  ...state,
                  rating: event.target.value as AdminReviewsListState["rating"],
                  page: "1",
                })
              }
            >
              {ADMIN_REVIEW_RATING_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {value === "ALL" ? "All ratings" : `${value}★`}
                </option>
              ))}
            </AdminSelectField>
            <AdminSelectField
              label="Locale"
              value={state.locale}
              onChange={(event) =>
                navigate({
                  ...state,
                  locale: event.target.value as AdminReviewsListState["locale"],
                  page: "1",
                })
              }
            >
              {ADMIN_REVIEW_LOCALE_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {value === "ALL" ? "All locales" : value.toUpperCase()}
                </option>
              ))}
            </AdminSelectField>
            <AdminSelectField
              label="Sort"
              value={state.sort}
              onChange={(event) =>
                navigate({
                  ...state,
                  sort: event.target.value as AdminReviewsListState["sort"],
                  page: "1",
                })
              }
            >
              {ADMIN_REVIEW_SORT_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </AdminSelectField>
            <AdminTextField
              label="From"
              type="date"
              value={state.from}
              onChange={(event) =>
                navigate({ ...state, from: event.target.value, page: "1" })
              }
            />
            <AdminTextField
              label="To"
              type="date"
              value={state.to}
              onChange={(event) =>
                navigate({ ...state, to: event.target.value, page: "1" })
              }
            />
          </div>

          <AdminEntityList.Root>
            <AdminEntityList.Header
              gridClassName={REVIEW_GRID}
              leading={
                <input
                  type="checkbox"
                  aria-label="Select all reviews on this page"
                  checked={page.items.length > 0 && selected.size === page.items.length}
                  onChange={toggleAll}
                />
              }
              columns={[
                { key: "product", label: "Product" },
                { key: "rating", label: "Rating" },
                { key: "locale", label: "Locale" },
                { key: "status", label: "Status" },
                { key: "review", label: "Review" },
                { key: "actions", label: "Actions", align: "end" },
              ]}
            />
            {empty ? (
              <div className="px-4 py-10 text-sm" style={{ color: "var(--adm-muted)" }}>
                No reviews match these filters.
              </div>
            ) : (
              page.items.map((item) => (
                <ReviewRow
                  key={item.id}
                  item={item}
                  selected={selected.has(item.id)}
                  onToggle={() => toggleId(item.id)}
                  pending={isPending}
                  onPublish={() => runModerate([item.id], "PUBLISHED")}
                  onPending={() => runModerate([item.id], "PENDING")}
                  onHide={() => setHideConfirmIds([item.id])}
                />
              ))
            )}
          </AdminEntityList.Root>

          <div
            className="flex items-center justify-between gap-3 px-4 py-4 text-xs"
            style={{ color: "var(--adm-muted)" }}
          >
            <span>
              Page {page.page} · {page.total} total
            </span>
            <div className="flex gap-2">
              <AdminButton
                variant="secondary"
                disabled={page.page <= 1 || isPending}
                onClick={() => navigate({ ...state, page: String(page.page - 1) })}
              >
                Previous
              </AdminButton>
              <AdminButton
                variant="secondary"
                disabled={page.page * page.pageSize >= page.total || isPending}
                onClick={() => navigate({ ...state, page: String(page.page + 1) })}
              >
                Next
              </AdminButton>
            </div>
          </div>
        </AdminListWorkspace.Body>
      </AdminListWorkspace.Root>

      <AdminConfirmModal
        open={Boolean(hideConfirmIds)}
        title="Hide review?"
        description="Hidden reviews leave the storefront and JSON-LD aggregate. You can restore them to Pending or Published later."
        confirmLabel="Hide"
        tone="danger"
        pending={isPending}
        onCancel={() => setHideConfirmIds(null)}
        onConfirm={() => {
          if (hideConfirmIds) runModerate(hideConfirmIds, "HIDDEN");
        }}
      />
    </div>
  );
}

function ReviewRow({
  item,
  selected,
  onToggle,
  pending,
  onPublish,
  onPending,
  onHide,
}: {
  item: AdminReviewListItem;
  selected: boolean;
  onToggle: () => void;
  pending: boolean;
  onPublish: () => void;
  onPending: () => void;
  onHide: () => void;
}) {
  const tone =
    item.status === "PUBLISHED"
      ? "published"
      : item.status === "HIDDEN"
        ? "archived"
        : "pending";

  return (
    <AdminEntityList.Row gridClassName={REVIEW_GRID}>
      <input
        type="checkbox"
        aria-label={`Select review by ${item.authorName}`}
        checked={selected}
        onChange={onToggle}
      />
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold" style={{ color: "var(--adm-ink)" }}>
          {item.productName}
        </p>
        <p className="mt-0.5 truncate text-xs" style={{ color: "var(--adm-muted)" }}>
          /{item.productSlug}
        </p>
      </div>
      <span className="text-sm tabular-nums">{item.rating}★</span>
      <span className="text-xs uppercase">{item.locale}</span>
      <AdminStatusBadge tone={tone}>{item.status}</AdminStatusBadge>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium" style={{ color: "var(--adm-ink)" }}>
          {item.title || "(no title)"}
        </p>
        <p className="mt-0.5 truncate text-xs" style={{ color: "var(--adm-muted)" }}>
          {item.authorName} · {item.authorEmail}
        </p>
        <p className="mt-1 line-clamp-2 text-xs" style={{ color: "var(--adm-muted)" }}>
          {item.body || "—"}
        </p>
      </div>
      <div className="flex shrink-0 flex-nowrap items-center justify-start gap-1 xl:justify-end">
        <AdminIconButton label="Publish" tooltip="Publish to storefront" onClick={onPublish} disabled={pending}>
          <Upload className="size-3.5" aria-hidden="true" />
        </AdminIconButton>
        <AdminIconButton label="Pending" tooltip="Return to pending" onClick={onPending} disabled={pending}>
          <RotateCcw className="size-3.5" aria-hidden="true" />
        </AdminIconButton>
        <AdminIconButton label="Hide" tooltip="Hide from storefront" onClick={onHide} disabled={pending}>
          <EyeOff className="size-3.5" aria-hidden="true" />
        </AdminIconButton>
      </div>
    </AdminEntityList.Row>
  );
}
