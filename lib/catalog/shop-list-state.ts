import {
  defineListStateSchema,
  enumField,
  listStateToSearchString,
  optionalEnumField,
  optionalStringField,
  parseListState,
  type ListStateParamSource,
} from "@/lib/list-state";
import { SHOP_SORT_OPTIONS, type ShopSort } from "@/lib/catalog/shop-sort";

const SORT_VALUES = SHOP_SORT_OPTIONS.map((option) => option.value) as [
  ShopSort,
  ...ShopSort[],
];

/**
 * Storefront shop / collection catalog filters.
 * URL shapes must stay identical to the legacy `parseShopFilters` / `buildSearchParams`.
 * Pagination `cursor` / `limit` / `locale` are intentionally absent.
 */
export const shopListStateSchema = defineListStateSchema({
  q: optionalStringField({ key: "q" }),
  availability: optionalEnumField({ key: "availability", allowed: ["in-stock"] as const }),
  category: optionalStringField({ key: "category" }),
  productType: optionalStringField({ key: "productType" }),
  collection: optionalStringField({ key: "collection" }),
  tag: optionalStringField({ key: "tag" }),
  material: optionalStringField({ key: "material" }),
  finish: optionalStringField({ key: "finish" }),
  origin: optionalStringField({ key: "origin" }),
  certified: optionalStringField({ key: "certified" }),
  sort: enumField({
    key: "sort",
    defaultValue: "featured" as ShopSort,
    allowed: SORT_VALUES,
  }),
});

export type ShopListState = ReturnType<typeof parseShopListState>;

/**
 * Public filter bag used by shop UI props (partial OK).
 * Parsed list state always includes every key (sort defaults to featured).
 */
export type ShopFilters = {
  q?: string;
  availability?: "in-stock";
  category?: string;
  productType?: string;
  collection?: string;
  tag?: string;
  material?: string;
  finish?: string;
  origin?: string;
  certified?: string;
  sort?: ShopSort;
};

export function parseShopListState(source: ListStateParamSource) {
  return parseListState(shopListStateSchema, source);
}

export function serializeShopListState(state: ShopFilters): string {
  const full: ShopListState = {
    q: state.q,
    availability: state.availability,
    category: state.category,
    productType: state.productType,
    collection: state.collection,
    tag: state.tag,
    material: state.material,
    finish: state.finish,
    origin: state.origin,
    certified: state.certified,
    sort: state.sort ?? "featured",
  };
  return listStateToSearchString(shopListStateSchema, full);
}
