"use client";

import { useEffect, useState, useTransition } from "react";

import {
  assignProductSkuAction,
  loadSkuAssignContext,
  previewProductSkuAction,
  resumePendingSkuAction,
  type SkuAssignContext,
  type SkuAssignVariantRow,
} from "@/app/admin/actions/sku-assign";
import { useAdminToast } from "@/components/admin/shared/admin-toast";
import {
  AdminAlert,
  AdminHelp,
  AdminReadonlyField,
  AdminSelectField,
  AdminTextField,
  type AdminFormValidation,
} from "@/components/synarava-cms";
import {
  PRODUCT_FIELD_MESSAGES,
  type ProductFieldName,
} from "@/lib/products/product-form-validation";
import { needsSkuAssignment } from "@/lib/sku/pending-sku";

/** Show Family → Preview → Confirm when SKU is a placeholder (client-side, not only server flag). */
function rowNeedsAssignControls(row: SkuAssignVariantRow): boolean {
  if (row.pendingReservationSku) return false;
  return needsSkuAssignment(row.sku) || row.pending;
}

function VariantAssignRow({
  productId,
  familyKey,
  familyKeys,
  row,
  isPending,
  onFamilyChange,
  onPreview,
  onAssign,
  onResume,
  previewSku,
  previewMeta,
}: {
  productId: string;
  familyKey: string;
  familyKeys: string[];
  row: SkuAssignVariantRow;
  isPending: boolean;
  onFamilyChange: (value: string) => void;
  onPreview: () => void;
  onAssign: () => void;
  onResume: () => void;
  previewSku: string | null;
  previewMeta: string | null;
}) {
  const notAssigned = rowNeedsAssignControls(row);
  return (
    <div className="grid gap-3 rounded-md border border-[var(--adm-border)] p-3" data-variant-id={row.variantId}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium text-[var(--adm-ink)]">{row.title}</p>
        <p className="text-xs text-[var(--adm-muted)]">
          {row.shopifyLinked ? "Linked" : "Local only"} · {notAssigned ? "Not assigned" : row.sku}
        </p>
      </div>
      {row.pendingReservationSku ? (
        <AdminAlert
          message={`Reservation pending confirm: ${row.pendingReservationSku}. ${
            row.shopifyLinked
              ? "Use Retry confirm (idempotent) — no new reservation."
              : "Push to Shopify to write the SKU and confirm, or link the variant first."
          }`}
        />
      ) : null}

      {notAssigned ? (
        <div
          className="grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-end"
          data-sku-assign-controls="true"
        >
          <AdminSelectField
            label="Family"
            owner="Synarava"
            value={familyKey}
            onChange={(event) => onFamilyChange(event.target.value)}
            disabled={isPending}
          >
            {familyKeys.length === 0 ? (
              <option value="">No families in published profile</option>
            ) : (
              familyKeys.map((key) => (
                <option key={key} value={key}>{key}</option>
              ))
            )}
          </AdminSelectField>
          <button type="button" className="adm-btn-secondary" disabled={isPending || !familyKey} onClick={onPreview}>
            {isPending ? "Working…" : "Preview"}
          </button>
          <button type="button" className="adm-btn-primary" disabled={isPending || !familyKey} onClick={onAssign}>
            {isPending ? "Working…" : "Confirm assign"}
          </button>
        </div>
      ) : null}

      {row.pendingReservationSku ? (
        <button
          type="button"
          className="adm-btn-primary w-fit"
          disabled={isPending || !row.shopifyLinked}
          onClick={onResume}
        >
          {isPending ? "Working…" : "Retry confirm"}
        </button>
      ) : null}

      {previewSku ? (
        <p className="text-sm text-[var(--adm-ink)]">
          Candidate <span className="font-medium">{previewSku}</span>
          {previewMeta ? <span className="text-[var(--adm-muted)]"> — {previewMeta}</span> : null}
        </p>
      ) : null}
    </div>
  );
}

