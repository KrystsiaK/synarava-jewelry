"use client";

import { useId, useMemo, useState } from "react";

import {
  AI_FIELDS,
  AI_LOCALES,
  STALE_APPLY_MESSAGE,
  buildDefaultSelections,
  fieldLabel,
  formatUsageLine,
  isAiDraftStale,
  isEnTitle,
  selectionKey,
  type AiFieldSelectionKey,
} from "@/components/admin/products/ai-content-apply";
import {
  AdminButton,
  AdminCheckboxControl,
  AdminModal,
} from "@/components/synarava-cms";
import { RichText } from "@/components/content/rich-text";
import type {
  AiField,
  AiLocale,
  ProductContentDraft,
} from "@/lib/ai/product-content/contract";

export type AiContentPreviewModalProps = {
  open: boolean;
  draft: ProductContentDraft | null;
  productUpdatedAt: string;
  fingerprintAtGenerate: string;
  fingerprintNow: string;
  getCurrent: (locale: AiLocale, field: AiField) => string;
  onClose: () => void;
  onApply: (selected: ReadonlySet<AiFieldSelectionKey>) => void;
};

function CurrentProposed({
  current,
  proposed,
}: {
  current: string;
  proposed: string;
}) {
  return (
    <div className="grid gap-2 text-xs md:grid-cols-2">
      <div>
        <p className="adm-section-tag mb-1">Current</p>
        <div className="min-h-10 border border-[var(--adm-border)] bg-[var(--adm-bg-soft)] p-2 text-[var(--adm-muted)]">
          {current.trim() ? (
            <RichText content={current} className="text-xs text-[var(--adm-ink)]" />
          ) : (
            <span>(empty)</span>
          )}
        </div>
      </div>
      <div>
        <p className="adm-section-tag mb-1">Proposed</p>
        <div className="min-h-10 border border-[var(--adm-border)] bg-[var(--adm-bg)] p-2">
          {proposed.trim() ? (
            <RichText content={proposed} className="text-xs text-[var(--adm-ink)]" />
          ) : (
            <span className="text-[var(--adm-muted)]">(empty)</span>
          )}
        </div>
      </div>
    </div>
  );
}

function PreviewBody({
  draft,
  stale,
  getCurrent,
  onClose,
  onApply,
}: {
  draft: ProductContentDraft;
  stale: boolean;
  getCurrent: (locale: AiLocale, field: AiField) => string;
  onClose: () => void;
  onApply: (selected: ReadonlySet<AiFieldSelectionKey>) => void;
}) {
  const [selected, setSelected] = useState(() => buildDefaultSelections(draft, getCurrent));

  const warningsByKey = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const warning of draft.warnings) {
      const key = selectionKey(warning.locale, warning.field);
      const list = map.get(key) ?? [];
      list.push(warning.message);
      map.set(key, list);
    }
    return map;
  }, [draft.warnings]);

  function toggle(key: AiFieldSelectionKey, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  return (
    <>
      {stale ? (
        <p
          role="alert"
          className="text-sm text-[var(--adm-danger)]"
          data-testid="ai-content-stale"
        >
          {STALE_APPLY_MESSAGE}
        </p>
      ) : null}

      <div className="grid gap-4">
        {AI_LOCALES.map((locale) => {
          const localeDraft = draft.locales[locale];
          if (!localeDraft) return null;
          const rows = AI_FIELDS.filter((field) => {
            if (isEnTitle(locale, field)) return false;
            return localeDraft[field] != null;
          });
          if (rows.length === 0) return null;
          return (
            <section key={locale} className="grid gap-3" aria-label={`${locale} fields`}>
              <p className="adm-section-tag">[ {locale.toUpperCase()} ]</p>
              {rows.map((field) => {
                const key = selectionKey(locale, field);
                const proposed = localeDraft[field] ?? "";
                const current = getCurrent(locale, field);
                const warnings = warningsByKey.get(key) ?? [];
                const checkboxId = `ai-preview-${locale}-${field}`;
                return (
                  <div
                    key={key}
                    className="grid gap-2 border border-[var(--adm-border)] p-3"
                    data-testid={`ai-preview-row-${locale}-${field}`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <AdminCheckboxControl
                        id={checkboxId}
                        label={fieldLabel(field)}
                        checked={selected.has(key)}
                        onChange={(event) => toggle(key, event.target.checked)}
                        disabled={stale}
                      />
                      {warnings.length > 0 ? (
                        <p
                          className="text-xs text-[orange]"
                          data-testid={`ai-preview-warning-${locale}-${field}`}
                        >
                          {warnings.join(" · ")}
                        </p>
                      ) : null}
                    </div>
                    <CurrentProposed current={current} proposed={proposed} />
                  </div>
                );
              })}
            </section>
          );
        })}
      </div>

      <div className="mt-2 flex flex-wrap justify-end gap-2">
        <AdminButton variant="ghost" onClick={onClose}>
          Cancel
        </AdminButton>
        <AdminButton
          variant="primary"
          disabled={stale || selected.size === 0}
          onClick={() => onApply(selected)}
          data-testid="ai-content-apply"
        >
          Apply to form
        </AdminButton>
      </div>
    </>
  );
}

/**
 * Preview modal for AI product content drafts.
 * Apply writes only into caller-owned form state — never save/push.
 */
export function AiContentPreviewModal({
  open,
  draft,
  productUpdatedAt,
  fingerprintAtGenerate,
  fingerprintNow,
  getCurrent,
  onClose,
  onApply,
}: AiContentPreviewModalProps) {
  const titleId = useId();
  const stale = Boolean(
    draft
    && isAiDraftStale({
      productUpdatedAt,
      draftSourceUpdatedAt: draft.sourceUpdatedAt,
      fingerprintAtGenerate,
      fingerprintNow,
    }),
  );

  return (
    <AdminModal
      open={open && Boolean(draft)}
      onClose={onClose}
      ariaLabelledBy={titleId}
      className="grid max-h-[min(90vh,52rem)] w-full max-w-3xl gap-3 overflow-y-auto p-6"
    >
      {draft ? (
        <>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 id={titleId} className="adm-title-sm">
                AI content preview
              </h2>
              <p className="mt-1 text-xs text-[var(--adm-muted)]">
                Choose fields to copy into the form. Save remains separate.
              </p>
            </div>
            <p className="text-[0.7rem] text-[var(--adm-muted)]" data-testid="ai-content-usage">
              {formatUsageLine(draft.usage)}
            </p>
          </div>
          <PreviewBody
            key={`${draft.productId}-${draft.sourceUpdatedAt}`}
            draft={draft}
            stale={stale}
            getCurrent={getCurrent}
            onClose={onClose}
            onApply={onApply}
          />
        </>
      ) : null}
    </AdminModal>
  );
}
