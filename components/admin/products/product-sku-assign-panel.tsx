"use client";

import { useEffect, useState, useTransition } from "react";

import {
  assignProductSkuAction,
  loadSkuAssignContext,
  previewProductSkuAction,
  type SkuAssignContext,
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
  const [familyKey, setFamilyKey] = useState("");
  const [previewSku, setPreviewSku] = useState<string | null>(null);
  const [previewMeta, setPreviewMeta] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadSkuAssignContext(productId)
      .then((payload) => {
        if (cancelled) return;
        setContext(payload);
        setFamilyKey((current) => current || payload.familyKeys[0] || "");
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

  const displaySku = context.currentSku || draftSku;
  const notAssigned = context.pending && !context.pendingReservationSku;

  function runPreview() {
    setError(null);
    setPreviewSku(null);
    setPreviewMeta(null);
    startTransition(async () => {
      const result = await previewProductSkuAction({ productId, familyKey });
      if (!result.ok) {
        setError(result.error ?? "Preview failed");
        return;
      }
      setPreviewSku(result.previewSku ?? null);
      setPreviewMeta(
        result.policyVersion != null
          ? `Policy v${result.policyVersion} · provisional (not reserved)`
          : "Provisional (not reserved)",
      );
    });
  }

  function runAssign() {
    setError(null);
    startTransition(async () => {
      const result = await assignProductSkuAction({ productId, familyKey });
      if (!result.ok) {
        setError(result.error ?? "Assign failed");
        pushToast({ tone: "error", message: result.error ?? "Assign failed" });
        const refreshed = await loadSkuAssignContext(productId);
        setContext(refreshed);
        return;
      }
      pushToast({ tone: "success", message: result.message ?? `Assigned ${result.sku}` });
      if (result.sku) onAssigned?.(result.sku);
      const refreshed = await loadSkuAssignContext(productId);
      setContext(refreshed);
      setPreviewSku(null);
      setPreviewMeta(null);
    });
  }

  return (
    <div data-component="ProductSkuAssignPanel" className="grid gap-4">
      <AdminReadonlyField
        label="SKU"
        owner="Shopify"
        value={notAssigned ? "Not assigned" : displaySku}
        help={(
          <AdminHelp label="SKU assignment guidance">
            Shopify owns the assigned Variant SKU. Synarava reserves via sku-api, writes Shopify,
            then confirms only after read-back matches. Do not invent commerce SKUs in the form.
          </AdminHelp>
        )}
      />
      <input type="hidden" name="sku" value={displaySku} readOnly />

      {context.pendingReservationSku ? (
        <AdminAlert
          message={`Reservation pending confirm: ${context.pendingReservationSku}. ${
            context.shopifyLinked
              ? "Retry assign recovery or Push if write already succeeded."
              : "Push to Shopify to write the SKU and confirm the assignment."
          }`}
        />
      ) : null}

      {notAssigned || context.pendingReservationSku ? (
        <div className="grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-end">
          <AdminSelectField
            label="Family"
            owner="Synarava"
            value={familyKey}
            onChange={(event) => {
              setFamilyKey(event.target.value);
              setPreviewSku(null);
              setPreviewMeta(null);
            }}
            disabled={isPending || Boolean(context.pendingReservationSku)}
            help={(
              <AdminHelp label="Family key guidance">
                Keys come from the published SKU policy profile (Settings → SKU policy).
              </AdminHelp>
            )}
          >
            {context.familyKeys.length === 0 ? (
              <option value="">No families in published profile</option>
            ) : (
              context.familyKeys.map((key) => (
                <option key={key} value={key}>{key}</option>
              ))
            )}
          </AdminSelectField>
          <button
            type="button"
            className="adm-btn-secondary"
            disabled={isPending || !familyKey || Boolean(context.pendingReservationSku)}
            onClick={runPreview}
          >
            {isPending ? "Working…" : "Preview"}
          </button>
          <button
            type="button"
            className="adm-btn-primary"
            disabled={isPending || !familyKey || Boolean(context.pendingReservationSku)}
            onClick={runAssign}
          >
            {isPending ? "Working…" : "Confirm assign"}
          </button>
        </div>
      ) : null}

      {previewSku ? (
        <p className="text-sm text-[var(--adm-ink)]">
          Candidate <span className="font-medium">{previewSku}</span>
          {previewMeta ? <span className="text-[var(--adm-muted)]"> — {previewMeta}</span> : null}
        </p>
      ) : null}

      {error ? <AdminAlert message={error} /> : null}
    </div>
  );
}
