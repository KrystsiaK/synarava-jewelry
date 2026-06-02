import type { Meta, StoryObj } from "@storybook/react";
import { FilterBar } from "./filter-bar";

const categories = [
  { value: "bracelets", label: "Bracelets" },
  { value: "necklaces", label: "Necklaces" },
  { value: "earrings", label: "Earrings" },
];
const collections = [
  { value: "heritage", label: "Heritage" },
  { value: "earth", label: "Eco Earth" },
  { value: "alchemist", label: "The Alchemist" },
];
const tags = [
  { value: "oak", label: "Oak Wood" },
  { value: "lava", label: "Lava Stone" },
  { value: "brass", label: "Raw Brass" },
];

const meta = {
  title: "Shop/FilterBar",
  component: FilterBar,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: { categories, collections, tags, totalCount: 12 },
} satisfies Meta<typeof FilterBar>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Default state — no active filters */
export const Default: Story = {
  args: { initialFilters: {} },
};

/** Single active filter */
export const WithCategory: Story = {
  args: { initialFilters: { category: "bracelets" }, totalCount: 4 },
};

/** Multiple active filters with chips */
export const MultipleFilters: Story = {
  args: {
    initialFilters: { category: "bracelets", collection: "heritage" },
    totalCount: 2,
  },
};

/** Active search query */
export const WithSearch: Story = {
  args: { initialFilters: { q: "oak carved" }, totalCount: 3 },
};

/** All filters active at once */
export const AllActive: Story = {
  args: {
    initialFilters: { q: "carved", category: "bracelets", collection: "heritage", tag: "oak" },
    totalCount: 1,
  },
};

/** Zero results state */
export const EmptyResults: Story = {
  args: {
    initialFilters: { category: "rings", q: "platinum" },
    totalCount: 0,
  },
};

/** Mobile viewport */
export const Mobile: Story = {
  args: { initialFilters: {}, totalCount: 12 },
  parameters: {
    viewport: { defaultViewport: "mobile1" },
    layout: "fullscreen",
  },
  decorators: [(Story) => <div className="p-4"><Story /></div>],
};

/** Mobile with active filters */
export const MobileWithFilters: Story = {
  args: { initialFilters: { category: "bracelets", tag: "oak" }, totalCount: 3 },
  parameters: {
    viewport: { defaultViewport: "mobile1" },
    layout: "fullscreen",
  },
  decorators: [(Story) => <div className="p-4"><Story /></div>],
};
