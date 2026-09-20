export const DEFAULT_HOME_EDIT_PRODUCT_TITLES = [
  "Golden Bird Brooch",
  "Hammered Half Moon Necklace",
  "Clementine Dachshund Bag Charm",
  "AAA Freshwater Pearl Necklace",
] as const;

type HomeEditProduct = {
  id: string;
  title: string;
  sourceTitle?: string;
  image: string;
};

export function resolveHomeEditProducts<T extends HomeEditProduct>(
  products: T[],
  selectedIds: string[] = [],
): T[] {
  const available = products.filter((product) => product.image);
  const byId = new Map(available.map((product) => [product.id, product]));
  const uniqueSelected = [...new Set(selectedIds)]
    .map((id) => byId.get(id))
    .filter((product): product is T => Boolean(product))
    .slice(0, 4);

  if (selectedIds.some(Boolean)) return uniqueSelected;

  const bySourceTitle = new Map(
    available.map((product) => [product.sourceTitle ?? product.title, product]),
  );
  const approvedDefault = DEFAULT_HOME_EDIT_PRODUCT_TITLES
    .map((title) => bySourceTitle.get(title))
    .filter((product): product is T => Boolean(product));

  return approvedDefault.length === 4 ? approvedDefault : available.slice(0, 4);
}
