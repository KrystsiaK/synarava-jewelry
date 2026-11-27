"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import { useId, useRef, type ReactNode } from "react";

import { AdminIconButton } from "@/components/admin/shared/admin-icon-button";
import { cn } from "@/lib/ui";

export type AdminMediaTileItem = {
  id: string;
  url: string;
  alt?: string;
};

export type AdminMediaTilesProps = {
  items: AdminMediaTileItem[];
  disabled?: boolean;
  addLabel?: string;
  emptyHint?: ReactNode;
  accept?: string;
  onAdd?: (file: File) => void;
  onMove?: (id: string, direction: "left" | "right") => void;
  onRemove?: (id: string) => void;
  className?: string;
};

const TILE =
  "relative aspect-square w-full overflow-hidden rounded-[var(--adm-radius)] border border-[var(--adm-border)] bg-[var(--adm-bg-soft)]";
const HIT = "min-h-11 min-w-11 !h-11 !w-11 !min-h-11 !min-w-11";

/**
 * Compact equal-size media tiles + matching “Add” tile.
 * Shared chrome for pairing photos and similar galleries — not the full
 * product AdminMediaGallery (alt / cover / multi-upload).
 */
export function AdminMediaTiles({
  items,
  disabled = false,
  addLabel = "Add photo",
  emptyHint = "No photos yet. Add a photo to show this pair on the product page.",
  accept = "image/jpeg,image/png,image/webp,image/avif",
  onAdd,
  onMove,
  onRemove,
  className,
}: AdminMediaTilesProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const addInputId = useId();

  return (
    <div data-component="AdminMediaTiles" className={cn("space-y-2", className)}>
      <ul className="grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {items.map((item, index) => (
          <li key={item.id} className="min-w-0">
            <div className={TILE}>
              <Image
                src={item.url}
                alt={item.alt || ""}
                fill
                sizes="120px"
                className="object-cover"
              />
            </div>
            <div className="mt-1 flex items-center justify-center gap-0.5">
              {onMove ? (
                <>
                  <AdminIconButton
                    label="Move left"
                    tooltip="Move left"
                    className={HIT}
                    disabled={disabled || index === 0}
                    onClick={() => onMove(item.id, "left")}
                  >
                    <ChevronLeft className="size-4" aria-hidden="true" strokeWidth={2} />
                  </AdminIconButton>
                  <AdminIconButton
                    label="Move right"
                    tooltip="Move right"
                    className={HIT}
                    disabled={disabled || index === items.length - 1}
                    onClick={() => onMove(item.id, "right")}
                  >
                    <ChevronRight className="size-4" aria-hidden="true" strokeWidth={2} />
                  </AdminIconButton>
                </>
              ) : null}
              {onRemove ? (
                <AdminIconButton
                  label="Remove photo"
                  tooltip="Remove photo"
                  tone="danger"
                  className={HIT}
                  disabled={disabled}
                  onClick={() => onRemove(item.id)}
                >
                  <Trash2 className="size-4" aria-hidden="true" strokeWidth={2} />
                </AdminIconButton>
              ) : null}
            </div>
          </li>
        ))}

        {onAdd ? (
          <li className="min-w-0">
            <label
              htmlFor={addInputId}
              className={cn(
                TILE,
                "grid place-items-center text-center text-xs font-semibold uppercase tracking-[0.1em] text-[var(--adm-muted)] focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--adm-focus)]",
                disabled ? "pointer-events-none opacity-60" : "cursor-pointer hover:border-[var(--adm-border-strong)] hover:text-[var(--adm-ink)]",
              )}
            >
              <span className="flex flex-col items-center gap-1 px-2">
                <Plus className="size-5" aria-hidden="true" strokeWidth={1.75} />
                {disabled ? "Uploading…" : addLabel}
              </span>
              <input
                id={addInputId}
                ref={inputRef}
                type="file"
                accept={accept}
                className="sr-only"
                disabled={disabled}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) onAdd(file);
                  if (inputRef.current) inputRef.current.value = "";
                }}
              />
            </label>
            {/* Spacer matches control row under photo tiles */}
            <div className="mt-1 h-11" aria-hidden="true" />
          </li>
        ) : null}
      </ul>

      {items.length === 0 ? (
        <p className="text-xs text-[var(--adm-muted)]">{emptyHint}</p>
      ) : null}
    </div>
  );
}
