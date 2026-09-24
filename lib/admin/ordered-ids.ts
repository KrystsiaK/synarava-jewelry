/**
 * Pure reorder helpers for AdminOrderedList.
 * Drag-and-drop can call the same moveOrderedItem later.
 */

export function moveOrderedItem<T>(items: readonly T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) {
    return [...items];
  }
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function moveOrderedItemUp<T>(items: readonly T[], index: number): T[] {
  return moveOrderedItem(items, index, index - 1);
}

export function moveOrderedItemDown<T>(items: readonly T[], index: number): T[] {
  return moveOrderedItem(items, index, index + 1);
}

export function removeOrderedItem<T>(items: readonly T[], index: number, minItems = 0): T[] {
  if (items.length <= minItems) return [...items];
  return items.filter((_, i) => i !== index);
}

export function appendOrderedItem<T>(items: readonly T[], item: T, maxItems?: number): T[] {
  if (maxItems != null && items.length >= maxItems) return [...items];
  return [...items, item];
}
