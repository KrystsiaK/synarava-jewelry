"use client";

import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import type { ReactNode } from "react";

import {
  appendOrderedItem,
  moveOrderedItemDown,
  moveOrderedItemUp,
  removeOrderedItem,
} from "@/lib/admin/ordered-ids";
import { AdminHelp } from "@/components/admin/shared/admin-help";
import { AdminIconButton } from "@/components/admin/shared/admin-icon-button";
import { cn } from "@/lib/ui";

export type AdminOrderedListItemControls = {
  index: number;
  moveUp: () => void;
  moveDown: () => void;
  remove: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  canRemove: boolean;
};

export type AdminOrderedListProps<T> = {
  /** Accessible list label. */
  label: ReactNode;
  help?: ReactNode;
  items: T[];
  onChange: (items: T[]) => void;
  getKey: (item: T, index: number) => string;
  /** Value written to each hidden input when `name` is set. */
  getValue?: (item: T, index: number) => string;
  /** Repeated form field name (`FormData.getAll(name)`). */
  name?: string;
  minItems?: number;
  maxItems?: number;
  renderItem: (item: T, controls: AdminOrderedListItemControls) => ReactNode;
  /** Factory for a new empty row when Add is pressed. */
  createItem?: () => T;
  addLabel?: string;
  /** Side up/down/remove strip. Set false when `renderItem` owns those actions (e.g. collapse trailing). */
  showItemControls?: boolean;
  className?: string;
};

/** Shared up / down / remove cluster — side strip or collapse `trailing`. */
export function AdminOrderedListItemActions({
  controls,
  className,
}: {
  controls: AdminOrderedListItemControls;
  className?: string;
}) {
  return (
    <span className={cn("adm-ordered-list__inline-controls", className)}>
      <AdminIconButton
        label="Move up"
        tooltip="Move up"
        disabled={!controls.canMoveUp}
        onClick={controls.moveUp}
      >
        <ChevronUp className="size-3.5" aria-hidden="true" strokeWidth={2} />
      </AdminIconButton>
      <AdminIconButton
        label="Move down"
        tooltip="Move down"
        disabled={!controls.canMoveDown}
        onClick={controls.moveDown}
      >
        <ChevronDown className="size-3.5" aria-hidden="true" strokeWidth={2} />
      </AdminIconButton>
      <AdminIconButton
        label="Remove"
        tooltip="Remove"
        tone="danger"
        disabled={!controls.canRemove}
        onClick={controls.remove}
      >
        <Trash2 className="size-3.5" aria-hidden="true" strokeWidth={2} />
      </AdminIconButton>
    </span>
  );
}

/**
 * Ordered list with up/down reorder controls.
 *
 * Reorder API is intentional: a future drag-and-drop strip can call the same
 * `onChange` / helpers without changing call sites. Prefer this over ad-hoc
 * arrow rows in entity editors.
 */
export function AdminOrderedList<T>({
  label,
  help,
  items,
  onChange,
  getKey,
  getValue,
  name,
  minItems = 1,
  maxItems,
  renderItem,
  createItem,
  addLabel = "Add item",
  showItemControls = true,
  className,
}: AdminOrderedListProps<T>) {
  const canAdd = Boolean(createItem) && (maxItems == null || items.length < maxItems);

  function moveUp(index: number) {
    onChange(moveOrderedItemUp(items, index));
  }

  function moveDown(index: number) {
    onChange(moveOrderedItemDown(items, index));
  }

  function remove(index: number) {
    onChange(removeOrderedItem(items, index, minItems));
  }

  function add() {
    if (!createItem || !canAdd) return;
    onChange(appendOrderedItem(items, createItem(), maxItems));
  }

  return (
    <div
      data-component="AdminOrderedList"
      className={cn("adm-ordered-list", className)}
    >
      <div className="adm-ordered-list__header">
        <span className="adm-label-row">
          <span className="adm-label">{label}</span>
          {help ? <AdminHelp>{help}</AdminHelp> : null}
        </span>
        {canAdd ? (
          <AdminIconButton label={addLabel} tooltip={addLabel} onClick={add}>
            <Plus className="size-3.5" aria-hidden="true" strokeWidth={2} />
          </AdminIconButton>
        ) : null}
      </div>

      <ul className="adm-ordered-list__rows" aria-label={typeof label === "string" ? label : undefined}>
        {items.map((item, index) => {
          const controls: AdminOrderedListItemControls = {
            index,
            moveUp: () => moveUp(index),
            moveDown: () => moveDown(index),
            remove: () => remove(index),
            canMoveUp: index > 0,
            canMoveDown: index < items.length - 1,
            canRemove: items.length > minItems,
          };
          const value = getValue?.(item, index) ?? "";

          return (
            <li
              key={getKey(item, index)}
              className={cn(
                "adm-ordered-list__row",
                !showItemControls && "adm-ordered-list__row--solo",
              )}
            >
              {name ? <input type="hidden" name={name} value={value} readOnly /> : null}
              <div className="adm-ordered-list__body">{renderItem(item, controls)}</div>
              {showItemControls ? (
                <div className="adm-ordered-list__controls">
                  <AdminOrderedListItemActions controls={controls} />
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