export function ProductSkuAssignPanel({
  productId,
  draftSku,
  fieldErrors,
  validation,
  onAssigned,
}: {
  productId: string;
  draftSku: string;
  fieldErrors: Partial<Record<ProductFieldName, string>>;
  validation: AdminFormValidation<ProductFieldName>;
  onAssigned?: (sku: string) => void;
}) {
  const { pushToast } = useAdminToast();
  const [isPending, startTransition] = useTransition();
  const [context, setContext] = useState<SkuAssignContext | null>(null);
  const [familyByVariant, setFamilyByVariant] = useState<Record<string, string>>({});
  const [previewByVariant, setPreviewByVariant] = useState<Record<string, { sku: string; meta: string }>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadSkuAssignContext(productId)
      .then((payload) => {
        if (cancelled) return;
        setContext(payload);
        setFamilyByVariant((current) => {
          const next = { ...current };
          for (const row of payload.variants) {
            if (!next[row.variantId]) next[row.variantId] = payload.familyKeys[0] || "";
          }
          return next;
        });
      })
      .catch(() => {
        if (cancelled) return;
        setContext({
          configured: false,
          reason: "Failed to load SKU assignment context",
          familyKeys: [],
          currentSku: draftSku,
          pending: true,
          pendingReservationSku: null,
          shopifyLinked: false,
          variantId: null,
          variants: [],
        });
        setError("Failed to load SKU assignment context.");
      });
    return () => {
      cancelled = true;
    };
  }, [productId, draftSku]);

  if (!context) {
    return (
      <p className="text-sm text-[var(--adm-muted)]">Loading SKU assignment…</p>
    );
  }

  if (!context.configured) {
    return (
      <AdminTextField
        label="SKU"
        owner="Shopify"
        required
        name="sku"
        data-validation-message={PRODUCT_FIELD_MESSAGES.sku}
        defaultValue={draftSku}
        error={fieldErrors.sku}
        errorId={validation.fieldErrorId("sku")}
        {...validation.fieldProps("sku")}
      />
    );
  }

  const rows = context.variants.length > 0
    ? context.variants
    : [{
        variantId: context.variantId ?? "primary",
        title: "Default Title",
        sku: context.currentSku || draftSku,
        shopifyVariantId: null,
        pending: context.pending,
        pendingReservationSku: context.pendingReservationSku,
        shopifyLinked: context.shopifyLinked,
      }];

  const primarySku = rows[0]?.sku || draftSku;
  const primaryNeedsAssign = rows[0] ? rowNeedsAssignControls(rows[0]) : needsSkuAssignment(primarySku);

  function refresh() {
    return loadSkuAssignContext(productId).then(setContext);
  }

  function runPreview(variantId: string) {
    const familyKey = familyByVariant[variantId] || context!.familyKeys[0] || "";
    setError(null);
    startTransition(async () => {
      const result = await previewProductSkuAction({ productId, familyKey });
      if (!result.ok) {
        setError(result.error ?? "Preview failed");
        return;
      }
      setPreviewByVariant((prev) => ({
        ...prev,
        [variantId]: {
          sku: result.previewSku ?? "",
          meta: result.policyVersion != null
            ? `Policy v${result.policyVersion} · provisional (not reserved)`
            : "Provisional (not reserved)",
        },
      }));
    });
  }

  function runAssign(variantId: string) {
    const familyKey = familyByVariant[variantId] || context!.familyKeys[0] || "";
    setError(null);
    startTransition(async () => {
      const result = await assignProductSkuAction({ productId, familyKey, variantId });
      if (!result.ok) {
        setError(result.error ?? "Assign failed");
        pushToast({ tone: "error", message: result.error ?? "Assign failed" });
        await refresh();
        return;
      }
      pushToast({ tone: "success", message: result.message ?? `Assigned ${result.sku}` });
      if (result.sku) onAssigned?.(result.sku);
      await refresh();
      setPreviewByVariant((prev) => {
        const next = { ...prev };
        delete next[variantId];
        return next;
      });
    });
  }

  function runResume(variantId: string) {
    setError(null);
    startTransition(async () => {
      const result = await resumePendingSkuAction({ productId, variantId });
      if (!result.ok) {
        setError(result.error ?? "Resume failed");
        pushToast({ tone: "error", message: result.error ?? "Resume failed" });
        await refresh();
        return;
      }
      pushToast({ tone: "success", message: result.message ?? `Confirmed ${result.sku}` });
      if (result.sku) onAssigned?.(result.sku);
      await refresh();
    });
  }

  return (
    <div data-component="ProductSkuAssignPanel" className="grid gap-4">
      <AdminReadonlyField
        label="SKU"
        owner="Shopify"
        value={primaryNeedsAssign ? "Not assigned" : primarySku}
        help={(
          <AdminHelp label="Commerce code assignment guidance">
            Shopify owns the assigned Variant SKU. Synarava reserves via sku-api, writes Shopify,
            then confirms only after read-back matches. Retry confirm is idempotent (no new number).
            Placeholders (PENDING-*, SHOPIFY-*) stay assignable — they are not commerce SKUs.
          </AdminHelp>
        )}
      />
      <input type="hidden" name="sku" value={primarySku} readOnly />

      <div className="grid gap-3">
        {rows.map((row) => (
          <VariantAssignRow
            key={row.variantId}
            productId={productId}
            familyKey={familyByVariant[row.variantId] || context.familyKeys[0] || ""}
            familyKeys={context.familyKeys}
            row={row}
            isPending={isPending}
            onFamilyChange={(value) => setFamilyByVariant((prev) => ({ ...prev, [row.variantId]: value }))}
            onPreview={() => runPreview(row.variantId)}
            onAssign={() => runAssign(row.variantId)}
            onResume={() => runResume(row.variantId)}
            previewSku={previewByVariant[row.variantId]?.sku ?? null}
            previewMeta={previewByVariant[row.variantId]?.meta ?? null}
          />
        ))}
      </div>

      {error ? <AdminAlert message={error} /> : null}
    </div>
  );
}
