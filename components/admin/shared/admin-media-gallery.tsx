"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { useId, useRef, useState, type ReactNode } from "react";

import { AdminConfirmModal } from "@/components/admin/shared/admin-confirm-modal";
import { AdminIconButton } from "@/components/admin/shared/admin-icon-button";
import { AdminButton, AdminTextField } from "@/components/synarava-cms";
import { imageAltSoftWarning } from "@/lib/seo/image-alt-checklist";
import { cn } from "@/lib/ui";

export type AdminMediaGalleryItem = {
  id: string;
  url: string;
  alt: string;
  /** Pending local upload not yet pushed to Shopify. */
  pendingUpload?: boolean;
};

export type AdminMediaGalleryProps = {
  label?: ReactNode;
  description?: ReactNode;
  items: AdminMediaGalleryItem[];
  disabled?: boolean;
  addLabel?: string;
  emptyLabel?: ReactNode;
  accept?: string;
  multiple?: boolean;
  onAdd?: (files: FileList) => void;
  onMove?: (frameId: string, toIndex: number) => void;
  onRemove?: (frameId: string) => void;
  onSetCover?: (frameId: string) => void;
  onAlt?: (frameId: string, alt: string) => void;
  className?: string;
};

/**
 * Shared admin media gallery — one chrome for every product (and future entity) gallery.
 * Ops identify frames by id, never by ephemeral array index in the caller contract.
 */
export function AdminMediaGallery({
  label = "Product gallery",
  description,
  items,
  disabled = false,
  addLabel = "Add images",
  emptyLabel = "No gallery images yet. Add images to build the product gallery.",
  accept = "image/jpeg,image/png,image/webp,image/avif",
  multiple = true,
  onAdd,
  onMove,
  onRemove,
  onSetCover,
  onAlt,
  className,
}: AdminMediaGalleryProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const addInputId = useId();
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

  function requestRemove(frameId: string) {
    if (items.length <= 1) {
      setConfirmRemoveId(frameId);
      return;
    }
    onRemove?.(frameId);
  }

  return (
    <section
      data-component="AdminMediaGallery"
      className={cn("grid gap-4 border border-[var(--adm-border)] p-4", className)}
      aria-label={typeof label === "string" ? label : "Media gallery"}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="adm-label">{label}</p>
          {description ? (
            <div className="mt-1 text-xs text-[var(--adm-muted)]">{description}</div>
          ) : null}
        </div>
        {onAdd ? (
          <label
            htmlFor={addInputId}
            className={cn(
              "adm-btn-ghost focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--adm-focus)]",
              disabled ? "pointer-events-none opacity-60" : "cursor-pointer",
            )}
          >
            {disabled ? "Uploading…" : addLabel}
            <input
              id={addInputId}
              ref={inputRef}
              type="file"
              accept={accept}
              multiple={multiple}
              className="sr-only"
              disabled={disabled}
              onChange={(event) => {
                const files = event.target.files;
                if (files?.length) onAdd(files);
                if (inputRef.current) inputRef.current.value = "";
              }}
            />
          </label>
        ) : null}
      </div>

      {items.length > 0 ? (
        <ul className="grid list-none gap-3 p-0 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item, index) => {
            const cover = index === 0;
            const altWarning = imageAltSoftWarning(item.alt) ?? undefined;
            return (
              <li key={item.id}>
                <article className="grid gap-3 border border-[var(--adm-border)] p-3">
                  <div className="relative aspect-square overflow-hidden bg-[var(--adm-bg-soft)]">
                    <Image
                      src={item.url}
                      alt={item.alt || "Gallery image"}
                      fill
                      sizes="(max-width: 640px) 100vw, 320px"
                      className="object-cover"
                    />
                    <span className="absolute left-2 top-2 bg-[var(--adm-ink)] px-2 py-1 text-[0.62rem] font-bold uppercase tracking-wider text-[var(--adm-bg)]">
                      {cover ? "01 · Cover" : String(index + 1).padStart(2, "0")}
                    </span>
                    {item.pendingUpload ? (
                      <span className="absolute bottom-2 left-2 bg-[var(--adm-panel)] px-2 py-1 text-[0.62rem] font-bold uppercase tracking-wider text-[var(--adm-ink)]">
                        Will upload
                      </span>
                    ) : null}
                  </div>
                  <AdminTextField
                    label="Alt text"
                    defaultValue={item.alt}
                    owner="Shopify"
                    help="Short description of what the image shows. Avoid filenames."
                    warning={altWarning}
                    // Keep alt editable while a sibling frame op is in flight (leave-guard / blur-save).
                    onBlur={(event) => {
                      if (event.currentTarget.value.trim() === item.alt.trim()) return;
                      onAlt?.(item.id, event.currentTarget.value);
                    }}
                  />
                  <div className="flex flex-wrap gap-2">
                    {onMove ? (
                      <>
                        <AdminIconButton
                          label="Move left"
                          tooltip="Move left"
                          disabled={disabled || index === 0}
                          onClick={() => onMove(item.id, index - 1)}
                        >
                          <ChevronLeft className="size-3.5" aria-hidden="true" strokeWidth={2} />
                        </AdminIconButton>
                        <AdminIconButton
                          label="Move right"
                          tooltip="Move right"
                          disabled={disabled || index === items.length - 1}
                          onClick={() => onMove(item.id, index + 1)}
                        >
                          <ChevronRight className="size-3.5" aria-hidden="true" strokeWidth={2} />
                        </AdminIconButton>
                      </>
                    ) : null}
                    {onSetCover && !cover ? (
                      <AdminButton
                        variant="ghost"
                        className="min-h-9 px-3"
                        disabled={disabled}
                        onClick={() => onSetCover(item.id)}
                      >
                        Move to first
                      </AdminButton>
                    ) : null}
                    {onRemove ? (
                      <AdminIconButton
                        label="Remove"
                        tooltip="Remove"
                        tone="danger"
                        disabled={disabled}
                        onClick={() => requestRemove(item.id)}
                      >
                        <Trash2 className="size-3.5" aria-hidden="true" strokeWidth={2} />
                      </AdminIconButton>
                    ) : null}
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-[var(--adm-muted)]">{emptyLabel}</p>
      )}

      <AdminConfirmModal
        open={confirmRemoveId != null}
        title="Remove last gallery image?"
        description="This is the last gallery image. Remove it? Push will delete all product media in Shopify."
        confirmLabel="Remove image"
        tone="danger"
        onCancel={() => setConfirmRemoveId(null)}
        onConfirm={() => {
          const id = confirmRemoveId;
          setConfirmRemoveId(null);
          if (id) onRemove?.(id);
        }}
      />
    </section>
  );
}
