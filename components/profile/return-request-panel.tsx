"use client";

import { useState } from "react";

import { useTranslations } from "@/lib/i18n/context";
import { ArtifactButton } from "@/components/ui";

type ReturnableLineItem = {
  quantity: number;
  lineItem: { id: string; name: string };
};

export function ReturnRequestPanel({
  orderId,
  returnableLineItems,
}: {
  orderId: string;
  returnableLineItems: ReturnableLineItem[];
}) {
  const { t } = useTranslations();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  if (returnableLineItems.length === 0) return null;

  function toggleItem(lineItemId: string) {
    setSelected((current) => {
      const next = { ...current };
      if (lineItemId in next) delete next[lineItemId];
      else next[lineItemId] = 1;
      return next;
    });
  }

  function setQuantity(lineItemId: string, quantity: number, maxQuantity: number) {
    const clamped = Math.min(Math.max(1, quantity), maxQuantity);
    setSelected((current) => ({ ...current, [lineItemId]: clamped }));
  }

  async function submit() {
    const lineItems = Object.entries(selected).map(([lineItemId, quantity]) => ({ lineItemId, quantity }));
    if (lineItems.length === 0) return;

    setPending(true);
    setResult(null);
    try {
      const response = await fetch("/api/orders/return", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, lineItems }),
      });
      const payload = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        // payload.error may be Shopify's own dynamic rejection reason (e.g. "This
        // item is not eligible for return"), which has no stable code to map to a
        // translation — shown as-is, with our own generic message as the fallback.
        setResult({ ok: false, message: payload.error || t("profile.returns.genericFailed") });
        return;
      }
      setResult({ ok: true, message: t("profile.returns.success") });
      setSelected({});
      setOpen(false);
    } catch {
      setResult({ ok: false, message: t("profile.returns.genericFailed") });
    } finally {
      setPending(false);
    }
  }

  if (result?.ok) {
    return <p className="mt-4 text-sm text-foreground/60">{result.message}</p>;
  }

  return (
    <div className="mt-4 border-t border-stroke pt-4">
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="label-caps text-couture-red">
          {t("profile.returns.request")}
        </button>
      ) : (
        <div className="space-y-3">
          {returnableLineItems.map(({ lineItem, quantity: maxQuantity }) => {
            const isSelected = lineItem.id in selected;
            return (
              <div key={lineItem.id} className="flex flex-wrap items-center justify-between gap-3">
                <label className="flex min-w-0 items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleItem(lineItem.id)}
                    className="size-4"
                  />
                  <span className="truncate">{lineItem.name}</span>
                </label>
                {isSelected && maxQuantity > 1 ? (
                  <input
                    type="number"
                    min={1}
                    max={maxQuantity}
                    value={selected[lineItem.id]}
                    onChange={(event) => setQuantity(lineItem.id, Number(event.target.value), maxQuantity)}
                    className="w-16 border border-stroke px-2 py-1 text-sm"
                    aria-label={t("profile.returns.quantityAria", { name: lineItem.name })}
                  />
                ) : null}
              </div>
            );
          })}
          {result && !result.ok ? <p className="text-sm text-couture-red">{result.message}</p> : null}
          <div className="flex flex-wrap gap-3 pt-1">
            <ArtifactButton
              type="button"
              onClick={submit}
              disabled={pending || Object.keys(selected).length === 0}
              size="md"
            >
              {pending ? t("profile.returns.submitting") : t("profile.returns.submit")}
            </ArtifactButton>
            <button
              type="button"
              onClick={() => { setOpen(false); setSelected({}); setResult(null); }}
              className="label-caps border border-stroke px-5 py-3 hover:border-foreground/50"
            >
              {t("profile.returns.cancel")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
