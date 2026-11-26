"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { Link2 } from "lucide-react";

import {
  createProductPairingAction,
  deleteProductPairingAction,
  deleteProductPairingImageAction,
  listProductPairingsAction,
  reorderProductPairingAction,
  reorderProductPairingImageAction,
  searchPairingCandidatesAction,
  uploadProductPairingImageAction,
  type AdminProductPairingRow,
} from "@/app/admin/actions/product-pairings";
import { AdminImmediateFileButton } from "@/components/admin/shared/admin-immediate-file-button";
import {
  AdminAlert,
  AdminButton,
  AdminConfirmModal,
  AdminOrderedList,
  AdminOrderedListItemActions,
  AdminTextControl,
} from "@/components/synarava-cms";

type ProductPairingsManagerProps = {
  productId: string;
  productSlug: string;
  /** When false, skip server fetches (hidden tab still mounts in the editor). */
  active?: boolean;
};

export function ProductPairingsManager({
  productId,
  productSlug,
  active = true,
}: ProductPairingsManagerProps) {
  const [pairings, setPairings] = useState<AdminProductPairingRow[]>([]);
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<
    Array<{ id: string; slug: string; name: string; sku: string }>
  >([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<AdminProductPairingRow | null>(null);
  const [isPending, startTransition] = useTransition();

  const isAddonView =
    pairings.length > 0 && pairings.every((row) => row.role === "base");

  useEffect(() => {
    if (!active) return;
    startTransition(async () => {
      const result = await listProductPairingsAction(productId);
      if (result.error) setError(result.error);
      setPairings(result.pairings ?? []);
    });
  }, [active, productId]);

  useEffect(() => {
    if (!active || isAddonView || query.trim().length < 1) return;
    const handle = window.setTimeout(() => {
      startTransition(async () => {
        const rows = await searchPairingCandidatesAction(productId, query);
        setCandidates(rows);
      });
    }, 220);
    return () => window.clearTimeout(handle);
  }, [active, isAddonView, productId, query]);

  // Derive empty results while the query is idle — avoid sync setState-in-effect.
  const shownCandidates =
    active && !isAddonView && query.trim().length >= 1 ? candidates : [];

  function applyResult(
    result: { error?: string; success?: string; pairings?: AdminProductPairingRow[] },
  ) {
    if (result.error) {
      setError(result.error);
      setSuccess(null);
      return;
    }
    setError(null);
    setSuccess(result.success ?? null);
    if (result.pairings) setPairings(result.pairings);
  }

  return (
    <div
      data-component="ProductPairingsManager"
      className="adm-inset-x space-y-5 py-4"
    >
      <p className="max-w-[68ch] text-sm leading-6 text-[var(--adm-muted)]">
        Synarava-only necklace ↔ charm links. Not pushed to Shopify. A partner is
        hidden on the storefront unless it is ACTIVE + PUBLIC and has a Shopify
        variant merchandise id — draft, private, unlisted, or variant-less
        partners stay off the PDP carousel even while linked here. Pair photos
        can be multiple; reorder and delete them one by one.
      </p>

      <AdminAlert message={error} tone="error" />
      <AdminAlert message={success} tone="success" />

      {isAddonView ? (
        <section className="space-y-3" aria-label="Worn on">
          <h3 className="text-sm font-semibold text-[var(--adm-ink)]">Надевается на</h3>
          <ul className="space-y-2">
            {pairings.map((row) => (
              <li key={row.id} className="flex items-center gap-3 text-sm">
                <Link2 className="size-4 shrink-0 text-[var(--adm-muted)]" aria-hidden />
                <Link
                  href={`/admin/products/${row.partner.slug}`}
                  className="font-medium text-[var(--adm-ink)] underline-offset-2 hover:underline"
                >
                  {row.partner.name}
                </Link>
                <span className="text-[var(--adm-muted)]">/{row.partner.slug}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <>
          <section className="space-y-3" aria-label="Add pairing partner">
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--adm-muted)]">
                Add addon product
              </span>
              <AdminTextControl
                name="pairing-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  // Inside the product Save form — Enter must not submit Save.
                  if (event.key === "Enter") event.preventDefault();
                }}
                placeholder="Search by name, slug, or SKU"
                clearable
                onClear={() => setQuery("")}
              />
            </label>
            {shownCandidates.length > 0 ? (
              <ul className="divide-y rounded-[var(--adm-radius)] border border-[var(--adm-border)]">
                {shownCandidates.map((candidate) => (
                  <li
                    key={candidate.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[var(--adm-ink)]">
                        {candidate.name}
                      </p>
                      <p className="truncate text-xs text-[var(--adm-muted)]">
                        {candidate.slug} · {candidate.sku}
                      </p>
                    </div>
                    <AdminButton
                      type="button"
                      variant="secondary"
                      disabled={isPending}
                      onClick={() => {
                        startTransition(async () => {
                          applyResult(
                            await createProductPairingAction(productId, candidate.id),
                          );
                          setQuery("");
                          setCandidates([]);
                        });
                      }}
                    >
                      Add
                    </AdminButton>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>

          <AdminOrderedList
            label="Linked addons"
            items={pairings}
            getKey={(row) => row.id}
            minItems={0}
            showItemControls={false}
            onChange={(next) => {
              const previousIds = pairings.map((row) => row.id);
              const nextIds = next.map((row) => row.id);
              setPairings(next);
              const movedId = nextIds.find((id, index) => previousIds[index] !== id);
              if (!movedId) return;
              const prevIndex = previousIds.indexOf(movedId);
              const nextIndex = nextIds.indexOf(movedId);
              if (prevIndex < 0 || nextIndex < 0 || prevIndex === nextIndex) return;
              startTransition(async () => {
                applyResult(
                  await reorderProductPairingAction(
                    productId,
                    movedId,
                    nextIndex < prevIndex ? "up" : "down",
                  ),
                );
              });
            }}
            renderItem={(row, controls) => (
              <div className="flex min-w-0 flex-1 flex-col gap-3">
                <div className="flex min-w-0 flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/admin/products/${row.partner.slug}`}
                      className="font-medium text-[var(--adm-ink)] underline-offset-2 hover:underline"
                    >
                      {row.partner.name}
                    </Link>
                    <p className="text-xs text-[var(--adm-muted)]">
                      {row.partner.status}/{row.partner.visibility} · /{row.partner.slug}
                    </p>
                    {row.partner.status !== "ACTIVE"
                    || row.partner.visibility !== "PUBLIC"
                    || !row.partner.hasShopifyVariant ? (
                      <p className="text-xs text-[var(--adm-danger)]">
                        Not storefront-visible
                        {row.partner.status !== "ACTIVE" || row.partner.visibility !== "PUBLIC"
                          ? " (needs ACTIVE + PUBLIC)"
                          : ""}
                        {!row.partner.hasShopifyVariant ? " (missing Shopify variant)" : ""}.
                      </p>
                    ) : null}
                  </div>
                  <AdminImmediateFileButton
                    accept="image/jpeg,image/png,image/webp,image/avif"
                    disabled={isPending}
                    label="Add photo"
                    onFile={(file) => {
                      const body = new FormData();
                      body.set("pairingId", row.id);
                      body.set("productId", productId);
                      body.set("file", file);
                      startTransition(async () => {
                        applyResult(await uploadProductPairingImageAction(body));
                      });
                    }}
                  />
                  <AdminOrderedListItemActions
                    controls={{
                      ...controls,
                      canRemove: true,
                      remove: () => setPendingDelete(row),
                    }}
                  />
                </div>

                {row.images.length > 0 ? (
                  <ul className="flex flex-wrap gap-2" aria-label="Pair photos">
                    {row.images.map((image, index) => (
                      <li
                        key={image.id}
                        className="flex items-center gap-1 rounded border border-[var(--adm-border)] bg-[var(--adm-surface)] p-1"
                      >
                        <span className="relative size-14 shrink-0 overflow-hidden rounded">
                          <Image
                            src={image.imageUrl}
                            alt=""
                            fill
                            className="object-cover"
                            sizes="56px"
                          />
                        </span>
                        <div className="flex flex-col gap-0.5">
                          <AdminButton
                            type="button"
                            variant="ghost"
                            disabled={isPending || index === 0}
                            onClick={() => {
                              startTransition(async () => {
                                applyResult(
                                  await reorderProductPairingImageAction(
                                    row.id,
                                    image.id,
                                    "up",
                                    productId,
                                  ),
                                );
                              });
                            }}
                          >
                            ↑
                          </AdminButton>
                          <AdminButton
                            type="button"
                            variant="ghost"
                            disabled={isPending || index === row.images.length - 1}
                            onClick={() => {
                              startTransition(async () => {
                                applyResult(
                                  await reorderProductPairingImageAction(
                                    row.id,
                                    image.id,
                                    "down",
                                    productId,
                                  ),
                                );
                              });
                            }}
                          >
                            ↓
                          </AdminButton>
                          <AdminButton
                            type="button"
                            variant="ghost"
                            disabled={isPending}
                            onClick={() => {
                              startTransition(async () => {
                                applyResult(
                                  await deleteProductPairingImageAction(image.id, productId),
                                );
                              });
                            }}
                          >
                            Delete
                          </AdminButton>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-[var(--adm-muted)]">No pair photos yet.</p>
                )}
              </div>
            )}
          />
        </>
      )}

      <p className="text-xs text-[var(--adm-muted)]">
        Editing product <code>{productSlug}</code>. Changes save immediately.
      </p>

      <AdminConfirmModal
        open={pendingDelete != null}
        title="Remove pairing?"
        description={
          pendingDelete
            ? `Unlink “${pendingDelete.partner.name}”? The storefront will stop offering this kit.`
            : ""
        }
        confirmLabel="Remove"
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (!pendingDelete) return;
          const target = pendingDelete;
          setPendingDelete(null);
          startTransition(async () => {
            applyResult(await deleteProductPairingAction(target.id, productId));
          });
        }}
        pending={isPending}
      />
    </div>
  );
}
